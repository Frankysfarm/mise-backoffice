/**
 * lib/delivery/analytics-export.ts
 *
 * Phase 322: Analytics-Export-Engine
 *
 * Exports von Delivery-Analytics-Snapshots als CSV oder als PDF-Rohdaten.
 *
 * Public API:
 *   getSnapshotsForExport(locationId, from, to)  — DB-Abfrage für Datumsbereich
 *   buildCsvString(snapshots, locationName)       — CSV-String generieren
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { AnalyticsSnapshot } from './delivery-analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExportSnapshot extends AnalyticsSnapshot {
  locationName: string;
}

export interface AnalyticsExportData {
  locationId:   string;
  locationName: string;
  from:         string;   // YYYY-MM-DD
  to:           string;   // YYYY-MM-DD
  generatedAt:  string;   // ISO
  snapshots:    AnalyticsSnapshot[];
  summary: {
    totalDays:            number;
    totalOrders:          number;
    totalDeliveries:      number;
    totalCancelled:       number;
    totalRevenueEur:      number;
    avgDeliveryRate:      number | null;
    avgDeliveryMin:       number | null;
    avgSlaCompliancePct:  number | null;
    avgCancellationRate:  number | null;
  };
}

// ─── DB-Abfrage ───────────────────────────────────────────────────────────────

export async function getSnapshotsForExport(
  locationId: string,
  from:        string,   // YYYY-MM-DD
  to:          string,   // YYYY-MM-DD
): Promise<AnalyticsSnapshot[]> {
  const svc = createServiceClient();

  const { data } = await svc
    .from('delivery_analytics_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('analytics_date', from)
    .lte('analytics_date', to)
    .order('analytics_date', { ascending: true })
    .limit(400);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    locationId:            r.location_id as string,
    analyticsDate:         r.analytics_date as string,
    totalOrders:           (r.total_orders as number) ?? 0,
    deliveryOrders:        (r.delivery_orders as number) ?? 0,
    completedDeliveries:   (r.completed_deliveries as number) ?? 0,
    cancelledOrders:       (r.cancelled_orders as number) ?? 0,
    deliveryRate:          r.delivery_rate as number | null,
    avgDeliveryMin:        r.avg_delivery_min as number | null,
    slaTotal:              (r.sla_total as number) ?? 0,
    slaOnTime:             (r.sla_on_time as number) ?? 0,
    slaCompliancePct:      r.sla_compliance_pct as number | null,
    cancellationRate:      r.cancellation_rate as number | null,
    totalRevenueEur:       r.total_revenue_eur as number | null,
    revenuePerDeliveryEur: r.revenue_per_delivery_eur as number | null,
    activeDrivers:         (r.active_drivers as number) ?? 0,
  }));
}

// ─── Perioden-Zusammenfassung ─────────────────────────────────────────────────

function avg(vals: (number | null)[]): number | null {
  const nums = vals.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

export function buildExportData(
  locationId:   string,
  locationName: string,
  from:         string,
  to:           string,
  snapshots:    AnalyticsSnapshot[],
): AnalyticsExportData {
  const totalOrders     = snapshots.reduce((s, r) => s + r.totalOrders, 0);
  const totalDeliveries = snapshots.reduce((s, r) => s + r.completedDeliveries, 0);
  const totalCancelled  = snapshots.reduce((s, r) => s + r.cancelledOrders, 0);
  const totalRevenueEur = snapshots.reduce((s, r) => s + (r.totalRevenueEur ?? 0), 0);

  return {
    locationId,
    locationName,
    from,
    to,
    generatedAt: new Date().toISOString(),
    snapshots,
    summary: {
      totalDays:           snapshots.length,
      totalOrders,
      totalDeliveries,
      totalCancelled,
      totalRevenueEur:     Math.round(totalRevenueEur * 100) / 100,
      avgDeliveryRate:     avg(snapshots.map((r) => r.deliveryRate)),
      avgDeliveryMin:      avg(snapshots.map((r) => r.avgDeliveryMin)),
      avgSlaCompliancePct: avg(snapshots.map((r) => r.slaCompliancePct)),
      avgCancellationRate: avg(snapshots.map((r) => r.cancellationRate)),
    },
  };
}

// ─── CSV-Generator ────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  'Datum',
  'Gesamt-Bestellungen',
  'Liefer-Bestellungen',
  'Abgeschlossene Lieferungen',
  'Stornierte Bestellungen',
  'Lieferrate (%)',
  'Ø Lieferzeit (Min)',
  'SLA gesamt',
  'SLA pünktlich',
  'SLA-Einhaltung (%)',
  'Stornoquote (%)',
  'Umsatz Lieferungen (€)',
  'Umsatz pro Lieferung (€)',
  'Aktive Fahrer',
];

function csvCell(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: (string | number | null)[]): string {
  return cells.map(csvCell).join(';');  // Semikolon für Excel DE
}

function fmtNum(v: number | null): string {
  if (v == null) return '';
  return String(v).replace('.', ',');  // Deutsches Dezimalformat
}

export function buildCsvString(data: AnalyticsExportData): string {
  const lines: string[] = [];

  // Meta-Header
  lines.push(`Delivery Analytics Report`);
  lines.push(`Standort;${data.locationName}`);
  lines.push(`Zeitraum;${data.from} – ${data.to}`);
  lines.push(`Erstellt am;${new Date(data.generatedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
  lines.push('');

  // Zusammenfassung
  lines.push('ZUSAMMENFASSUNG');
  lines.push(`Tage mit Daten;${data.summary.totalDays}`);
  lines.push(`Gesamt-Bestellungen;${data.summary.totalOrders}`);
  lines.push(`Abgeschlossene Lieferungen;${data.summary.totalDeliveries}`);
  lines.push(`Stornierte Bestellungen;${data.summary.totalCancelled}`);
  lines.push(`Gesamt-Umsatz Lieferungen;${fmtNum(data.summary.totalRevenueEur)} €`);
  lines.push(`Ø Lieferrate;${fmtNum(data.summary.avgDeliveryRate)} %`);
  lines.push(`Ø Lieferzeit;${fmtNum(data.summary.avgDeliveryMin)} Min`);
  lines.push(`Ø SLA-Einhaltung;${fmtNum(data.summary.avgSlaCompliancePct)} %`);
  lines.push(`Ø Stornoquote;${fmtNum(data.summary.avgCancellationRate)} %`);
  lines.push('');

  // Tages-Daten
  lines.push('TAGES-DETAIL');
  lines.push(CSV_HEADERS.join(';'));

  for (const r of data.snapshots) {
    lines.push(csvRow([
      r.analyticsDate,
      r.totalOrders,
      r.deliveryOrders,
      r.completedDeliveries,
      r.cancelledOrders,
      fmtNum(r.deliveryRate),
      fmtNum(r.avgDeliveryMin),
      r.slaTotal,
      r.slaOnTime,
      fmtNum(r.slaCompliancePct),
      fmtNum(r.cancellationRate),
      fmtNum(r.totalRevenueEur),
      fmtNum(r.revenuePerDeliveryEur),
      r.activeDrivers,
    ]));
  }

  return lines.join('\n');
}
