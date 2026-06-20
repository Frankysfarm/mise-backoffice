/**
 * lib/delivery/dynamic-pricing.ts
 *
 * Phase 340 — Dynamic Pricing Engine
 *
 * Surge-basierte Liefergebühren-Anpassung mit Admin-Konfiguration.
 * Ergänzt die bestehende delivery-fee.ts um:
 *  - Admin-konfigurierbare Surge-Multiplikatoren je Level
 *  - Off-Peak-Rabatte in ruhigen Stunden
 *  - Vollständiges Ereignis-Log für Preistransparenz
 *  - Customer-Info-Banner-Flag
 *
 * Public API:
 *   getDynamicPricingConfig(locationId)           — Konfiguration laden
 *   upsertDynamicPricingConfig(locationId, cfg)   — Konfiguration speichern
 *   computeDynamicFee(locationId, baseFeeEur, surgeLevel) → DynamicFeeResult
 *   logPricingEvent(locationId, orderId, result)  — Ereignis protokollieren
 *   getDynamicPricingDashboard(locationId)        — Admin-Dashboard-Daten
 *   getRecentPricingEvents(locationId, limit)     — Ereignis-Log
 *   pruneOldPricingEvents(daysToKeep)             — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ─── Typen ────────────────────────────────────────────────────────────────────

export type SurgeLevel = 'none' | 'elevated' | 'high' | 'extreme';
export type PricingReason =
  | 'normal'
  | 'surge_low'
  | 'surge_mid'
  | 'surge_high'
  | 'off_peak'
  | 'off_peak_surge';

export interface DynamicPricingConfig {
  locationId:            string;
  isEnabled:             boolean;
  multiplierNormal:      number;
  multiplierSurgeLow:    number;
  multiplierSurgeMid:    number;
  multiplierSurgeHigh:   number;
  maxSurchargeEur:       number;
  offPeakEnabled:        boolean;
  offPeakDiscountPct:    number;
  offPeakStartHour:      number;
  offPeakEndHour:        number;
  customerBannerEnabled: boolean;
  updatedAt:             string;
}

export interface DynamicFeeResult {
  baseFeeEur:        number;
  appliedMultiplier: number;
  discountPct:       number;
  finalFeeEur:       number;
  surchargeEur:      number;
  discountEur:       number;
  pricingReason:     PricingReason;
  surgeLevel:        SurgeLevel;
  hourUtc:           number;
  showBanner:        boolean;
  bannerText:        string | null;
}

export interface PricingEvent {
  id:                string;
  locationId:        string;
  orderId:           string | null;
  pricingReason:     string;
  baseFeeEur:        number;
  appliedMultiplier: number;
  discountPct:       number;
  finalFeeEur:       number;
  surgeLevel:        string | null;
  hourUtc:           number;
  createdAt:         string;
}

export interface PricingDashboard {
  config:          DynamicPricingConfig;
  todayStats: {
    eventsToday:      number;
    surgeEvents:      number;
    offPeakEvents:    number;
    avgMultiplier:    number | null;
    extraRevenueEur:  number;
    discountGivenEur: number;
  };
  recentEvents:    PricingEvent[];
  hourlyPattern:   { hour: number; avgMultiplier: number; events: number }[];
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Omit<DynamicPricingConfig, 'locationId' | 'updatedAt'> = {
  isEnabled:             false,
  multiplierNormal:      1.00,
  multiplierSurgeLow:    1.20,
  multiplierSurgeMid:    1.50,
  multiplierSurgeHigh:   2.00,
  maxSurchargeEur:       3.00,
  offPeakEnabled:        false,
  offPeakDiscountPct:    10.0,
  offPeakStartHour:      14,
  offPeakEndHour:        17,
  customerBannerEnabled: true,
};

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): DynamicPricingConfig {
  return {
    locationId:            r.location_id as string,
    isEnabled:             Boolean(r.is_enabled),
    multiplierNormal:      Number(r.multiplier_normal),
    multiplierSurgeLow:    Number(r.multiplier_surge_low),
    multiplierSurgeMid:    Number(r.multiplier_surge_mid),
    multiplierSurgeHigh:   Number(r.multiplier_surge_high),
    maxSurchargeEur:       Number(r.max_surcharge_eur),
    offPeakEnabled:        Boolean(r.off_peak_enabled),
    offPeakDiscountPct:    Number(r.off_peak_discount_pct),
    offPeakStartHour:      Number(r.off_peak_start_hour),
    offPeakEndHour:        Number(r.off_peak_end_hour),
    customerBannerEnabled: Boolean(r.customer_banner_enabled),
    updatedAt:             r.updated_at as string,
  };
}

function isOffPeak(cfg: DynamicPricingConfig, hourUtc: number): boolean {
  if (!cfg.offPeakEnabled) return false;
  const { offPeakStartHour: s, offPeakEndHour: e } = cfg;
  return s < e ? hourUtc >= s && hourUtc < e : hourUtc >= s || hourUtc < e;
}

function buildBannerText(reason: PricingReason, multiplier: number, discountPct: number): string | null {
  if (reason === 'normal') return null;
  if (reason === 'off_peak') return `${discountPct.toFixed(0)}% Rabatt in der Off-Peak-Zeit`;
  if (reason === 'surge_low') return `Erhöhte Nachfrage — Liefergebühr ×${multiplier.toFixed(1)}`;
  if (reason === 'surge_mid') return `Hohe Nachfrage — Liefergebühr ×${multiplier.toFixed(1)}`;
  if (reason === 'surge_high') return `Sehr hohe Nachfrage — Liefergebühr ×${multiplier.toFixed(1)}`;
  if (reason === 'off_peak_surge') return `Surge-Rabatt: ×${multiplier.toFixed(1)} abzgl. ${discountPct.toFixed(0)}%`;
  return null;
}

// ─── Konfiguration ────────────────────────────────────────────────────────────

export async function getDynamicPricingConfig(locationId: string): Promise<DynamicPricingConfig> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('dynamic_pricing_configs')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) {
    return { ...DEFAULT_CONFIG, locationId, updatedAt: new Date().toISOString() };
  }
  return mapRow(data as Record<string, unknown>);
}

export async function upsertDynamicPricingConfig(
  locationId: string,
  update: Partial<Omit<DynamicPricingConfig, 'locationId' | 'updatedAt'>>,
): Promise<DynamicPricingConfig> {
  const svc = createServiceClient();

  const current = await getDynamicPricingConfig(locationId);
  const merged = { ...current, ...update };

  const { data, error } = await svc
    .from('dynamic_pricing_configs')
    .upsert({
      location_id:             locationId,
      is_enabled:              merged.isEnabled,
      multiplier_normal:       merged.multiplierNormal,
      multiplier_surge_low:    merged.multiplierSurgeLow,
      multiplier_surge_mid:    merged.multiplierSurgeMid,
      multiplier_surge_high:   merged.multiplierSurgeHigh,
      max_surcharge_eur:       merged.maxSurchargeEur,
      off_peak_enabled:        merged.offPeakEnabled,
      off_peak_discount_pct:   merged.offPeakDiscountPct,
      off_peak_start_hour:     merged.offPeakStartHour,
      off_peak_end_hour:       merged.offPeakEndHour,
      customer_banner_enabled: merged.customerBannerEnabled,
    }, { onConflict: 'location_id' })
    .select()
    .single();

  if (error) throw new Error(`[dynamic-pricing] upsert failed: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}

// ─── Kern-Berechnung ──────────────────────────────────────────────────────────

/**
 * Berechnet die dynamische Liefergebühr auf Basis der Admin-Konfiguration.
 *
 * @param locationId  — Location UUID
 * @param baseFeeEur  — Basis-Liefergebühr aus delivery_zones
 * @param surgeLevel  — aktuelles Surge-Level aus surge.ts
 * @returns DynamicFeeResult mit finalFeeEur, Multiplikator, Rabatt und Grund
 */
export async function computeDynamicFee(
  locationId: string,
  baseFeeEur: number,
  surgeLevel: SurgeLevel = 'none',
): Promise<DynamicFeeResult> {
  const cfg = await getDynamicPricingConfig(locationId);
  const hourUtc = new Date().getUTCHours();

  // Wenn Dynamic Pricing deaktiviert: direkte Durchleitung
  if (!cfg.isEnabled) {
    return {
      baseFeeEur,
      appliedMultiplier: 1.0,
      discountPct:       0,
      finalFeeEur:       baseFeeEur,
      surchargeEur:      0,
      discountEur:       0,
      pricingReason:     'normal',
      surgeLevel,
      hourUtc,
      showBanner:        false,
      bannerText:        null,
    };
  }

  // Surge-Multiplikator aus Admin-Config
  let multiplier: number;
  let baseReason: PricingReason;
  if (surgeLevel === 'extreme') {
    multiplier = cfg.multiplierSurgeHigh;
    baseReason = 'surge_high';
  } else if (surgeLevel === 'high') {
    multiplier = cfg.multiplierSurgeMid;
    baseReason = 'surge_mid';
  } else if (surgeLevel === 'elevated') {
    multiplier = cfg.multiplierSurgeLow;
    baseReason = 'surge_low';
  } else {
    multiplier = cfg.multiplierNormal;
    baseReason = 'normal';
  }

  // Off-Peak-Rabatt
  const offPeak = isOffPeak(cfg, hourUtc);
  let discountPct = 0;
  let pricingReason: PricingReason = baseReason;

  if (offPeak) {
    discountPct = cfg.offPeakDiscountPct;
    pricingReason = baseReason === 'normal' ? 'off_peak' : 'off_peak_surge';
  }

  // Gebühr berechnen
  const rawFee = baseFeeEur * multiplier;
  const surchargeEur = Math.max(0, rawFee - baseFeeEur);

  // Kappen: max surcharge
  const cappedSurcharge = Math.min(surchargeEur, cfg.maxSurchargeEur);
  const afterCap = baseFeeEur + cappedSurcharge;

  // Off-Peak-Rabatt anwenden
  const discountEur = offPeak ? Math.round(afterCap * (discountPct / 100) * 100) / 100 : 0;
  const finalFeeEur = Math.max(0, Math.round((afterCap - discountEur) * 100) / 100);

  const effectiveMultiplier = baseFeeEur > 0
    ? Math.round((finalFeeEur / baseFeeEur) * 100) / 100
    : multiplier;

  const bannerText = cfg.customerBannerEnabled
    ? buildBannerText(pricingReason, effectiveMultiplier, discountPct)
    : null;

  return {
    baseFeeEur,
    appliedMultiplier: effectiveMultiplier,
    discountPct,
    finalFeeEur,
    surchargeEur:      Math.max(0, finalFeeEur - baseFeeEur),
    discountEur,
    pricingReason,
    surgeLevel,
    hourUtc,
    showBanner:        cfg.customerBannerEnabled && bannerText != null,
    bannerText,
  };
}

// ─── Ereignis-Log ────────────────────────────────────────────────────────────

export async function logPricingEvent(
  locationId: string,
  orderId:    string | null,
  result:     DynamicFeeResult,
): Promise<void> {
  const svc = createServiceClient();
  await svc.from('dynamic_pricing_events').insert({
    location_id:        locationId,
    order_id:           orderId,
    pricing_reason:     result.pricingReason,
    base_fee_eur:       result.baseFeeEur,
    applied_multiplier: result.appliedMultiplier,
    discount_pct:       result.discountPct,
    final_fee_eur:      result.finalFeeEur,
    surge_level:        result.surgeLevel,
    hour_utc:           result.hourUtc,
  });
}

// ─── Events laden ─────────────────────────────────────────────────────────────

export async function getRecentPricingEvents(
  locationId: string,
  limit = 50,
): Promise<PricingEvent[]> {
  const svc = createServiceClient();
  const { data } = await svc
    .from('dynamic_pricing_events')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id:                r.id as string,
    locationId:        r.location_id as string,
    orderId:           (r.order_id as string | null) ?? null,
    pricingReason:     r.pricing_reason as string,
    baseFeeEur:        Number(r.base_fee_eur),
    appliedMultiplier: Number(r.applied_multiplier),
    discountPct:       Number(r.discount_pct),
    finalFeeEur:       Number(r.final_fee_eur),
    surgeLevel:        (r.surge_level as string | null) ?? null,
    hourUtc:           Number(r.hour_utc),
    createdAt:         r.created_at as string,
  }));
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export async function getDynamicPricingDashboard(locationId: string): Promise<PricingDashboard> {
  const svc = createServiceClient();

  const [config, todayRow, recentEvents, hourlyData] = await Promise.all([
    getDynamicPricingConfig(locationId),

    svc
      .from('v_dynamic_pricing_today')
      .select('*')
      .eq('location_id', locationId)
      .maybeSingle(),

    getRecentPricingEvents(locationId, 20),

    svc
      .from('dynamic_pricing_events')
      .select('hour_utc, applied_multiplier')
      .eq('location_id', locationId)
      .not('order_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  const today = todayRow.data as Record<string, unknown> | null;

  // Stündliches Muster (7 Tage)
  const hourMap = new Map<number, { sum: number; count: number }>();
  for (const row of hourlyData.data ?? []) {
    const r = row as Record<string, unknown>;
    const h = Number(r.hour_utc);
    const m = Number(r.applied_multiplier);
    const entry = hourMap.get(h) ?? { sum: 0, count: 0 };
    entry.sum += m;
    entry.count += 1;
    hourMap.set(h, entry);
  }
  const hourlyPattern = Array.from(hourMap.entries())
    .map(([hour, { sum, count }]) => ({
      hour,
      avgMultiplier: Math.round((sum / count) * 100) / 100,
      events:        count,
    }))
    .sort((a, b) => a.hour - b.hour);

  return {
    config,
    todayStats: {
      eventsToday:      Number(today?.events_today ?? 0),
      surgeEvents:      Number(today?.surge_events ?? 0),
      offPeakEvents:    Number(today?.off_peak_events ?? 0),
      avgMultiplier:    today?.avg_multiplier != null ? Math.round(Number(today.avg_multiplier) * 100) / 100 : null,
      extraRevenueEur:  Math.round(Number(today?.extra_revenue_eur ?? 0) * 100) / 100,
      discountGivenEur: Math.round(Number(today?.discount_given_eur ?? 0) * 100) / 100,
    },
    recentEvents,
    hourlyPattern,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function pruneOldPricingEvents(daysToKeep = 30): Promise<{ pruned: number }> {
  const svc = createServiceClient();
  const { data } = await svc.rpc('prune_dynamic_pricing_events', { days_old: daysToKeep });
  return { pruned: (data as number | null) ?? 0 };
}
