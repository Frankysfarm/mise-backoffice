/**
 * POST /api/driver/v1/internal/push-flush
 *
 * Cron-Endpoint (jede Minute aus mise_cron Container).
 *
 * Standard APNs/Expo delivery. PushKit/VoIP is intentionally not used for orders.
 */
import { NextRequest, NextResponse } from 'next/server';
import { sb } from '../../_lib/driver-auth';
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
  expires_at?: string | null;
}

interface DriverShortRow {
  expo_push_token: string | null;
  push_enabled: boolean;
  active: boolean;
  state: string;
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
      .select('expo_push_token,push_enabled,active,state').eq('id', row.driver_id).maybeSingle();
    if (driverError) return NextResponse.json({ ok: false, reason_code: 'PUSH_DRIVER_LOOKUP_FAILED' }, { status: 500 });
    pending.push({ ...row, drivers: drivers as DriverShortRow | null });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, skipped: 0, apns: 0, expo: 0 });
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
  let apnsCount = 0;
  let expoCount = 0;

  const finish = async (id: string, accepted: boolean, providerMessageId: string | null, error: string | null,
    retryable = true) => {
    const result = await c.rpc('fn_finish_wake_notification', {
      p_notification_id: id, p_worker_id: workerId, p_provider_accepted: accepted,
      p_provider_message_id: providerMessageId, p_error: error,
      p_retryable: retryable,
    });
    if (result.error || !(result.data as { ok?: boolean } | null)?.ok) throw new Error('PUSH_LEDGER_UPDATE_FAILED');
  };
  const wakeData = (row: OutboxRow) => ({
    ...row.data,
    wake_only: true, notification_id: row.id, event_type: row.type,
    assignment_id: row.data.assignment_id ?? row.data.batch_id,
    assignment_version: row.data.assignment_version ?? row.data.snapshot_version ?? 1,
    expires_at: row.expires_at ?? row.data.expires_at ?? row.data.lease_expires_at,
    snapshot_path: '/api/driver/v2/snapshot',
  });

  for (const row of pending as unknown as Row[]) {
    const drv = row.drivers;
    const enabled = drv?.push_enabled ?? true;
    if (!enabled) {
      await finish(row.id, false, null, 'PUSH_DISABLED', false);
      skipped++;
      continue;
    }

    const isAssign = row.type === 'order_assigned' || row.type === 'assign';
    if (isAssign && (!drv?.active || drv.state === 'offline')) {
      await finish(row.id, false, null, 'DRIVER_OFF_DUTY', false);
      skipped++;
      continue;
    }
    // APNs alert for raw Capacitor device tokens.
    const rawTok = drv?.expo_push_token;
    const isExpoTok = typeof rawTok === 'string' && /^Expo(nent)?PushToken\[/.test(rawTok);
    if (rawTok && !isExpoTok && /^[0-9a-fA-F]{64}$/.test(rawTok) && isApnsAlertConfigured()) {
      const r = await sendAlertPush(rawTok, {
        title: isAssign ? 'Neue Lieferung' : 'Aktualisierung',
        body: isAssign
          ? 'Bitte App öffnen und Lieferung jetzt annehmen.'
          : 'Bitte App öffnen und aktuellen Stand laden.',
        sound: isAssign ? 'alarm.caf' : (row.sound ?? 'default'),
        interruptionLevel: isAssign ? 'time-sensitive' : 'active',
        data: wakeData(row),
        collapseId: typeof row.data?.assignment_id === 'string'
          ? `assignment:${row.data.assignment_id}`
          : `notification:${row.id}`,
      });
      if (r.ok) {
        await finish(row.id, true, r.apnsId ?? null, null);
        sent++;
        apnsCount++;
        continue;
      }
      if (r.tokenDead) {
        const { error: tokenError } = await c.from('mise_drivers').update({ expo_push_token: null, push_token_updated_at: new Date().toISOString() }).eq('id', row.driver_id);
        if (tokenError) throw new Error('DEAD_ALERT_TOKEN_CLEAR_FAILED');
      }
        await finish(row.id, false, null, r.error ?? 'APNS_ALERT_REJECTED', !r.tokenDead);
      skipped++;
      continue;
    }

    // 2) Expo-Push (Standard oder Fallback)
    const expoToken = drv?.expo_push_token;
    if (!expoToken) {
      await finish(row.id, false, null, 'NO_EXPO_TOKEN', false);
      skipped++;
      continue;
    }
    expoBatch.push({
      outboxId: row.id,
      message: {
        to: expoToken,
        title: isAssign ? 'Neue Lieferung' : 'Aktualisierung',
        body: isAssign
          ? 'Bitte App öffnen und Lieferung jetzt annehmen.'
          : 'Bitte App öffnen und aktuellen Stand laden.',
        data: wakeData(row),
        sound: isAssign ? 'alarm.caf' : (row.sound ?? 'default'),
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
      if (!res.ok) throw new Error(`EXPO_HTTP_${res.status}`);
      const json = (await res.json()) as { data?: Array<{ status: string; id?: string; message?: string }> };
      const tickets = Array.isArray(json.data) ? json.data : [];
      for (let i = 0; i < expoBatch.length; i++) {
        const ticket = tickets[i];
        const outboxId = expoBatch[i].outboxId;
        if (!ticket) {
          await finish(outboxId, false, null, 'EXPO_MISSING_TICKET');
          failed++;
          continue;
        }
        if (ticket.status === 'ok') {
          await finish(outboxId, true, ticket.id ?? null, null);
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

  return NextResponse.json({ ok: true, sent, failed, skipped, apns: apnsCount, expo: expoCount });
}
