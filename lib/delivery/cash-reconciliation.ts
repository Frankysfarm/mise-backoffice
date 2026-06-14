/**
 * lib/delivery/cash-reconciliation.ts
 *
 * Cash-on-Delivery Reconciliation Engine — Phase 169
 *
 * Verwaltet Bargeld-Abrechnungen für Lieferfahrer:
 *  1. computeExpectedCash()       — Erwartetes Bargeld aus gelieferten Bar-Bestellungen
 *  2. upsertSettlement()          — Abrechnung erstellen / aktualisieren (open)
 *  3. reconcileDriverToday()      — Einzelfahrer-Abrechnung für heute
 *  4. reconcileAllDriversToday()  — Batch: alle aktiven Fahrer eines Standorts
 *  5. reconcileAllLocations()     — Cron-Batch für alle Standorte
 *  6. settlePayment()             — Tatsächliche Übergabe erfassen → settled
 *  7. disputeSettlement()         — Als strittig markieren
 *  8. getCashDashboard()          — Admin-Dashboard (KPIs + Liste + Trend)
 *  9. getDriverCashHistory()      — Fahrer-Verlauf (letzte 30 Tage)
 * 10. addFloatTransaction()       — Kassenlade-Buchung
 * 11. getFloatBalance()           — Aktueller Kassenstand
 * 12. getOpenSettlements()        — Offene Abrechnungen (für Alerts)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface CashSettlement {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  shiftDate: string;
  expectedCashEur: number;
  actualCashEur: number | null;
  discrepancyEur: number | null;
  cashOrderCount: number;
  status: 'open' | 'settled' | 'disputed';
  settledAt: string | null;
  settledByEmployeeId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FloatTransaction {
  id: string;
  locationId: string;
  transactionType: 'deposit' | 'withdrawal' | 'initial' | 'adjustment';
  amountEur: number;
  description: string | null;
  employeeId: string | null;
  referenceSettlementId: string | null;
  createdAt: string;
}

export interface TodaySummary {
  locationId: string;
  locationName: string;
  totalSettlements: number;
  openCount: number;
  settledCount: number;
  disputedCount: number;
  totalExpectedEur: number;
  totalActualEur: number;
  totalDiscrepancyEur: number;
  totalCashOrders: number;
}

export interface TrendRow {
  shiftDate: string;
  driverCount: number;
  expectedEur: number;
  actualEur: number;
  discrepancyEur: number;
  disputes: number;
}

export interface CashDashboard {
  summary: TodaySummary | null;
  settlements: CashSettlement[];
  trend: TrendRow[];
  floatBalance: number;
  recentFloat: FloatTransaction[];
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function toSettlement(r: Record<string, unknown>): CashSettlement {
  const actual = r.actual_cash_eur != null ? Number(r.actual_cash_eur) : null;
  const expected = Number(r.expected_cash_eur ?? 0);
  return {
    id:                    r.id as string,
    locationId:            r.location_id as string,
    driverId:              r.driver_id as string,
    driverName:            (r.driver_name as string | null) ?? null,
    shiftDate:             r.shift_date as string,
    expectedCashEur:       expected,
    actualCashEur:         actual,
    discrepancyEur:        actual != null ? actual - expected : null,
    cashOrderCount:        Number(r.cash_order_count ?? 0),
    status:                (r.status as 'open' | 'settled' | 'disputed') ?? 'open',
    settledAt:             (r.settled_at as string | null) ?? null,
    settledByEmployeeId:   (r.settled_by_employee_id as string | null) ?? null,
    notes:                 (r.notes as string | null) ?? null,
    createdAt:             r.created_at as string,
    updatedAt:             r.updated_at as string,
  };
}

// ── 1. Erwartetes Bargeld berechnen ────────────────────────────────────────────

export async function computeExpectedCash(
  driverId: string,
  locationId: string,
  date: string,
): Promise<{ expectedCashEur: number; cashOrderCount: number }> {
  const sb = createServiceClient();
  const dayStart = `${date}T00:00:00Z`;
  const dayEnd   = `${date}T23:59:59Z`;

  // Mise-Fahrer: über mise_delivery_batch_stops → mise_delivery_batches.driver_id
  const { data: miseOrders } = await sb
    .from('mise_delivery_batch_stops')
    .select('order_id, mise_delivery_batches!inner(driver_id, location_id)')
    .eq('mise_delivery_batches.driver_id', driverId)
    .eq('mise_delivery_batches.location_id', locationId)
    .eq('status', 'delivered')
    .gte('delivered_at', dayStart)
    .lte('delivered_at', dayEnd)
    .limit(500);

  const orderIds: string[] = (miseOrders ?? []).map(
    (s: Record<string, unknown>) => s.order_id as string,
  ).filter(Boolean);

  if (orderIds.length === 0) {
    return { expectedCashEur: 0, cashOrderCount: 0 };
  }

  const { data: cashOrders } = await sb
    .from('customer_orders')
    .select('gesamtbetrag')
    .in('id', orderIds)
    .eq('zahlungsart', 'bar')
    .eq('bezahlt', false);

  const cashOrderCount = (cashOrders ?? []).length;
  const expectedCashEur = (cashOrders ?? []).reduce(
    (sum: number, o: Record<string, unknown>) => sum + Number(o.gesamtbetrag ?? 0),
    0,
  );

  return { expectedCashEur, cashOrderCount };
}

// ── 2. Abrechnung erstellen / aktualisieren ────────────────────────────────────

export async function upsertSettlement(
  driverId: string,
  locationId: string,
  date: string,
  driverName?: string,
): Promise<CashSettlement | null> {
  const sb = createServiceClient();
  const { expectedCashEur, cashOrderCount } = await computeExpectedCash(driverId, locationId, date);

  // Fetch driver name if not provided
  let resolvedName = driverName ?? null;
  if (!resolvedName) {
    const { data: emp } = await sb
      .from('employees')
      .select('vorname, nachname')
      .eq('id', driverId)
      .maybeSingle();
    if (emp) {
      resolvedName = `${(emp as Record<string, string>).vorname ?? ''} ${(emp as Record<string, string>).nachname ?? ''}`.trim() || null;
    }
  }

  const { data, error } = await sb
    .from('driver_cash_settlements')
    .upsert({
      location_id:      locationId,
      driver_id:        driverId,
      driver_name:      resolvedName,
      shift_date:       date,
      expected_cash_eur: expectedCashEur,
      cash_order_count:  cashOrderCount,
    }, {
      onConflict: 'location_id,driver_id,shift_date',
      ignoreDuplicates: false,
    })
    .select()
    .maybeSingle();

  if (error || !data) return null;
  return toSettlement(data as Record<string, unknown>);
}

// ── 3. Einzelfahrer für heute ──────────────────────────────────────────────────

export async function reconcileDriverToday(
  driverId: string,
  locationId: string,
): Promise<CashSettlement | null> {
  const today = new Date().toISOString().slice(0, 10);
  return upsertSettlement(driverId, locationId, today);
}

// ── 4. Alle aktiven Fahrer eines Standorts ─────────────────────────────────────

export async function reconcileAllDriversToday(locationId: string): Promise<{
  created: number;
  updated: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Fahrer mit mindestens einer Lieferung heute
  const { data: activeDrivers } = await sb
    .from('mise_delivery_batches')
    .select('driver_id, driver_name')
    .eq('location_id', locationId)
    .eq('status', 'delivered')
    .gte('created_at', `${today}T00:00:00Z`)
    .limit(100);

  const seenDrivers = new Map<string, string | null>();
  for (const d of (activeDrivers ?? [])) {
    const row = d as Record<string, unknown>;
    if (typeof row.driver_id === 'string') {
      seenDrivers.set(row.driver_id, (row.driver_name as string | null) ?? null);
    }
  }

  let created = 0; let updated = 0; let errors = 0;
  for (const [driverId, driverName] of seenDrivers) {
    try {
      const existing = await sb
        .from('driver_cash_settlements')
        .select('id, status')
        .eq('location_id', locationId)
        .eq('driver_id', driverId)
        .eq('shift_date', today)
        .maybeSingle();

      if (existing.data && (existing.data as Record<string, unknown>).status !== 'open') {
        continue; // bereits abgerechnet — nicht überschreiben
      }

      const result = await upsertSettlement(driverId, locationId, today, driverName ?? undefined);
      if (result) {
        existing.data ? updated++ : created++;
      }
    } catch {
      errors++;
    }
  }

  return { created, updated, errors };
}

// ── 5. Cron-Batch: alle Standorte ─────────────────────────────────────────────

export async function reconcileAllLocations(): Promise<{
  locations: number;
  created: number;
  updated: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(50);

  let totalCreated = 0; let totalUpdated = 0; let totalErrors = 0;
  const locationList = (locations ?? []) as { id: string }[];

  for (const loc of locationList) {
    try {
      const r = await reconcileAllDriversToday(loc.id);
      totalCreated  += r.created;
      totalUpdated  += r.updated;
      totalErrors   += r.errors;
    } catch {
      totalErrors++;
    }
  }

  return {
    locations: locationList.length,
    created:   totalCreated,
    updated:   totalUpdated,
    errors:    totalErrors,
  };
}

// ── 6. Bargeld-Übergabe erfassen → settled ─────────────────────────────────────

export async function settlePayment(
  settlementId: string,
  actualCashEur: number,
  employeeId: string,
  notes?: string,
): Promise<CashSettlement | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_cash_settlements')
    .update({
      actual_cash_eur:         actualCashEur,
      status:                  'settled',
      settled_at:              new Date().toISOString(),
      settled_by_employee_id:  employeeId,
      notes:                   notes ?? null,
    })
    .eq('id', settlementId)
    .eq('status', 'open')
    .select()
    .maybeSingle();

  if (error || !data) return null;

  // Float-Buchung: Deposit in Höhe des tatsächlich erhaltenen Bargelds
  const settlement = toSettlement(data as Record<string, unknown>);
  await addFloatTransaction(
    settlement.locationId,
    'deposit',
    actualCashEur,
    employeeId,
    `Bargeld-Übergabe Fahrer ${settlement.driverName ?? settlement.driverId}`,
    settlementId,
  );

  return settlement;
}

// ── 7. Als strittig markieren ──────────────────────────────────────────────────

export async function disputeSettlement(
  settlementId: string,
  notes: string,
): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_cash_settlements')
    .update({ status: 'disputed', notes })
    .eq('id', settlementId)
    .neq('status', 'settled');
  return !error;
}

// ── 8. Admin-Dashboard ─────────────────────────────────────────────────────────

export async function getCashDashboard(locationId: string): Promise<CashDashboard> {
  const sb = createServiceClient();

  const [summaryRes, settlementsRes, trendRes, floatRes] = await Promise.all([
    sb.from('v_cash_settlement_today')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    sb.from('driver_cash_settlements')
      .select('*')
      .eq('location_id', locationId)
      .eq('shift_date', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(50),

    sb.from('v_cash_settlement_trend')
      .select('*')
      .eq('location_id', locationId)
      .limit(14),

    sb.from('cash_float_transactions')
      .select('*')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const rawSummary = summaryRes.data as Record<string, unknown> | null;
  const summary: TodaySummary | null = rawSummary ? {
    locationId:          rawSummary.location_id as string,
    locationName:        rawSummary.location_name as string,
    totalSettlements:    Number(rawSummary.total_settlements ?? 0),
    openCount:           Number(rawSummary.open_count ?? 0),
    settledCount:        Number(rawSummary.settled_count ?? 0),
    disputedCount:       Number(rawSummary.disputed_count ?? 0),
    totalExpectedEur:    Number(rawSummary.total_expected_eur ?? 0),
    totalActualEur:      Number(rawSummary.total_actual_eur ?? 0),
    totalDiscrepancyEur: Number(rawSummary.total_discrepancy_eur ?? 0),
    totalCashOrders:     Number(rawSummary.total_cash_orders ?? 0),
  } : null;

  const settlements = ((settlementsRes.data ?? []) as Record<string, unknown>[]).map(toSettlement);

  const trend: TrendRow[] = ((trendRes.data ?? []) as Record<string, unknown>[]).map(r => ({
    shiftDate:      r.shift_date as string,
    driverCount:    Number(r.driver_count ?? 0),
    expectedEur:    Number(r.expected_eur ?? 0),
    actualEur:      Number(r.actual_eur ?? 0),
    discrepancyEur: Number(r.discrepancy_eur ?? 0),
    disputes:       Number(r.disputes ?? 0),
  }));

  const floatBalance = await getFloatBalance(locationId);
  const recentFloat = ((floatRes.data ?? []) as Record<string, unknown>[]).map(toFloat);

  return { summary, settlements, trend, floatBalance, recentFloat };
}

// ── 9. Fahrer-Verlauf ──────────────────────────────────────────────────────────

export async function getDriverCashHistory(
  driverId: string,
  locationId: string,
  days = 30,
): Promise<CashSettlement[]> {
  const sb = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data } = await sb
    .from('driver_cash_settlements')
    .select('*')
    .eq('location_id', locationId)
    .eq('driver_id', driverId)
    .gte('shift_date', since.toISOString().slice(0, 10))
    .order('shift_date', { ascending: false })
    .limit(days);
  return ((data ?? []) as Record<string, unknown>[]).map(toSettlement);
}

// ── 10. Float-Buchung ──────────────────────────────────────────────────────────

export async function addFloatTransaction(
  locationId: string,
  type: 'deposit' | 'withdrawal' | 'initial' | 'adjustment',
  amountEur: number,
  employeeId: string,
  description?: string,
  referenceSettlementId?: string,
): Promise<FloatTransaction | null> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('cash_float_transactions')
    .insert({
      location_id:              locationId,
      transaction_type:         type,
      amount_eur:               amountEur,
      description:              description ?? null,
      employee_id:              employeeId,
      reference_settlement_id:  referenceSettlementId ?? null,
    })
    .select()
    .maybeSingle();
  if (error || !data) return null;
  return toFloat(data as Record<string, unknown>);
}

// ── 11. Kassenstand ────────────────────────────────────────────────────────────

export async function getFloatBalance(locationId: string): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('cash_float_transactions')
    .select('transaction_type, amount_eur')
    .eq('location_id', locationId);

  return ((data ?? []) as Record<string, unknown>[]).reduce((acc, t) => {
    const amt = Number(t.amount_eur ?? 0);
    const type = t.transaction_type as string;
    return type === 'withdrawal' ? acc - amt : acc + amt;
  }, 0);
}

// ── 12. Offene Abrechnungen ────────────────────────────────────────────────────

export async function getOpenSettlements(locationId: string): Promise<CashSettlement[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_cash_settlements')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'open')
    .order('shift_date', { ascending: false })
    .limit(50);
  return ((data ?? []) as Record<string, unknown>[]).map(toSettlement);
}

// ── Hilfsfunktion für Float ────────────────────────────────────────────────────

function toFloat(r: Record<string, unknown>): FloatTransaction {
  return {
    id:                     r.id as string,
    locationId:             r.location_id as string,
    transactionType:        r.transaction_type as FloatTransaction['transactionType'],
    amountEur:              Number(r.amount_eur ?? 0),
    description:            (r.description as string | null) ?? null,
    employeeId:             (r.employee_id as string | null) ?? null,
    referenceSettlementId:  (r.reference_settlement_id as string | null) ?? null,
    createdAt:              r.created_at as string,
  };
}
