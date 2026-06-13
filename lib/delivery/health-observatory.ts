/**
 * lib/delivery/health-observatory.ts
 *
 * Phase 102: Health Observatory — System-Gesundheitsmonitoring
 *
 * Periodische Snapshots operationaler KPIs und Multi-Tenant-Isolations-Audits.
 * Gibt Betreibern einen Echtzeit-Gesundheitsindex (0–100) für ihr Delivery-System.
 *
 * Health-Score-Formel (100 Punkte Basis, Abzüge):
 *   - Keine Fahrer online        → -25
 *   - Weniger als 3 Fahrer       → -10
 *   - Dispatch-Warteschlange > 5 → -10  (> 10: -20)
 *   - Offene Alarme > 0          → -5   (> 2: -15)
 *   - ETA-Genauigkeit < 85%      → -10  (< 70%: -20)
 *   Minimum: 0
 *
 * Bewertungsskala: A ≥ 90 · B ≥ 75 · C ≥ 55 · D < 55
 *
 * Funktionen:
 *   takeHealthSnapshot()          — Aktuellen Zustand erfassen + speichern
 *   takeSnapshotAllLocations()    — Cron-Batch alle aktiven Locations
 *   runIsolationAudit()           — 10 Tabellen auf fehlende location_id prüfen
 *   getHealthTrend()              — 24h stündliche Trend-Daten
 *   getLatestSnapshot()           — Letzten gespeicherten Snapshot laden
 *   getObservatoryDashboard()     — Kombinierter Dashboard-Response
 *   pruneOldSnapshots()           — Snapshots > 7 Tage löschen (Cron)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface HealthSnapshot {
  id: string;
  location_id: string;
  snapshot_at: string;
  drivers_online: number;
  drivers_active: number;
  pending_orders: number;
  active_tours: number;
  dispatch_queue: number;
  open_alerts: number;
  avg_eta_min: number | null;
  eta_accuracy_pct: number | null;
  health_score: number;
}

export interface HealthGrade {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D';
  label: string;
  color: string;
}

export interface TrendBucket {
  hour_bucket: string;
  avg_drivers_online: number;
  avg_pending_orders: number;
  avg_active_tours: number;
  avg_dispatch_queue: number;
  avg_health_score: number;
  min_health_score: number;
  sample_count: number;
}

export interface IsolationAuditResult {
  id: string;
  audited_at: string;
  table_name: string;
  total_rows: number;
  orphaned_rows: number;
  severity: 'ok' | 'warning' | 'critical';
  notes: string | null;
}

export interface ObservatoryDashboard {
  location_id: string;
  latest_snapshot: HealthSnapshot | null;
  grade: HealthGrade;
  trend_24h: TrendBucket[];
  audit_results: IsolationAuditResult[];
  last_audit_at: string | null;
  score_breakdown: ScoreBreakdown;
}

interface ScoreBreakdown {
  base: number;
  deductions: Array<{ reason: string; points: number }>;
  final: number;
}

interface SnapshotAllResult {
  locations: number;
  snapshots: number;
  errors: number;
}

// ============================================================
// Score-Logik
// ============================================================

function computeHealthScore(
  driversOnline: number,
  dispatchQueue: number,
  openAlerts: number,
  etaAccuracy: number | null,
): { score: number; breakdown: ScoreBreakdown } {
  const deductions: Array<{ reason: string; points: number }> = [];
  let total = 100;

  if (driversOnline === 0) {
    deductions.push({ reason: 'Kein Fahrer online', points: -25 });
    total -= 25;
  } else if (driversOnline < 3) {
    deductions.push({ reason: 'Weniger als 3 Fahrer online', points: -10 });
    total -= 10;
  }

  if (dispatchQueue > 10) {
    deductions.push({ reason: 'Dispatch-Warteschlange > 10', points: -20 });
    total -= 20;
  } else if (dispatchQueue > 5) {
    deductions.push({ reason: 'Dispatch-Warteschlange > 5', points: -10 });
    total -= 10;
  }

  if (openAlerts > 2) {
    deductions.push({ reason: `${openAlerts} offene Alarme`, points: -15 });
    total -= 15;
  } else if (openAlerts > 0) {
    deductions.push({ reason: `${openAlerts} offene${openAlerts === 1 ? 'r' : ''} Alarm`, points: -5 });
    total -= 5;
  }

  if (etaAccuracy !== null) {
    if (etaAccuracy < 70) {
      deductions.push({ reason: `ETA-Genauigkeit ${etaAccuracy.toFixed(0)}% (< 70%)`, points: -20 });
      total -= 20;
    } else if (etaAccuracy < 85) {
      deductions.push({ reason: `ETA-Genauigkeit ${etaAccuracy.toFixed(0)}% (< 85%)`, points: -10 });
      total -= 10;
    }
  }

  return {
    score: Math.max(0, Math.min(100, total)),
    breakdown: {
      base: 100,
      deductions,
      final: Math.max(0, Math.min(100, total)),
    },
  };
}

function scoreToGrade(score: number): HealthGrade {
  if (score >= 90) return { score, grade: 'A', label: 'Ausgezeichnet', color: 'green' };
  if (score >= 75) return { score, grade: 'B', label: 'Gut', color: 'blue' };
  if (score >= 55) return { score, grade: 'C', label: 'Ausreichend', color: 'amber' };
  return { score, grade: 'D', label: 'Kritisch', color: 'red' };
}

// ============================================================
// Kern-Snapshot-Funktion
// ============================================================

export async function takeHealthSnapshot(locationId: string): Promise<HealthSnapshot | null> {
  const sb = createServiceClient();

  // Online-Fahrer (mise_drivers hat kein location_id — globale Messung)
  const [
    { count: driversOnline },
    { count: driversActive },
    { count: pendingOrders },
    { count: activeTours },
    { count: dispatchQueue },
    { count: openAlerts },
  ] = await Promise.all([
    sb.from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .in('state', ['idle', 'assigned', 'at_restaurant', 'en_route', 'returning']),

    sb.from('mise_drivers')
      .select('id', { count: 'exact', head: true })
      .eq('active', true)
      .in('state', ['en_route', 'at_restaurant']),

    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .not('status', 'in', '(storniert,abgeschlossen,geliefert)'),

    sb.from('mise_delivery_batches')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .not('state', 'in', '(completed,cancelled,delivered)'),

    sb.from('customer_orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('typ', 'lieferung')
      .is('mise_batch_id', null)
      .not('status', 'in', '(storniert,abgeschlossen,geliefert)'),

    sb.from('delivery_alerts')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .is('resolved_at', null),
  ]);

  // ETA-Genauigkeit aus letzten 50 Performance-Records
  const { data: perfRows } = await sb
    .from('delivery_performance')
    .select('on_time')
    .eq('location_id', locationId)
    .order('recorded_at', { ascending: false })
    .limit(50);

  let etaAccuracyPct: number | null = null;
  if (perfRows && perfRows.length >= 10) {
    etaAccuracyPct = Math.round(
      (perfRows.filter((r: { on_time: boolean }) => r.on_time).length / perfRows.length) * 1000,
    ) / 10;
  }

  // Ø ETA aktiver Touren
  const { data: activeTourRows } = await sb
    .from('mise_delivery_batches')
    .select('total_eta_min')
    .eq('location_id', locationId)
    .eq('state', 'on_route')
    .not('total_eta_min', 'is', null)
    .limit(20);

  let avgEtaMin: number | null = null;
  if (activeTourRows && activeTourRows.length > 0) {
    const etaValues = activeTourRows
      .map((r: { total_eta_min: number | null }) => r.total_eta_min)
      .filter((v): v is number => v !== null);
    if (etaValues.length > 0) {
      avgEtaMin = Math.round((etaValues.reduce((a, b) => a + b, 0) / etaValues.length) * 10) / 10;
    }
  }

  const online   = driversOnline ?? 0;
  const queue    = dispatchQueue ?? 0;
  const alerts   = openAlerts ?? 0;

  const { score } = computeHealthScore(online, queue, alerts, etaAccuracyPct);

  const { data: saved, error } = await sb
    .from('delivery_health_snapshots')
    .insert({
      location_id:      locationId,
      drivers_online:   online,
      drivers_active:   driversActive ?? 0,
      pending_orders:   pendingOrders ?? 0,
      active_tours:     activeTours ?? 0,
      dispatch_queue:   queue,
      open_alerts:      alerts,
      avg_eta_min:      avgEtaMin,
      eta_accuracy_pct: etaAccuracyPct,
      health_score:     score,
    })
    .select()
    .single();

  if (error) {
    console.error('[health-observatory] snapshot insert error:', error.message);
    return null;
  }
  return saved as HealthSnapshot;
}

// ============================================================
// Cron-Batch
// ============================================================

export async function takeSnapshotAllLocations(): Promise<SnapshotAllResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  if (!locations?.length) return { locations: 0, snapshots: 0, errors: 0 };

  let snapshots = 0;
  let errors = 0;

  await Promise.all(
    locations.map(async (loc: { id: string }) => {
      const result = await takeHealthSnapshot(loc.id).catch(() => null);
      if (result) snapshots++;
      else errors++;
    }),
  );

  return { locations: locations.length, snapshots, errors };
}

// ============================================================
// Isolations-Audit
// ============================================================

const AUDIT_TABLES: Array<{ table: string; notes: string }> = [
  { table: 'mise_delivery_batches',          notes: 'Haupttouren-Tabelle' },
  { table: 'delivery_zone_config',           notes: 'Zonen-Konfiguration' },
  { table: 'delivery_alerts',                notes: 'Betriebsalarme' },
  { table: 'delivery_alert_rules',           notes: 'Alarmregeln' },
  { table: 'driver_shifts',                  notes: 'Fahrer-Schichten' },
  { table: 'driver_payout_records',          notes: 'Abrechnungs-Datensätze' },
  { table: 'driver_performance_snapshots',   notes: 'Performance-Snapshots' },
  { table: 'delivery_events',                notes: 'Event-Log' },
  { table: 'delivery_profitability_snapshots', notes: 'P&L-Snapshots' },
  { table: 'customer_churn_risk_scores',     notes: 'Churn-Risikoscores' },
];

export async function runIsolationAudit(): Promise<IsolationAuditResult[]> {
  const sb = createServiceClient();
  const now = new Date().toISOString();
  const results: IsolationAuditResult[] = [];

  for (const { table, notes } of AUDIT_TABLES) {
    try {
      const [{ count: total }, { count: orphaned }] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any).from(table).select('id', { count: 'exact', head: true }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (sb as any).from(table).select('id', { count: 'exact', head: true }).is('location_id', null),
      ]);

      const totalRows    = total ?? 0;
      const orphanedRows = orphaned ?? 0;
      const severity: 'ok' | 'warning' | 'critical' =
        orphanedRows === 0 ? 'ok' :
        orphanedRows < 10  ? 'warning' : 'critical';

      const { data: saved } = await sb
        .from('delivery_isolation_audits')
        .insert({
          audited_at:    now,
          table_name:    table,
          total_rows:    totalRows,
          orphaned_rows: orphanedRows,
          severity,
          notes,
        })
        .select()
        .single();

      if (saved) results.push(saved as IsolationAuditResult);
    } catch {
      // Tabelle existiert noch nicht in dieser DB-Instanz → überspringen
    }
  }

  return results;
}

// ============================================================
// Lese-Funktionen
// ============================================================

export async function getLatestSnapshot(locationId: string): Promise<HealthSnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('delivery_health_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as HealthSnapshot | null;
}

export async function getHealthTrend(locationId: string, hours = 24): Promise<TrendBucket[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data } = await sb
    .from('delivery_health_snapshots')
    .select('snapshot_at, drivers_online, pending_orders, active_tours, dispatch_queue, health_score')
    .eq('location_id', locationId)
    .gte('snapshot_at', since)
    .order('snapshot_at', { ascending: true });

  if (!data?.length) return [];

  // Client-seitige Stunden-Bucket-Aggregation (kein RPC erforderlich)
  const buckets = new Map<string, {
    online: number[]; pending: number[]; tours: number[];
    queue: number[]; scores: number[];
  }>();

  for (const row of data as Array<{
    snapshot_at: string; drivers_online: number; pending_orders: number;
    active_tours: number; dispatch_queue: number; health_score: number;
  }>) {
    const hour = new Date(row.snapshot_at);
    hour.setMinutes(0, 0, 0);
    const key = hour.toISOString();
    if (!buckets.has(key)) buckets.set(key, { online: [], pending: [], tours: [], queue: [], scores: [] });
    const b = buckets.get(key)!;
    b.online.push(row.drivers_online);
    b.pending.push(row.pending_orders);
    b.tours.push(row.active_tours);
    b.queue.push(row.dispatch_queue);
    b.scores.push(row.health_score);
  }

  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const min = (arr: number[]) => Math.min(...arr);

  return Array.from(buckets.entries()).map(([key, b]) => ({
    hour_bucket:          key,
    avg_drivers_online:   avg(b.online),
    avg_pending_orders:   avg(b.pending),
    avg_active_tours:     avg(b.tours),
    avg_dispatch_queue:   avg(b.queue),
    avg_health_score:     avg(b.scores),
    min_health_score:     min(b.scores),
    sample_count:         b.scores.length,
  }));
}

export async function getLatestAuditResults(): Promise<IsolationAuditResult[]> {
  const sb = createServiceClient();

  // Letzten Audit-Zeitstempel ermitteln
  const { data: last } = await sb
    .from('delivery_isolation_audits')
    .select('audited_at')
    .order('audited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last?.audited_at) return [];

  // Alle Zeilen dieses Audit-Laufs laden
  const { data } = await sb
    .from('delivery_isolation_audits')
    .select('*')
    .eq('audited_at', last.audited_at)
    .order('table_name');

  return (data ?? []) as IsolationAuditResult[];
}

// ============================================================
// Kombinierter Dashboard-Response
// ============================================================

export async function getObservatoryDashboard(locationId: string): Promise<ObservatoryDashboard> {
  const [latest, trend, auditResults] = await Promise.all([
    getLatestSnapshot(locationId),
    getHealthTrend(locationId, 24),
    getLatestAuditResults(),
  ]);

  const score = latest?.health_score ?? 100;
  const grade = scoreToGrade(score);

  const { breakdown } = computeHealthScore(
    latest?.drivers_online ?? 0,
    latest?.dispatch_queue ?? 0,
    latest?.open_alerts ?? 0,
    latest?.eta_accuracy_pct ?? null,
  );

  const lastAuditAt = auditResults[0]?.audited_at ?? null;

  return {
    location_id:     locationId,
    latest_snapshot: latest,
    grade,
    trend_24h:       trend,
    audit_results:   auditResults,
    last_audit_at:   lastAuditAt,
    score_breakdown: breakdown,
  };
}

// ============================================================
// Cron-Cleanup
// ============================================================

export async function pruneOldSnapshots(): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from('delivery_health_snapshots')
    .delete({ count: 'exact' })
    .lt('snapshot_at', cutoff);
  return count ?? 0;
}
