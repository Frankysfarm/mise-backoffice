/**
 * lib/delivery/payout.ts
 *
 * Driver Payout Engine — Phase 18
 *
 * Berechnet Fahrer-Vergütung pro Lieferung basierend auf:
 *  - Basis-Betrag pro Lieferung
 *  - km-Bonus (Luftlinie zur Lieferadresse)
 *  - Spitzenzeiten-Multiplikator
 *  - Rating-Bonus (>4.0)
 *  - Meilenstein-Boni (10./25./50. Lieferung des Tages)
 *
 * Funktionen:
 *  - getPayoutConfig()          — Konfiguration laden/erstellen
 *  - upsertPayoutConfig()       — Konfiguration speichern
 *  - calculateDeliveryPayout()  — Einzellieferung berechnen + schreiben
 *  - generatePeriodPayout()     — Periodenabschluss (täglich/wöchentlich)
 *  - getDriverPayouts()         — Abrechnungen auflisten
 *  - getPeriodPayouts()         — Perioden auflisten
 *  - approvePeriod()            — Periode freigeben
 *  - getPayoutSummary()         — Location-weite Übersicht
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ============================================================
// Typen
// ============================================================

export interface PayoutConfig {
  id?: string;
  locationId: string;
  basePerDelivery: number;      // € pro Lieferung
  kmRate: number;               // € pro km
  peakMultiplier: number;       // Multiplikator bei Spitzenzeit
  bonusPerRatingPoint: number;  // € je 0.1 über 4.0
  minRatingForBonus: number;    // Mindestrating für Bonus
  milestoneBonuses: Record<string, number>; // {count: bonus_eur}
  peakWindows: PeakWindow[];
  currency: string;
  isActive: boolean;
}

export interface PeakWindow {
  weekday: number;  // 1=Mo … 7=So (ISO)
  start: string;    // "HH:MM"
  end: string;      // "HH:MM"
}

export interface PayoutRecord {
  id: string;
  locationId: string;
  driverId: string;
  orderId: string | null;
  batchId: string | null;
  baseAmount: number;
  kmBonus: number;
  peakBonus: number;
  ratingBonus: number;
  milestoneBonus: number;
  totalAmount: number;
  deliveryKm: number | null;
  wasPeakTime: boolean;
  driverRatingAtTime: number | null;
  deliveriesTodayAtTime: number | null;
  periodId: string | null;
  paidOut: boolean;
  completedAt: string;
}

export interface PayoutPeriod {
  id: string;
  locationId: string;
  driverId: string;
  driverName?: string;
  periodType: 'daily' | 'weekly' | 'monthly' | 'custom';
  periodStart: string;
  periodEnd: string;
  deliveriesCount: number;
  totalKm: number;
  totalBase: number;
  totalKmBonus: number;
  totalPeakBonus: number;
  totalRatingBonus: number;
  totalMilestoneBonus: number;
  totalPayout: number;
  avgRating: number | null;
  onTimeRatePct: number | null;
  status: 'draft' | 'approved' | 'paid';
  approvedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DeliveryPayoutInput {
  driverId: string;
  locationId: string;
  orderId?: string | null;
  batchId?: string | null;
  batchStopId?: string | null;
  deliveryKm?: number | null;
  completedAt?: string;
  driverRating?: number | null;
}

// ============================================================
// Hilfsfunktionen
// ============================================================

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isPeakTime(windows: PeakWindow[], at: Date): boolean {
  const iso = at.getDay(); // 0=So
  const weekday = iso === 0 ? 7 : iso; // ISO weekday 1=Mo, 7=So
  const hm = at.toTimeString().slice(0, 5); // "HH:MM"
  return windows.some(
    (w) => w.weekday === weekday && hm >= w.start && hm < w.end,
  );
}

function getMilestoneBonus(
  bonuses: Record<string, number>,
  deliveriesToday: number,
): number {
  const milestones = Object.entries(bonuses)
    .map(([k, v]) => ({ count: parseInt(k, 10), bonus: v }))
    .sort((a, b) => a.count - b.count);

  // Bonus gibt es wenn deliveriesToday genau einem Meilenstein entspricht
  const hit = milestones.find((m) => m.count === deliveriesToday);
  return hit ? hit.bonus : 0;
}

// ============================================================
// Konfiguration laden / speichern
// ============================================================

const DEFAULT_CONFIG: Omit<PayoutConfig, 'id' | 'locationId'> = {
  basePerDelivery: 3.00,
  kmRate: 0.25,
  peakMultiplier: 1.20,
  bonusPerRatingPoint: 0.10,
  minRatingForBonus: 4.0,
  milestoneBonuses: { '10': 2.00, '25': 5.00, '50': 10.00 },
  peakWindows: [
    { weekday: 1, start: '11:30', end: '14:00' },
    { weekday: 1, start: '18:00', end: '21:30' },
    { weekday: 5, start: '11:30', end: '14:00' },
    { weekday: 5, start: '18:00', end: '22:00' },
    { weekday: 6, start: '11:00', end: '22:30' },
    { weekday: 7, start: '11:00', end: '21:30' },
  ],
  currency: 'EUR',
  isActive: true,
};

export async function getPayoutConfig(locationId: string): Promise<PayoutConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('driver_payout_configs')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    // Erstelle Default-Config on demand
    const { data: created } = await sb
      .from('driver_payout_configs')
      .insert({ location_id: locationId, ...toDbConfig(DEFAULT_CONFIG) })
      .select('*')
      .single();
    return fromDbConfig(created ?? { location_id: locationId, ...toDbConfig(DEFAULT_CONFIG) });
  }
  return fromDbConfig(data);
}

export async function upsertPayoutConfig(config: PayoutConfig): Promise<PayoutConfig> {
  const sb = createServiceClient();
  const { data, error } = await sb
    .from('driver_payout_configs')
    .upsert(
      {
        location_id: config.locationId,
        ...toDbConfig(config),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id' },
    )
    .select('*')
    .single();

  if (error) throw new Error(`[payout] upsertPayoutConfig: ${error.message}`);
  return fromDbConfig(data);
}

function toDbConfig(c: Omit<PayoutConfig, 'id' | 'locationId'> & { locationId?: string }) {
  return {
    base_per_delivery: c.basePerDelivery,
    km_rate: c.kmRate,
    peak_multiplier: c.peakMultiplier,
    bonus_per_rating_point: c.bonusPerRatingPoint,
    min_rating_for_bonus: c.minRatingForBonus,
    milestone_bonuses: c.milestoneBonuses,
    peak_windows: c.peakWindows,
    currency: c.currency,
    is_active: c.isActive,
  };
}

function fromDbConfig(row: Record<string, unknown>): PayoutConfig {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    basePerDelivery: Number(row.base_per_delivery),
    kmRate: Number(row.km_rate),
    peakMultiplier: Number(row.peak_multiplier),
    bonusPerRatingPoint: Number(row.bonus_per_rating_point),
    minRatingForBonus: Number(row.min_rating_for_bonus),
    milestoneBonuses: (row.milestone_bonuses as Record<string, number>) ?? {},
    peakWindows: (row.peak_windows as PeakWindow[]) ?? [],
    currency: (row.currency as string) ?? 'EUR',
    isActive: Boolean(row.is_active),
  };
}

// ============================================================
// Einzellieferung berechnen + in DB schreiben
// ============================================================

export interface PayoutCalculation {
  baseAmount: number;
  kmBonus: number;
  peakBonus: number;
  ratingBonus: number;
  milestoneBonus: number;
  totalAmount: number;
  wasPeakTime: boolean;
  breakdown: string;
}

export async function calculateDeliveryPayout(
  input: DeliveryPayoutInput,
): Promise<PayoutCalculation> {
  const sb = createServiceClient();
  const config = await getPayoutConfig(input.locationId);
  const completedAt = input.completedAt ? new Date(input.completedAt) : new Date();

  // Lieferungs-km aus Order ableiten wenn nicht direkt übergeben
  let deliveryKm = input.deliveryKm ?? null;
  if (deliveryKm === null && input.orderId) {
    const { data: order } = await sb
      .from('customer_orders')
      .select('kunde_lat, kunde_lng, location_id')
      .eq('id', input.orderId)
      .maybeSingle();
    if (order?.kunde_lat && order?.kunde_lng) {
      const { data: loc } = await sb
        .from('locations')
        .select('lat, lng')
        .eq('id', order.location_id)
        .maybeSingle();
      if (loc?.lat && loc?.lng) {
        deliveryKm = haversineKm(loc.lat, loc.lng, order.kunde_lat, order.kunde_lng);
      }
    }
  }

  // Fahrer-Rating zum Zeitpunkt der Lieferung
  const driverRating =
    input.driverRating ??
    (await sb
      .from('mise_drivers')
      .select('rating')
      .eq('id', input.driverId)
      .maybeSingle()
      .then(({ data }) => (data?.rating as number | null) ?? null));

  // Lieferungen heute (für Meilenstein-Check)
  const startOfDay = new Date(completedAt);
  startOfDay.setHours(0, 0, 0, 0);
  const { count: deliveriesToday } = await sb
    .from('driver_payout_records')
    .select('*', { count: 'exact', head: true })
    .eq('driver_id', input.driverId)
    .eq('location_id', input.locationId)
    .gte('completed_at', startOfDay.toISOString());

  const todayCount = (deliveriesToday ?? 0) + 1; // +1 für die aktuelle

  // Berechnung
  const base = config.basePerDelivery;
  const km = deliveryKm != null ? Math.round(deliveryKm * config.kmRate * 100) / 100 : 0;
  const peak = isPeakTime(config.peakWindows, completedAt);
  const peakBonus = peak ? Math.round(base * (config.peakMultiplier - 1) * 100) / 100 : 0;
  const ratingBonus =
    driverRating != null && driverRating >= config.minRatingForBonus
      ? Math.round(
          ((driverRating - config.minRatingForBonus) / 0.1) *
            config.bonusPerRatingPoint *
            100,
        ) / 100
      : 0;
  const milestoneBonus = getMilestoneBonus(config.milestoneBonuses, todayCount);
  const total =
    Math.round((base + km + peakBonus + ratingBonus + milestoneBonus) * 100) / 100;

  const breakdown = [
    `Basis: €${base.toFixed(2)}`,
    km > 0 ? `km-Bonus: €${km.toFixed(2)} (${deliveryKm?.toFixed(1)}km × €${config.kmRate})` : null,
    peak ? `Spitzenzeit: +€${peakBonus.toFixed(2)}` : null,
    ratingBonus > 0 ? `Rating-Bonus: +€${ratingBonus.toFixed(2)} (★${driverRating?.toFixed(1)})` : null,
    milestoneBonus > 0 ? `Meilenstein #${todayCount}: +€${milestoneBonus.toFixed(2)}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  // In DB schreiben (fire-and-forget)
  sb.from('driver_payout_records')
    .insert({
      location_id: input.locationId,
      driver_id: input.driverId,
      order_id: input.orderId ?? null,
      batch_id: input.batchId ?? null,
      batch_stop_id: input.batchStopId ?? null,
      base_amount: base,
      km_bonus: km,
      peak_bonus: peakBonus,
      rating_bonus: ratingBonus,
      milestone_bonus: milestoneBonus,
      total_amount: total,
      delivery_km: deliveryKm,
      was_peak_time: peak,
      driver_rating_at_time: driverRating,
      deliveries_today_at_time: todayCount,
      config_snapshot: toDbConfig(config),
      completed_at: completedAt.toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.warn('[payout] insert record failed:', error.message);
      }
    });

  return { baseAmount: base, kmBonus: km, peakBonus, ratingBonus, milestoneBonus, totalAmount: total, wasPeakTime: peak, breakdown };
}

// ============================================================
// Perioden-Abschluss
// ============================================================

export async function generatePeriodPayout(
  driverId: string,
  locationId: string,
  periodStart: Date,
  periodEnd: Date,
  periodType: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily',
): Promise<string> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('generate_driver_period_payout', {
    p_driver_id: driverId,
    p_location_id: locationId,
    p_start: periodStart.toISOString(),
    p_end: periodEnd.toISOString(),
    p_type: periodType,
  });
  if (error) throw new Error(`[payout] generatePeriodPayout: ${error.message}`);
  return data as string;
}

export async function generateAllPeriodsForDate(
  locationId: string,
  date: Date,
  periodType: 'daily' | 'weekly' = 'daily',
): Promise<{ driverCount: number; periodIds: string[]; totalPayout: number }> {
  const sb = createServiceClient();

  const periodStart = new Date(date);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(date);
  periodEnd.setHours(23, 59, 59, 999);

  // Alle Fahrer mit Payout-Records im Zeitraum finden
  const { data: drivers } = await sb
    .from('driver_payout_records')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('completed_at', periodStart.toISOString())
    .lte('completed_at', periodEnd.toISOString())
    .is('period_id', null);

  const uniqueDriverIds = [...new Set((drivers ?? []).map((r) => r.driver_id as string))];
  const periodIds: string[] = [];
  let totalPayout = 0;

  for (const driverId of uniqueDriverIds) {
    const periodId = await generatePeriodPayout(
      driverId,
      locationId,
      periodStart,
      periodEnd,
      periodType,
    );
    periodIds.push(periodId);

    // Total summieren
    const { data: period } = await sb
      .from('driver_payout_periods')
      .select('total_payout')
      .eq('id', periodId)
      .maybeSingle();
    if (period) totalPayout += Number(period.total_payout);
  }

  return { driverCount: uniqueDriverIds.length, periodIds, totalPayout };
}

// ============================================================
// Abrechnungen lesen
// ============================================================

export async function getDriverPayouts(
  locationId: string,
  options: {
    driverId?: string;
    since?: Date;
    until?: Date;
    paidOut?: boolean;
    limit?: number;
  } = {},
): Promise<PayoutRecord[]> {
  const sb = createServiceClient();
  let q = sb
    .from('driver_payout_records')
    .select('*')
    .eq('location_id', locationId)
    .order('completed_at', { ascending: false })
    .limit(options.limit ?? 200);

  if (options.driverId) q = q.eq('driver_id', options.driverId);
  if (options.since) q = q.gte('completed_at', options.since.toISOString());
  if (options.until) q = q.lte('completed_at', options.until.toISOString());
  if (options.paidOut !== undefined) q = q.eq('paid_out', options.paidOut);

  const { data } = await q;
  return (data ?? []).map(fromDbRecord);
}

export async function getPeriodPayouts(
  locationId: string,
  options: {
    driverId?: string;
    status?: 'draft' | 'approved' | 'paid';
    since?: Date;
    limit?: number;
  } = {},
): Promise<PayoutPeriod[]> {
  const sb = createServiceClient();
  let q = sb
    .from('driver_payout_periods')
    .select(`*, mise_drivers(name)`)
    .eq('location_id', locationId)
    .order('period_start', { ascending: false })
    .limit(options.limit ?? 100);

  if (options.driverId) q = q.eq('driver_id', options.driverId);
  if (options.status) q = q.eq('status', options.status);
  if (options.since) q = q.gte('period_start', options.since.toISOString());

  const { data } = await q;
  return (data ?? []).map(fromDbPeriod);
}

export async function approvePeriod(
  periodId: string,
  approvedByUserId: string,
): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_payout_periods')
    .update({
      status: 'approved',
      approved_by: approvedByUserId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', periodId);
  if (error) throw new Error(`[payout] approvePeriod: ${error.message}`);
}

export async function markPeriodPaid(periodId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('driver_payout_periods')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', periodId);

  if (error) throw new Error(`[payout] markPeriodPaid: ${error.message}`);

  // Einzelrecords als ausgezahlt markieren
  await sb
    .from('driver_payout_records')
    .update({ paid_out: true, paid_out_at: new Date().toISOString() })
    .eq('period_id', periodId);
}

// ============================================================
// Übersicht / Summary
// ============================================================

export interface PayoutSummary {
  today: {
    activeDrivers: number;
    totalDeliveries: number;
    totalPayoutEur: number;
    avgPerDelivery: number;
  };
  pending: {
    draftPeriods: number;
    totalAmountEur: number;
  };
  topDriverToday: Array<{
    driverId: string;
    driverName: string;
    deliveries: number;
    totalEur: number;
  }>;
}

export async function getPayoutSummary(locationId: string): Promise<PayoutSummary> {
  const sb = createServiceClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [{ data: todayRecords }, { data: pendingPeriods }] = await Promise.all([
    sb
      .from('driver_payout_records')
      .select('driver_id, total_amount')
      .eq('location_id', locationId)
      .gte('completed_at', startOfDay.toISOString()),
    sb
      .from('driver_payout_periods')
      .select('total_payout')
      .eq('location_id', locationId)
      .eq('status', 'draft'),
  ]);

  const records = todayRecords ?? [];
  const totalDeliveries = records.length;
  const totalPayoutEur = records.reduce((s, r) => s + Number(r.total_amount), 0);
  const activeDrivers = new Set(records.map((r) => r.driver_id as string)).size;

  // Top-Fahrer heute
  const driverMap = new Map<string, { deliveries: number; total: number }>();
  for (const r of records) {
    const id = r.driver_id as string;
    const cur = driverMap.get(id) ?? { deliveries: 0, total: 0 };
    driverMap.set(id, { deliveries: cur.deliveries + 1, total: cur.total + Number(r.total_amount) });
  }

  const topDriverIds = [...driverMap.entries()]
    .sort((a, b) => b[1].deliveries - a[1].deliveries)
    .slice(0, 5)
    .map(([id]) => id);

  let topDriverToday: PayoutSummary['topDriverToday'] = [];
  if (topDriverIds.length > 0) {
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, name')
      .in('id', topDriverIds);

    topDriverToday = topDriverIds.map((id) => {
      const d = drivers?.find((x) => x.id === id);
      const stats = driverMap.get(id)!;
      return {
        driverId: id,
        driverName: (d?.name as string) ?? '–',
        deliveries: stats.deliveries,
        totalEur: Math.round(stats.total * 100) / 100,
      };
    });
  }

  const pendingTotal = (pendingPeriods ?? []).reduce(
    (s, p) => s + Number(p.total_payout),
    0,
  );

  return {
    today: {
      activeDrivers,
      totalDeliveries,
      totalPayoutEur: Math.round(totalPayoutEur * 100) / 100,
      avgPerDelivery:
        totalDeliveries > 0 ? Math.round((totalPayoutEur / totalDeliveries) * 100) / 100 : 0,
    },
    pending: {
      draftPeriods: (pendingPeriods ?? []).length,
      totalAmountEur: Math.round(pendingTotal * 100) / 100,
    },
    topDriverToday,
  };
}

// ============================================================
// DB-Mapping Helpers
// ============================================================

function fromDbRecord(row: Record<string, unknown>): PayoutRecord {
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    driverId: row.driver_id as string,
    orderId: (row.order_id as string | null) ?? null,
    batchId: (row.batch_id as string | null) ?? null,
    baseAmount: Number(row.base_amount),
    kmBonus: Number(row.km_bonus),
    peakBonus: Number(row.peak_bonus),
    ratingBonus: Number(row.rating_bonus),
    milestoneBonus: Number(row.milestone_bonus),
    totalAmount: Number(row.total_amount),
    deliveryKm: row.delivery_km != null ? Number(row.delivery_km) : null,
    wasPeakTime: Boolean(row.was_peak_time),
    driverRatingAtTime: row.driver_rating_at_time != null ? Number(row.driver_rating_at_time) : null,
    deliveriesTodayAtTime: row.deliveries_today_at_time != null ? Number(row.deliveries_today_at_time) : null,
    periodId: (row.period_id as string | null) ?? null,
    paidOut: Boolean(row.paid_out),
    completedAt: row.completed_at as string,
  };
}

function fromDbPeriod(row: Record<string, unknown>): PayoutPeriod {
  const driver = row.mise_drivers as { name: string } | null;
  return {
    id: row.id as string,
    locationId: row.location_id as string,
    driverId: row.driver_id as string,
    driverName: driver?.name ?? undefined,
    periodType: row.period_type as PayoutPeriod['periodType'],
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    deliveriesCount: Number(row.deliveries_count),
    totalKm: Number(row.total_km),
    totalBase: Number(row.total_base),
    totalKmBonus: Number(row.total_km_bonus),
    totalPeakBonus: Number(row.total_peak_bonus),
    totalRatingBonus: Number(row.total_rating_bonus),
    totalMilestoneBonus: Number(row.total_milestone_bonus),
    totalPayout: Number(row.total_payout),
    avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
    onTimeRatePct: row.on_time_rate_pct != null ? Number(row.on_time_rate_pct) : null,
    status: row.status as PayoutPeriod['status'],
    approvedAt: (row.approved_at as string | null) ?? null,
    paidAt: (row.paid_at as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}
