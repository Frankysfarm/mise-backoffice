/**
 * lib/delivery/push-analytics.ts
 *
 * Phase 175: Unified Push Notification Analytics.
 * Aggregiert Versand-Performance aus allen drei Push-Kanälen:
 *   - VAPID (customer_web_push_log)
 *   - WhatsApp (whatsapp_message_log)
 *   - Driver Push (mise_push_outbox via fahrer/driver_id → location)
 *
 * Cron: täglich 02:00 UTC + alle 30 Min für Near-Real-Time.
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type PushChannel = 'vapid' | 'whatsapp' | 'driver';

export interface ChannelSummary {
  channel: PushChannel;
  sent7d:         number;
  delivered7d:    number;
  failed7d:       number;
  expired7d:      number;
  read7d:         number;
  deliveryRatePct: number | null;
  readRatePct:     number | null;
}

export interface EventBreakdown {
  channel:         PushChannel;
  eventType:       string;
  sent30d:         number;
  delivered30d:    number;
  failed30d:       number;
  deliveryRatePct: number | null;
}

export interface DailyTrendRow {
  date:       string;
  vapidSent:  number;
  waSent:     number;
  driverSent: number;
  vapidDelivered:  number;
  waDelivered:     number;
  driverDelivered: number;
}

export interface PushAnalyticsDashboard {
  totalSent7d:     number;
  totalDelivered7d:number;
  overallDeliveryRatePct: number | null;
  waReadRatePct:   number | null;
  vapidActiveSubs: number;
  channels:        ChannelSummary[];
  trend14d:        DailyTrendRow[];
  eventBreakdown:  EventBreakdown[];
  generatedAt:     string;
}

// ── Interne Helpers ───────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Aggregation: VAPID (customer_web_push_log) ────────────────────────────────

async function computeVapidForLocation(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  targetDate: string,
): Promise<void> {
  // Hole alle VAPID-Logs für den Zieltag
  const dayStart = `${targetDate}T00:00:00Z`;
  const dayEnd   = `${targetDate}T23:59:59Z`;

  const { data: rows } = await sb
    .from('customer_web_push_log')
    .select('status, event_type')
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(10000);

  if (!rows || rows.length === 0) return;

  // Aggregiere nach event_type + 'all'
  const agg = new Map<string, { sent: number; delivered: number; failed: number; expired: number }>();

  const inc = (key: string, status: string) => {
    if (!agg.has(key)) agg.set(key, { sent: 0, delivered: 0, failed: 0, expired: 0 });
    const b = agg.get(key)!;
    if (status === 'sent')    b.sent++;
    if (status === 'failed')  { b.sent++; b.failed++; }
    if (status === 'expired') { b.sent++; b.expired++; }
    // 'skipped' not counted as sent
  };

  for (const r of rows) {
    const status = (r.status as string) ?? 'sent';
    const et     = (r.event_type as string) ?? 'unknown';
    if (status === 'skipped') continue;
    inc('all', status);
    inc(et, status);
  }

  for (const [eventType, counts] of agg) {
    await sb.from('push_analytics_daily').upsert({
      location_id:   locationId,
      channel:       'vapid',
      snapshot_date: targetDate,
      event_type:    eventType,
      sent:          counts.sent,
      delivered:     counts.sent - counts.failed - counts.expired,
      failed:        counts.failed,
      expired:       counts.expired,
      read_count:    0,
    }, { onConflict: 'location_id,channel,snapshot_date,event_type' });
  }
}

// ── Aggregation: WhatsApp (whatsapp_message_log) ──────────────────────────────

async function computeWhatsAppForLocation(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  targetDate: string,
): Promise<void> {
  const dayStart = `${targetDate}T00:00:00Z`;
  const dayEnd   = `${targetDate}T23:59:59Z`;

  const { data: rows } = await sb
    .from('whatsapp_message_log')
    .select('status, event_type')
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(10000);

  if (!rows || rows.length === 0) return;

  const agg = new Map<string, { sent: number; delivered: number; failed: number; read: number }>();

  const inc = (key: string, status: string) => {
    if (!agg.has(key)) agg.set(key, { sent: 0, delivered: 0, failed: 0, read: 0 });
    const b = agg.get(key)!;
    if (status === 'pending') return;
    b.sent++;
    if (status === 'delivered') b.delivered++;
    if (status === 'read')      { b.delivered++; b.read++; }
    if (status === 'failed')    b.failed++;
    if (status === 'sent')      b.delivered++; // sent = at least delivered to WA
  };

  for (const r of rows) {
    const status = (r.status as string) ?? 'sent';
    const et     = (r.event_type as string) ?? 'unknown';
    inc('all', status);
    inc(et, status);
  }

  for (const [eventType, counts] of agg) {
    await sb.from('push_analytics_daily').upsert({
      location_id:   locationId,
      channel:       'whatsapp',
      snapshot_date: targetDate,
      event_type:    eventType,
      sent:          counts.sent,
      delivered:     counts.delivered,
      failed:        counts.failed,
      expired:       0,
      read_count:    counts.read,
    }, { onConflict: 'location_id,channel,snapshot_date,event_type' });
  }
}

// ── Aggregation: Driver Push (mise_push_outbox → location via employees) ───────

async function computeDriverPushForLocation(
  sb: ReturnType<typeof createServiceClient>,
  locationId: string,
  targetDate: string,
): Promise<void> {
  const dayStart = `${targetDate}T00:00:00Z`;
  const dayEnd   = `${targetDate}T23:59:59Z`;

  // Fahrer-IDs dieser Location
  const { data: drivers } = await sb
    .from('employees')
    .select('id')
    .eq('location_id', locationId)
    .eq('rolle', 'fahrer')
    .limit(500);

  if (!drivers || drivers.length === 0) return;

  const driverIds = drivers.map((d: { id: string }) => d.id);

  const { data: rows } = await sb
    .from('mise_push_outbox')
    .select('type, sent_at')
    .in('driver_id', driverIds)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd)
    .limit(10000);

  if (!rows || rows.length === 0) return;

  // Driver push: sent_at != null → delivered (no explicit read tracking)
  const agg = new Map<string, { sent: number; delivered: number }>();

  for (const r of rows) {
    const et      = (r.type as string) ?? 'unknown';
    const sentAt  = r.sent_at as string | null;
    if (!agg.has('all')) agg.set('all', { sent: 0, delivered: 0 });
    if (!agg.has(et))    agg.set(et,    { sent: 0, delivered: 0 });
    agg.get('all')!.sent++;
    agg.get(et)!.sent++;
    if (sentAt) {
      agg.get('all')!.delivered++;
      agg.get(et)!.delivered++;
    }
  }

  for (const [eventType, counts] of agg) {
    await sb.from('push_analytics_daily').upsert({
      location_id:   locationId,
      channel:       'driver',
      snapshot_date: targetDate,
      event_type:    eventType,
      sent:          counts.sent,
      delivered:     counts.delivered,
      failed:        counts.sent - counts.delivered,
      expired:       0,
      read_count:    0,
    }, { onConflict: 'location_id,channel,snapshot_date,event_type' });
  }
}

// ── Haupt-Berechnung ──────────────────────────────────────────────────────────

export async function computePushAnalyticsForLocation(locationId: string): Promise<void> {
  const sb = createServiceClient();
  const today     = isoDate(new Date());
  const yesterday = isoDate(new Date(Date.now() - 86_400_000));

  await Promise.all([
    computeVapidForLocation(sb, locationId, today).catch(() => null),
    computeVapidForLocation(sb, locationId, yesterday).catch(() => null),
    computeWhatsAppForLocation(sb, locationId, today).catch(() => null),
    computeWhatsAppForLocation(sb, locationId, yesterday).catch(() => null),
    computeDriverPushForLocation(sb, locationId, today).catch(() => null),
    computeDriverPushForLocation(sb, locationId, yesterday).catch(() => null),
  ]);
}

export async function computePushAnalyticsAllLocations(): Promise<{
  locations: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  let errors = 0;
  for (const loc of locs ?? []) {
    try {
      await computePushAnalyticsForLocation(loc.id as string);
    } catch {
      errors++;
    }
  }
  return { locations: (locs ?? []).length, errors };
}

// ── Dashboard-Daten ───────────────────────────────────────────────────────────

export async function getPushAnalyticsDashboard(
  locationId: string,
  days = 7,
): Promise<PushAnalyticsDashboard> {
  const sb     = createServiceClient();
  const cutoff = isoDate(new Date(Date.now() - (days - 1) * 86_400_000));

  const [channelRes, trendRes, eventRes, subsRes] = await Promise.all([
    // Channel-Vergleich (7d)
    sb
      .from('push_analytics_daily')
      .select('channel, sent, delivered, failed, expired, read_count')
      .eq('location_id', locationId)
      .eq('event_type', 'all')
      .gte('snapshot_date', cutoff)
      .order('snapshot_date', { ascending: true }),

    // Trend (14d täglich)
    sb
      .from('push_analytics_daily')
      .select('channel, snapshot_date, sent, delivered')
      .eq('location_id', locationId)
      .eq('event_type', 'all')
      .gte('snapshot_date', isoDate(new Date(Date.now() - 13 * 86_400_000)))
      .order('snapshot_date', { ascending: true }),

    // Event-Breakdown (30d)
    sb
      .from('push_analytics_daily')
      .select('channel, event_type, sent, delivered, failed')
      .eq('location_id', locationId)
      .neq('event_type', 'all')
      .gte('snapshot_date', isoDate(new Date(Date.now() - 29 * 86_400_000)))
      .order('sent', { ascending: false }),

    // VAPID aktive Subscriptions
    sb
      .from('customer_push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId),
  ]);

  // Aggregiere Channel-Summen
  const channelMap = new Map<PushChannel, ChannelSummary>();
  for (const r of channelRes.data ?? []) {
    const ch = r.channel as PushChannel;
    if (!channelMap.has(ch)) {
      channelMap.set(ch, {
        channel: ch,
        sent7d: 0, delivered7d: 0, failed7d: 0, expired7d: 0, read7d: 0,
        deliveryRatePct: null, readRatePct: null,
      });
    }
    const c = channelMap.get(ch)!;
    c.sent7d      += Number(r.sent ?? 0);
    c.delivered7d += Number(r.delivered ?? 0);
    c.failed7d    += Number(r.failed ?? 0);
    c.expired7d   += Number(r.expired ?? 0);
    c.read7d      += Number(r.read_count ?? 0);
  }

  const channels: ChannelSummary[] = (['vapid', 'whatsapp', 'driver'] as PushChannel[]).map((ch) => {
    const c = channelMap.get(ch) ?? {
      channel: ch, sent7d: 0, delivered7d: 0, failed7d: 0, expired7d: 0, read7d: 0,
      deliveryRatePct: null, readRatePct: null,
    };
    const total = c.sent7d + c.failed7d;
    c.deliveryRatePct = total > 0 ? Math.round((c.delivered7d / total) * 1000) / 10 : null;
    c.readRatePct     = c.delivered7d > 0 ? Math.round((c.read7d / c.delivered7d) * 1000) / 10 : null;
    return c;
  });

  // Trend-Matrix (14 Tage)
  const trendMap = new Map<string, DailyTrendRow>();
  for (let i = 13; i >= 0; i--) {
    const d = isoDate(new Date(Date.now() - i * 86_400_000));
    trendMap.set(d, {
      date: d,
      vapidSent: 0, waSent: 0, driverSent: 0,
      vapidDelivered: 0, waDelivered: 0, driverDelivered: 0,
    });
  }
  for (const r of trendRes.data ?? []) {
    const d   = r.snapshot_date as string;
    const row = trendMap.get(d);
    if (!row) continue;
    const ch  = r.channel as PushChannel;
    const s   = Number(r.sent ?? 0);
    const del = Number(r.delivered ?? 0);
    if (ch === 'vapid')    { row.vapidSent   += s; row.vapidDelivered   += del; }
    if (ch === 'whatsapp') { row.waSent      += s; row.waDelivered      += del; }
    if (ch === 'driver')   { row.driverSent  += s; row.driverDelivered  += del; }
  }

  // Event-Breakdown aggregieren
  const evMap = new Map<string, EventBreakdown>();
  for (const r of eventRes.data ?? []) {
    const key = `${r.channel}::${r.event_type}`;
    if (!evMap.has(key)) {
      evMap.set(key, {
        channel: r.channel as PushChannel,
        eventType: r.event_type as string,
        sent30d: 0, delivered30d: 0, failed30d: 0, deliveryRatePct: null,
      });
    }
    const e = evMap.get(key)!;
    e.sent30d      += Number(r.sent ?? 0);
    e.delivered30d += Number(r.delivered ?? 0);
    e.failed30d    += Number(r.failed ?? 0);
  }
  const eventBreakdown = [...evMap.values()].map((e) => {
    const total = e.sent30d + e.failed30d;
    e.deliveryRatePct = total > 0 ? Math.round((e.delivered30d / total) * 1000) / 10 : null;
    return e;
  }).sort((a, b) => b.sent30d - a.sent30d).slice(0, 30);

  const totalSent7d      = channels.reduce((s, c) => s + c.sent7d, 0);
  const totalDelivered7d = channels.reduce((s, c) => s + c.delivered7d, 0);
  const totalFailed7d    = channels.reduce((s, c) => s + c.failed7d, 0);
  const overallDeliveryRatePct = (totalSent7d + totalFailed7d) > 0
    ? Math.round((totalDelivered7d / (totalSent7d + totalFailed7d)) * 1000) / 10
    : null;

  const waChannel = channels.find((c) => c.channel === 'whatsapp');

  return {
    totalSent7d,
    totalDelivered7d,
    overallDeliveryRatePct,
    waReadRatePct:   waChannel?.readRatePct ?? null,
    vapidActiveSubs: (subsRes.count ?? 0),
    channels,
    trend14d:        [...trendMap.values()],
    eventBreakdown,
    generatedAt:     new Date().toISOString(),
  };
}
