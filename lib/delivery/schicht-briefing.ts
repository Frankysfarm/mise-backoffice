/**
 * lib/delivery/schicht-briefing.ts — Phase 429
 *
 * Schicht-Briefing-Engine: Personalisierte Briefings für Fahrer vor Schichtbeginn.
 *
 * Algorithmus:
 *   1. Finde nächste Schicht je Fahrer (driver_shifts, nächste 4h)
 *   2. tages_muster_snapshots → Spitzenstunde + Peak-Klasse für Schicht-Wochentag
 *   3. fahrer_prognose_snapshots → Score + Kategorie des Fahrers
 *   4. zonen_prognose_snapshots → Top-Zone für Schicht-Datum
 *   5. Dynamische Tipps je Kategorie + Peak-Klasse
 *   6. UPSERT in schicht_briefings (einmal je driver_id × schicht_datum)
 *
 * Public API:
 *   generateBriefingForDriver(driverId, locationId)   — Briefing für einen Fahrer
 *   generateBriefingsForLocation(locationId)          — Alle Fahrer der Location
 *   generateBriefingsAllLocations()                   — Cron-Batch alle Standorte
 *   getBriefingForDriver(driverId, locationId)        — Heutiges Briefing lesen
 *   markBriefingSeen(id)                              — Gesehen-Zeitstempel setzen
 *   pruneOldBriefings(daysOld?)                       — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type DriverKategorie = 'elite' | 'gut' | 'durchschnitt' | 'auffällig';
export type PeakKlasse      = 'low' | 'normal' | 'peak' | 'high';

export interface SchichtBriefing {
  id:                    string;
  locationId:            string;
  driverId:              string;
  schichtDatum:          string;     // YYYY-MM-DD
  schichtStart:          string;     // ISO timestamptz
  erwarteteBestellungen: number;
  spitzenstunde:         number | null; // UTC 0-23
  topZone:               string | null;
  peakKlasseSchicht:     PeakKlasse | null;
  tipps:                 string[];
  driverScore:           number | null;
  driverKategorie:       DriverKategorie | null;
  generiertAm:           string;
  gesehenAm:             string | null;
}

export interface GenerateBriefingResult {
  driverId:   string;
  schichtDatum: string;
  upserted:   boolean;
  skipped:    boolean;
  reason?:    string;
}

export interface GenerateAllResult {
  locationId: string;
  drivers:    number;
  upserted:   number;
  skipped:    number;
  errors:     number;
}

export interface AllLocationsResult {
  locations: number;
  upserted:  number;
  errors:    number;
}

// ── Konstanten ────────────────────────────────────────────────────────────────

const DOW_LABELS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const LOOKAHEAD_MS = 4 * 60 * 60 * 1000; // 4 Stunden voraus

// ── Tipps-Bibliothek ──────────────────────────────────────────────────────────

function buildTipps(
  kategorie:  DriverKategorie | null,
  peakKlasse: PeakKlasse | null,
  topZone:    string | null,
  spitzenstunde: number | null,
): string[] {
  const tipps: string[] = [];

  // Peak-basierte Tipps
  if (peakKlasse === 'high') {
    tipps.push('🔥 Hochbetrieb heute — kurze Pausen einplanen, Routen vordenken.');
  } else if (peakKlasse === 'peak') {
    tipps.push('📈 Überdurchschnittlich viele Bestellungen erwartet — gut ausgeruht starten.');
  } else if (peakKlasse === 'low') {
    tipps.push('🟢 Ruhige Schicht erwartet — gute Zeit für schnelle, sorgfältige Lieferungen.');
  }

  // Spitzenstunde-Tipp
  if (spitzenstunde !== null) {
    const h = spitzenstunde;
    tipps.push(`⏰ Spitzenstunde: ca. ${String(h).padStart(2, '0')}:00–${String((h + 1) % 24).padStart(2, '0')}:00 Uhr (UTC).`);
  }

  // Zonen-Tipp
  if (topZone) {
    const zoneLabels: Record<string, string> = {
      A: 'Express (< 3 km)',
      B: 'Standard (3–6 km)',
      C: 'Weit (6–10 km)',
      D: 'Außerhalb (> 10 km)',
    };
    tipps.push(`📍 Top-Zone heute: Zone ${topZone} — ${zoneLabels[topZone] ?? topZone}.`);
  }

  // Kategorie-basierte Performance-Tipps
  if (kategorie === 'elite') {
    tipps.push('⭐ Du bist in der Elite-Klasse — bleib konzentriert und halte deinen Score!');
  } else if (kategorie === 'gut') {
    tipps.push('👍 Solide Leistung — ein bisschen mehr Pünktlichkeit und du erreichst Elite.');
  } else if (kategorie === 'durchschnitt') {
    tipps.push('💪 Fokus auf Pünktlichkeit: Lieferungen in ≤ 30 Min verbessern deinen Score.');
  } else if (kategorie === 'auffällig') {
    tipps.push('⚠️ Dein Score braucht Aufmerksamkeit — spreche mit dem Dispatch-Team.');
  }

  return tipps.slice(0, 4);
}

// ── generateBriefingForDriver ─────────────────────────────────────────────────

export async function generateBriefingForDriver(
  driverId:   string,
  locationId: string,
): Promise<GenerateBriefingResult> {
  const svc  = createServiceClient();
  const now  = new Date();
  const end  = new Date(now.getTime() + LOOKAHEAD_MS);

  // 1. Nächste Schicht finden
  type ShiftRow = { id: string; planned_start: string; planned_end: string };
  const { data: shifts } = await svc
    .from('driver_shifts')
    .select('id, planned_start, planned_end')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .gte('planned_start', now.toISOString())
    .lte('planned_start', end.toISOString())
    .order('planned_start', { ascending: true })
    .limit(1);

  const shift = (shifts ?? [])[0] as ShiftRow | undefined;
  if (!shift) {
    return { driverId, schichtDatum: '', upserted: false, skipped: true, reason: 'no_upcoming_shift' };
  }

  const schichtStart = new Date(shift.planned_start);
  const schichtDatum = schichtStart.toISOString().slice(0, 10);
  const wochentag    = schichtStart.getUTCDay(); // 0=So … 6=Sa

  // 2. Tages-Muster für diesen Wochentag
  type MusterRow = {
    stunde:           number;
    avg_bestellungen: number;
    peak_klasse:      string | null;
    basis_tage:       number;
  };
  const { data: musterData } = await svc
    .from('tages_muster_snapshots')
    .select('stunde, avg_bestellungen, peak_klasse, basis_tage')
    .eq('location_id', locationId)
    .eq('wochentag', wochentag)
    .order('avg_bestellungen', { ascending: false });

  const musterRows = (musterData ?? []) as MusterRow[];

  // Spitzenstunde = Stunde mit höchstem avg_bestellungen
  const topMuster     = musterRows[0] ?? null;
  const spitzenstunde = topMuster?.stunde ?? null;
  const peakKlasseSchicht = (topMuster?.peak_klasse ?? null) as PeakKlasse | null;

  // Erwartete Bestellungen = Summe aller Stunden des Wochentags
  const erwarteteBestellungen = Math.round(
    musterRows.reduce((s, r) => s + (r.avg_bestellungen ?? 0), 0),
  );

  // 3. Fahrer-Prognose-Score
  type PrognoseRow = { prognose_score: number | null; kategorie: string | null };
  const { data: prognoseData } = await svc
    .from('fahrer_prognose_snapshots')
    .select('prognose_score, kategorie')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .limit(1)
    .maybeSingle();

  const prognose = prognoseData as PrognoseRow | null;
  const driverScore     = prognose?.prognose_score ?? null;
  const driverKategorie = (prognose?.kategorie ?? null) as DriverKategorie | null;

  // 4. Top-Zone aus zonen_prognose_snapshots (morgen oder heute)
  type ZoneRow = { zone: string; expected_orders: number };
  const { data: zonenData } = await svc
    .from('zonen_prognose_snapshots')
    .select('zone, expected_orders')
    .eq('location_id', locationId)
    .eq('prognose_datum', schichtDatum)
    .order('expected_orders', { ascending: false })
    .limit(1)
    .maybeSingle();

  const topZone = (zonenData as ZoneRow | null)?.zone ?? null;

  // 5. Tipps generieren
  const tipps = buildTipps(driverKategorie, peakKlasseSchicht, topZone, spitzenstunde);

  // 6. UPSERT
  const { error } = await svc
    .from('schicht_briefings')
    .upsert(
      {
        location_id:            locationId,
        driver_id:              driverId,
        schicht_datum:          schichtDatum,
        schicht_start:          shift.planned_start,
        erwartete_bestellungen: erwarteteBestellungen,
        spitzenstunde,
        top_zone:               topZone,
        peak_klasse_schicht:    peakKlasseSchicht,
        tipps,
        driver_score:           driverScore,
        driver_kategorie:       driverKategorie,
        generiert_am:           now.toISOString(),
      },
      { onConflict: 'driver_id,schicht_datum' },
    );

  if (error) throw new Error(`upsert failed: ${error.message}`);

  return { driverId, schichtDatum, upserted: true, skipped: false };
}

// ── generateBriefingsForLocation ──────────────────────────────────────────────

export async function generateBriefingsForLocation(
  locationId: string,
): Promise<GenerateAllResult> {
  const svc = createServiceClient();
  const now = new Date();
  const end = new Date(now.getTime() + LOOKAHEAD_MS);

  // Alle Fahrer mit Schicht in den nächsten 4h
  type ShiftDriverRow = { driver_id: string };
  const { data: upcoming } = await svc
    .from('driver_shifts')
    .select('driver_id')
    .eq('location_id', locationId)
    .gte('planned_start', now.toISOString())
    .lte('planned_start', end.toISOString());

  const driverIds = [...new Set((upcoming ?? []).map((r: ShiftDriverRow) => r.driver_id))];

  let upserted = 0;
  let skipped  = 0;
  let errors   = 0;

  await Promise.allSettled(
    driverIds.map(async (driverId) => {
      try {
        const r = await generateBriefingForDriver(driverId, locationId);
        if (r.upserted) upserted++;
        else skipped++;
      } catch {
        errors++;
      }
    }),
  );

  return { locationId, drivers: driverIds.length, upserted, skipped, errors };
}

// ── generateBriefingsAllLocations ─────────────────────────────────────────────

export async function generateBriefingsAllLocations(): Promise<AllLocationsResult> {
  const svc = createServiceClient();

  type LocationRow = { id: string };
  const { data: locs } = await svc
    .from('locations')
    .select('id')
    .eq('active', true);

  const locationIds = (locs ?? []).map((l: LocationRow) => l.id);
  let totalUpserted = 0;
  let errors        = 0;

  const results = await Promise.allSettled(
    locationIds.map((lid) => generateBriefingsForLocation(lid)),
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') totalUpserted += r.value.upserted;
    else errors++;
  });

  return { locations: locationIds.length, upserted: totalUpserted, errors };
}

// ── getBriefingForDriver ───────────────────────────────────────────────────────

export async function getBriefingForDriver(
  driverId:   string,
  locationId: string,
  date?:      string,
): Promise<SchichtBriefing | null> {
  const svc   = createServiceClient();
  const datum = date ?? new Date().toISOString().slice(0, 10);

  const { data } = await svc
    .from('schicht_briefings')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .eq('schicht_datum', datum)
    .maybeSingle();

  if (!data) return null;

  type RawRow = Record<string, unknown>;
  const r = data as RawRow;
  return {
    id:                    r['id'] as string,
    locationId:            r['location_id'] as string,
    driverId:              r['driver_id'] as string,
    schichtDatum:          r['schicht_datum'] as string,
    schichtStart:          r['schicht_start'] as string,
    erwarteteBestellungen: r['erwartete_bestellungen'] as number,
    spitzenstunde:         r['spitzenstunde'] as number | null,
    topZone:               r['top_zone'] as string | null,
    peakKlasseSchicht:     r['peak_klasse_schicht'] as PeakKlasse | null,
    tipps:                 (r['tipps'] as string[] | null) ?? [],
    driverScore:           r['driver_score'] as number | null,
    driverKategorie:       r['driver_kategorie'] as DriverKategorie | null,
    generiertAm:           r['generiert_am'] as string,
    gesehenAm:             r['gesehen_am'] as string | null,
  };
}

// ── getTodaysBriefingsForLocation ──────────────────────────────────────────────

export interface BriefingRow extends SchichtBriefing {
  driverName: string;
}

export async function getTodaysBriefingsForLocation(
  locationId: string,
): Promise<BriefingRow[]> {
  const svc   = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  type RawRow = Record<string, unknown>;
  const { data } = await svc
    .from('schicht_briefings')
    .select('*')
    .eq('location_id', locationId)
    .eq('schicht_datum', today)
    .order('schicht_start', { ascending: true });

  const rows = (data ?? []) as RawRow[];
  if (rows.length === 0) return [];

  // Fahrer-Namen aus employees
  const driverIds = rows.map((r) => r['driver_id'] as string);
  type EmpRow = { id: string; vorname: string; nachname: string };
  const { data: emps } = await svc
    .from('employees')
    .select('id, vorname, nachname')
    .in('id', driverIds);

  const nameMap = new Map<string, string>();
  for (const e of ((emps ?? []) as EmpRow[])) {
    nameMap.set(e.id, `${e.vorname} ${e.nachname}`);
  }

  return rows.map((r) => ({
    id:                    r['id'] as string,
    locationId:            r['location_id'] as string,
    driverId:              r['driver_id'] as string,
    driverName:            nameMap.get(r['driver_id'] as string) ?? 'Unbekannt',
    schichtDatum:          r['schicht_datum'] as string,
    schichtStart:          r['schicht_start'] as string,
    erwarteteBestellungen: r['erwartete_bestellungen'] as number,
    spitzenstunde:         r['spitzenstunde'] as number | null,
    topZone:               r['top_zone'] as string | null,
    peakKlasseSchicht:     r['peak_klasse_schicht'] as PeakKlasse | null,
    tipps:                 (r['tipps'] as string[] | null) ?? [],
    driverScore:           r['driver_score'] as number | null,
    driverKategorie:       r['driver_kategorie'] as DriverKategorie | null,
    generiertAm:           r['generiert_am'] as string,
    gesehenAm:             r['gesehen_am'] as string | null,
  }));
}

// ── markBriefingSeen ──────────────────────────────────────────────────────────

export async function markBriefingSeen(id: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from('schicht_briefings')
    .update({ gesehen_am: new Date().toISOString() })
    .eq('id', id)
    .is('gesehen_am', null);
}

// ── pruneOldBriefings ─────────────────────────────────────────────────────────

export async function pruneOldBriefings(daysOld = 30): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('prune_schicht_briefings', { days_old: daysOld });
  if (error) throw new Error(`prune failed: ${error.message}`);
  return (data as number | null) ?? 0;
}
