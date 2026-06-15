/**
 * lib/delivery/customer-value-score.ts
 *
 * Phase 192: Smart Customer Value Score (CVS) Engine
 *
 * Aggregiert vorhandene Kunden-Analytics zu einem einheitlichen Wert-Score (0–100)
 * pro Telefonnummer. Kombiniert:
 *   - rfm_score_norm  (35%): Normalisierter RFM-Score aus customer_rfm_profiles
 *   - monetary_score  (25%): Gesamtumsatz-Perzentil unter allen Location-Kunden
 *   - frequency_score (20%): Bestellfrequenz-Perzentil unter allen Location-Kunden
 *   - recency_score   (20%): Exponential-Decay-Score (100 × e^{-days/30})
 *
 * Tier-Grenzen: Platinum ≥ 75 · Gold ≥ 55 · Silver ≥ 35 · Bronze < 35
 *
 * Funktionen:
 *   computeCvsForLocation(locationId)    — Alle Kunden einer Location bewerten
 *   computeCvsAllLocations()             — Cron-Batch: alle aktiven Locations
 *   getCvsDistribution(locationId)       — Tier-Verteilung + KPIs
 *   getTopCustomers(locationId, limit?)  — Top-N Kunden nach CVS
 *   getCvsByPhone(locationId, phone)     — Einzelprofil abrufen
 *   getCvsDashboard(locationId)          — Kombinierter Admin-Response
 *   pruneStaleScores(days?)              — Alte Einträge bereinigen
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type CvsTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CustomerValueScore {
  id: string;
  locationId: string;
  customerPhone: string;
  customerName: string | null;
  rfmScoreNorm: number;
  frequencyScore: number;
  monetaryScore: number;
  recencyScore: number;
  cvs: number;
  cvsTier: CvsTier;
  totalOrders: number;
  totalSpentEur: number;
  ordersLast30d: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  recencyDays: number | null;
  rfmSegment: string | null;
  computedAt: string;
}

export interface CvsDistribution {
  locationId: string;
  totalCustomers: number;
  platinumCount: number;
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  avgCvs: number;
  maxCvs: number;
  totalRevenueEur: number;
  avgRevenuePerCustomer: number;
  avgOrdersLast30d: number;
  lastComputedAt: string | null;
}

export interface CvsDashboard {
  distribution: CvsDistribution | null;
  topCustomers: CustomerValueScore[];
  computedAt: string;
}

export interface CvsComputeResult {
  locationId: string;
  customersAnalyzed: number;
  scoresUpserted: number;
  errors: number;
}

// ── Berechnung-Hilfsfunktionen ────────────────────────────────────────────────

function computeRecencyScore(recencyDays: number): number {
  // Exponential decay: 100 bei 0 Tagen, ~37 bei 30 Tagen, ~5 bei 90 Tagen
  const raw = 100 * Math.exp(-recencyDays / 30);
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

function normalizeRfmScore(rfmScore: number): number {
  // RFM-Score: Summe aus 3 Quintil-Scores (1–5) → Wertebereich 3–15
  // Normalisierung auf 0–100
  const norm = ((rfmScore - 3) / 12) * 100;
  return Math.round(Math.min(100, Math.max(0, norm)) * 100) / 100;
}

function computePercentileScore(value: number, sortedValues: number[]): number {
  if (sortedValues.length <= 1) return 50;
  let below = 0;
  for (const v of sortedValues) {
    if (v < value) below++;
  }
  return Math.round((below / sortedValues.length) * 100 * 100) / 100;
}

function computeWeightedCvs(
  rfmScoreNorm: number,
  frequencyScore: number,
  monetaryScore: number,
  recencyScore: number,
): number {
  const raw =
    rfmScoreNorm   * 0.35 +
    frequencyScore * 0.20 +
    monetaryScore  * 0.25 +
    recencyScore   * 0.20;
  return Math.round(Math.min(100, Math.max(0, raw)) * 100) / 100;
}

function computeCvsTier(cvs: number): CvsTier {
  if (cvs >= 75) return 'platinum';
  if (cvs >= 55) return 'gold';
  if (cvs >= 35) return 'silver';
  return 'bronze';
}

// ── Mapping aus DB-Row ────────────────────────────────────────────────────────

function rowToScore(row: Record<string, unknown>): CustomerValueScore {
  return {
    id:               row.id as string,
    locationId:       row.location_id as string,
    customerPhone:    row.customer_phone as string,
    customerName:     (row.customer_name as string | null) ?? null,
    rfmScoreNorm:     Number(row.rfm_score_norm),
    frequencyScore:   Number(row.frequency_score),
    monetaryScore:    Number(row.monetary_score),
    recencyScore:     Number(row.recency_score),
    cvs:              Number(row.cvs),
    cvsTier:          row.cvs_tier as CvsTier,
    totalOrders:      Number(row.total_orders),
    totalSpentEur:    Number(row.total_spent_eur),
    ordersLast30d:    Number(row.orders_last_30d),
    firstOrderAt:     (row.first_order_at as string | null) ?? null,
    lastOrderAt:      (row.last_order_at as string | null) ?? null,
    recencyDays:      row.recency_days != null ? Number(row.recency_days) : null,
    rfmSegment:       (row.rfm_segment as string | null) ?? null,
    computedAt:       row.computed_at as string,
  };
}

// ── Haupt-Compute: eine Location ─────────────────────────────────────────────

export async function computeCvsForLocation(locationId: string): Promise<CvsComputeResult> {
  const sb = createServiceClient();
  const now = new Date().toISOString();

  // 1. RFM-Profile laden (Basis aller Kunden-Metriken)
  const { data: profiles, error: rfmErr } = await sb
    .from('customer_rfm_profiles')
    .select('customer_phone, customer_name, rfm_score, frequency, monetary_eur, recency_days, first_order_at, last_order_at, segment')
    .eq('location_id', locationId);

  if (rfmErr || !profiles || profiles.length === 0) {
    return {
      locationId,
      customersAnalyzed: 0,
      scoresUpserted: 0,
      errors: rfmErr ? 1 : 0,
    };
  }

  // 2. Bestellungen der letzten 30 Tage pro Telefonnummer (frischer Aktivitätssignal)
  const cutoff30d = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data: recentRows } = await sb
    .from('customer_orders')
    .select('kunde_telefon')
    .eq('location_id', locationId)
    .in('status', ['done', 'delivered', 'geliefert', 'abgeholt'])
    .gte('created_at', cutoff30d)
    .not('kunde_telefon', 'is', null);

  const last30dByPhone: Record<string, number> = {};
  for (const row of (recentRows ?? [])) {
    const phone = row.kunde_telefon as string;
    last30dByPhone[phone] = (last30dByPhone[phone] ?? 0) + 1;
  }

  // 3. Sorted arrays für Perzentil-Berechnung
  const sortedFrequencies = profiles
    .map(p => p.frequency as number)
    .sort((a, b) => a - b);
  const sortedMonetaries = profiles
    .map(p => p.monetary_eur as number)
    .sort((a, b) => a - b);

  // 4. CVS für jeden Kunden berechnen und als Upsert vorbereiten
  type UpsertRow = {
    location_id: string;
    customer_phone: string;
    customer_name: string | null;
    rfm_score_norm: number;
    frequency_score: number;
    monetary_score: number;
    recency_score: number;
    cvs: number;
    cvs_tier: CvsTier;
    total_orders: number;
    total_spent_eur: number;
    orders_last_30d: number;
    first_order_at: string | null;
    last_order_at: string | null;
    recency_days: number | null;
    rfm_segment: string | null;
    computed_at: string;
  };

  const upserts: UpsertRow[] = [];
  let errors = 0;

  for (const profile of profiles) {
    try {
      const phone         = profile.customer_phone as string;
      const rfmRaw        = profile.rfm_score as number;
      const frequency     = profile.frequency as number;
      const monetary      = profile.monetary_eur as number;
      const recencyDays   = profile.recency_days as number;

      const rfmScoreNorm  = normalizeRfmScore(rfmRaw);
      const frequencyScore = computePercentileScore(frequency, sortedFrequencies);
      const monetaryScore  = computePercentileScore(monetary, sortedMonetaries);
      const recencyScore   = computeRecencyScore(recencyDays);
      const cvs            = computeWeightedCvs(rfmScoreNorm, frequencyScore, monetaryScore, recencyScore);
      const cvsTier        = computeCvsTier(cvs);

      upserts.push({
        location_id:    locationId,
        customer_phone: phone,
        customer_name:  (profile.customer_name as string | null) ?? null,
        rfm_score_norm: rfmScoreNorm,
        frequency_score: frequencyScore,
        monetary_score:  monetaryScore,
        recency_score:   recencyScore,
        cvs,
        cvs_tier:        cvsTier,
        total_orders:    frequency,
        total_spent_eur: monetary,
        orders_last_30d: last30dByPhone[phone] ?? 0,
        first_order_at:  (profile.first_order_at as string | null) ?? null,
        last_order_at:   (profile.last_order_at as string | null) ?? null,
        recency_days:    recencyDays,
        rfm_segment:     (profile.segment as string | null) ?? null,
        computed_at:     now,
      });
    } catch {
      errors++;
    }
  }

  // 5. Upserts in 200er-Batches ausführen
  let scoresUpserted = 0;
  const CHUNK = 200;
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const chunk = upserts.slice(i, i + CHUNK);
    const { error } = await sb
      .from('customer_value_scores')
      .upsert(chunk, { onConflict: 'location_id,customer_phone' });
    if (error) {
      errors++;
    } else {
      scoresUpserted += chunk.length;
    }
  }

  return {
    locationId,
    customersAnalyzed: profiles.length,
    scoresUpserted,
    errors,
  };
}

// ── Cron-Batch: alle aktiven Locations ────────────────────────────────────────

export async function computeCvsAllLocations(): Promise<{
  locations: number;
  scoresUpserted: number;
  errors: number;
}> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  if (!locs?.length) return { locations: 0, scoresUpserted: 0, errors: 0 };

  const results = await Promise.all(
    locs.map(l =>
      computeCvsForLocation(l.id as string).catch(() => ({
        locationId: l.id as string,
        customersAnalyzed: 0,
        scoresUpserted: 0,
        errors: 1,
      }))
    )
  );

  return {
    locations: locs.length,
    scoresUpserted: results.reduce((s, r) => s + r.scoresUpserted, 0),
    errors: results.reduce((s, r) => s + r.errors, 0),
  };
}

// ── Abfrage-Funktionen ────────────────────────────────────────────────────────

export async function getCvsDistribution(locationId: string): Promise<CvsDistribution | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('v_cvs_distribution')
    .select('*')
    .eq('location_id', locationId)
    .maybeSingle();

  if (!data) return null;

  return {
    locationId:            data.location_id as string,
    totalCustomers:        Number(data.total_customers ?? 0),
    platinumCount:         Number(data.platinum_count ?? 0),
    goldCount:             Number(data.gold_count ?? 0),
    silverCount:           Number(data.silver_count ?? 0),
    bronzeCount:           Number(data.bronze_count ?? 0),
    avgCvs:                Number(data.avg_cvs ?? 0),
    maxCvs:                Number(data.max_cvs ?? 0),
    totalRevenueEur:       Number(data.total_revenue_eur ?? 0),
    avgRevenuePerCustomer: Number(data.avg_revenue_per_customer ?? 0),
    avgOrdersLast30d:      Number(data.avg_orders_last_30d ?? 0),
    lastComputedAt:        (data.last_computed_at as string | null) ?? null,
  };
}

export async function getTopCustomers(
  locationId: string,
  limit = 50,
): Promise<CustomerValueScore[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_value_scores')
    .select('*')
    .eq('location_id', locationId)
    .order('cvs', { ascending: false })
    .limit(Math.min(limit, 200));

  return (data ?? []).map(row => rowToScore(row as Record<string, unknown>));
}

export async function getCvsByTier(
  locationId: string,
  tier: CvsTier,
  limit = 50,
): Promise<CustomerValueScore[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_value_scores')
    .select('*')
    .eq('location_id', locationId)
    .eq('cvs_tier', tier)
    .order('cvs', { ascending: false })
    .limit(Math.min(limit, 200));

  return (data ?? []).map(row => rowToScore(row as Record<string, unknown>));
}

export async function getCvsByPhone(
  locationId: string,
  phone: string,
): Promise<CustomerValueScore | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_value_scores')
    .select('*')
    .eq('location_id', locationId)
    .eq('customer_phone', phone)
    .maybeSingle();

  if (!data) return null;
  return rowToScore(data as Record<string, unknown>);
}

export async function getCvsDashboard(locationId: string): Promise<CvsDashboard> {
  const [distribution, topCustomers] = await Promise.all([
    getCvsDistribution(locationId),
    getTopCustomers(locationId, 20),
  ]);

  return {
    distribution,
    topCustomers,
    computedAt: new Date().toISOString(),
  };
}

export async function pruneStaleScores(days = 45): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data } = await sb
    .from('customer_value_scores')
    .delete()
    .lt('computed_at', cutoff)
    .select('id');
  return (data ?? []).length;
}
