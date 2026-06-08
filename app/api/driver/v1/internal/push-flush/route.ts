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
      'id, driver_id, type, title, body, data, sound, priority, attempts, drivers:driver_id(expo_push_token,voip_push_token,push_enabled)',
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
    const enabled = drv?.push_enabled ?? true;
    if (!enabled) {
      await c
        .from('mise_push_outbox')
        .update({ failed_at: new Date().toISOString(), fail_reason: 'push_enabled=false' })
        .eq('id', row.id);
      skipped++;
      continue;
    }

    // 1) VoIP-First für Bundle-Assignments
    const isAssign = row.type === 'order_assigned' || row.type === 'assign';
    if (isAssign && drv?.voip_push_token) {
      const data = (row.data ?? {}) as Record<string, unknown>;
      const r = await sendVoipPush(drv.voip_push_token, {
        batch_id: typeof data.batch_id === 'string' ? data.batch_id : '',
        order_count: typeof data.order_count === 'number' ? data.order_count : 1,
        restaurant_name: typeof data.restaurant_name === 'string' ? data.restaurant_name : 'Bestellung',
        distance_km: typeof data.distance_km === 'number' ? data.distance_km : null,
        payout_eur: typeof data.payout_eur === 'number' ? data.payout_eur : null,
        reason_text: row.body,
        decision_id: typeof data.decision_id === 'string' ? data.decision_id : undefined,
      });
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
        sound: 'default',
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
      await c.from('mise_push_outbox').update({ failed_at: new Date().toISOString(), fail_reason: r.error ?? 'apns-alert-fail' }).eq('id', row.id);
      skipped++;
      continue;
    }

    // 2) Expo-Push (Standard oder Fallback)
    const expoToken = drv?.expo_push_token;
    if (!expoToken) {
      await c
        .from('mise_push_outbox')
        .update({ failed_at: new Date().toISOString(), fail_reason: 'no expo token' })
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
        if (!ticket) continue;
        if (ticket.status === 'ok') {
          await c
            .from('mise_push_outbox')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', outboxId);
          sent++;
        } else {
          const row = pending.find((p: OutboxRow) => p.id === outboxId);
          const newAttempts = (row?.attempts ?? 0) + 1;
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
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'push send failed' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true, sent, failed, skipped, voip: voipCount, expo: expoCount });
}
