/**
 * lib/delivery/order-amendments.ts
 *
 * Smart Order Amendment Engine — Phase 211
 *
 * Tracks post-order modifications (items, address, notes, amounts) with a full
 * audit trail, signals re-evaluation when dispatch is affected, and exposes
 * KPI dashboards for operations managers.
 *
 * Functions:
 *  recordAmendment()           — Log a single field change on an order
 *  getAmendmentHistory()       — All amendments for one order
 *  getAmendmentDashboard()     — KPI dashboard for a location
 *  getAmendmentsByType()       — Counts broken down by amendment_type
 *  getInFlightAmendments()     — Orders in dispatch that were modified
 *  getDailyAmendmentTrend()    — 30-day daily trend data
 *  pruneOldAmendments()        — Cleanup older records
 *  pruneOldAmendmentsAllLocations() — Cron batch
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { logDeliveryEvent } from './events';

// ── Typen ────────────────────────────────────────────────────────────────────

export type AmendmentType =
  | 'item_added'
  | 'item_removed'
  | 'item_changed'
  | 'address_changed'
  | 'phone_changed'
  | 'notes_changed'
  | 'amount_adjusted'
  | 'tip_changed'
  | 'priority_changed'
  | 'other';

export interface AmendmentRecord {
  id: string;
  locationId: string;
  orderId: string;
  amendedByUser: string | null;
  amendmentType: AmendmentType;
  fieldName: string | null;
  oldValue: unknown;
  newValue: unknown;
  reason: string | null;
  affectedDispatch: boolean;
  etaRecalculated: boolean;
  deltaEur: number;
  batchId: string | null;
  createdAt: string;
}

export interface RecordAmendmentInput {
  locationId: string;
  orderId: string;
  amendedByUser?: string;
  amendmentType: AmendmentType;
  fieldName?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  affectedDispatch?: boolean;
  etaRecalculated?: boolean;
  deltaEur?: number;
  batchId?: string;
}

export interface AmendmentDashboard {
  summary: {
    todayCount: number;
    todayUniqueOrders: number;
    weekCount: number;
    dispatchImpactedAll: number;
    deltaEurToday: number;
    deltaEurWeek: number;
    upsellsToday: number;
    discountsToday: number;
    totalAllTime: number;
  };
  typeBreakdown: Array<{
    amendmentType: string;
    todayCount: number;
    weekCount: number;
    dispatchImpacted: number;
    avgDeltaEur: number;
  }>;
  inFlightAmendments: InFlightAmendment[];
  recentAmendments: AmendmentRecord[];
  dailyTrend: DailyAmendmentRow[];
}

export interface InFlightAmendment {
  orderId: string;
  locationId: string;
  bestellnummer: string;
  status: string;
  kundeName: string | null;
  miseBatchId: string | null;
  gesamtbetrag: number | null;
  latestAmendmentId: string;
  latestType: string;
  latestDeltaEur: number;
  affectedDispatch: boolean;
  amendedAt: string;
  reason: string | null;
}

export interface DailyAmendmentRow {
  day: string;
  totalAmendments: number;
  uniqueOrders: number;
  dispatchImpacted: number;
  deltaEurTotal: number;
  upsellAmendments: number;
  discountAmendments: number;
}

// ── recordAmendment ──────────────────────────────────────────────────────────

export async function recordAmendment(input: RecordAmendmentInput): Promise<AmendmentRecord> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('order_amendments')
    .insert({
      location_id: input.locationId,
      order_id: input.orderId,
      amended_by_user: input.amendedByUser ?? null,
      amendment_type: input.amendmentType,
      field_name: input.fieldName ?? null,
      old_value: input.oldValue !== undefined ? input.oldValue : null,
      new_value: input.newValue !== undefined ? input.newValue : null,
      reason: input.reason ?? null,
      affected_dispatch: input.affectedDispatch ?? false,
      eta_recalculated: input.etaRecalculated ?? false,
      delta_eur: input.deltaEur ?? 0,
      batch_id: input.batchId ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(`recordAmendment failed: ${error?.message}`);
  }

  await logDeliveryEvent({
    location_id: input.locationId,
    event_type: 'zone_classified', // reuse as audit marker; type_detail in payload
    order_id: input.orderId,
    batch_id: input.batchId ?? null,
    payload: {
      amendment_type: input.amendmentType,
      field: input.fieldName,
      delta_eur: input.deltaEur,
      affected_dispatch: input.affectedDispatch,
    },
  });

  return mapRow(data);
}

// ── getAmendmentHistory ───────────────────────────────────────────────────────

export async function getAmendmentHistory(
  orderId: string,
  locationId: string,
): Promise<AmendmentRecord[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('order_amendments')
    .select('*')
    .eq('order_id', orderId)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (data ?? []).map(mapRow);
}

// ── getAmendmentDashboard ─────────────────────────────────────────────────────

export async function getAmendmentDashboard(locationId: string): Promise<AmendmentDashboard> {
  const sb = createServiceClient();

  const [summaryRes, typeRes, inFlightRes, recentRes, trendRes] = await Promise.all([
    sb
      .from('v_amendment_summary')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),
    sb
      .from('v_amendment_type_counts')
      .select('*')
      .eq('location_id', locationId)
      .order('today_count', { ascending: false }),
    sb
      .from('v_amended_orders_in_flight')
      .select('*')
      .eq('location_id', locationId)
      .order('amended_at', { ascending: false })
      .limit(20),
    sb
      .from('order_amendments')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(30),
    sb
      .from('v_amendments_daily')
      .select('*')
      .eq('location_id', locationId)
      .order('day', { ascending: false })
      .limit(30),
  ]);

  const s = summaryRes.data;

  return {
    summary: {
      todayCount: s?.today_count ?? 0,
      todayUniqueOrders: s?.today_unique_orders ?? 0,
      weekCount: s?.week_count ?? 0,
      dispatchImpactedAll: s?.dispatch_impacted_all ?? 0,
      deltaEurToday: Number(s?.delta_eur_today ?? 0),
      deltaEurWeek: Number(s?.delta_eur_week ?? 0),
      upsellsToday: s?.upsells_today ?? 0,
      discountsToday: s?.discounts_today ?? 0,
      totalAllTime: s?.total_all_time ?? 0,
    },
    typeBreakdown: (typeRes.data ?? []).map((r) => ({
      amendmentType: r.amendment_type as string,
      todayCount: r.today_count as number,
      weekCount: r.week_count as number,
      dispatchImpacted: r.dispatch_impacted as number,
      avgDeltaEur: Number(r.avg_delta_eur ?? 0),
    })),
    inFlightAmendments: (inFlightRes.data ?? []).map((r) => ({
      orderId: r.order_id as string,
      locationId: r.location_id as string,
      bestellnummer: r.bestellnummer as string,
      status: r.status as string,
      kundeName: r.kunde_name as string | null,
      miseBatchId: r.mise_batch_id as string | null,
      gesamtbetrag: r.gesamtbetrag as number | null,
      latestAmendmentId: r.latest_amendment_id as string,
      latestType: r.latest_type as string,
      latestDeltaEur: Number(r.latest_delta_eur ?? 0),
      affectedDispatch: r.affected_dispatch as boolean,
      amendedAt: r.amended_at as string,
      reason: r.reason as string | null,
    })),
    recentAmendments: (recentRes.data ?? []).map(mapRow),
    dailyTrend: (trendRes.data ?? []).map((r) => ({
      day: r.day as string,
      totalAmendments: r.total_amendments as number,
      uniqueOrders: r.unique_orders as number,
      dispatchImpacted: r.dispatch_impacted as number,
      deltaEurTotal: Number(r.delta_eur_total ?? 0),
      upsellAmendments: r.upsell_amendments as number,
      discountAmendments: r.discount_amendments as number,
    })),
  };
}

// ── getInFlightAmendments ─────────────────────────────────────────────────────

export async function getInFlightAmendments(locationId: string): Promise<InFlightAmendment[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_amended_orders_in_flight')
    .select('*')
    .eq('location_id', locationId)
    .order('amended_at', { ascending: false })
    .limit(50);

  return (data ?? []).map((r) => ({
    orderId: r.order_id as string,
    locationId: r.location_id as string,
    bestellnummer: r.bestellnummer as string,
    status: r.status as string,
    kundeName: r.kunde_name as string | null,
    miseBatchId: r.mise_batch_id as string | null,
    gesamtbetrag: r.gesamtbetrag as number | null,
    latestAmendmentId: r.latest_amendment_id as string,
    latestType: r.latest_type as string,
    latestDeltaEur: Number(r.latest_delta_eur ?? 0),
    affectedDispatch: r.affected_dispatch as boolean,
    amendedAt: r.amended_at as string,
    reason: r.reason as string | null,
  }));
}

// ── getDailyAmendmentTrend ────────────────────────────────────────────────────

export async function getDailyAmendmentTrend(locationId: string): Promise<DailyAmendmentRow[]> {
  const sb = createServiceClient();

  const { data } = await sb
    .from('v_amendments_daily')
    .select('*')
    .eq('location_id', locationId)
    .order('day', { ascending: false })
    .limit(30);

  return (data ?? []).map((r) => ({
    day: r.day as string,
    totalAmendments: r.total_amendments as number,
    uniqueOrders: r.unique_orders as number,
    dispatchImpacted: r.dispatch_impacted as number,
    deltaEurTotal: Number(r.delta_eur_total ?? 0),
    upsellAmendments: r.upsell_amendments as number,
    discountAmendments: r.discount_amendments as number,
  }));
}

// ── pruneOldAmendments ────────────────────────────────────────────────────────

export async function pruneOldAmendments(
  locationId: string,
  daysToKeep = 90,
): Promise<number> {
  const sb = createServiceClient();

  const cutoff = new Date(Date.now() - daysToKeep * 86400_000).toISOString();
  const { count } = await sb
    .from('order_amendments')
    .delete({ count: 'exact' })
    .eq('location_id', locationId)
    .lt('created_at', cutoff);

  return count ?? 0;
}

export async function pruneOldAmendmentsAllLocations(daysToKeep = 90): Promise<number> {
  const sb = createServiceClient();

  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations) return 0;

  let total = 0;
  for (const loc of locations) {
    try {
      total += await pruneOldAmendments(loc.id as string, daysToKeep);
    } catch {
      // per-location error; continue
    }
  }
  return total;
}

// ── Interne Hilfsfunktionen ───────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): AmendmentRecord {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    orderId: r.order_id as string,
    amendedByUser: r.amended_by_user as string | null,
    amendmentType: r.amendment_type as AmendmentType,
    fieldName: r.field_name as string | null,
    oldValue: r.old_value,
    newValue: r.new_value,
    reason: r.reason as string | null,
    affectedDispatch: r.affected_dispatch as boolean,
    etaRecalculated: r.eta_recalculated as boolean,
    deltaEur: Number(r.delta_eur ?? 0),
    batchId: r.batch_id as string | null,
    createdAt: r.created_at as string,
  };
}
