/**
 * lib/delivery/fahrer-incentive.ts — Phase 431
 *
 * Fahrer-Incentive-Engine: Zielbasiertes Bonus-System
 *
 * Verknüpft definierte Ziele (score/pünktlichkeit/lieferungen) mit
 * tatsächlichen Werten aus schicht_abschluss_berichte.
 *
 * Algorithmus:
 *   1. Lade aktive Ziele (zeitraum_start <= heute <= zeitraum_end)
 *   2. Aggregiere ist_wert aus schicht_abschluss_berichte je Fahrer + Zeitraum
 *   3. UPSERT ist_wert, setze erreicht_am wenn zielwert erreicht
 *
 * Public API:
 *   evaluateIncentivesForLocation(locationId)  — Alle Fahrer einer Location
 *   evaluateIncentivesAllLocations()           — Cron-Batch
 *   createIncentiveZiel(...)                   — Neues Ziel anlegen
 *   getIncentivesForLocation(locationId)       — Alle Ziele + Status
 *   getIncentivesForDriver(driverId, locationId) — Ziele eines Fahrers
 *   pruneOldIncentives(daysOld?)               — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type ZielTyp = 'score' | 'puenktlichkeit' | 'lieferungen';

export interface FahrerIncentive {
  id:             string;
  locationId:     string;
  driverId:       string;
  zielTyp:        ZielTyp;
  zielwert:       number;
  istWert:        number | null;
  bonusEur:       number;
  erreichterAm:   string | null;
  zeitraumStart:  string;
  zeitraumEnd:    string;
  generiertAm:    string;
}

export interface FahrerIncentiveWithDriver extends FahrerIncentive {
  driverName:  string | null;
  vehicle:     string | null;
  fortschrittPct: number | null;
}

export interface CreateZielParams {
  locationId:    string;
  driverId:      string;
  zielTyp:       ZielTyp;
  zielwert:      number;
  bonusEur:      number;
  zeitraumStart: string;
  zeitraumEnd:   string;
}

export interface EvaluateResult {
  locations:  number;
  evaluated:  number;
  achieved:   number;
  errors:     number;
}

// ── Hilfsfunktionen ────────────────────────────────────────────────────────────

function calcFortschrittPct(istWert: number | null, zielwert: number): number | null {
  if (istWert === null) return null;
  return Math.min(100, Math.round((istWert / zielwert) * 100));
}

// ── Aggregation aus schicht_abschluss_berichte ─────────────────────────────────

async function aggregateIstWert(
  sb: ReturnType<typeof createServiceClient>,
  driverId: string,
  locationId: string,
  zielTyp: ZielTyp,
  zeitraumStart: string,
  zeitraumEnd: string,
): Promise<number | null> {
  const { data, error } = await sb
    .from('schicht_abschluss_berichte')
    .select('lieferungen_gesamt, puenktlichkeits_pct, composite_score')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('schicht_datum', zeitraumStart)
    .lte('schicht_datum', zeitraumEnd);

  if (error || !data || data.length === 0) return null;

  if (zielTyp === 'lieferungen') {
    const total = (data as { lieferungen_gesamt: number | null }[])
      .reduce((s, r) => s + (r.lieferungen_gesamt ?? 0), 0);
    return total;
  }

  if (zielTyp === 'puenktlichkeit') {
    const valid = (data as { puenktlichkeits_pct: number | null }[])
      .filter(r => r.puenktlichkeits_pct !== null);
    if (valid.length === 0) return null;
    const avg = valid.reduce((s, r) => s + (r.puenktlichkeits_pct ?? 0), 0) / valid.length;
    return Math.round(avg * 10) / 10;
  }

  // score: Durchschnitt composite_score
  const valid = (data as { composite_score: number | null }[])
    .filter(r => r.composite_score !== null);
  if (valid.length === 0) return null;
  const avg = valid.reduce((s, r) => s + (r.composite_score ?? 0), 0) / valid.length;
  return Math.round(avg * 10) / 10;
}

// ── Core-Engine ────────────────────────────────────────────────────────────────

export async function evaluateIncentivesForLocation(
  locationId: string,
): Promise<{ evaluated: number; achieved: number }> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // Aktive Ziele dieser Location
  const { data: ziele, error } = await sb
    .from('fahrer_incentives')
    .select('id, driver_id, ziel_typ, zielwert, zeitraum_start, zeitraum_end, erreicht_am')
    .eq('location_id', locationId)
    .lte('zeitraum_start', today)
    .gte('zeitraum_end', today);

  if (error || !ziele || ziele.length === 0) return { evaluated: 0, achieved: 0 };

  let achieved = 0;

  await Promise.allSettled(
    (ziele as {
      id: string;
      driver_id: string;
      ziel_typ: ZielTyp;
      zielwert: number;
      zeitraum_start: string;
      zeitraum_end: string;
      erreicht_am: string | null;
    }[]).map(async (ziel) => {
      const istWert = await aggregateIstWert(
        sb,
        ziel.driver_id,
        locationId,
        ziel.ziel_typ,
        ziel.zeitraum_start,
        ziel.zeitraum_end,
      );

      const erreichterAm =
        istWert !== null && istWert >= ziel.zielwert && !ziel.erreicht_am
          ? new Date().toISOString()
          : ziel.erreicht_am ?? null;

      if (erreichterAm && !ziel.erreicht_am) achieved++;

      await sb
        .from('fahrer_incentives')
        .update({ ist_wert: istWert, erreicht_am: erreichterAm })
        .eq('id', ziel.id);
    }),
  );

  return { evaluated: ziele.length, achieved };
}

export async function evaluateIncentivesAllLocations(): Promise<EvaluateResult> {
  const sb = createServiceClient();
  const { data: locs } = await sb
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locs || locs.length === 0) return { locations: 0, evaluated: 0, achieved: 0, errors: 0 };

  let evaluated = 0, achieved = 0, errors = 0;

  await Promise.allSettled(
    (locs as { id: string }[]).map(async (loc) => {
      try {
        const r = await evaluateIncentivesForLocation(loc.id);
        evaluated += r.evaluated;
        achieved += r.achieved;
      } catch {
        errors++;
      }
    }),
  );

  return { locations: locs.length, evaluated, achieved, errors };
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export async function createIncentiveZiel(params: CreateZielParams): Promise<FahrerIncentive> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('fahrer_incentives')
    .insert({
      location_id:    params.locationId,
      driver_id:      params.driverId,
      ziel_typ:       params.zielTyp,
      zielwert:       params.zielwert,
      bonus_eur:      params.bonusEur,
      zeitraum_start: params.zeitraumStart,
      zeitraum_end:   params.zeitraumEnd,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data);
}

export async function getIncentivesForLocation(
  locationId: string,
  activeOnly = false,
): Promise<FahrerIncentiveWithDriver[]> {
  const sb = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  let q = sb
    .from('fahrer_incentives')
    .select(`
      *,
      employees!fahrer_incentives_driver_id_fkey (
        full_name,
        vehicle_type
      )
    `)
    .eq('location_id', locationId)
    .order('zeitraum_end', { ascending: false });

  if (activeOnly) {
    q = q.lte('zeitraum_start', today).gte('zeitraum_end', today);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const emp = row.employees as { full_name: string | null; vehicle_type: string | null } | null;
    const base = mapRow(row);
    return {
      ...base,
      driverName: emp?.full_name ?? null,
      vehicle: emp?.vehicle_type ?? null,
      fortschrittPct: calcFortschrittPct(base.istWert, base.zielwert),
    };
  });
}

export async function getIncentivesForDriver(
  driverId: string,
  locationId: string,
): Promise<FahrerIncentiveWithDriver[]> {
  const sb = createServiceClient();

  const { data, error } = await sb
    .from('fahrer_incentives')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('zeitraum_end', { ascending: false })
    .limit(10);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const base = mapRow(row);
    return {
      ...base,
      driverName: null,
      vehicle: null,
      fortschrittPct: calcFortschrittPct(base.istWert, base.zielwert),
    };
  });
}

export async function deleteIncentiveZiel(id: string, locationId: string): Promise<void> {
  const sb = createServiceClient();
  const { error } = await sb
    .from('fahrer_incentives')
    .delete()
    .eq('id', id)
    .eq('location_id', locationId);
  if (error) throw new Error(error.message);
}

export async function pruneOldIncentives(daysOld = 90): Promise<{ pruned: number }> {
  const sb = createServiceClient();
  const { data, error } = await sb.rpc('prune_fahrer_incentives', { days_old: daysOld });
  if (error) throw new Error(error.message);
  return { pruned: (data as number | null) ?? 0 };
}

// ── Mapper ─────────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): FahrerIncentive {
  return {
    id:            row.id as string,
    locationId:    row.location_id as string,
    driverId:      row.driver_id as string,
    zielTyp:       row.ziel_typ as ZielTyp,
    zielwert:      Number(row.zielwert),
    istWert:       row.ist_wert !== null ? Number(row.ist_wert) : null,
    bonusEur:      Number(row.bonus_eur),
    erreichterAm:  (row.erreicht_am as string | null) ?? null,
    zeitraumStart: row.zeitraum_start as string,
    zeitraumEnd:   row.zeitraum_end as string,
    generiertAm:   row.generiert_am as string,
  };
}
