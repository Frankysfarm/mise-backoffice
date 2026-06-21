/**
 * lib/delivery/ops-health-history.ts — Phase 392
 *
 * Ops-Health-History Engine.
 *
 * Persistiert alle 15 Minuten einen Ops-Gesundheits-Snapshot pro Standort.
 * Ermöglicht Trend-Charts im Lieferdienst-Dashboard: Wann kippt die Ops-Qualität?
 * Welche Stunden sind systematisch belastet?
 *
 * Gesundheits-Score (0–100):
 *   - SLA On-Time-Rate  (40%): on_time_pct → 0–40 Pkt
 *   - Driver Coverage   (25%): idle_ratio → 0–25 Pkt
 *   - Queue-Tiefe       (20%): niedrige Queue-Tiefe = gut → 0–20 Pkt
 *   - Alert-Penalty     (15%): kritische Alerts ziehen ab → 0–15 Pkt
 *
 * Public API:
 *   snapshotOpsHealth(locationId)         — aktuellen Snapshot berechnen + speichern
 *   snapshotOpsHealthAllLocations()       — Cron-Batch (alle 15 Min)
 *   getOpsHealthHistory(locationId, hours) — Trend-Daten (stündlich aggregiert)
 *   getOpsHealthSummary(locationId)       — KPIs: heute, letzte 7 Tage, Problemphasen
 *   pruneOpsHealthSnapshots(daysToKeep)   — Cleanup via SQL-Funktion
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface OpsHealthSnapshot {
  id: string;
  locationId: string;
  snappedAt: string;
  queueTotal: number;
  queueNeu: number;
  queueZubereitung: number;
  queueBereit: number;
  queueUnterwegs: number;
  driversOnline: number;
  driversIdle: number;
  driversActive: number;
  driversOffline: number;
  alertsCritical: number;
  alertsWarning: number;
  alertsTotal: number;
  slaOnTimePct: number | null;
  slaAvgDeviationMin: number | null;
  throughputPerHour: number;
  delaysActive: number;
  revenueTodayEur: number;
  healthScore: number;
}

export interface OpsHealthHourly {
  hourBucket: string;
  avgHealthScore: number;
  avgQueueTotal: number;
  avgDriversOnline: number;
  avgSlaOnTimePct: number | null;
  avgThroughputPerHour: number;
  maxAlertsCritical: number;
  snapshotCount: number;
}

export interface OpsHealthSummary {
  locationId: string;
  currentScore: number | null;
  avgScore24h: number | null;
  avgScore7d: number | null;
  worstHour24h: number | null;
  peakQueueDepth24h: number;
  criticalAlertCount24h: number;
  latestSnapshotAt: string | null;
  trend: 'improving' | 'stable' | 'declining';
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function computeHealthScore(params: {
  slaOnTimePct: number | null;
  driversOnline: number;
  driversIdle: number;
  queueTotal: number;
  alertsCritical: number;
}): number {
  const { slaOnTimePct, driversOnline, driversIdle, queueTotal, alertsCritical } = params;

  // 1. SLA On-Time (40 Punkte)
  const slaScore = Math.round(Math.min(40, ((slaOnTimePct ?? 75) / 100) * 40));

  // 2. Driver Coverage (25 Punkte): idle / online ratio > 0.3 ist gut
  const idleRatio = driversOnline > 0 ? driversIdle / driversOnline : 0;
  const driverScore = Math.round(Math.min(25, idleRatio * 80));

  // 3. Queue-Tiefe (20 Punkte): 0–2 Aufträge = 20, 10+ = 0
  const queueScore = Math.max(0, Math.round(20 - queueTotal * 2));

  // 4. Alert-Penalty (15 Punkte abzüglich)
  const alertDeduction = Math.min(15, alertsCritical * 5);
  const alertScore = Math.max(0, 15 - alertDeduction);

  return Math.min(100, Math.max(0, slaScore + driverScore + queueScore + alertScore));
}

// ── Core: Snapshot eines Standorts ────────────────────────────────────────────

export async function snapshotOpsHealth(locationId: string): Promise<OpsHealthSnapshot | null> {
  const sb = createServiceClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60_000);

  const [queueRes, driversRes, driverStatusRes, alertsRes, slaRes, throughputRes, delaysRes, revRes] =
    await Promise.allSettled([
      sb
        .from('customer_orders')
        .select('status')
        .eq('location_id', locationId)
        .eq('bestellart', 'lieferung')
        .in('status', ['neu', 'in_zubereitung', 'bereit_zur_lieferung', 'unterwegs'])
        .gte('bestellt_am', todayStart.toISOString()),

      sb
        .from('mise_drivers')
        .select('id, state, active')
        .eq('active', true),

      sb
        .from('driver_status')
        .select('driver_id, online'),

      sb
        .from('delivery_alerts')
        .select('severity')
        .eq('location_id', locationId)
        .eq('resolved', false),

      sb
        .from('delivery_performance')
        .select('on_time, eta_deviation_min')
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(20),

      sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('bestellart', 'lieferung')
        .in('status', ['abgeschlossen', 'geliefert'])
        .gte('geliefert_am', thirtyMinAgo.toISOString()),

      sb
        .from('customer_orders')
        .select('id', { count: 'exact', head: true })
        .eq('location_id', locationId)
        .eq('bestellart', 'lieferung')
        .not('eta_latest', 'is', null)
        .lt('eta_latest', now.toISOString())
        .not('status', 'in', '(abgeschlossen,geliefert,storniert)'),

      sb
        .from('customer_orders')
        .select('gesamtbetrag')
        .eq('location_id', locationId)
        .eq('bestellart', 'lieferung')
        .in('status', ['abgeschlossen', 'geliefert'])
        .gte('bestellt_am', todayStart.toISOString()),
    ]);

  // Queue-Breakdown
  const queueRows = queueRes.status === 'fulfilled' ? (queueRes.value.data ?? []) : [];
  const queueTotal       = queueRows.length;
  const queueNeu         = queueRows.filter((r) => r.status === 'neu').length;
  const queueZubereitung = queueRows.filter((r) => r.status === 'in_zubereitung').length;
  const queueBereit      = queueRows.filter((r) => r.status === 'bereit_zur_lieferung').length;
  const queueUnterwegs   = queueRows.filter((r) => r.status === 'unterwegs').length;

  // Driver-Breakdown
  const miseDrivers = driversRes.status === 'fulfilled' ? (driversRes.value.data ?? []) : [];
  const onlineSet = new Set(
    (driverStatusRes.status === 'fulfilled' ? (driverStatusRes.value.data ?? []) : [])
      .filter((d) => d.online)
      .map((d) => d.driver_id),
  );
  const driversOnline  = miseDrivers.filter((d) => onlineSet.has(d.id)).length;
  const driversIdle    = miseDrivers.filter((d) => onlineSet.has(d.id) && d.state === 'idle').length;
  const driversActive  = miseDrivers.filter((d) =>
    ['assigned', 'at_restaurant', 'en_route', 'returning'].includes(d.state),
  ).length;
  const driversOffline = miseDrivers.filter((d) => !onlineSet.has(d.id)).length;

  // Alerts
  const alertRows    = alertsRes.status === 'fulfilled' ? (alertsRes.value.data ?? []) : [];
  const alertsCritical = alertRows.filter((a) => a.severity === 'critical').length;
  const alertsWarning  = alertRows.filter((a) => a.severity === 'warning').length;
  const alertsTotal    = alertRows.length;

  // SLA
  const slaRows = slaRes.status === 'fulfilled' ? (slaRes.value.data ?? []) : [];
  const slaOnTimePct =
    slaRows.length > 0
      ? Math.round((slaRows.filter((r) => r.on_time).length / slaRows.length) * 100)
      : null;
  const slaAvgDeviationMin =
    slaRows.length > 0
      ? Math.round(
          slaRows.reduce((s, r) => s + Number(r.eta_deviation_min ?? 0), 0) / slaRows.length,
        )
      : null;

  // Throughput
  const throughputCount    = throughputRes.status === 'fulfilled' ? (throughputRes.value.count ?? 0) : 0;
  const throughputPerHour  = Math.round(throughputCount * 2);

  // Delays
  const delaysActive = delaysRes.status === 'fulfilled' ? (delaysRes.value.count ?? 0) : 0;

  // Revenue today
  const revRows = revRes.status === 'fulfilled' ? (revRes.value.data ?? []) : [];
  const revenueTodayEur = revRows.reduce((s, r) => s + Number(r.gesamtbetrag ?? 0), 0);

  // Health Score
  const healthScore = computeHealthScore({
    slaOnTimePct,
    driversOnline,
    driversIdle,
    queueTotal,
    alertsCritical,
  });

  // Persistieren
  const { data, error } = await sb
    .from('ops_health_snapshots')
    .insert({
      location_id:            locationId,
      snapped_at:             now.toISOString(),
      queue_total:            queueTotal,
      queue_neu:              queueNeu,
      queue_zubereitung:      queueZubereitung,
      queue_bereit:           queueBereit,
      queue_unterwegs:        queueUnterwegs,
      drivers_online:         driversOnline,
      drivers_idle:           driversIdle,
      drivers_active:         driversActive,
      drivers_offline:        driversOffline,
      alerts_critical:        alertsCritical,
      alerts_warning:         alertsWarning,
      alerts_total:           alertsTotal,
      sla_on_time_pct:        slaOnTimePct,
      sla_avg_deviation_min:  slaAvgDeviationMin,
      throughput_per_hour:    throughputPerHour,
      delays_active:          delaysActive,
      revenue_today_eur:      Math.round(revenueTodayEur * 100) / 100,
      health_score:           healthScore,
    })
    .select('id')
    .single();

  if (error || !data) return null;

  return {
    id: data.id as string,
    locationId,
    snappedAt: now.toISOString(),
    queueTotal, queueNeu, queueZubereitung, queueBereit, queueUnterwegs,
    driversOnline, driversIdle, driversActive, driversOffline,
    alertsCritical, alertsWarning, alertsTotal,
    slaOnTimePct, slaAvgDeviationMin,
    throughputPerHour, delaysActive,
    revenueTodayEur: Math.round(revenueTodayEur * 100) / 100,
    healthScore,
  };
}

// ── Cron-Batch ─────────────────────────────────────────────────────────────────

export async function snapshotOpsHealthAllLocations(): Promise<{
  locations: number;
  saved: number;
  errors: number;
}> {
  const sb = createServiceClient();

  const { data: locs } = await sb
    .from('mise_locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, saved: 0, errors: 0 };

  const results = await Promise.allSettled(
    locs.map((l) => snapshotOpsHealth(l.id as string)),
  );

  return {
    locations: locs.length,
    saved:     results.filter((r) => r.status === 'fulfilled' && r.value !== null).length,
    errors:    results.filter((r) => r.status === 'rejected').length,
  };
}

// ── History-Abfragen ──────────────────────────────────────────────────────────

export async function getOpsHealthHistory(
  locationId: string,
  hours = 24,
): Promise<OpsHealthHourly[]> {
  const sb = createServiceClient();

  const since = new Date(Date.now() - hours * 60 * 60_000).toISOString();

  // Stündliche Aggregation direkt via Query (ohne View für Portabilität)
  const { data } = await sb
    .from('ops_health_snapshots')
    .select(
      'snapped_at, health_score, queue_total, drivers_online, sla_on_time_pct, throughput_per_hour, alerts_critical',
    )
    .eq('location_id', locationId)
    .gte('snapped_at', since)
    .order('snapped_at', { ascending: true });

  if (!data || data.length === 0) return [];

  // Stündliche Buckets manuell aggregieren
  const buckets = new Map<
    string,
    {
      scores: number[];
      queues: number[];
      drivers: number[];
      slas: number[];
      throughputs: number[];
      maxCritical: number;
    }
  >();

  for (const row of data) {
    const hour = new Date(row.snapped_at as string);
    hour.setUTCMinutes(0, 0, 0);
    const key = hour.toISOString();

    const b = buckets.get(key) ?? {
      scores: [],
      queues: [],
      drivers: [],
      slas: [],
      throughputs: [],
      maxCritical: 0,
    };

    b.scores.push(Number(row.health_score));
    b.queues.push(Number(row.queue_total));
    b.drivers.push(Number(row.drivers_online));
    if (row.sla_on_time_pct != null) b.slas.push(Number(row.sla_on_time_pct));
    b.throughputs.push(Number(row.throughput_per_hour));
    b.maxCritical = Math.max(b.maxCritical, Number(row.alerts_critical));

    buckets.set(key, b);
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

  return Array.from(buckets.entries()).map(([hour, b]) => ({
    hourBucket:          hour,
    avgHealthScore:      avg(b.scores),
    avgQueueTotal:       avg(b.queues),
    avgDriversOnline:    avg(b.drivers),
    avgSlaOnTimePct:     b.slas.length > 0 ? avg(b.slas) : null,
    avgThroughputPerHour: avg(b.throughputs),
    maxAlertsCritical:   b.maxCritical,
    snapshotCount:       b.scores.length,
  }));
}

// ── Summary ───────────────────────────────────────────────────────────────────

export async function getOpsHealthSummary(locationId: string): Promise<OpsHealthSummary> {
  const sb = createServiceClient();
  const now = new Date();
  const h24ago = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const d7ago  = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();

  const [latestRes, h24Res, d7Res] = await Promise.allSettled([
    sb
      .from('ops_health_snapshots')
      .select('health_score, snapped_at')
      .eq('location_id', locationId)
      .order('snapped_at', { ascending: false })
      .limit(1)
      .maybeSingle(),

    sb
      .from('ops_health_snapshots')
      .select('health_score, queue_total, alerts_critical, snapped_at')
      .eq('location_id', locationId)
      .gte('snapped_at', h24ago),

    sb
      .from('ops_health_snapshots')
      .select('health_score')
      .eq('location_id', locationId)
      .gte('snapped_at', d7ago),
  ]);

  const latest = latestRes.status === 'fulfilled' ? latestRes.value.data : null;
  const h24Rows = h24Res.status === 'fulfilled' ? (h24Res.value.data ?? []) : [];
  const d7Rows  = d7Res.status === 'fulfilled'  ? (d7Res.value.data ?? [])  : [];

  const avgOf = (rows: Array<{ health_score: number }>) =>
    rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + Number(r.health_score), 0) / rows.length)
      : null;

  const avgScore24h = avgOf(h24Rows);
  const avgScore7d  = avgOf(d7Rows);

  // Schlechteste Stunde der letzten 24h (niedrigster avg score)
  let worstHour24h: number | null = null;
  if (h24Rows.length > 0) {
    const hourMap = new Map<number, number[]>();
    for (const r of h24Rows) {
      const h = new Date(r.snapped_at as string).getUTCHours();
      const arr = hourMap.get(h) ?? [];
      arr.push(Number(r.health_score));
      hourMap.set(h, arr);
    }
    let minScore = Infinity;
    for (const [h, scores] of hourMap) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      if (avg < minScore) { minScore = avg; worstHour24h = h; }
    }
  }

  const peakQueueDepth24h =
    h24Rows.length > 0
      ? Math.max(...h24Rows.map((r) => Number((r as { queue_total?: number }).queue_total ?? 0)))
      : 0;

  const criticalAlertCount24h = h24Rows.reduce(
    (s, r) => s + Number((r as { alerts_critical?: number }).alerts_critical ?? 0),
    0,
  );

  // Trend: 1. Hälfte vs. 2. Hälfte der letzten 24h
  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (h24Rows.length >= 4) {
    const mid  = Math.floor(h24Rows.length / 2);
    const old  = avgOf(h24Rows.slice(0, mid)) ?? 50;
    const recent = avgOf(h24Rows.slice(mid)) ?? 50;
    const delta = recent - old;
    if (delta >= 5) trend = 'improving';
    else if (delta <= -5) trend = 'declining';
  }

  return {
    locationId,
    currentScore:        latest ? Number(latest.health_score) : null,
    avgScore24h,
    avgScore7d,
    worstHour24h,
    peakQueueDepth24h,
    criticalAlertCount24h,
    latestSnapshotAt:    latest ? (latest.snapped_at as string) : null,
    trend,
  };
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOpsHealthSnapshots(daysToKeep = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_ops_health_snapshots', { days_to_keep: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
