/**
 * lib/delivery/schicht-optimierer.ts — Phase 428
 *
 * Schicht-Auslastungs-Optimierer:
 * Berechnet die optimale Fahrerzahl pro Stunde je Wochentag aus tages_muster_snapshots.
 *
 * Algorithmus:
 *   1. Lade tages_muster_snapshots (7 × 24 Einträge) für die Location
 *   2. Für jede (wochentag, stunde): empfohlene_fahrer = ceil(avg_bestellungen / ORDERS_PER_DRIVER)
 *   3. +1 Fahrer bei peak_klasse='high' (Puffer für Spitzenstunden)
 *   4. konfidenz = min(1.0, basis_tage / BASIS_TAGE_MAX)
 *   5. UPSERT in schicht_auslastungs_vorschlaege
 *
 * Public API:
 *   computeVorschlaege(locationId)        — Berechnen + UPSERT
 *   computeVorschlaegeAllLocations()      — Cron-Batch alle Standorte
 *   getVorschlaege(locationId, wochentag?) — Vorschläge lesen (nach DOW gruppiert)
 *   getVorschlaegeWithIst(locationId)     — Vorschläge + Ist-Besetzung (nächste 7 Tage)
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Konstanten ────────────────────────────────────────────────────────────────

/** Ø Bestellungen je Fahrer je Stunde (~25 Min/Lieferung → 2,4 Touren/h). */
const ORDERS_PER_DRIVER_HOUR = 2.5;

/** Basis-Tage ab dem konfidenz = 1.0 erreicht wird. */
const BASIS_TAGE_MAX = 30;

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// ── Typen ──────────────────────────────────────────────────────────────────────

export type PeakKlasse = 'low' | 'normal' | 'peak' | 'high';

export interface AuslastungsVorschlag {
  wochentag:               number;
  stunde:                  number;
  empfohlene_fahrer_anzahl: number;
  konfidenz:               number;
  tages_muster_basis:      number;
  avg_bestellungen:        number;
  peak_klasse:             PeakKlasse | null;
  berechnet_am:            string;
}

export interface VorschlaegeTag {
  wochentag:      number;
  wochentagLabel: string;
  stunden:        Array<AuslastungsVorschlag & { ist_fahrer?: number }>;
}

export interface ComputeVorschlaegeResult {
  locationId: string;
  upserted:   number;
  durationMs: number;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function computeEmpfohlen(avgBest: number, peakKlasse: PeakKlasse | null): number {
  const base  = Math.ceil(avgBest / ORDERS_PER_DRIVER_HOUR);
  const boost = peakKlasse === 'high' ? 1 : 0;
  return Math.max(1, base + boost);
}

function computeKonfidenz(basisTage: number): number {
  return Math.min(1.0, Math.round((basisTage / BASIS_TAGE_MAX) * 1000) / 1000);
}

// ── computeVorschlaege ────────────────────────────────────────────────────────

export async function computeVorschlaege(
  locationId: string,
): Promise<ComputeVorschlaegeResult> {
  const start = Date.now();
  const svc   = createServiceClient();

  type MusterRow = {
    wochentag:        number;
    stunde:           number;
    avg_bestellungen: number;
    peak_klasse:      string | null;
    basis_tage:       number;
  };

  const { data } = await svc
    .from('tages_muster_snapshots')
    .select('wochentag, stunde, avg_bestellungen, peak_klasse, basis_tage')
    .eq('location_id', locationId)
    .order('wochentag', { ascending: true })
    .order('stunde', { ascending: true });

  const rows = (data ?? []) as MusterRow[];

  if (rows.length === 0) {
    return { locationId, upserted: 0, durationMs: Date.now() - start };
  }

  const now = new Date().toISOString();
  const upserts = rows.map(r => {
    const pk = (r.peak_klasse ?? null) as PeakKlasse | null;
    return {
      location_id:               locationId,
      wochentag:                 r.wochentag,
      stunde:                    r.stunde,
      empfohlene_fahrer_anzahl:  computeEmpfohlen(r.avg_bestellungen, pk),
      konfidenz:                 computeKonfidenz(r.basis_tage),
      tages_muster_basis:        r.basis_tage,
      avg_bestellungen:          Math.round(r.avg_bestellungen * 100) / 100,
      peak_klasse:               pk,
      berechnet_am:              now,
    };
  });

  let upserted = 0;
  const BATCH  = 168; // 7 × 24
  for (let i = 0; i < upserts.length; i += BATCH) {
    const batch = upserts.slice(i, i + BATCH);
    const { error } = await svc
      .from('schicht_auslastungs_vorschlaege')
      .upsert(batch, { onConflict: 'location_id,wochentag,stunde' });
    if (!error) upserted += batch.length;
  }

  return { locationId, upserted, durationMs: Date.now() - start };
}

// ── computeVorschlaegeAllLocations ────────────────────────────────────────────

export async function computeVorschlaegeAllLocations(): Promise<{
  locations: number;
  upserted:  number;
  errors:    number;
  durationMs: number;
}> {
  const start = Date.now();
  const svc   = createServiceClient();

  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('aktiv', true);

  let upserted = 0;
  let errors   = 0;
  const results = await Promise.allSettled(
    (locs ?? []).map(l => computeVorschlaege(String(l.id))),
  );
  for (const r of results) {
    if (r.status === 'fulfilled') upserted += r.value.upserted;
    else errors++;
  }

  return { locations: (locs ?? []).length, upserted, errors, durationMs: Date.now() - start };
}

// ── getVorschlaege ────────────────────────────────────────────────────────────

export async function getVorschlaege(
  locationId: string,
  wochentag?: number,
): Promise<VorschlaegeTag[]> {
  const svc = createServiceClient();

  type Row = {
    wochentag: number; stunde: number; empfohlene_fahrer_anzahl: number;
    konfidenz: number; tages_muster_basis: number; avg_bestellungen: number;
    peak_klasse: string | null; berechnet_am: string;
  };

  let query = svc
    .from('schicht_auslastungs_vorschlaege')
    .select('wochentag, stunde, empfohlene_fahrer_anzahl, konfidenz, tages_muster_basis, avg_bestellungen, peak_klasse, berechnet_am')
    .eq('location_id', locationId)
    .order('wochentag', { ascending: true })
    .order('stunde', { ascending: true });

  if (wochentag !== undefined) {
    query = query.eq('wochentag', wochentag);
  }

  const { data } = await query;
  const rows = (data ?? []) as Row[];

  const byDow = new Map<number, Row[]>();
  for (const r of rows) {
    const arr = byDow.get(r.wochentag) ?? [];
    arr.push(r);
    byDow.set(r.wochentag, arr);
  }

  return Array.from(byDow.entries()).map(([dow, dowRows]) => ({
    wochentag:      dow,
    wochentagLabel: DOW_LABELS[dow] ?? '?',
    stunden:        dowRows.map(r => ({
      wochentag:               r.wochentag,
      stunde:                  r.stunde,
      empfohlene_fahrer_anzahl: r.empfohlene_fahrer_anzahl,
      konfidenz:               r.konfidenz,
      tages_muster_basis:      r.tages_muster_basis,
      avg_bestellungen:        r.avg_bestellungen,
      peak_klasse:             (r.peak_klasse ?? null) as PeakKlasse | null,
      berechnet_am:            r.berechnet_am,
    })),
  }));
}

// ── getVorschlaegeWithIst ─────────────────────────────────────────────────────

/**
 * Kombiniert Vorschläge mit tatsächlich geplanter Fahrerzahl je (wochentag, stunde)
 * aus driver_shifts der nächsten 7 Tage.
 */
export async function getVorschlaegeWithIst(locationId: string): Promise<VorschlaegeTag[]> {
  const svc     = createServiceClient();
  const now     = new Date();
  const in7Days = new Date(now.getTime() + 7 * 86_400_000);

  const [tagsData, shiftsRes] = await Promise.all([
    getVorschlaege(locationId),
    svc
      .from('driver_shifts')
      .select('planned_start, planned_end')
      .eq('location_id', locationId)
      .in('status', ['scheduled', 'active'])
      .gte('planned_start', now.toISOString())
      .lt('planned_start', in7Days.toISOString()),
  ]);

  type ShiftRow = { planned_start: string; planned_end: string | null };
  const shiftRows = (shiftsRes.data ?? []) as ShiftRow[];

  // Zähle eingeplante Fahrer je (wochentag, stunde)
  const istMap = new Map<string, number>();
  for (const shift of shiftRows) {
    const startDt = new Date(shift.planned_start);
    const endDt   = shift.planned_end
      ? new Date(shift.planned_end)
      : new Date(startDt.getTime() + 4 * 3_600_000); // Default 4h Schicht
    const dow    = startDt.getUTCDay();
    const startH = startDt.getUTCHours();
    const endH   = Math.min(endDt.getUTCHours(), 23);
    for (let h = startH; h <= endH; h++) {
      const key = `${dow}_${h}`;
      istMap.set(key, (istMap.get(key) ?? 0) + 1);
    }
  }

  return tagsData.map(tag => ({
    ...tag,
    stunden: tag.stunden.map(s => ({
      ...s,
      ist_fahrer: istMap.get(`${s.wochentag}_${s.stunde}`) ?? 0,
    })),
  }));
}
