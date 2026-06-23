/**
 * lib/delivery/einnahmen-trichter.ts — Phase 439
 *
 * Einnahmen-Trichter: Tägliche Konversionsanalyse der Bestellpipeline.
 * Verfolgt wie viele Bestellungen jeden Schritt der Pipeline durchlaufen:
 *   Eingegangen → In Küche → Unterwegs → Geliefert
 *
 * Konversionsraten:
 *   Küchen-Rate    = in_kueche / eingegangen
 *   Transit-Rate   = unterwegs / in_kueche
 *   Abschluss-Rate = geliefert / unterwegs
 *   Gesamt-Rate    = geliefert / eingegangen
 *
 * Public API:
 *   computeSnapshot(locationId, datum?)  — Snapshot für einen Tag
 *   computeAllLocations(datum?)          — Cron-Batch
 *   getSnapshots(locationId, days?)      — Letzte N Tage
 *   getLatestSnapshot(locationId)        — Neuester Snapshot
 *   pruneOldSnapshots(daysOld?)          — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface TrichterSnapshot {
  id:                  string;
  locationId:          string;
  datum:               string;
  eingegangen:         number;
  inKueche:            number;
  unterwegs:           number;
  geliefert:           number;
  storniert:           number;
  umsatzEingegangen:   number;
  umsatzGeliefert:     number;
  rateKueche:          number | null;
  rateTransit:         number | null;
  rateAbschluss:       number | null;
  rateGesamt:          number | null;
  avgLieferMin:        number | null;
  avgGesamtMin:        number | null;
  berechnetAm:         string;
}

export interface ComputeResult {
  locationId: string;
  datum:      string;
  ok:         boolean;
  error?:     string;
}

// ── Berechnung ────────────────────────────────────────────────────────────────

const KUECHE_STATUSES  = new Set(['in_zubereitung', 'fertig', 'unterwegs', 'geliefert']);
const TRANSIT_STATUSES = new Set(['unterwegs', 'geliefert']);

export async function computeSnapshot(
  locationId: string,
  datum?: string,
): Promise<ComputeResult> {
  const sb = createServiceClient();
  const targetDate = datum ?? (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd   = `${targetDate}T23:59:59.999Z`;

  const { data: orders, error: fetchErr } = await sb
    .from('customer_orders')
    .select('status, gesamtbetrag, created_at, dispatched_at, geliefert_am')
    .eq('location_id', locationId)
    .gte('created_at', dayStart)
    .lte('created_at', dayEnd);

  if (fetchErr) return { locationId, datum: targetDate, ok: false, error: fetchErr.message };
  if (!orders || orders.length === 0) return { locationId, datum: targetDate, ok: true };

  type OrderRow = {
    status: string;
    gesamtbetrag: number | null;
    created_at: string;
    dispatched_at: string | null;
    geliefert_am: string | null;
  };

  const rows = orders as OrderRow[];

  const eingegangen  = rows.length;
  const inKueche     = rows.filter((r) => KUECHE_STATUSES.has(r.status)).length;
  const unterwegs    = rows.filter((r) => TRANSIT_STATUSES.has(r.status)).length;
  const geliefert    = rows.filter((r) => r.status === 'geliefert').length;
  const storniert    = rows.filter((r) => r.status === 'storniert').length;

  const umsatzEingegangen = rows.reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);
  const umsatzGeliefert   = rows
    .filter((r) => r.status === 'geliefert')
    .reduce((s, r) => s + (r.gesamtbetrag ?? 0), 0);

  const rate = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 10000) / 10000 : null);

  const rateKueche   = rate(inKueche, eingegangen);
  const rateTransit  = rate(unterwegs, inKueche);
  const rateAbschluss = rate(geliefert, unterwegs);
  const rateGesamt   = rate(geliefert, eingegangen);

  const lieferMinuten = rows
    .filter((r) => r.status === 'geliefert' && r.dispatched_at && r.geliefert_am)
    .map((r) => (new Date(r.geliefert_am!).getTime() - new Date(r.dispatched_at!).getTime()) / 60000);

  const gesamtMinuten = rows
    .filter((r) => r.status === 'geliefert' && r.geliefert_am)
    .map((r) => (new Date(r.geliefert_am!).getTime() - new Date(r.created_at).getTime()) / 60000);

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : null;

  const avgLieferMin  = avg(lieferMinuten.filter((v) => v > 0 && v < 300));
  const avgGesamtMin  = avg(gesamtMinuten.filter((v) => v > 0 && v < 300));

  const snapshot = {
    location_id:          locationId,
    datum:                targetDate,
    eingegangen,
    in_kueche:            inKueche,
    unterwegs,
    geliefert,
    storniert,
    umsatz_eingegangen:   Math.round(umsatzEingegangen * 100) / 100,
    umsatz_geliefert:     Math.round(umsatzGeliefert * 100) / 100,
    rate_kueche:          rateKueche,
    rate_transit:         rateTransit,
    rate_abschluss:       rateAbschluss,
    rate_gesamt:          rateGesamt,
    avg_liefer_min:       avgLieferMin,
    avg_gesamt_min:       avgGesamtMin,
    berechnet_am:         new Date().toISOString(),
  };

  const { error: upsertErr } = await sb
    .from('einnahmen_trichter_snapshots')
    .upsert(snapshot, { onConflict: 'location_id,datum' });

  if (upsertErr) return { locationId, datum: targetDate, ok: false, error: upsertErr.message };
  return { locationId, datum: targetDate, ok: true };
}

export async function computeAllLocations(
  datum?: string,
): Promise<{ locations: number; ok: number; errors: number }> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);
  if (!locs) return { locations: 0, ok: 0, errors: 0 };

  let ok = 0;
  let errors = 0;
  for (const loc of locs) {
    const r = await computeSnapshot(loc.id, datum);
    if (r.ok) ok++; else errors++;
  }
  return { locations: locs.length, ok, errors };
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

export async function getSnapshots(
  locationId: string,
  days = 14,
): Promise<TrichterSnapshot[]> {
  const sb = createServiceClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data } = await sb
    .from('einnahmen_trichter_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .gte('datum', since)
    .order('datum', { ascending: false });

  return (data ?? []).map(mapRow);
}

export async function getLatestSnapshot(locationId: string): Promise<TrichterSnapshot | null> {
  const sb = createServiceClient();
  const { data } = await sb
    .from('einnahmen_trichter_snapshots')
    .select('*')
    .eq('location_id', locationId)
    .order('datum', { ascending: false })
    .limit(1)
    .single();

  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function pruneOldSnapshots(daysOld = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_einnahmen_trichter', { days_old: daysOld });
  return (data as number | null) ?? 0;
}

// ── Mapper ────────────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): TrichterSnapshot {
  return {
    id:                r.id as string,
    locationId:        r.location_id as string,
    datum:             r.datum as string,
    eingegangen:       Number(r.eingegangen),
    inKueche:          Number(r.in_kueche),
    unterwegs:         Number(r.unterwegs),
    geliefert:         Number(r.geliefert),
    storniert:         Number(r.storniert),
    umsatzEingegangen: Number(r.umsatz_eingegangen),
    umsatzGeliefert:   Number(r.umsatz_geliefert),
    rateKueche:        r.rate_kueche != null ? Number(r.rate_kueche) : null,
    rateTransit:       r.rate_transit != null ? Number(r.rate_transit) : null,
    rateAbschluss:     r.rate_abschluss != null ? Number(r.rate_abschluss) : null,
    rateGesamt:        r.rate_gesamt != null ? Number(r.rate_gesamt) : null,
    avgLieferMin:      r.avg_liefer_min != null ? Number(r.avg_liefer_min) : null,
    avgGesamtMin:      r.avg_gesamt_min != null ? Number(r.avg_gesamt_min) : null,
    berechnetAm:       r.berechnet_am as string,
  };
}
