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
import { randomUUID } from 'node:crypto';

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

  const workerId = randomUUID();
  const { data: claimed, error: claimError } = await c.rpc('fn_claim_wake_notifications', {
    p_worker_id: workerId, p_limit: 50,
  });
  if (claimError) return NextResponse.json({ ok: false, reason_code: 'PUSH_CLAIM_FAILED' }, { status: 500 });
  type Row = OutboxRow & { drivers: DriverShortRow | null };
  const pending: Row[] = [];
  for (const row of (claimed ?? []) as OutboxRow[]) {
    const { data: drivers, error: driverError } = await c.from('mise_drivers')
      .select('expo_push_token,voip_push_token,push_enabled').eq('id', row.driver_id).maybeSingle();
    if (driverError) return NextResponse.json({ ok: false, reason_code: 'PUSH_DRIVER_LOOKUP_FAILED' }, { status: 500 });
    pending.push({ ...row, drivers: drivers as DriverShortRow | null });
  }

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

  const finish = async (id: string, accepted: boolean, providerMessageId: string | null, error: string | null) => {
    const result = await c.rpc('fn_finish_wake_notification', {
      p_notification_id: id, p_worker_id: workerId, p_provider_accepted: accepted,
      p_provider_message_id: providerMessageId, p_error: error,
    });
    if (result.error || !(result.data as { ok?: boolean } | null)?.ok) throw new Error('PUSH_LEDGER_UPDATE_FAILED');
  };
  const wakeData = (row: OutboxRow) => ({
    wake_only: true, notification_id: row.id, event_type: row.type,
    snapshot_path: '/api/driver/v2/snapshot',
  });

  for (const row of pending as unknown as Row[]) {
    const drv = row.drivers;
    const enabled = drv?.push_enabled ?? true;
    if (!enabled) {
      await finish(row.id, false, null, 'PUSH_DISABLED');
      skipped++;
      continue;
    }

    // 1) VoIP-First für Bundle-Assignments
    const isAssign = row.type === 'order_assigned' || row.type === 'assign';
    if (isAssign && drv?.voip_push_token) {
      const data = wakeData(row);
      const r = await sendVoipPush(drv.voip_push_token, {
        batch_id: '',
        order_count: 1,
        restaurant_name: 'Aktualisierung',
        distance_km: null,
        payout_eur: null,
        reason_text: 'App öffnen und aktuellen Stand laden.',
        decision_id: data.notification_id,
      });
      if (r.ok) {
        await finish(row.id, true, null, null);
        sent++;
        voipCount++;
        continue;
      }
      // Token tot? -> in DB nullen
      if (r.tokenDead) {
        const { error: tokenError } = await c
          .from('mise_drivers')
          .update({ voip_push_token: null, voip_push_token_updated_at: new Date().toISOString() })
          .eq('id', row.driver_id);
        if (tokenError) throw new Error('DEAD_VOIP_TOKEN_CLEAR_FAILED');
      }
      // Egal welcher Fehler — fall back auf Expo wenn vorhanden
      // (kein continue → es geht in den Expo-Block unten)
    }

    // 1b) APNs-Alert fuer rohe Device-Tokens (Capacitor-App, 64-Hex statt Expo-Token)
    const rawTok = drv?.expo_push_token;
    const isExpoTok = typeof rawTok === 'string' && /^Expo(nent)?PushToken\[/.test(rawTok);
    if (rawTok && !isExpoTok && /^[0-9a-fA-F]{64}$/.test(rawTok) && isApnsAlertConfigured()) {
      const r = await sendAlertPush(rawTok, {
        title: 'Aktualisierung',
        body: 'Bitte App öffnen und aktuellen Stand laden.',
        sound: 'default',
        data: wakeData(row),
      });
      if (r.ok) {
        await finish(row.id, true, null, null);
        sent++;
        continue;
      }
      if (r.tokenDead) {
        const { error: tokenError } = await c.from('mise_drivers').update({ expo_push_token: null, push_token_updated_at: new Date().toISOString() }).eq('id', row.driver_id);
        if (tokenError) throw new Error('DEAD_ALERT_TOKEN_CLEAR_FAILED');
      }
      await finish(row.id, false, null, r.error ?? 'APNS_ALERT_REJECTED');
      skipped++;
      continue;
    }

    // 2) Expo-Push (Standard oder Fallback)
    const expoToken = drv?.expo_push_token;
    if (!expoToken) {
      await finish(row.id, false, null, 'NO_EXPO_TOKEN');
      skipped++;
      continue;
    }
    expoBatch.push({
      outboxId: row.id,
      message: {
        to: expoToken,
        title: 'Aktualisierung',
        body: 'Bitte App öffnen und aktuellen Stand laden.',
        data: wakeData(row),
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
          await finish(outboxId, true, null, null);
          sent++;
        } else {
          await finish(outboxId, false, null, ticket.message ?? 'EXPO_REJECTED');
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
