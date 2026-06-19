/**
 * lib/delivery/shift-goals.ts
 *
 * Phase 308 — Tages-/Schichtziele
 *
 * Speichert konfigurierbare Ziele (Bestellungen, Umsatz, Schichtlänge) je Location
 * und berechnet Ist-Werte + Pace aus customer_orders.
 *
 * Öffentliche Funktionen:
 *   getShiftGoals(locationId)            — Konfiguration lesen (Defaults wenn leer)
 *   upsertShiftGoals(locationId, config) — Konfiguration speichern
 *   getShiftGoalsDashboard(locationId)   — Konfiguration + Ist-Werte + Pace
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface ShiftGoalConfig {
  targetOrders: number;
  targetRevenue: number;
  shiftHoursTotal: number;
  shiftStartHour: number;
}

export interface ShiftGoalsDashboard extends ShiftGoalConfig {
  actualOrders: number;
  actualRevenue: number;
  actualDeliveries: number;
  avgDeliveryMin: number;
  onTimePct: number;
  shiftHoursElapsed: number;
  pace: 'ahead' | 'on_track' | 'behind';
  projectedOrders: number;
  projectedRevenue: number;
}

// ── Interne Hilfstypen ────────────────────────────────────────────────────────

interface OrderRow {
  typ: string | null;
  status: string | null;
  gesamtbetrag: number | null;
  created_at: string;
  fertig_am: string | null;
  eta_earliest: string | null;
}

// ── Öffentliche Funktionen ────────────────────────────────────────────────────

export async function getShiftGoals(locationId: string): Promise<ShiftGoalConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('shift_goals')
    .select('target_orders,target_revenue_eur,shift_hours_total,shift_start_hour')
    .eq('location_id', locationId)
    .maybeSingle();

  return {
    targetOrders: (data as { target_orders?: number } | null)?.target_orders ?? 60,
    targetRevenue: Number((data as { target_revenue_eur?: number } | null)?.target_revenue_eur ?? 1500),
    shiftHoursTotal: Number((data as { shift_hours_total?: number } | null)?.shift_hours_total ?? 8),
    shiftStartHour: (data as { shift_start_hour?: number } | null)?.shift_start_hour ?? 10,
  };
}

export async function upsertShiftGoals(
  locationId: string,
  config: Partial<ShiftGoalConfig>,
): Promise<void> {
  const sb = createServiceClient();
  const row: Record<string, unknown> = {
    location_id: locationId,
    updated_at: new Date().toISOString(),
  };
  if (config.targetOrders !== undefined)    row.target_orders      = config.targetOrders;
  if (config.targetRevenue !== undefined)   row.target_revenue_eur = config.targetRevenue;
  if (config.shiftHoursTotal !== undefined) row.shift_hours_total  = config.shiftHoursTotal;
  if (config.shiftStartHour !== undefined)  row.shift_start_hour   = config.shiftStartHour;

  await sb.from('shift_goals').upsert(row, { onConflict: 'location_id' });
}

export async function getShiftGoalsDashboard(locationId: string): Promise<ShiftGoalsDashboard> {
  const goals = await getShiftGoals(locationId);

  // Shift window: shift_start_hour UTC today
  const now = new Date();
  const shiftStartToday = new Date(now);
  shiftStartToday.setUTCHours(goals.shiftStartHour, 0, 0, 0);

  // If current time is before today's shift start, consider yesterday's shift
  if (now < shiftStartToday) {
    shiftStartToday.setUTCDate(shiftStartToday.getUTCDate() - 1);
  }

  const shiftEndToday = new Date(shiftStartToday);
  shiftEndToday.setUTCHours(
    shiftStartToday.getUTCHours() + Math.floor(goals.shiftHoursTotal),
    Math.round((goals.shiftHoursTotal % 1) * 60),
    0,
    0,
  );

  const shiftHoursElapsed = Math.max(
    0,
    Math.min(
      goals.shiftHoursTotal,
      (now.getTime() - shiftStartToday.getTime()) / 3_600_000,
    ),
  );

  const sb = createServiceClient();
  const { data: rawOrders } = await sb
    .from('customer_orders')
    .select('typ,status,gesamtbetrag,created_at,fertig_am,eta_earliest')
    .eq('location_id', locationId)
    .gte('created_at', shiftStartToday.toISOString())
    .lte('created_at', shiftEndToday.toISOString());

  const orders = (rawOrders ?? []) as OrderRow[];

  const completedStatuses = new Set(['geliefert', 'abgeschlossen', 'fertig']);
  const deliveredStatuses = new Set(['geliefert', 'abgeschlossen']);

  const completedOrders = orders.filter((o) => completedStatuses.has(o.status ?? ''));
  const deliveryOrders  = orders.filter((o) => o.typ === 'lieferung');
  const deliveredOrders = deliveryOrders.filter((o) => deliveredStatuses.has(o.status ?? ''));

  const actualOrders  = orders.length;
  const actualRevenue = completedOrders.reduce((s, o) => s + Number(o.gesamtbetrag ?? 0), 0);
  const actualDeliveries = deliveredOrders.length;

  // Avg delivery time: fertig_am - created_at, outliers >240 min excluded
  const deliveryTimes = deliveredOrders
    .filter((o): o is OrderRow & { fertig_am: string } => !!o.fertig_am)
    .map((o) => (new Date(o.fertig_am).getTime() - new Date(o.created_at).getTime()) / 60_000)
    .filter((t) => t > 0 && t < 240);

  const avgDeliveryMin =
    deliveryTimes.length > 0
      ? deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length
      : 0;

  // On-time: fertig_am <= eta_earliest
  const onTimeCount = deliveredOrders.filter((o) => {
    if (!o.fertig_am || !o.eta_earliest) return false;
    return new Date(o.fertig_am) <= new Date(o.eta_earliest);
  }).length;

  const onTimePct =
    deliveredOrders.length > 0 ? (onTimeCount / deliveredOrders.length) * 100 : 0;

  // Pace projection
  const ordersPerHour = shiftHoursElapsed > 0.1 ? actualOrders / shiftHoursElapsed : 0;
  const projectedOrders = Math.round(ordersPerHour * goals.shiftHoursTotal);
  const avgOrderValue = actualOrders > 0 ? actualRevenue / actualOrders : 25;
  const projectedRevenue = projectedOrders * (avgOrderValue || 25);

  const pace: 'ahead' | 'on_track' | 'behind' =
    projectedOrders >= goals.targetOrders * 1.05
      ? 'ahead'
      : projectedOrders >= goals.targetOrders * 0.9
      ? 'on_track'
      : 'behind';

  return {
    ...goals,
    actualOrders,
    actualRevenue,
    actualDeliveries,
    avgDeliveryMin,
    onTimePct,
    shiftHoursElapsed,
    pace,
    projectedOrders,
    projectedRevenue,
  };
}
