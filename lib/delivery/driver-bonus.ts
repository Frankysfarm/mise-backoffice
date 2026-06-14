/**
 * lib/delivery/driver-bonus.ts — Phase 158
 *
 * Driver Bonus / Incentive Engine
 *
 * Configurable performance bonuses evaluated daily/weekly:
 *  - deliveries_count: X deliveries in period → bonus
 *  - on_time_rate:     ≥ Y% on-time rate → bonus
 *  - min_rating:       avg rating ≥ Z → bonus
 *  - custom:           manual bonus entry
 *
 * Cron: evaluateBonusesAllLocations() täglich um 02:00 UTC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type BonusType = 'deliveries_count' | 'on_time_rate' | 'min_rating' | 'custom';
export type BonusPeriod = 'daily' | 'weekly';
export type BonusStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

export interface BonusConfig {
  id?: string;
  locationId: string;
  bonusType: BonusType;
  label: string;
  thresholdValue: number;
  bonusAmountEur: number;
  period: BonusPeriod;
  enabled: boolean;
}

export interface BonusEvent {
  id: string;
  locationId: string;
  driverId: string;
  driverName: string | null;
  configId: string | null;
  bonusType: BonusType;
  period: BonusPeriod;
  referenceDate: string;
  thresholdValue: number;
  achievedValue: number;
  bonusAmountEur: number;
  status: BonusStatus;
  notes: string | null;
  evaluatedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface BonusSummary {
  driverId: string;
  driverName: string | null;
  totalBonuses: number;
  totalEur: number;
  pendingEur: number;
  approvedEur: number;
  paidEur: number;
  pendingCount: number;
  approvedCount: number;
  paidCount: number;
  latestBonusDate: string | null;
}

export interface EvaluateResult {
  locationId: string;
  driversChecked: number;
  bonusesCreated: number;
  bonusesSkipped: number;
  totalEurQueued: number;
  errors: number;
}

// ── Konfiguration ─────────────────────────────────────────────────────────────

export async function getBonusConfigs(locationId: string): Promise<BonusConfig[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_bonus_configs')
    .select('id, location_id, bonus_type, label, threshold_value, bonus_amount_eur, period, enabled')
    .eq('location_id', locationId)
    .order('bonus_type');
  if (error) throw error;
  return (data ?? []).map(mapConfig);
}

export async function upsertBonusConfig(cfg: BonusConfig): Promise<BonusConfig> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_bonus_configs')
    .upsert({
      location_id:      cfg.locationId,
      bonus_type:       cfg.bonusType,
      label:            cfg.label,
      threshold_value:  cfg.thresholdValue,
      bonus_amount_eur: cfg.bonusAmountEur,
      period:           cfg.period,
      enabled:          cfg.enabled,
      ...(cfg.id ? { id: cfg.id } : {}),
    }, { onConflict: 'location_id,bonus_type,period', ignoreDuplicates: false })
    .select('id, location_id, bonus_type, label, threshold_value, bonus_amount_eur, period, enabled')
    .single();
  if (error) throw error;
  return mapConfig(data!);
}

export async function deleteBonusConfig(configId: string, locationId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_bonus_configs')
    .delete()
    .eq('id', configId)
    .eq('location_id', locationId);
  if (error) throw error;
}

// ── Bonus-Auswertung ──────────────────────────────────────────────────────────

export async function evaluateBonusesForLocation(
  locationId: string,
  referenceDate?: string,
): Promise<EvaluateResult> {
  const sb = createServiceClient();
  const refDate = referenceDate ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const result: EvaluateResult = {
    locationId,
    driversChecked: 0,
    bonusesCreated: 0,
    bonusesSkipped: 0,
    totalEurQueued: 0,
    errors: 0,
  };

  // Aktive Konfigurationen laden
  const { data: configs, error: cfgErr } = await sb
    .from('driver_bonus_configs')
    .select('id, bonus_type, label, threshold_value, bonus_amount_eur, period')
    .eq('location_id', locationId)
    .eq('enabled', true);
  if (cfgErr || !configs?.length) return result;

  // Aktive Fahrer des Tages laden (hatten gestern mindestens 1 Lieferung)
  const dateFrom = `${refDate}T00:00:00Z`;
  const dateTo   = `${refDate}T23:59:59Z`;

  const { data: drivers, error: drvErr } = await sb
    .from('mise_drivers')
    .select('id, name')
    .eq('location_id', locationId);
  if (drvErr || !drivers?.length) return result;

  for (const driver of drivers) {
    result.driversChecked++;

    // Tages-Metriken des Fahrers ermitteln
    const [deliveriesRes, onTimeRes, ratingRes] = await Promise.all([
      // Anzahl abgeschlossener Lieferungen gestern
      sb.from('mise_delivery_batches')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', driver.id)
        .eq('status', 'delivered')
        .gte('updated_at', dateFrom)
        .lte('updated_at', dateTo),

      // On-Time-Rate gestern (aus delivery_performance)
      sb.from('delivery_performance')
        .select('on_time')
        .eq('driver_id', driver.id)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo),

      // Durchschnitts-Rating gestern
      sb.from('delivery_performance')
        .select('customer_rating')
        .eq('driver_id', driver.id)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo)
        .not('customer_rating', 'is', null),
    ]);

    const deliveryCount = deliveriesRes.count ?? 0;
    const performances  = onTimeRes.data ?? [];
    const onTimeRate    = performances.length > 0
      ? performances.filter((p) => p.on_time).length / performances.length
      : 0;
    const ratings       = (ratingRes.data ?? []).map((r) => r.customer_rating as number);
    const avgRating     = ratings.length > 0
      ? ratings.reduce((a, b) => a + b, 0) / ratings.length
      : 0;

    // Jeden Config-Eintrag prüfen
    for (const cfg of configs) {
      let achieved = 0;
      let qualifies = false;

      switch (cfg.bonus_type as BonusType) {
        case 'deliveries_count':
          achieved   = deliveryCount;
          qualifies  = deliveryCount >= cfg.threshold_value;
          break;
        case 'on_time_rate':
          achieved   = onTimeRate;
          qualifies  = onTimeRate >= cfg.threshold_value && performances.length >= 3;
          break;
        case 'min_rating':
          achieved   = avgRating;
          qualifies  = avgRating >= cfg.threshold_value && ratings.length >= 3;
          break;
        case 'custom':
          // Nur manuell erzeugbar
          continue;
      }

      if (!qualifies) {
        result.bonusesSkipped++;
        continue;
      }

      // Bonus-Event einfügen (UPSERT — verhindert Doppel-Bonus für gleichen Tag)
      const { error: insErr } = await sb
        .from('driver_bonus_events')
        .upsert({
          location_id:      locationId,
          driver_id:        driver.id,
          driver_name:      driver.name,
          config_id:        cfg.id,
          bonus_type:       cfg.bonus_type,
          period:           cfg.period ?? 'daily',
          reference_date:   refDate,
          threshold_value:  cfg.threshold_value,
          achieved_value:   achieved,
          bonus_amount_eur: cfg.bonus_amount_eur,
          status:           'pending',
        }, { onConflict: 'driver_id,bonus_type,period,reference_date', ignoreDuplicates: true });

      if (insErr) {
        result.errors++;
      } else {
        result.bonusesCreated++;
        result.totalEurQueued += cfg.bonus_amount_eur;
      }
    }
  }

  return result;
}

export async function evaluateBonusesAllLocations(): Promise<{
  locations: number;
  bonusesCreated: number;
  totalEurQueued: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('active', true).limit(20);
  let totalBonuses = 0;
  let totalEur     = 0;
  let totalErrors  = 0;

  for (const loc of locs ?? []) {
    const r = await evaluateBonusesForLocation(loc.id as string).catch(() => null);
    if (r) {
      totalBonuses += r.bonusesCreated;
      totalEur     += r.totalEurQueued;
      totalErrors  += r.errors;
    }
  }

  return {
    locations:      (locs ?? []).length,
    bonusesCreated: totalBonuses,
    totalEurQueued: totalEur,
    errors:         totalErrors,
  };
}

// ── Events abrufen ────────────────────────────────────────────────────────────

export async function getBonusEvents(
  locationId: string,
  options?: { status?: BonusStatus; days?: number; limit?: number },
): Promise<BonusEvent[]> {
  const sb  = createServiceClient();
  const days = options?.days ?? 30;
  const limit = options?.limit ?? 200;
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  let q = sb
    .from('driver_bonus_events')
    .select('id, location_id, driver_id, driver_name, config_id, bonus_type, period, reference_date, threshold_value, achieved_value, bonus_amount_eur, status, notes, evaluated_at, approved_at, paid_at')
    .eq('location_id', locationId)
    .gte('reference_date', since)
    .order('reference_date', { ascending: false })
    .limit(limit);

  if (options?.status) q = q.eq('status', options.status);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getBonusSummary(locationId: string): Promise<BonusSummary[]> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('v_driver_bonus_summary')
    .select('location_id, driver_id, driver_name, total_bonuses, total_eur, pending_eur, approved_eur, paid_eur, pending_count, approved_count, paid_count, latest_bonus_date')
    .eq('location_id', locationId)
    .order('total_eur', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    driverId:         r.driver_id,
    driverName:       r.driver_name,
    totalBonuses:     Number(r.total_bonuses ?? 0),
    totalEur:         Number(r.total_eur ?? 0),
    pendingEur:       Number(r.pending_eur ?? 0),
    approvedEur:      Number(r.approved_eur ?? 0),
    paidEur:          Number(r.paid_eur ?? 0),
    pendingCount:     Number(r.pending_count ?? 0),
    approvedCount:    Number(r.approved_count ?? 0),
    paidCount:        Number(r.paid_count ?? 0),
    latestBonusDate:  r.latest_bonus_date,
  }));
}

export async function getBonusDashboard(locationId: string): Promise<{
  configs:   BonusConfig[];
  events:    BonusEvent[];
  summary:   BonusSummary[];
  kpis: {
    totalPending:  number;
    totalApproved: number;
    totalPaid:     number;
    pendingEur:    number;
    approvedEur:   number;
    paidEur:       number;
  };
}> {
  const [configs, events, summary] = await Promise.all([
    getBonusConfigs(locationId),
    getBonusEvents(locationId, { days: 30 }),
    getBonusSummary(locationId),
  ]);

  const kpis = {
    totalPending:  events.filter((e) => e.status === 'pending').length,
    totalApproved: events.filter((e) => e.status === 'approved').length,
    totalPaid:     events.filter((e) => e.status === 'paid').length,
    pendingEur:    events.filter((e) => e.status === 'pending').reduce((s, e) => s + e.bonusAmountEur, 0),
    approvedEur:   events.filter((e) => e.status === 'approved').reduce((s, e) => s + e.bonusAmountEur, 0),
    paidEur:       events.filter((e) => e.status === 'paid').reduce((s, e) => s + e.bonusAmountEur, 0),
  };

  return { configs, events, summary, kpis };
}

// ── Status-Updates ────────────────────────────────────────────────────────────

export async function updateBonusEventStatus(
  eventIds: string[],
  status: 'approved' | 'paid' | 'cancelled',
  locationId: string,
): Promise<{ updated: number }> {
  if (!eventIds.length) return { updated: 0 };
  const sb = createServiceClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'approved') patch.approved_at = new Date().toISOString();
  if (status === 'paid')     patch.paid_at     = new Date().toISOString();

  const { data, error } = await sb
    .from('driver_bonus_events')
    .update(patch)
    .in('id', eventIds)
    .eq('location_id', locationId)
    .select('id');
  if (error) throw error;
  return { updated: (data ?? []).length };
}

export async function issueManualBonus(input: {
  locationId: string;
  driverId: string;
  driverName?: string;
  bonusAmountEur: number;
  notes: string;
  referenceDate?: string;
}): Promise<BonusEvent> {
  const sb  = createServiceClient();
  const ref = input.referenceDate ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await sb
    .from('driver_bonus_events')
    .insert({
      location_id:      input.locationId,
      driver_id:        input.driverId,
      driver_name:      input.driverName ?? null,
      bonus_type:       'custom',
      period:           'daily',
      reference_date:   ref,
      threshold_value:  0,
      achieved_value:   0,
      bonus_amount_eur: input.bonusAmountEur,
      status:           'pending',
      notes:            input.notes,
    })
    .select('id, location_id, driver_id, driver_name, config_id, bonus_type, period, reference_date, threshold_value, achieved_value, bonus_amount_eur, status, notes, evaluated_at, approved_at, paid_at')
    .single();
  if (error) throw error;
  return mapEvent(data!);
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapConfig(r: Record<string, unknown>): BonusConfig {
  return {
    id:             r.id as string,
    locationId:     r.location_id as string,
    bonusType:      r.bonus_type as BonusType,
    label:          r.label as string,
    thresholdValue: Number(r.threshold_value),
    bonusAmountEur: Number(r.bonus_amount_eur),
    period:         (r.period as BonusPeriod) ?? 'daily',
    enabled:        Boolean(r.enabled),
  };
}

function mapEvent(r: Record<string, unknown>): BonusEvent {
  return {
    id:              r.id as string,
    locationId:      r.location_id as string,
    driverId:        r.driver_id as string,
    driverName:      r.driver_name as string | null,
    configId:        r.config_id as string | null,
    bonusType:       r.bonus_type as BonusType,
    period:          (r.period as BonusPeriod) ?? 'daily',
    referenceDate:   r.reference_date as string,
    thresholdValue:  Number(r.threshold_value),
    achievedValue:   Number(r.achieved_value),
    bonusAmountEur:  Number(r.bonus_amount_eur),
    status:          r.status as BonusStatus,
    notes:           r.notes as string | null,
    evaluatedAt:     r.evaluated_at as string,
    approvedAt:      r.approved_at as string | null,
    paidAt:          r.paid_at as string | null,
  };
}
