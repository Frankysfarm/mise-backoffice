/**
 * POST /api/driver/v1/internal/push-flush
 *
 * Cron-Endpoint (jede Minute aus mise_cron Container).
 *
 * Phase 4 (2026-05-06): VoIP-First Push-Strategy.
 *  - Bei Bundle-Assignment-Pushes (type='assign'):
 *      → Wenn Driver iOS-VoIP-Token hat: APNs VoIP-Push senden (klingelt durch wie Uber)
 *      → Fallback zu Expo-Push wenn VoIP fehlschlägt oder Token tot
 *  - Bei allen anderen Pushes: Expo-Push wie bisher.
 *
 * Token-Hygiene: APNs-Response 410/Unregistered → voip_push_token wird genullt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sb } from '../../_lib/driver-auth';
import { sendVoipPush } from '@/lib/apns-voip';
import { sendAlertPush, isApnsAlertConfigured } from '@/lib/apns-alert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface OutboxRow {
  id: string;
  driver_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  sound: string | null;
  priority: string | null;
  attempts: number;
}

interface DriverShortRow {
  expo_push_token: string | null;
  voip_push_token: string | null;
  push_enabled: boolean;
  last_active_at: string | null;
  last_foreground_at: string | null;
}

async function driverHasWebPushChannel(
  c: ReturnType<typeof sb>,
  driverId: string,
): Promise<boolean> {
  const { data: drv } = await c
    .from('mise_drivers')
    .select('auth_user_id')
    .eq('id', driverId)
    .maybeSingle();
  if (!drv?.auth_user_id) return false;
  const { data: emp } = await c
    .from('employees')
    .select('id')
    .eq('auth_user_id', drv.auth_user_id)
    .maybeSingle();
  if (!emp?.id) return false;
  const { count } = await c
    .from('driver_push_subscriptions')
    .select('id', { head: true, count: 'exact' })
    .eq('employee_id', emp.id);
  return (count ?? 0) > 0;
}

async function requeueFailedAssignment(
  c: ReturnType<typeof sb>,
  row: Pick<OutboxRow, 'driver_id' | 'type' | 'data'>,
  reason: string,
): Promise<void> {
  const isAssign = row.type === 'order_assigned' || row.type === 'assign';
  const batchId = typeof row.data?.batch_id === 'string' ? row.data.batch_id : null;
  if (!isAssign || !batchId) return;

  // Fahrer mit offener App sieht das Angebot per Polling/Realtime — ein defekter
  // Push-Kanal darf ihm die Tour dann NICHT wegnehmen (live 14.08.: ungültiger
  // Token stornierte jede Tour Sekunden nach dem Anbieten, App blieb leer).
  // Ohne App-Kontakt bleibt es beim Requeue, damit die Tour zum nächsten Fahrer geht.
  const { data: drv } = await c
    .from('mise_drivers')
    .select('last_foreground_at')
    .eq('id', row.driver_id)
    .maybeSingle();
  const lastForeground = drv?.last_foreground_at
    ? new Date(drv.last_foreground_at as string).getTime()
    : 0;
  if (Date.now() - lastForeground < 120_000) return;
  const { error } = await c.rpc('requeue_delivery_batch', {
    p_batch_id: batchId,
    p_reason: `push_failure:${reason}`.slice(0, 500),
    p_exclude_minutes: 15,
  });
  if (error) throw new Error(`assignment requeue failed: ${error.message}`);
}

export async function POST(req: NextRequest) {
  const expected = process.env.BISS_INTERNAL_TOKEN;
  let provided: string | null = null;
  try {
    const body = (await req.json()) as { internal_token?: string };
    provided = body.internal_token ?? null;
  } catch {
    /* leerer body ok */
  }
  if (!provided) provided = req.headers.get('x-internal-token');
  if (!expected || expected.length < 16 || provided !== expected) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const c = sb();

  const { data: pending } = await c
    .from('mise_push_outbox')
    .select(
      'id, driver_id, type, title, body, data, sound, priority, attempts, drivers:driver_id(expo_push_token,voip_push_token,push_enabled,last_active_at,last_foreground_at)',
    )
    .is('sent_at', null)
    .is('failed_at', null)
    .lt('attempts', 5)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0, voip: 0, expo: 0 });
  }

  const expoBatch: Array<{
    outboxId: string;
    message: {
      to: string;
      title: string;
      body: string;
      data: Record<string, unknown>;
      sound: string;
      priority: string;
      channelId: string;
    };
  }> = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let voipCount = 0;
  let expoCount = 0;

  type Row = OutboxRow & { drivers: DriverShortRow | null };

  for (const row of pending as unknown as Row[]) {
    const drv = row.drivers;
    const isAssign = row.type === 'order_assigned' || row.type === 'assign';
    const assignmentBatchId =
      typeof row.data?.batch_id === 'string' ? row.data.batch_id : null;
    const enabled = drv?.push_enabled ?? true;
    if (!enabled) {
      // Browser-Fahrer: Assignment ging bereits über driver_push_outbox (Web-Push) raus —
      // der fehlende Native-Kanal darf die Tour dann nicht stornieren.
      const hasWebChannel = await driverHasWebPushChannel(c, row.driver_id);
      if (!hasWebChannel) await requeueFailedAssignment(c, row, 'push_enabled=false');
      await c
        .from('mise_push_outbox')
        .update({
          failed_at: new Date().toISOString(),
          fail_reason: hasWebChannel ? 'webpush-channel-active' : 'push_enabled=false',
        })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    // Fahrer gerade aktiv in der App? -> Realtime zeigt die Order live -> KEIN Anruf/Push
    const lastForeground = drv?.last_foreground_at ? new Date(drv.last_foreground_at).getTime() : 0;
    if (Date.now() - lastForeground < 25_000) {
      await c
        .from('mise_push_outbox')
        .update({ sent_at: new Date().toISOString(), fail_reason: 'skip-foreground' })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    // 1) VoIP-First für Bundle-Assignments
    // Outbox-Einträge können einen Batch-Rollback oder eine Stornierung
    // überleben. Vor einem Assignment-Push immer den Live-Zustand prüfen,
    // damit niemals eine alte/abgebrochene Tour beim Fahrer klingelt.
    if (isAssign && assignmentBatchId) {
      const { data: liveBatch, error: liveBatchError } = await c
        .from('mise_delivery_batches')
        .select('id,state,driver_id')
        .eq('id', assignmentBatchId)
        .maybeSingle();
      if (liveBatchError) {
        console.error('[driver/push-flush] batch validation failed', liveBatchError);
        return NextResponse.json({ error: 'push batch validation failed' }, { status: 500 });
      }
      if (
        !liveBatch ||
        liveBatch.driver_id !== row.driver_id ||
        ['cancelled', 'completed', 'expired'].includes(liveBatch.state as string)
      ) {
        await c
          .from('mise_push_outbox')
          .update({
            failed_at: new Date().toISOString(),
            fail_reason: !liveBatch ? 'stale-batch-missing' : `stale-batch-${liveBatch.state}`,
          })
          .eq('id', row.id);
        skipped++;
        continue;
      }
    }

    // VoIP (= eingehender Anruf-Bildschirm) ist per Founder-Entscheidung 14.08. aus:
    // Touren kommen als normale Push-Mitteilung. Über DELIVERY_VOIP_PUSH_ENABLED=true
    // wieder aktivierbar, ohne Code-Änderung.
    const voipEnabled = process.env.DELIVERY_VOIP_PUSH_ENABLED === 'true';
    if (voipEnabled && isAssign && drv?.voip_push_token) {
      const data = (row.data ?? {}) as Record<string, unknown>;
      let r: Awaited<ReturnType<typeof sendVoipPush>>;
      try {
        r = await sendVoipPush(drv.voip_push_token, {
          batch_id: typeof data.batch_id === 'string' ? data.batch_id : '',
          order_count: typeof data.order_count === 'number' ? data.order_count : 1,
          restaurant_name: typeof data.restaurant_name === 'string' ? data.restaurant_name : 'Bestellung',
          distance_km: typeof data.distance_km === 'number' ? data.distance_km : null,
          payout_eur: typeof data.payout_eur === 'number' ? data.payout_eur : null,
          reason_text: row.body,
          decision_id: typeof data.decision_id === 'string' ? data.decision_id : undefined,
        });
      } catch (error) {
        r = {
          ok: false,
          error: error instanceof Error ? error.message : 'voip push failed',
        };
      }
      if (r.ok) {
        await c
          .from('mise_push_outbox')
          .update({
            sent_at: new Date().toISOString(),
            fail_reason: 'voip-ok',
          })
          .eq('id', row.id);
        sent++;
        voipCount++;
        continue;
      }
      // Token tot? -> in DB nullen
      if (r.tokenDead) {
        await c
          .from('mise_drivers')
          .update({ voip_push_token: null, voip_push_token_updated_at: new Date().toISOString() })
          .eq('id', row.driver_id);
      }
      // Egal welcher Fehler — fall back auf Expo wenn vorhanden
      // (kein continue → es geht in den Expo-Block unten)
    }

    // 1b) APNs-Alert fuer rohe Device-Tokens (Capacitor-App, 64-Hex statt Expo-Token)
    const rawTok = drv?.expo_push_token;
    const isExpoTok = typeof rawTok === 'string' && /^Expo(nent)?PushToken\[/.test(rawTok);
    if (rawTok && !isExpoTok && /^[0-9a-fA-F]{64}$/.test(rawTok) && isApnsAlertConfigured()) {
      const r = await sendAlertPush(rawTok, {
        title: row.title,
        body: row.body,
        // Custom sound muss im nativen Bundle liegen (alarm.caf wird im
        // TestFlight-Workflow als Resource verifiziert). Nicht hier wieder auf
        // den iOS-Default ueberschreiben.
        sound: row.sound ?? 'default',
        data: (row.data ?? {}) as Record<string, unknown>,
      });
      if (r.ok) {
        await c.from('mise_push_outbox').update({ sent_at: new Date().toISOString(), fail_reason: 'apns-alert-ok' }).eq('id', row.id);
        sent++;
        continue;
      }
      if (r.tokenDead) {
        await c.from('mise_drivers').update({ expo_push_token: null, push_token_updated_at: new Date().toISOString() }).eq('id', row.driver_id);
      }
      await requeueFailedAssignment(c, row, r.error ?? 'apns-alert-fail');
      await c.from('mise_push_outbox').update({ failed_at: new Date().toISOString(), fail_reason: r.error ?? 'apns-alert-fail' }).eq('id', row.id);
      skipped++;
      continue;
    }

    // 2) Expo-Push (Standard oder Fallback)
    const expoToken = drv?.expo_push_token;
    if (!expoToken) {
      const hasWebChannel = await driverHasWebPushChannel(c, row.driver_id);
      if (!hasWebChannel) await requeueFailedAssignment(c, row, 'no expo token');
      await c
        .from('mise_push_outbox')
        .update({
          failed_at: new Date().toISOString(),
          fail_reason: hasWebChannel ? 'webpush-channel-active' : 'no expo token',
        })
        .eq('id', row.id);
      skipped++;
      continue;
    }
    expoBatch.push({
      outboxId: row.id,
      message: {
        to: expoToken,
        title: row.title,
        body: row.body,
        data: row.data,
        sound: row.sound ?? 'default',
        priority: row.priority ?? 'high',
        channelId: 'orders',
      },
    });
    expoCount++;
  }

  // Expo-Batch einschicken
  if (expoBatch.length > 0) {
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(expoBatch.map((b) => b.message)),
      });
      const json = (await res.json()) as { data?: Array<{ status: string; message?: string }> };
      const tickets = Array.isArray(json.data) ? json.data : [];
      for (let i = 0; i < expoBatch.length; i++) {
        const ticket = tickets[i];
        const outboxId = expoBatch[i].outboxId;
        if (!ticket) {
          const row = pending.find((p: OutboxRow) => p.id === outboxId);
          const newAttempts = (row?.attempts ?? 0) + 1;
          if (row) await requeueFailedAssignment(c, row, 'expo-ticket-missing');
          await c
            .from('mise_push_outbox')
            .update({
              attempts: newAttempts,
              fail_reason: 'expo-ticket-missing',
              failed_at: new Date().toISOString(),
            })
            .eq('id', outboxId);
          failed++;
          continue;
        }
        if (ticket.status === 'ok') {
          await c
            .from('mise_push_outbox')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', outboxId);
          sent++;
        } else {
          const row = pending.find((p: OutboxRow) => p.id === outboxId);
          const newAttempts = (row?.attempts ?? 0) + 1;
          if (row) await requeueFailedAssignment(c, row, ticket.message ?? 'expo-ticket-failed');
          await c
            .from('mise_push_outbox')
            .update({
              attempts: newAttempts,
              fail_reason: ticket.message ?? 'unknown',
              failed_at: newAttempts >= 5 ? new Date().toISOString() : null,
            })
            .eq('id', outboxId);
          failed++;
        }
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'expo transport failed';
      // A transport-level failure has no ticket to reconcile later. Release all
      // assignment batches immediately; the Smart writer retries another
      // eligible driver and the DB transaction raises the per-order alert.
      for (const entry of expoBatch) {
        const row = pending.find((p: OutboxRow) => p.id === entry.outboxId);
        if (!row) continue;
        try {
          await requeueFailedAssignment(c, row, `expo-transport:${reason}`);
          await c
            .from('mise_push_outbox')
            .update({
              attempts: (row.attempts ?? 0) + 1,
              fail_reason: reason.slice(0, 500),
              failed_at: new Date().toISOString(),
            })
            .eq('id', entry.outboxId);
        } catch (requeueError) {
          console.error('[driver/push-flush] transport failure requeue failed', requeueError);
        }
      }
      return NextResponse.json(
        { error: reason },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, voip: voipCount, expo: expoCount });
}
