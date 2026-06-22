/**
 * lib/delivery/order-pulse.ts — Phase 398
 *
 * Order-Pulse-Tracker: Analysiert die Bestellgeschwindigkeit in 15-Minuten-Buckets.
 *
 * Zeigt:
 *  - Bestellrate je 15-Min-Bucket der letzten 2 Stunden
 *  - Aktuellen Bucket (letzte 15 Min)
 *  - Trend: beschleunigend / stabil / abkühlend
 *  - Hochrechnung auf nächste Stunde
 *
 * Public API:
 *  getOrderPulse(locationId)          — Live-Pulse-Daten
 *  snapshotOrderPulse(locationId)     — Aktuellen Bucket in DB schreiben (Cron)
 *  pruneOrderPulseSnapshots(days)     — Alte Buckets löschen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface PulseBucket {
  bucketStart:   string;   // ISO UTC
  bucketLabel:   string;   // 'HH:MM' Berliner Zeit
  orderCount:    number;
  revenueEur:    number;
  deliveryCount: number;
}

export type PulseTrend = 'beschleunigend' | 'stabil' | 'abkühlend' | 'inaktiv';

export interface OrderPulse {
  locationId:       string;
  buckets:          PulseBucket[];          // letzte 8 Buckets (2h)
  currentRate:      number;                 // Bestellungen / Stunde (aktueller Bucket hochgerechnet)
  trend:            PulseTrend;
  nextHourForecast: number;                 // Hochrechnung Bestellungen nächste Stunde
  peakBucketLabel:  string | null;          // Bucket mit den meisten Bestellungen heute
  totalToday:       number;                 // Bestellungen gesamt heute
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

/** Floort auf 15-Min-Bucket (UTC). */
function floorTo15Min(date: Date): Date {
  const ms = date.getTime();
  const bucket = Math.floor(ms / (15 * 60_000)) * (15 * 60_000);
  return new Date(bucket);
}

/** Berliner Zeit-Label für ISO UTC. */
function berlinLabel(isoUtc: string): string {
  const d = new Date(isoUtc);
  const offsetH = 2;
  const berlin = new Date(d.getTime() + offsetH * 3_600_000);
  const h = String(berlin.getUTCHours()).padStart(2, '0');
  const m = String(berlin.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Gibt UTC-Range für "heute" (Berliner Zeit, UTC+2 Approximation). */
function todayRangeUtc(): { from: string; to: string } {
  const offsetH = 2;
  const berlinNow = new Date(Date.now() + offsetH * 3_600_000);
  const berlinDate = berlinNow.toISOString().slice(0, 10);
  const from = new Date(`${berlinDate}T00:00:00.000Z`);
  from.setTime(from.getTime() - offsetH * 3_600_000);
  const to = new Date(from.getTime() + 24 * 3_600_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// ── getOrderPulse ─────────────────────────────────────────────────────────────

export async function getOrderPulse(locationId: string): Promise<OrderPulse> {
  const svc = createServiceClient();
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000);
  const { from: todayFrom } = todayRangeUtc();

  // Alle Bestellungen der letzten 2h + heute für Gesamt-Count
  const [{ data: recentRows }, { data: todayRows }] = await Promise.all([
    svc
      .from('customer_orders')
      .select('id, status, gesamtbetrag, bestellart, bestellt_am')
      .eq('location_id', locationId)
      .neq('status', 'storniert')
      .gte('bestellt_am', twoHoursAgo.toISOString())
      .lte('bestellt_am', now.toISOString()),

    svc
      .from('customer_orders')
      .select('id')
      .eq('location_id', locationId)
      .neq('status', 'storniert')
      .gte('bestellt_am', todayFrom)
      .lte('bestellt_am', now.toISOString()),
  ]);

  type OrderRow = {
    id: string;
    status: string;
    gesamtbetrag: number | null;
    bestellart: string | null;
    bestellt_am: string | null;
  };

  const rows = (recentRows ?? []) as OrderRow[];
  const totalToday = (todayRows ?? []).length;

  // Buckets aufbauen: letzte 8 × 15-Min-Slots
  const bucketMap = new Map<string, { orderCount: number; revenueEur: number; deliveryCount: number }>();

  for (let i = 7; i >= 0; i--) {
    const bucketTime = new Date(floorTo15Min(now).getTime() - i * 15 * 60_000);
    bucketMap.set(bucketTime.toISOString(), { orderCount: 0, revenueEur: 0, deliveryCount: 0 });
  }

  for (const row of rows) {
    if (!row.bestellt_am) continue;
    const bucketStart = floorTo15Min(new Date(row.bestellt_am)).toISOString();
    const entry = bucketMap.get(bucketStart);
    if (!entry) continue;
    entry.orderCount += 1;
    entry.revenueEur += row.gesamtbetrag ?? 0;
    if (row.bestellart === 'lieferung') entry.deliveryCount += 1;
  }

  const buckets: PulseBucket[] = Array.from(bucketMap.entries()).map(([key, val]) => ({
    bucketStart:   key,
    bucketLabel:   berlinLabel(key),
    orderCount:    val.orderCount,
    revenueEur:    Math.round(val.revenueEur * 100) / 100,
    deliveryCount: val.deliveryCount,
  }));

  // Trend: Vergleich letzte 15 Min vs. vorherige 15 Min
  const currentBucket = buckets[buckets.length - 1];
  const prevBucket    = buckets[buckets.length - 2];
  const currentCount  = currentBucket?.orderCount ?? 0;
  const prevCount     = prevBucket?.orderCount ?? 0;

  let trend: PulseTrend = 'inaktiv';
  if (currentCount === 0 && prevCount === 0) {
    trend = 'inaktiv';
  } else if (currentCount >= prevCount * 1.3) {
    trend = 'beschleunigend';
  } else if (currentCount <= prevCount * 0.7) {
    trend = 'abkühlend';
  } else {
    trend = 'stabil';
  }

  // Aktuelle Rate: Bestellungen/h (aktueller Bucket × 4)
  const currentRate = currentCount * 4;

  // Hochrechnung nächste Stunde: avg der letzten 2 Buckets × 4
  const lastTwo = [prevCount, currentCount];
  const avgLast2 = lastTwo.reduce((s, n) => s + n, 0) / 2;
  const nextHourForecast = Math.round(avgLast2 * 4);

  // Peak-Bucket (max orderCount in letzte 2h)
  let peakBucketLabel: string | null = null;
  let peakCount = 0;
  for (const b of buckets) {
    if (b.orderCount > peakCount) {
      peakCount = b.orderCount;
      peakBucketLabel = b.bucketLabel;
    }
  }
  if (peakCount === 0) peakBucketLabel = null;

  return {
    locationId,
    buckets,
    currentRate,
    trend,
    nextHourForecast,
    peakBucketLabel,
    totalToday,
  };
}

// ── snapshotOrderPulse ────────────────────────────────────────────────────────

/**
 * Schreibt den aktuell-abgeschlossenen 15-Min-Bucket in order_pulse_snapshots.
 * Für Cron: läuft alle 15 Min, schreibt den jeweils gerade beendeten Bucket.
 */
export async function snapshotOrderPulse(locationId: string): Promise<void> {
  const svc = createServiceClient();
  const now = new Date();

  // Bucket, der gerade abgeschlossen wurde = vorheriger Bucket
  const currentBucketStart = floorTo15Min(now);
  const prevBucketStart = new Date(currentBucketStart.getTime() - 15 * 60_000);
  const bucketEnd = currentBucketStart;

  const { data: rows } = await svc
    .from('customer_orders')
    .select('gesamtbetrag, bestellart, status')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('bestellt_am', prevBucketStart.toISOString())
    .lt('bestellt_am', bucketEnd.toISOString());

  type Row = { gesamtbetrag: number | null; bestellart: string | null; status: string };
  const orderRows = (rows ?? []) as Row[];

  const orderCount    = orderRows.length;
  const revenueEur    = orderRows.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);
  const deliveryCount = orderRows.filter(r => r.bestellart === 'lieferung').length;
  const avgOrderEur   = orderCount > 0 ? Math.round((revenueEur / orderCount) * 100) / 100 : null;

  await svc
    .from('order_pulse_snapshots')
    .upsert({
      location_id:    locationId,
      bucket_start:   prevBucketStart.toISOString(),
      order_count:    orderCount,
      revenue_eur:    Math.round(revenueEur * 100) / 100,
      delivery_count: deliveryCount,
      avg_order_eur:  avgOrderEur,
    }, { onConflict: 'location_id,bucket_start' });
}

/** Batch-Snapshot für alle aktiven Standorte (Cron-Batch). */
export async function snapshotOrderPulseAllLocations(): Promise<{ saved: number; errors: number }> {
  const svc = createServiceClient();
  const { data: locations } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  let saved = 0;
  let errors = 0;

  await Promise.allSettled(
    (locations ?? []).map(async (loc: { id: string }) => {
      try {
        await snapshotOrderPulse(loc.id);
        saved++;
      } catch {
        errors++;
      }
    }),
  );

  return { saved, errors };
}

/** Löscht Snapshots älter als N Tage (via RPC in der Datenbank). */
export async function pruneOrderPulseSnapshots(daysToKeep: number = 7): Promise<number> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_order_pulse_snapshots', { days_to_keep: daysToKeep });
  return (data as number | null) ?? 0;
}

// ── Chart-Erweiterung (Phase 399) ─────────────────────────────────────────────

export type ChartRange = '2h' | '4h' | '8h' | 'today';
export type ChartMetric = 'orders' | 'revenue' | 'deliveries';
export type BucketColor = 'green' | 'amber' | 'red' | 'neutral';

export interface ChartBucket extends PulseBucket {
  movingAvg:     number;    // 3-Bucket gleitender Durchschnitt (orderCount)
  deltaFromPrev: number;    // Differenz zum Vorgänger-Bucket
  color:         BucketColor;
  hourlyRate:    number;    // hochgerechnete Bestellungen/Stunde
}

export interface OrderPulseChartData {
  locationId:       string;
  range:            ChartRange;
  metric:           ChartMetric;
  buckets:          ChartBucket[];
  overallTrend:     PulseTrend;
  avgRate:          number;    // Ø Bestellungen/h über gesamte Range
  peakBucketLabel:  string | null;
  currentRate:      number;
  nextHourForecast: number;
  totalInRange:     number;
}

/** Lädt historische Snapshots + Live-Daten und gibt chart-ready Buckets zurück. */
export async function getOrderPulseChartData(
  locationId: string,
  range: ChartRange = '2h',
  metric: ChartMetric = 'orders',
): Promise<OrderPulseChartData> {
  const svc  = createServiceClient();
  const now  = new Date();

  // Wie viele Stunden zurück?
  let hoursBack: number;
  if (range === '2h')    hoursBack = 2;
  else if (range === '4h') hoursBack = 4;
  else if (range === '8h') hoursBack = 8;
  else {
    // 'today': Berliner Mitternacht bis jetzt
    const { from } = todayRangeUtc();
    hoursBack = (now.getTime() - new Date(from).getTime()) / 3_600_000;
  }

  const rangeStart = new Date(now.getTime() - hoursBack * 3_600_000);
  const bucketCount = Math.ceil(hoursBack * 4);  // 15-Min-Buckets

  // Schritt 1: Buckets aus order_pulse_snapshots (historisch — bereits persistiert)
  const { data: snapRows } = await svc
    .from('order_pulse_snapshots')
    .select('bucket_start, order_count, revenue_eur, delivery_count')
    .eq('location_id', locationId)
    .gte('bucket_start', rangeStart.toISOString())
    .lt('bucket_start', floorTo15Min(now).toISOString())
    .order('bucket_start', { ascending: true });

  type SnapRow = { bucket_start: string; order_count: number; revenue_eur: number; delivery_count: number };
  const snaps = (snapRows ?? []) as SnapRow[];

  // Schritt 2: Aktuellen (laufenden) Bucket live aus customer_orders
  const currentBucketStart = floorTo15Min(now);
  const { data: liveRows } = await svc
    .from('customer_orders')
    .select('gesamtbetrag, bestellart')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('bestellt_am', currentBucketStart.toISOString())
    .lte('bestellt_am', now.toISOString());

  type LiveRow = { gesamtbetrag: number | null; bestellart: string | null };
  const liveData = (liveRows ?? []) as LiveRow[];

  const liveSnap: SnapRow = {
    bucket_start:   currentBucketStart.toISOString(),
    order_count:    liveData.length,
    revenue_eur:    liveData.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0),
    delivery_count: liveData.filter(r => r.bestellart === 'lieferung').length,
  };

  // Schritt 3: Vollständige Bucket-Timeline aufbauen (lückenlose Slots)
  const allBucketKeys: string[] = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const t = new Date(floorTo15Min(now).getTime() - i * 15 * 60_000);
    allBucketKeys.push(t.toISOString());
  }

  const snapMap = new Map<string, SnapRow>();
  for (const s of snaps) snapMap.set(new Date(s.bucket_start).toISOString(), s);
  snapMap.set(liveSnap.bucket_start, liveSnap);

  const rawBuckets: PulseBucket[] = allBucketKeys.map(key => {
    const s = snapMap.get(key);
    return {
      bucketStart:   key,
      bucketLabel:   berlinLabel(key),
      orderCount:    s?.order_count    ?? 0,
      revenueEur:    s ? Math.round(Number(s.revenue_eur) * 100) / 100 : 0,
      deliveryCount: s?.delivery_count ?? 0,
    };
  });

  // Schritt 4: Chart-Metriken berechnen
  function metricValue(b: PulseBucket): number {
    if (metric === 'revenue')    return b.revenueEur;
    if (metric === 'deliveries') return b.deliveryCount;
    return b.orderCount;
  }

  const chartBuckets: ChartBucket[] = rawBuckets.map((b, idx) => {
    // 3-Bucket gleitender Durchschnitt
    const window = rawBuckets.slice(Math.max(0, idx - 2), idx + 1);
    const movingAvg = Math.round(
      (window.reduce((s, w) => s + metricValue(w), 0) / window.length) * 10,
    ) / 10;

    const prev = idx > 0 ? metricValue(rawBuckets[idx - 1]) : 0;
    const curr = metricValue(b);
    const deltaFromPrev = curr - prev;

    // Farbe: ggü. movingAvg
    let color: BucketColor = 'neutral';
    if (movingAvg > 0) {
      const ratio = curr / movingAvg;
      if (ratio >= 1.2)      color = 'green';
      else if (ratio >= 0.8) color = 'neutral';
      else if (ratio >= 0.5) color = 'amber';
      else                   color = 'red';
    } else if (curr > 0) {
      color = 'green';
    }

    return { ...b, movingAvg, deltaFromPrev, color, hourlyRate: curr * 4 };
  });

  // Schritt 5: Gesamt-Trend + Forecast
  const last4 = chartBuckets.slice(-4);
  // Trend immer anhand orderCount (allgemeine Aktivität), unabhängig vom metric-Selektor
  const first2Avg = ((last4[0]?.orderCount ?? 0) + (last4[1]?.orderCount ?? 0)) / 2;
  const last2Avg  = ((last4[2]?.orderCount ?? 0) + (last4[3]?.orderCount ?? 0)) / 2;

  let overallTrend: PulseTrend = 'inaktiv';
  if (first2Avg + last2Avg === 0) {
    overallTrend = 'inaktiv';
  } else if (last2Avg >= first2Avg * 1.2) {
    overallTrend = 'beschleunigend';
  } else if (last2Avg <= first2Avg * 0.8) {
    overallTrend = 'abkühlend';
  } else {
    overallTrend = 'stabil';
  }

  // Aggregat-Metriken respektieren den metric-Selektor
  const lastBucket        = chartBuckets[chartBuckets.length - 1];
  const last2MetricAvg    = ((last4[2] ? metricValue(last4[2]) : 0) + (last4[3] ? metricValue(last4[3]) : 0)) / 2;
  const currentRate       = (lastBucket ? metricValue(lastBucket) : 0) * 4;
  const nextHourForecast  = Math.round(last2MetricAvg * 4);
  const totalInRange      = rawBuckets.reduce((s, b) => s + metricValue(b), 0);
  const avgRate           = Math.round((totalInRange / hoursBack) * 10) / 10;

  let peakBucketLabel: string | null = null;
  let peakVal = 0;
  for (const b of chartBuckets) {
    const v = metricValue(b);
    if (v > peakVal) { peakVal = v; peakBucketLabel = b.bucketLabel; }
  }
  if (peakVal === 0) peakBucketLabel = null;

  return {
    locationId,
    range,
    metric,
    buckets:          chartBuckets,
    overallTrend,
    avgRate,
    peakBucketLabel,
    currentRate,
    nextHourForecast,
    totalInRange,
  };
}
