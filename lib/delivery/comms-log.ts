/**
 * lib/delivery/comms-log.ts
 *
 * Fahrer-Kommunikations-Log — Phase 109
 *
 * Verfolgt alle Nachrichten zwischen Dispatch, System und Fahrern.
 * logCommunication() ist fire-and-forget und kann in bestehende
 * Messaging-Funktionen (sendBroadcast, enqueueBatchPush, etc.) eingebaut werden.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type CommChannel   = 'push' | 'broadcast' | 'in_app' | 'system';
export type CommType      = 'dispatch_assign' | 'route_update' | 'broadcast' | 'surge_notify'
                          | 'positioning' | 'challenge' | 'shift_alert' | 'system' | 'custom';
export type CommDirection = 'dispatch_to_driver' | 'system' | 'driver_to_dispatch';
export type CommStatus    = 'sent' | 'delivered' | 'read' | 'failed';

export interface CommLogEntry {
  id: string;
  locationId: string;
  driverId: string | null;
  driverName: string | null;
  channel: CommChannel;
  messageType: CommType;
  direction: CommDirection;
  title: string | null;
  body: string;
  status: CommStatus;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  sentByName: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
}

export interface CommLogStats {
  totalMessages: number;
  messagesToday: number;
  messagesWeek: number;
  pushCount: number;
  broadcastCount: number;
  inAppCount: number;
  systemCount: number;
  readCount: number;
  deliveredCount: number;
  failedCount: number;
  readRatePct: number | null;
  deliveryRatePct: number | null;
}

export interface DriverCommSummary {
  driverId: string;
  driverName: string | null;
  totalMessages: number;
  messagesToday: number;
  lastMessageAt: string | null;
  readCount: number;
  pushCount: number;
  broadcastCount: number;
}

export interface CommLogDashboard {
  stats: CommLogStats;
  recentMessages: CommLogEntry[];
  driverSummaries: DriverCommSummary[];
  hourlyVolume: { hour: number; count: number }[];
}

// ─── Hilfsfunktion: Migration-Guard ──────────────────────────────────────────

async function tableExists(sb: ReturnType<typeof createServiceClient>): Promise<boolean> {
  const { error } = await sb
    .from('driver_communication_log')
    .select('id')
    .limit(0);
  return !error || (!error.message.includes('driver_communication_log') && error.code !== '42P01');
}

// ─── Kern-Funktion: Kommunikation loggen ─────────────────────────────────────

/**
 * Loggt eine Nachricht fire-and-forget.
 * Fehler werden geschwallowed — kein Blocking der Haupt-Logik.
 */
export async function logCommunication(params: {
  locationId: string;
  driverId?: string | null;
  channel: CommChannel;
  messageType: CommType;
  direction?: CommDirection;
  title?: string;
  body: string;
  status?: CommStatus;
  sentByName?: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const sb = createServiceClient();
    if (!(await tableExists(sb))) return;

    await sb.from('driver_communication_log').insert({
      location_id:    params.locationId,
      driver_id:      params.driverId ?? null,
      channel:        params.channel,
      message_type:   params.messageType,
      direction:      params.direction ?? 'dispatch_to_driver',
      title:          params.title ?? null,
      body:           params.body.slice(0, 500),
      status:         params.status ?? 'sent',
      sent_by_name:   params.sentByName ?? null,
      reference_type: params.referenceType ?? null,
      reference_id:   params.referenceId ?? null,
      metadata:       params.metadata ?? {},
    });
  } catch {
    // Fire-and-forget — nie den Haupt-Flow blockieren
  }
}

/**
 * Markiert eine Nachricht als zugestellt.
 */
export async function markCommDelivered(id: string): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb
      .from('driver_communication_log')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'sent');
  } catch {
    // ignore
  }
}

/**
 * Markiert eine Nachricht als gelesen.
 */
export async function markCommRead(id: string): Promise<void> {
  try {
    const sb = createServiceClient();
    await sb
      .from('driver_communication_log')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('id', id)
      .in('status', ['sent', 'delivered']);
  } catch {
    // ignore
  }
}

// ─── Abfrage-Funktionen ───────────────────────────────────────────────────────

export async function getCommunicationLog(params: {
  locationId: string;
  driverId?: string;
  channel?: CommChannel;
  messageType?: CommType;
  status?: CommStatus;
  fromDate?: string;
  toDate?: string;
  limit?: number;
  offset?: number;
}): Promise<{ entries: CommLogEntry[]; total: number }> {
  const sb = createServiceClient();
  if (!(await tableExists(sb))) return { entries: [], total: 0 };

  const limit = Math.min(params.limit ?? 50, 200);
  const offset = params.offset ?? 0;

  let q = sb
    .from('driver_communication_log')
    .select(`
      id, location_id, driver_id, channel, message_type, direction,
      title, body, status, sent_at, delivered_at, read_at,
      sent_by_name, reference_type, reference_id, metadata,
      mise_drivers!driver_id(name)
    `, { count: 'exact' })
    .eq('location_id', params.locationId)
    .order('sent_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.driverId)    q = q.eq('driver_id', params.driverId);
  if (params.channel)     q = q.eq('channel', params.channel);
  if (params.messageType) q = q.eq('message_type', params.messageType);
  if (params.status)      q = q.eq('status', params.status);
  if (params.fromDate)    q = q.gte('sent_at', params.fromDate);
  if (params.toDate)      q = q.lte('sent_at', params.toDate);

  const { data, count } = await q;

  const entries: CommLogEntry[] = (data ?? []).map((r) => {
    const drivers = r.mise_drivers as { name: string } | null;
    return {
      id:            r.id as string,
      locationId:    r.location_id as string,
      driverId:      r.driver_id as string | null,
      driverName:    drivers?.name ?? null,
      channel:       r.channel as CommChannel,
      messageType:   r.message_type as CommType,
      direction:     r.direction as CommDirection,
      title:         r.title as string | null,
      body:          r.body as string,
      status:        r.status as CommStatus,
      sentAt:        r.sent_at as string,
      deliveredAt:   r.delivered_at as string | null,
      readAt:        r.read_at as string | null,
      sentByName:    r.sent_by_name as string | null,
      referenceType: r.reference_type as string | null,
      referenceId:   r.reference_id as string | null,
      metadata:      (r.metadata as Record<string, unknown>) ?? {},
    };
  });

  return { entries, total: count ?? 0 };
}

export async function getCommLogStats(locationId: string): Promise<CommLogStats> {
  const sb = createServiceClient();
  if (!(await tableExists(sb))) {
    return {
      totalMessages: 0, messagesToday: 0, messagesWeek: 0,
      pushCount: 0, broadcastCount: 0, inAppCount: 0, systemCount: 0,
      readCount: 0, deliveredCount: 0, failedCount: 0,
      readRatePct: null, deliveryRatePct: null,
    };
  }

  const { data } = await sb
    .from('v_comms_log_stats')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return {
      totalMessages: 0, messagesToday: 0, messagesWeek: 0,
      pushCount: 0, broadcastCount: 0, inAppCount: 0, systemCount: 0,
      readCount: 0, deliveredCount: 0, failedCount: 0,
      readRatePct: null, deliveryRatePct: null,
    };
  }

  return {
    totalMessages:   Number(data.total_messages   ?? 0),
    messagesToday:   Number(data.messages_today   ?? 0),
    messagesWeek:    Number(data.messages_week    ?? 0),
    pushCount:       Number(data.push_count       ?? 0),
    broadcastCount:  Number(data.broadcast_count  ?? 0),
    inAppCount:      Number(data.in_app_count     ?? 0),
    systemCount:     Number(data.system_count     ?? 0),
    readCount:       Number(data.read_count       ?? 0),
    deliveredCount:  Number(data.delivered_count  ?? 0),
    failedCount:     Number(data.failed_count     ?? 0),
    readRatePct:     data.read_rate_pct      != null ? Number(data.read_rate_pct)      : null,
    deliveryRatePct: data.delivery_rate_pct  != null ? Number(data.delivery_rate_pct)  : null,
  };
}

export async function getDriverCommSummaries(locationId: string): Promise<DriverCommSummary[]> {
  const sb = createServiceClient();
  if (!(await tableExists(sb))) return [];

  const { data } = await sb
    .from('v_comms_log_driver_summary')
    .select('*')
    .eq('location_id', locationId)
    .order('messages_today', { ascending: false })
    .limit(20);

  return (data ?? []).map((r) => ({
    driverId:      r.driver_id as string,
    driverName:    r.driver_name as string | null,
    totalMessages: Number(r.total_messages  ?? 0),
    messagesToday: Number(r.messages_today  ?? 0),
    lastMessageAt: r.last_message_at as string | null,
    readCount:     Number(r.read_count      ?? 0),
    pushCount:     Number(r.push_count      ?? 0),
    broadcastCount:Number(r.broadcast_count ?? 0),
  }));
}

export async function getHourlyCommVolume(
  locationId: string,
  hours = 24,
): Promise<{ hour: number; count: number }[]> {
  const sb = createServiceClient();
  if (!(await tableExists(sb))) return [];

  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data } = await sb
    .from('driver_communication_log')
    .select('sent_at')
    .eq('location_id', locationId)
    .gte('sent_at', since);

  if (!data || data.length === 0) return [];

  const buckets: Record<number, number> = {};
  for (let h = 0; h < hours; h++) {
    const hourKey = (new Date().getUTCHours() - (hours - 1 - h) + 24) % 24;
    buckets[hourKey] = 0;
  }
  for (const row of data) {
    const h = new Date(row.sent_at as string).getUTCHours();
    buckets[h] = (buckets[h] ?? 0) + 1;
  }

  return Object.entries(buckets)
    .map(([hour, count]) => ({ hour: Number(hour), count }))
    .sort((a, b) => a.hour - b.hour);
}

export async function getCommLogDashboard(locationId: string): Promise<CommLogDashboard> {
  const [stats, { entries: recentMessages }, driverSummaries, hourlyVolume] = await Promise.all([
    getCommLogStats(locationId),
    getCommunicationLog({ locationId, limit: 50 }),
    getDriverCommSummaries(locationId),
    getHourlyCommVolume(locationId, 24),
  ]);
  return { stats, recentMessages, driverSummaries, hourlyVolume };
}

/**
 * Löscht Logs älter als maxDays Tage. Cron-Helfer.
 */
export async function pruneOldCommsLogs(maxDays = 90): Promise<number> {
  try {
    const sb = createServiceClient();
    if (!(await tableExists(sb))) return 0;

    const cutoff = new Date(Date.now() - maxDays * 86_400_000).toISOString();
    const { count } = await sb
      .from('driver_communication_log')
      .delete({ count: 'exact' })
      .lt('sent_at', cutoff);

    return count ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Sendet eine manuelle Dispatch-Nachricht an einen einzelnen Fahrer
 * und loggt sie direkt.
 */
export async function sendDirectDriverMessage(params: {
  locationId: string;
  driverId: string;
  title: string;
  body: string;
  sentByName?: string;
  referenceType?: string;
  referenceId?: string;
}): Promise<{ id: string }> {
  const sb = createServiceClient();

  // In mise_push_outbox einreihen
  const { data: push } = await sb
    .from('mise_push_outbox')
    .insert({
      driver_id: params.driverId,
      type:      'custom_message',
      title:     params.title.slice(0, 100),
      body:      params.body.slice(0, 280),
      sound:     'default',
    })
    .select('id')
    .maybeSingle();

  // Kommunikations-Log
  const { data: log } = await sb
    .from('driver_communication_log')
    .insert({
      location_id:    params.locationId,
      driver_id:      params.driverId,
      channel:        'push',
      message_type:   'custom',
      direction:      'dispatch_to_driver',
      title:          params.title,
      body:           params.body,
      status:         'sent',
      sent_by_name:   params.sentByName ?? null,
      reference_type: params.referenceType ?? null,
      reference_id:   params.referenceId ?? null,
      metadata:       push?.id ? { push_outbox_id: push.id } : {},
    })
    .select('id')
    .maybeSingle();

  return { id: (log?.id as string) ?? '' };
}
