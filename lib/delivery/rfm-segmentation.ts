/**
 * lib/delivery/rfm-segmentation.ts
 *
 * Phase 178 — RFM Customer Segmentation Engine
 *
 * Segmentiert Kunden nach Recency / Frequency / Monetary Value.
 * Quintil-Scoring (1–5) + 10-Segment-Klassifikation.
 *
 * Segmente:
 *  champion           — Beste Kunden: kaufen oft, viel, kürzlich
 *  loyal              — Regelmäßig, aber nicht unbedingt hoher Wert
 *  potential_loyalist — Kürzlich, mittlere Frequenz — Potenzial
 *  new_customer       — Kürzlich, erste Bestellungen
 *  promising          — Mittelfrisch, frühe Phase
 *  needs_attention    — Mittel-Recency, okay Frequenz/Wert — drohen zu schlafen
 *  at_risk            — Früher gut, jetzt lange inaktiv
 *  cant_lose          — Sehr wertvoll, aber fast verloren
 *  hibernating        — Inaktiv, niedrige Frequenz/Wert
 *  lost               — Lange keine Bestellung mehr
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ─────────────────────────────────────────────────────────────────────

export type RfmSegment =
  | 'champion'
  | 'loyal'
  | 'potential_loyalist'
  | 'new_customer'
  | 'promising'
  | 'needs_attention'
  | 'at_risk'
  | 'cant_lose'
  | 'hibernating'
  | 'lost';

export interface RfmProfile {
  id: string;
  locationId: string;
  customerPhone: string;
  customerName: string | null;
  recencyDays: number;
  frequency: number;
  monetaryEur: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  rScore: number;
  fScore: number;
  mScore: number;
  rfmScore: number;
  segment: RfmSegment;
  computedAt: string;
}

export interface SegmentStats {
  segment: RfmSegment;
  customerCount: number;
  avgMonetaryEur: number;
  avgFrequency: number;
  avgRecencyDays: number;
  avgRfmScore: number;
  totalMonetaryEur: number;
}

export interface RfmDashboard {
  totalCustomers: number;
  totalRevenueEur: number;
  avgOrderValue: number;
  topSegment: RfmSegment | null;
  segmentStats: SegmentStats[];
  topCustomers: RfmProfile[];
  computedAt: string | null;
}

export interface ComputeResult {
  locationId: string;
  customersAnalyzed: number;
  profilesUpserted: number;
  errors: number;
}

export interface BatchResult {
  locations: number;
  profilesUpserted: number;
  errors: number;
}

// ── Segment-Klassifikation ────────────────────────────────────────────────────

export function classifySegment(r: number, f: number, m: number): RfmSegment {
  // Beste Kunden: hoher R + hoher F + hoher M
  if (r >= 4 && f >= 4 && m >= 4) return 'champion';
  // Treue: hohe Frequenz
  if (f >= 4) return 'loyal';
  // Fast-treue: kürzlich + mittlere Frequenz
  if (r >= 4 && f >= 2) return 'potential_loyalist';
  // Neu: kürzlich, kaum Bestellungen
  if (r >= 4 && f === 1) return 'new_customer';
  // Vielversprechend: mittelfrisch, erste Schritte
  if (r === 3 && f === 1) return 'promising';
  // Brauchen Aufmerksamkeit: mittel-Recency, okay Wert
  if (r === 3 && f >= 2 && m >= 3) return 'needs_attention';
  // Kann verloren gehen: sehr hoch F+M, aber lange inaktiv
  if (r <= 2 && f >= 4 && m >= 4) return 'cant_lose';
  // Abwanderungs-Risiko: früher gut, jetzt inaktiv
  if (r <= 2 && f >= 2 && m >= 2) return 'at_risk';
  // Schläfer: niedrige Werte in allem
  if (r <= 2 && f <= 2) return 'hibernating';
  // Verloren: sehr niedrige Werte
  return 'lost';
}

// ── Quintil-Bucketing ─────────────────────────────────────────────────────────

function quintile(value: number, sorted: number[], invert = false): number {
  if (sorted.length === 0) return 3;
  const pct = sorted.filter((v) => v <= value).length / sorted.length;
  const score = Math.ceil(pct * 5) as 1 | 2 | 3 | 4 | 5;
  const clamped = Math.max(1, Math.min(5, score)) as 1 | 2 | 3 | 4 | 5;
  return invert ? (6 - clamped) : clamped;
}

// ── Kunden-Daten laden ────────────────────────────────────────────────────────

interface RawCustomer {
  phone: string;
  name: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: string;
  firstOrderAt: string;
  recencyDays: number;
}

async function loadCustomerMetrics(locationId: string): Promise<RawCustomer[]> {
  const sb = createServiceClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 365);

  const { data, error } = await sb
    .from('customer_orders')
    .select('kunde_telefon, kunde_name, gesamtbetrag, created_at')
    .eq('location_id', locationId)
    .not('kunde_telefon', 'is', null)
    .gte('created_at', cutoffDate.toISOString())
    .in('order_status', ['delivered', 'completed', 'bezahlt'])
    .order('created_at', { ascending: false })
    .limit(10000);

  if (error || !data) return [];

  const now = Date.now();
  const byPhone = new Map<string, RawCustomer>();

  for (const row of data) {
    const phone = row.kunde_telefon as string;
    if (!phone?.trim()) continue;
    const amount = (row.gesamtbetrag as number | null) ?? 0;
    const orderAt = row.created_at as string;
    const existing = byPhone.get(phone);
    if (!existing) {
      byPhone.set(phone, {
        phone,
        name: (row.kunde_name as string | null) ?? null,
        totalOrders: 1,
        totalSpent: amount,
        lastOrderAt: orderAt,
        firstOrderAt: orderAt,
        recencyDays: Math.floor((now - new Date(orderAt).getTime()) / 86_400_000),
      });
    } else {
      existing.totalOrders++;
      existing.totalSpent += amount;
      if (orderAt < existing.firstOrderAt) existing.firstOrderAt = orderAt;
      if (orderAt > existing.lastOrderAt) {
        existing.lastOrderAt = orderAt;
        existing.recencyDays = Math.floor((now - new Date(orderAt).getTime()) / 86_400_000);
      }
    }
  }

  return Array.from(byPhone.values());
}

// ── Kern-Berechnung ───────────────────────────────────────────────────────────

export async function computeRfmForLocation(locationId: string): Promise<ComputeResult> {
  const sb = createServiceClient();
  let errors = 0;

  const customers = await loadCustomerMetrics(locationId);
  if (customers.length === 0) {
    return { locationId, customersAnalyzed: 0, profilesUpserted: 0, errors: 0 };
  }

  // Sortierte Arrays für Quintil-Berechnung
  const sortedRecency  = [...customers.map((c) => c.recencyDays)].sort((a, b) => a - b);
  const sortedFreq     = [...customers.map((c) => c.totalOrders)].sort((a, b) => a - b);
  const sortedMonetary = [...customers.map((c) => c.totalSpent)].sort((a, b) => a - b);

  const rows = customers.map((c) => {
    // Recency: niedrigerer Wert = besser → invertieren
    const rScore = quintile(c.recencyDays, sortedRecency, true);
    const fScore = quintile(c.totalOrders, sortedFreq);
    const mScore = quintile(c.totalSpent, sortedMonetary);
    const rfmScore = rScore + fScore + mScore;
    const segment = classifySegment(rScore, fScore, mScore);

    return {
      location_id:    locationId,
      customer_phone: c.phone,
      customer_name:  c.name,
      recency_days:   c.recencyDays,
      frequency:      c.totalOrders,
      monetary_eur:   Math.round(c.totalSpent * 100) / 100,
      first_order_at: c.firstOrderAt,
      last_order_at:  c.lastOrderAt,
      r_score:        rScore,
      f_score:        fScore,
      m_score:        mScore,
      rfm_score:      rfmScore,
      segment,
      computed_at:    new Date().toISOString(),
    };
  });

  // Batch-Upsert in Chunks von 500
  let upserted = 0;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb
      .from('customer_rfm_profiles')
      .upsert(chunk, { onConflict: 'location_id,customer_phone' });
    if (error) {
      errors++;
    } else {
      upserted += chunk.length;
    }
  }

  return {
    locationId,
    customersAnalyzed: customers.length,
    profilesUpserted: upserted,
    errors,
  };
}

// ── Cron-Batch ────────────────────────────────────────────────────────────────

export async function buildRfmAllLocations(): Promise<BatchResult> {
  const sb = createServiceClient();
  const { data: locations } = await sb
    .from('locations')
    .select('id')
    .eq('active', true)
    .limit(30);

  if (!locations?.length) return { locations: 0, profilesUpserted: 0, errors: 0 };

  let totalUpserted = 0;
  let totalErrors = 0;

  for (const loc of locations) {
    try {
      const r = await computeRfmForLocation(loc.id as string);
      totalUpserted += r.profilesUpserted;
      totalErrors   += r.errors;
    } catch {
      totalErrors++;
    }
  }

  return { locations: locations.length, profilesUpserted: totalUpserted, errors: totalErrors };
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export async function getRfmDashboard(locationId: string): Promise<RfmDashboard> {
  const sb = createServiceClient();

  const [statsRes, topRes] = await Promise.all([
    sb
      .from('v_rfm_segment_stats')
      .select('segment,customer_count,avg_monetary_eur,avg_frequency,avg_recency_days,avg_rfm_score,total_monetary_eur')
      .eq('location_id', locationId),
    sb
      .from('v_rfm_top_customers')
      .select('id,location_id,customer_phone,customer_name,recency_days,frequency,monetary_eur,first_order_at,last_order_at,r_score,f_score,m_score,rfm_score,segment,computed_at,rank')
      .eq('location_id', locationId)
      .lte('rank', 10)
      .order('rank', { ascending: true }),
  ]);

  const stats: SegmentStats[] = (statsRes.data ?? []).map((r) => ({
    segment:         r.segment as RfmSegment,
    customerCount:   r.customer_count as number,
    avgMonetaryEur:  Number(r.avg_monetary_eur ?? 0),
    avgFrequency:    Number(r.avg_frequency ?? 0),
    avgRecencyDays:  Number(r.avg_recency_days ?? 0),
    avgRfmScore:     Number(r.avg_rfm_score ?? 0),
    totalMonetaryEur: Number(r.total_monetary_eur ?? 0),
  }));

  const topCustomers: RfmProfile[] = (topRes.data ?? []).map(mapRow);

  const totalCustomers = stats.reduce((s, x) => s + x.customerCount, 0);
  const totalRevenueEur = stats.reduce((s, x) => s + x.totalMonetaryEur, 0);
  const topSegment = stats.sort((a, b) => b.customerCount - a.customerCount)[0]?.segment ?? null;

  return {
    totalCustomers,
    totalRevenueEur: Math.round(totalRevenueEur * 100) / 100,
    avgOrderValue: totalCustomers > 0 ? Math.round((totalRevenueEur / totalCustomers) * 100) / 100 : 0,
    topSegment,
    segmentStats: stats,
    topCustomers,
    computedAt: topCustomers[0]?.computedAt ?? null,
  };
}

// ── Kunden pro Segment ────────────────────────────────────────────────────────

export async function getSegmentCustomers(
  locationId: string,
  segment: RfmSegment,
  limit = 50,
): Promise<RfmProfile[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_rfm_profiles')
    .select('id,location_id,customer_phone,customer_name,recency_days,frequency,monetary_eur,first_order_at,last_order_at,r_score,f_score,m_score,rfm_score,segment,computed_at')
    .eq('location_id', locationId)
    .eq('segment', segment)
    .order('rfm_score', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

// ── Einzelkunden-Profil ───────────────────────────────────────────────────────

export async function getCustomerRfmProfile(
  locationId: string,
  phone: string,
): Promise<RfmProfile | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('customer_rfm_profiles')
    .select('id,location_id,customer_phone,customer_name,recency_days,frequency,monetary_eur,first_order_at,last_order_at,r_score,f_score,m_score,rfm_score,segment,computed_at')
    .eq('location_id', locationId)
    .eq('customer_phone', phone)
    .maybeSingle();

  return data ? mapRow(data) : null;
}

// ── Audience-Größe für Kampagnen ──────────────────────────────────────────────

export async function getSegmentAudienceSize(
  locationId: string,
  segment: RfmSegment,
): Promise<number> {
  const sb = createServiceClient();
  const { count } = await sb
    .from('customer_rfm_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('segment', segment);
  return count ?? 0;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneStaleRfmProfiles(days = 30): Promise<number> {
  const sb = createServiceClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { count } = await sb
    .from('customer_rfm_profiles')
    .delete({ count: 'exact' })
    .lt('computed_at', cutoff);
  return count ?? 0;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): RfmProfile {
  return {
    id:            r.id as string,
    locationId:    r.location_id as string,
    customerPhone: r.customer_phone as string,
    customerName:  (r.customer_name as string | null) ?? null,
    recencyDays:   r.recency_days as number,
    frequency:     r.frequency as number,
    monetaryEur:   Number(r.monetary_eur ?? 0),
    firstOrderAt:  (r.first_order_at as string | null) ?? null,
    lastOrderAt:   (r.last_order_at as string | null) ?? null,
    rScore:        r.r_score as number,
    fScore:        r.f_score as number,
    mScore:        r.m_score as number,
    rfmScore:      r.rfm_score as number,
    segment:       r.segment as RfmSegment,
    computedAt:    r.computed_at as string,
  };
}

// ── Segment-Meta (Label + Farbe) ──────────────────────────────────────────────

export const SEGMENT_META: Record<RfmSegment, { label: string; color: string; description: string }> = {
  champion:           { label: 'Champions',           color: '#16a34a', description: 'Beste Kunden — kaufen oft, viel, kürzlich' },
  loyal:              { label: 'Treue Kunden',        color: '#2563eb', description: 'Regelmäßig, hohe Frequenz' },
  potential_loyalist: { label: 'Fast-Treue',          color: '#7c3aed', description: 'Kürzlich + mittlere Frequenz' },
  new_customer:       { label: 'Neukunden',           color: '#0891b2', description: 'Kürzlich, erste Bestellungen' },
  promising:          { label: 'Vielversprechend',    color: '#0d9488', description: 'Mittelfrisch, frühe Phase' },
  needs_attention:    { label: 'Braucht Aufmerksamkeit', color: '#d97706', description: 'Mittel-Recency, drohen zu schlafen' },
  at_risk:            { label: 'Abwanderungs-Risiko', color: '#ea580c', description: 'Früher gut, jetzt lange inaktiv' },
  cant_lose:          { label: 'Darf nicht verloren gehen', color: '#dc2626', description: 'Sehr wertvoll, fast weg' },
  hibernating:        { label: 'Schläfer',            color: '#6b7280', description: 'Inaktiv, niedrige Werte' },
  lost:               { label: 'Verloren',            color: '#374151', description: 'Lange keine Bestellung mehr' },
};
