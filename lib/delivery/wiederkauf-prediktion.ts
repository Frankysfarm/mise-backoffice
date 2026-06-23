/**
 * lib/delivery/wiederkauf-prediktion.ts — Phase 438
 *
 * Wiederkauf-Prediktion: Berechnet für jeden Kunden die Wahrscheinlichkeit,
 * innerhalb von 30/60/90 Tagen erneut zu bestellen.
 *
 * Modell: Exponential-Interarrival (vereinfachtes Pareto/NBD)
 *   λ = orders_90d / 90          — Kaufrate (Bestellungen/Tag)
 *   avgInterval = 90 / orders_90d — Ø Tage zwischen Käufen
 *   recencyDecay = exp(-daysSinceLast / (1.5 × avgInterval))
 *   p(T) = min(0.95, recencyDecay × (1 − exp(−λ × T)))
 *
 * Public API:
 *   computeForLocation(locationId)   — Prognosen für alle Kunden
 *   computeAllLocations()            — Cron-Batch
 *   getPrognosen(locationId, limit?) — Sortiert nach p30 DESC
 *   getDashboard(locationId)         — Übersicht + High/Medium/Low Segmente
 *   pruneOldPrognosen(daysOld?)      — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface WiederkaufPrognose {
  id:              string;
  locationId:      string;
  kundeTelefon:    string;
  kundeName:       string | null;
  p30:             number;
  p60:             number;
  p90:             number;
  letzterKauf:     string;
  bestellungen90d: number;
  avgBestellwert:  number | null;
  prognoseDatum:   string;
  berechnetAm:     string;
}

export interface WiederkaufSegment {
  label:  string;
  count:  number;
  avgP30: number;
}

export interface WiederkaufDashboard {
  totalKunden:    number;
  avgP30:         number | null;
  highRisk:       WiederkaufPrognose[];  // p30 >= 0.7 — sehr wahrscheinlich
  mediumRisk:     WiederkaufPrognose[];  // p30 0.4–0.7 — möglich
  lowRisk:        WiederkaufPrognose[];  // p30 < 0.4 — unwahrscheinlich
  prognoseDatum:  string | null;
}

export interface ComputeResult {
  locationId: string;
  analyzed:   number;
  upserted:   number;
  errors:     number;
}

// ── Modell-Berechnung ─────────────────────────────────────────────────────────

function computeProb(
  orders90d: number,
  daysSinceLast: number,
  horizonDays: number,
): number {
  if (orders90d === 0) return 0;
  const lambda = orders90d / 90;
  const avgInterval = 90 / orders90d;
  const recencyDecay = Math.exp(-daysSinceLast / (1.5 * avgInterval));
  const baseProb = 1 - Math.exp(-lambda * horizonDays);
  return Math.min(0.9500, Math.max(0, Math.round(recencyDecay * baseProb * 10000) / 10000));
}

// ── Berechnung für eine Location ──────────────────────────────────────────────

export async function computeForLocation(locationId: string): Promise<ComputeResult> {
  const sb = createServiceClient();
  const result: ComputeResult = { locationId, analyzed: 0, upserted: 0, errors: 0 };

  const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const since180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('kunde_telefon, kunde_name, created_at, gesamtbetrag, status')
    .eq('location_id', locationId)
    .neq('status', 'storniert')
    .gte('created_at', since180)
    .order('created_at', { ascending: false });

  if (!orders || orders.length === 0) return result;

  type OrderRow = {
    kunde_telefon: string;
    kunde_name: string | null;
    created_at: string;
    gesamtbetrag: number | null;
  };

  const byKunde = new Map<string, { rows: OrderRow[] }>();
  for (const o of orders as OrderRow[]) {
    if (!o.kunde_telefon) continue;
    const entry = byKunde.get(o.kunde_telefon);
    if (entry) {
      entry.rows.push(o);
    } else {
      byKunde.set(o.kunde_telefon, { rows: [o] });
    }
  }

  const now = Date.now();
  const rows: {
    location_id:       string;
    kunde_telefon:     string;
    kunde_name:        string | null;
    p30:               number;
    p60:               number;
    p90:               number;
    letzter_kauf:      string;
    bestellungen_90d:  number;
    avg_bestellwert:   number | null;
    prognose_datum:    string;
    berechnet_am:      string;
  }[] = [];

  const today = new Date().toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  for (const [tel, { rows: orderRows }] of byKunde) {
    result.analyzed++;
    const sortedRows = orderRows.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    const letzterKauf = sortedRows[0].created_at;
    const daysSinceLast = (now - new Date(letzterKauf).getTime()) / (1000 * 60 * 60 * 24);

    const rows90d = sortedRows.filter((r) => new Date(r.created_at).getTime() >= Date.now() - 90 * 24 * 60 * 60 * 1000);
    const bestellungen90d = rows90d.length;

    const betraege = sortedRows.map((r) => r.gesamtbetrag).filter((v): v is number => v != null);
    const avgBestellwert = betraege.length > 0
      ? Math.round((betraege.reduce((a, b) => a + b, 0) / betraege.length) * 100) / 100
      : null;

    const kundeName = sortedRows.find((r) => r.kunde_name)?.kunde_name ?? null;

    rows.push({
      location_id:      locationId,
      kunde_telefon:    tel,
      kunde_name:       kundeName,
      p30:              computeProb(bestellungen90d, daysSinceLast, 30),
      p60:              computeProb(bestellungen90d, daysSinceLast, 60),
      p90:              computeProb(bestellungen90d, daysSinceLast, 90),
      letzter_kauf:     letzterKauf,
      bestellungen_90d: bestellungen90d,
      avg_bestellwert:  avgBestellwert,
      prognose_datum:   today,
      berechnet_am:     nowIso,
    });
  }

  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await sb.from('wiederkauf_prognosen').upsert(chunk, {
      onConflict: 'location_id,kunde_telefon',
    });
    if (error) {
      result.errors++;
    } else {
      result.upserted += chunk.length;
    }
  }

  return result;
}

export async function computeAllLocations(): Promise<{ locations: number; upserted: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);
  if (!locs) return { locations: 0, upserted: 0, errors: 0 };

  let upserted = 0;
  let errors = 0;
  for (const loc of locs) {
    const r = await computeForLocation(loc.id);
    upserted += r.upserted;
    errors += r.errors;
  }
  return { locations: locs.length, upserted, errors };
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

export async function getPrognosen(
  locationId: string,
  limit = 50,
): Promise<WiederkaufPrognose[]> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('wiederkauf_prognosen')
    .select('*')
    .eq('location_id', locationId)
    .order('p30', { ascending: false })
    .limit(limit);

  return (data ?? []).map(mapRow);
}

export async function getDashboard(locationId: string): Promise<WiederkaufDashboard> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('wiederkauf_prognosen')
    .select('*')
    .eq('location_id', locationId)
    .order('p30', { ascending: false })
    .limit(200);

  const all = (data ?? []).map(mapRow);
  const totalKunden = all.length;
  const avgP30 = totalKunden > 0
    ? Math.round((all.reduce((s, r) => s + r.p30, 0) / totalKunden) * 1000) / 1000
    : null;

  return {
    totalKunden,
    avgP30,
    highRisk:   all.filter((r) => r.p30 >= 0.7).slice(0, 15),
    mediumRisk: all.filter((r) => r.p30 >= 0.4 && r.p30 < 0.7).slice(0, 15),
    lowRisk:    all.filter((r) => r.p30 < 0.4).slice(0, 10),
    prognoseDatum: all[0]?.prognoseDatum ?? null,
  };
}

export async function pruneOldPrognosen(daysOld = 30): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_wiederkauf_prognosen', { days_old: daysOld });
  return (data as number | null) ?? 0;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): WiederkaufPrognose {
  return {
    id:              r.id as string,
    locationId:      r.location_id as string,
    kundeTelefon:    r.kunde_telefon as string,
    kundeName:       (r.kunde_name as string | null) ?? null,
    p30:             Number(r.p30),
    p60:             Number(r.p60),
    p90:             Number(r.p90),
    letzterKauf:     r.letzter_kauf as string,
    bestellungen90d: Number(r.bestellungen_90d),
    avgBestellwert:  r.avg_bestellwert != null ? Number(r.avg_bestellwert) : null,
    prognoseDatum:   r.prognose_datum as string,
    berechnetAm:     r.berechnet_am as string,
  };
}
