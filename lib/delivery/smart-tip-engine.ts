/**
 * lib/delivery/smart-tip-engine.ts
 *
 * Phase 338 — Smart Tip Engine
 *
 * Berechnet dynamische Trinkgeld-Vorschläge (low/mid/high) je Bestellung,
 * basierend auf Lieferpünktlichkeit, Fahrer-Score und Bestellwert.
 *
 * Public API:
 *   calculateSmartTipSuggestions(orderId, locationId) — Vorschläge berechnen
 *   getSmartTipConfig(locationId)                     — Konfiguration laden
 *   upsertSmartTipConfig(locationId, cfg)             — Konfiguration speichern
 *   recordSuggestionShown(orderId, locationId, sugg)  — Anzeige speichern
 *   recordTipChosen(orderId, actualTipEur)            — Gewähltes Trinkgeld speichern
 *   getSmartTipDashboard(locationId)                  — Admin-Übersicht
 *   pruneOldSuggestions(days)                         — Cleanup (Cron)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export interface SmartTipConfig {
  id?: string;
  locationId: string;
  isEnabled: boolean;
  basePct: number;
  boostPctPunctual: number;
  penaltyPctLate: number;
  driverScoreBoost: boolean;
  minSuggestionEur: number;
  maxSuggestionEur: number;
}

export interface SmartTipSuggestions {
  low: number;
  mid: number;
  high: number;
  reason: string;
  driverScore: number | null;
  deliveryMin: number | null;
  etaMin: number | null;
  punctualityDeltaMin: number | null;
  orderValueEur: number | null;
}

export interface SmartTipSuggestionRow {
  id: string;
  orderId: string;
  locationId: string;
  suggestedLowEur: number;
  suggestedMidEur: number;
  suggestedHighEur: number;
  orderValueEur: number | null;
  driverScore: number | null;
  deliveryMin: number | null;
  etaMin: number | null;
  punctualityDeltaMin: number | null;
  reason: string | null;
  shownAt: string;
  actualTipEur: number | null;
  tipChosenAt: string | null;
}

export interface SmartTipDashboard {
  config: SmartTipConfig;
  stats: {
    suggestionsShown30d: number;
    tipsChosen30d: number;
    conversionRate: number;
    avgActualTipEur: number;
    avgMidSuggestionEur: number;
    tipVsSuggestionRatio: number;
  };
  recentSuggestions: SmartTipSuggestionRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function rowToConfig(r: Record<string, unknown>): SmartTipConfig {
  return {
    id: r.id as string,
    locationId: r.location_id as string,
    isEnabled: r.is_enabled as boolean,
    basePct: Number(r.base_pct),
    boostPctPunctual: Number(r.boost_pct_punctual),
    penaltyPctLate: Number(r.penalty_pct_late),
    driverScoreBoost: r.driver_score_boost as boolean,
    minSuggestionEur: Number(r.min_suggestion_eur),
    maxSuggestionEur: Number(r.max_suggestion_eur),
  };
}

const DEFAULT_CONFIG: SmartTipConfig = {
  locationId: '',
  isEnabled: true,
  basePct: 15,
  boostPctPunctual: 5,
  penaltyPctLate: 5,
  driverScoreBoost: true,
  minSuggestionEur: 0.5,
  maxSuggestionEur: 10.0,
};

// ── 1. Konfiguration ──────────────────────────────────────────────────────────

export async function getSmartTipConfig(locationId: string): Promise<SmartTipConfig> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('smart_tip_config')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();
  if (!data) return { ...DEFAULT_CONFIG, locationId };
  return rowToConfig(data as Record<string, unknown>);
}

export async function upsertSmartTipConfig(
  locationId: string,
  cfg: Partial<Omit<SmartTipConfig, 'locationId' | 'id'>>,
): Promise<SmartTipConfig> {
  const sb = createServiceClient();
  const payload = {
    location_id: locationId,
    is_enabled: cfg.isEnabled,
    base_pct: cfg.basePct,
    boost_pct_punctual: cfg.boostPctPunctual,
    penalty_pct_late: cfg.penaltyPctLate,
    driver_score_boost: cfg.driverScoreBoost,
    min_suggestion_eur: cfg.minSuggestionEur,
    max_suggestion_eur: cfg.maxSuggestionEur,
    updated_at: new Date().toISOString(),
  };
  const clean = Object.fromEntries(
    Object.entries(payload).filter(([, v]) => v !== undefined),
  );
  const { data, error } = await sb
    .from('smart_tip_config')
    .upsert(clean, { onConflict: 'location_id' })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return rowToConfig(data as Record<string, unknown>);
}

// ── 2. Berechnung ─────────────────────────────────────────────────────────────

export async function calculateSmartTipSuggestions(
  orderId: string,
  locationId: string,
): Promise<SmartTipSuggestions> {
  const sb = createServiceClient();
  const cfg = await getSmartTipConfig(locationId);

  const { data: order } = await sb
    .from('customer_orders')
    .select('gesamtbetrag, geliefert_am, dispatched_at, eta_latest, mise_batch_id')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  let driverScore: number | null = null;
  let deliveryMin: number | null = null;
  let etaMin: number | null = null;
  let punctualityDeltaMin: number | null = null;
  const orderValueEur = order ? Number(order.gesamtbetrag ?? 0) : null;

  if (order?.mise_batch_id) {
    const { data: batch } = await sb
      .from('mise_delivery_batches')
      .select('driver_id')
      .eq('id', order.mise_batch_id as string)
      .maybeSingle();

    if (batch?.driver_id) {
      const { data: scoreRow } = await sb
        .from('driver_composite_scores')
        .select('composite_score')
        .eq('driver_id', batch.driver_id as string)
        .maybeSingle();
      if (scoreRow) driverScore = Number(scoreRow.composite_score);
    }
  }

  if (order?.dispatched_at && order?.geliefert_am) {
    deliveryMin = (
      new Date(order.geliefert_am as string).getTime() -
      new Date(order.dispatched_at as string).getTime()
    ) / 60_000;
  }

  if (order?.dispatched_at && order?.eta_latest) {
    etaMin = (
      new Date(order.eta_latest as string).getTime() -
      new Date(order.dispatched_at as string).getTime()
    ) / 60_000;
  }

  if (etaMin !== null && deliveryMin !== null) {
    // positive = delivered before ETA (early), negative = delivered after ETA (late)
    punctualityDeltaMin = etaMin - deliveryMin;
  }

  const base = orderValueEur ? orderValueEur * (cfg.basePct / 100) : 1.50;
  let adjustedPct = cfg.basePct;

  let reason = 'Standard-Lieferung';

  if (punctualityDeltaMin !== null) {
    if (punctualityDeltaMin >= 5) {
      adjustedPct += cfg.boostPctPunctual;
      reason = 'Sehr pünktliche Lieferung';
    } else if (punctualityDeltaMin >= 0) {
      adjustedPct += cfg.boostPctPunctual / 2;
      reason = 'Pünktliche Lieferung';
    } else if (punctualityDeltaMin < -10) {
      adjustedPct -= cfg.penaltyPctLate;
      reason = 'Lieferung mit Verspätung';
    }
  }

  if (cfg.driverScoreBoost && driverScore !== null) {
    if (driverScore >= 80) {
      adjustedPct += 5;
      reason = reason === 'Standard-Lieferung' ? 'Top-bewerteter Fahrer' : `${reason} · Top-Fahrer`;
    } else if (driverScore < 50) {
      adjustedPct -= 5;
    }
  }

  const midRaw = orderValueEur ? orderValueEur * (adjustedPct / 100) : base;
  const mid = clamp(roundToHalf(midRaw), cfg.minSuggestionEur, cfg.maxSuggestionEur);
  const low = clamp(roundToHalf(mid * 0.5), cfg.minSuggestionEur, cfg.maxSuggestionEur);
  const high = clamp(roundToHalf(mid * 2), cfg.minSuggestionEur, cfg.maxSuggestionEur);

  return {
    low,
    mid,
    high,
    reason,
    driverScore,
    deliveryMin: deliveryMin !== null ? Math.round(deliveryMin * 10) / 10 : null,
    etaMin: etaMin !== null ? Math.round(etaMin * 10) / 10 : null,
    punctualityDeltaMin: punctualityDeltaMin !== null ? Math.round(punctualityDeltaMin * 10) / 10 : null,
    orderValueEur,
  };
}

// ── 3. Vorschlag speichern ────────────────────────────────────────────────────

export async function recordSuggestionShown(
  orderId: string,
  locationId: string,
  sugg: SmartTipSuggestions,
): Promise<void> {
  const sb = createServiceClient();
  await sb.from('smart_tip_suggestions').upsert(
    {
      order_id: orderId,
      location_id: locationId,
      suggested_low_eur: sugg.low,
      suggested_mid_eur: sugg.mid,
      suggested_high_eur: sugg.high,
      order_value_eur: sugg.orderValueEur,
      driver_score: sugg.driverScore,
      delivery_min: sugg.deliveryMin,
      eta_min: sugg.etaMin,
      punctuality_delta_min: sugg.punctualityDeltaMin,
      reason: sugg.reason,
      shown_at: new Date().toISOString(),
    },
    { onConflict: 'order_id' },
  );
}

export async function recordTipChosen(orderId: string, actualTipEur: number): Promise<void> {
  const sb = createServiceClient();
  await sb
    .from('smart_tip_suggestions')
    .update({ actual_tip_eur: actualTipEur, tip_chosen_at: new Date().toISOString() })
    .eq('order_id', orderId);
}

// ── 4. Dashboard ──────────────────────────────────────────────────────────────

export async function getSmartTipDashboard(locationId: string): Promise<SmartTipDashboard> {
  const sb = createServiceClient();
  const since30d = new Date(Date.now() - 30 * 86400_000).toISOString();

  const [config, { data: rows30d }, { data: recent }] = await Promise.all([
    getSmartTipConfig(locationId),
    sb
      .from('smart_tip_suggestions')
      .select('suggested_mid_eur, actual_tip_eur, tip_chosen_at')
      .eq('location_id', locationId)
      .gte('shown_at', since30d),
    sb
      .from('smart_tip_suggestions')
      .select('*')
      .eq('location_id', locationId)
      .order('shown_at', { ascending: false })
      .limit(20),
  ]);

  const all = rows30d ?? [];
  const chosen = all.filter((r) => r.tip_chosen_at !== null);
  const suggestionsShown30d = all.length;
  const tipsChosen30d = chosen.length;
  const conversionRate = suggestionsShown30d > 0 ? (tipsChosen30d / suggestionsShown30d) * 100 : 0;
  const avgActualTipEur =
    chosen.length > 0
      ? chosen.reduce((s, r) => s + Number(r.actual_tip_eur ?? 0), 0) / chosen.length
      : 0;
  const avgMidSuggestionEur =
    all.length > 0
      ? all.reduce((s, r) => s + Number(r.suggested_mid_eur ?? 0), 0) / all.length
      : 0;
  const tipVsSuggestionRatio =
    avgMidSuggestionEur > 0 ? (avgActualTipEur / avgMidSuggestionEur) * 100 : 0;

  const recentSuggestions = (recent ?? []).map(
    (r) =>
      ({
        id: r.id as string,
        orderId: r.order_id as string,
        locationId: r.location_id as string,
        suggestedLowEur: Number(r.suggested_low_eur),
        suggestedMidEur: Number(r.suggested_mid_eur),
        suggestedHighEur: Number(r.suggested_high_eur),
        orderValueEur: r.order_value_eur != null ? Number(r.order_value_eur) : null,
        driverScore: r.driver_score != null ? Number(r.driver_score) : null,
        deliveryMin: r.delivery_min != null ? Number(r.delivery_min) : null,
        etaMin: r.eta_min != null ? Number(r.eta_min) : null,
        punctualityDeltaMin:
          r.punctuality_delta_min != null ? Number(r.punctuality_delta_min) : null,
        reason: (r.reason as string | null) ?? null,
        shownAt: r.shown_at as string,
        actualTipEur: r.actual_tip_eur != null ? Number(r.actual_tip_eur) : null,
        tipChosenAt: (r.tip_chosen_at as string | null) ?? null,
      }) satisfies SmartTipSuggestionRow,
  );

  return {
    config,
    stats: {
      suggestionsShown30d,
      tipsChosen30d,
      conversionRate: Math.round(conversionRate * 10) / 10,
      avgActualTipEur: Math.round(avgActualTipEur * 100) / 100,
      avgMidSuggestionEur: Math.round(avgMidSuggestionEur * 100) / 100,
      tipVsSuggestionRatio: Math.round(tipVsSuggestionRatio * 10) / 10,
    },
    recentSuggestions,
  };
}

// ── 5. Prune ──────────────────────────────────────────────────────────────────

export async function pruneOldSuggestions(days = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_smart_tip_suggestions', { older_than_days: days });
  return (data as number | null) ?? 0;
}
