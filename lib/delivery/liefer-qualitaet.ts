/**
 * lib/delivery/liefer-qualitaet.ts — Phase 433
 *
 * Liefer-Qualitäts-Index: Automatische Qualitätsbewertung jeder Lieferung.
 *
 * Score-Komponenten (0–100):
 *   Pünktlichkeit   (40%): 100 wenn on-time; max(0, 100 − min_verspätung×5) sonst
 *   Vollständigkeit (30%): 100 wenn delivered; 0 wenn cancelled/rejected
 *   Zufriedenheit   (30%): (customer_rating/5)×100 aus tour_feedback; 70 wenn kein Feedback
 *
 * Public API:
 *   computeQualitaetForOrder(orderId, locationId)       — Einzellieferung
 *   computeQualitaetForLocation(locationId, since?)     — Alle offenen Orders einer Location
 *   computeQualitaetAllLocations(since?)                — Cron-Batch
 *   getQualitaetForLocation(locationId, days?, limit?)  — Admin-Lesen
 *   getQualitaetForDriver(driverId, locationId, days?)  — Fahrer-eigene Daten
 *   pruneOldQualitaet(daysOld?)                        — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export interface QualitaetKomponenten {
  puenktlichkeit:   number | null;   // 0–100
  vollstaendigkeit: number;           // 0 or 100
  zufriedenheit:    number | null;    // 0–100
  minutesLate:      number | null;    // null wenn pünktlich
  hasRating:        boolean;
}

export interface LieferQualitaet {
  id:            string;
  locationId:    string;
  orderId:       string;
  driverId:      string;
  score:         number;
  komponenten:   QualitaetKomponenten;
  berechnetAm:   string;
}

export interface QualitaetWithOrder extends LieferQualitaet {
  orderNr:       string | null;
  kundeName:     string | null;
  driverName:    string | null;
}

export interface ComputeResult {
  orderId:  string;
  score:    number;
  upserted: boolean;
  skipped:  boolean;
  reason?:  string;
}

export interface ComputeLocationResult {
  locationId: string;
  computed:   number;
  upserted:   number;
  skipped:    number;
  errors:     number;
}

// ── Score-Berechnung ───────────────────────────────────────────────────────────

function computePuenktlichkeit(deliveredAt: string | null, promisedAt: string | null): { score: number | null; minutesLate: number | null } {
  if (!deliveredAt || !promisedAt) return { score: null, minutesLate: null };
  const delMs   = new Date(deliveredAt).getTime();
  const promMs  = new Date(promisedAt).getTime();
  const minLate = Math.max(0, (delMs - promMs) / 60_000);
  const score   = Math.max(0, 100 - minLate * 5);
  return { score: Math.round(score * 10) / 10, minutesLate: minLate > 0 ? Math.round(minLate) : null };
}

function computeVollstaendigkeit(status: string): number {
  return status === 'delivered' ? 100 : 0;
}

function computeZufriedenheit(rating: number | null): number {
  if (rating === null) return 70;            // Default: neutral when no feedback
  return Math.round((rating / 5) * 100 * 10) / 10;
}

function finalScore(p: number | null, v: number, z: number | null): number {
  const ps = p ?? 70;   // default 70 when no timing data
  const zs = z ?? 70;
  return Math.round((ps * 0.4 + v * 0.3 + zs * 0.3) * 10) / 10;
}

// ── Einzellieferung ─────────────────────────────────────────────────────────

export async function computeQualitaetForOrder(
  orderId: string,
  locationId: string,
): Promise<ComputeResult> {
  const sb = createServiceClient();

  const { data: order } = await sb
    .from('customer_orders')
    .select('id, status, driver_id, batch_id, delivered_at, promised_delivery_at, bestellnummer, kunde_name')
    .eq('id', orderId)
    .eq('location_id', locationId)
    .maybeSingle();

  if (!order) return { orderId, score: 0, upserted: false, skipped: true, reason: 'order_not_found' };
  if (!order.driver_id) return { orderId, score: 0, upserted: false, skipped: true, reason: 'no_driver' };
  if (!['delivered', 'cancelled', 'rejected'].includes(order.status)) {
    return { orderId, score: 0, upserted: false, skipped: true, reason: 'not_completed' };
  }

  // Kundenbewertung aus tour_feedback
  let rating: number | null = null;
  if (order.batch_id) {
    const { data: fb } = await sb
      .from('tour_feedback')
      .select('customer_rating')
      .eq('batch_id', order.batch_id)
      .not('customer_rating', 'is', null)
      .maybeSingle();
    rating = fb ? (fb.customer_rating as number | null) : null;
  }

  const { score: pScore, minutesLate } = computePuenktlichkeit(
    order.delivered_at as string | null,
    order.promised_delivery_at as string | null,
  );
  const vScore = computeVollstaendigkeit(order.status);
  const zScore = computeZufriedenheit(rating);
  const score  = finalScore(pScore, vScore, zScore);

  const komponenten: QualitaetKomponenten = {
    puenktlichkeit:   pScore,
    vollstaendigkeit: vScore,
    zufriedenheit:    zScore,
    minutesLate,
    hasRating:        rating !== null,
  };

  const { error } = await sb
    .from('liefer_qualitaet')
    .upsert(
      {
        location_id:   locationId,
        order_id:      orderId,
        driver_id:     order.driver_id,
        score,
        komponenten,
        berechnet_am:  new Date().toISOString(),
      },
      { onConflict: 'order_id' },
    );

  if (error) return { orderId, score, upserted: false, skipped: false, reason: error.message };
  return { orderId, score, upserted: true, skipped: false };
}

// ── Location-Batch ───────────────────────────────────────────────────────────

export async function computeQualitaetForLocation(
  locationId: string,
  since?: string,
): Promise<ComputeLocationResult> {
  const sb = createServiceClient();
  const sinceDate = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id')
    .eq('location_id', locationId)
    .in('status', ['delivered', 'cancelled', 'rejected'])
    .gte('updated_at', sinceDate);

  const ids = (orders ?? []).map((o) => o.id);

  let computed = 0, upserted = 0, skipped = 0, errors = 0;

  for (const orderId of ids) {
    try {
      const r = await computeQualitaetForOrder(orderId, locationId);
      computed++;
      if (r.upserted) upserted++;
      else if (r.skipped) skipped++;
    } catch {
      errors++;
    }
  }

  return { locationId, computed, upserted, skipped, errors };
}

export async function computeQualitaetAllLocations(since?: string): Promise<ComputeLocationResult[]> {
  const sb = createServiceClient();
  const { data: locs } = await sb.from('locations').select('id').eq('is_active', true);
  const results: ComputeLocationResult[] = [];
  for (const loc of locs ?? []) {
    try {
      results.push(await computeQualitaetForLocation(loc.id, since));
    } catch {
      results.push({ locationId: loc.id, computed: 0, upserted: 0, skipped: 0, errors: 1 });
    }
  }
  return results;
}

// ── Lesen ────────────────────────────────────────────────────────────────────

export async function getQualitaetForLocation(
  locationId: string,
  days = 7,
  limit = 200,
): Promise<QualitaetWithOrder[]> {
  const sb    = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('liefer_qualitaet')
    .select(`
      id, location_id, order_id, driver_id, score, komponenten, berechnet_am,
      customer_orders!order_id (bestellnummer, kunde_name),
      employees!driver_id (name)
    `)
    .eq('location_id', locationId)
    .gte('berechnet_am', since)
    .order('berechnet_am', { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => {
    const ord = r.customer_orders as { bestellnummer?: string; kunde_name?: string } | null;
    const emp = r.employees as { name?: string } | null;
    return {
      id:           r.id,
      locationId:   r.location_id,
      orderId:      r.order_id,
      driverId:     r.driver_id,
      score:        Number(r.score),
      komponenten:  r.komponenten as QualitaetKomponenten,
      berechnetAm:  r.berechnet_am,
      orderNr:      ord?.bestellnummer ?? null,
      kundeName:    ord?.kunde_name ?? null,
      driverName:   emp?.name ?? null,
    };
  });
}

export async function getQualitaetForDriver(
  driverId: string,
  locationId: string,
  days = 30,
): Promise<LieferQualitaet[]> {
  const sb    = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('liefer_qualitaet')
    .select('id, location_id, order_id, driver_id, score, komponenten, berechnet_am')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('berechnet_am', since)
    .order('berechnet_am', { ascending: false })
    .limit(100);

  return (data ?? []).map((r) => ({
    id:          r.id,
    locationId:  r.location_id,
    orderId:     r.order_id,
    driverId:    r.driver_id,
    score:       Number(r.score),
    komponenten: r.komponenten as QualitaetKomponenten,
    berechnetAm: r.berechnet_am,
  }));
}

// ── Tages-Aggregat je Fahrer (für Heatmap) ────────────────────────────────────

export interface QualitaetTagesAggregat {
  driverId:   string;
  driverName: string | null;
  datum:      string;
  avgScore:   number;
  count:      number;
}

export async function getQualitaetTagesAggregat(
  locationId: string,
  days = 7,
): Promise<QualitaetTagesAggregat[]> {
  const sb    = createServiceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data } = await sb
    .from('liefer_qualitaet')
    .select(`
      driver_id, score, berechnet_am,
      employees!driver_id (name)
    `)
    .eq('location_id', locationId)
    .gte('berechnet_am', since)
    .order('berechnet_am', { ascending: false });

  type Row = { driver_id: string; score: number; berechnet_am: string; employees: { name?: string } | null };

  // Aggregate per driver per day
  const map = new Map<string, { scores: number[]; name: string | null }>();
  for (const row of (data ?? []) as Row[]) {
    const datum = row.berechnet_am.slice(0, 10);
    const key   = `${row.driver_id}::${datum}`;
    if (!map.has(key)) {
      const emp = row.employees as { name?: string } | null;
      map.set(key, { scores: [], name: emp?.name ?? null });
    }
    map.get(key)!.scores.push(Number(row.score));
  }

  return Array.from(map.entries()).map(([key, v]) => {
    const [driverId, datum] = key.split('::');
    const avg = v.scores.reduce((s, n) => s + n, 0) / v.scores.length;
    return { driverId, driverName: v.name, datum, avgScore: Math.round(avg * 10) / 10, count: v.scores.length };
  }).sort((a, b) => a.datum.localeCompare(b.datum));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

export async function pruneOldQualitaet(daysOld = 90): Promise<number> {
  const sb = createServiceClient();
  const { data } = await sb.rpc('prune_liefer_qualitaet', { days_old: daysOld });
  return (data as number | null) ?? 0;
}
