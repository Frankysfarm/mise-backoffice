/**
 * lib/delivery/fahrer-coach.ts — Phase 466
 *
 * Fahrer-Pünktlichkeits-Coach: Automatische Coaching-Hinweise wenn
 * ein Fahrer unter 80% Pünktlichkeit liegt, basierend auf
 * schicht_abschluss_berichte der letzten 7 Tage.
 *
 * Kategorien:
 *   kritisch  — Pünktlichkeit < 60%
 *   warnung   — Pünktlichkeit 60–79%
 *   info      — Pünktlichkeit ≥ 80% (positives Feedback)
 *
 * Public API:
 *   generateCoachingForLocation(locationId, datum?)     — Alle Fahrer einer Location
 *   generateCoachingAllLocations(datum?)               — Cron-Batch
 *   getCoachingForLocation(locationId, datum?)          — Liste für Admin
 *   getCoachingForDriver(driverId, locationId)          — Letzter Hinweis für Fahrer
 *   markCoachingGesehen(id)                            — Gesehen-Zeitstempel
 *   pruneOldCoaching(daysOld?)                         — Cleanup via RPC
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type CoachingKategorie = 'kritisch' | 'warnung' | 'info';

export interface FahrerCoachingHinweis {
  id:                 string;
  locationId:         string;
  driverId:           string;
  driverName:         string;
  schichtDatum:       string;
  puenktlichkeitPct:  number;
  zielPct:            number;
  hinweise:           string[];
  kategorie:          CoachingKategorie;
  gesehenAm:          string | null;
  generiertAm:        string;
}

export interface GenerateResult {
  locationId:  string;
  datum:       string;
  generated:   number;
  skipped:     number;
  errors:      number;
}

export interface GenerateAllResult {
  locations:  number;
  generated:  number;
  errors:     number;
}

// ── Hinweis-Bibliothek ─────────────────────────────────────────────────────────

function buildHinweise(pct: number, trend: 'steigend' | 'sinkend' | 'stabil'): string[] {
  const tips: string[] = [];

  if (pct < 60) {
    tips.push('Routenplanung: Plane Stopps von nah nach weit, um Umwege zu vermeiden.');
    tips.push('Zeitpuffer: Kalkuliere je Stopp mind. 2 Min. extra für Parksuche.');
    tips.push('Kommunikation: Informiere Kunden bei Verzögerungen proaktiv via App.');
    tips.push('Übergabezeit: Rede mit der Küche ab, ob Bestellungen wirklich ready sind.');
  } else if (pct < 70) {
    tips.push('Routenoptimierung: Nutze die Zonen-Hinweise in der App für effizientere Wege.');
    tips.push('Pickup-Timing: Hole erst ab wenn Bestellung als fertig markiert ist.');
    tips.push('Stopp-Reihenfolge: Priorisiere Bestellungen mit engem ETA-Fenster.');
  } else if (pct < 80) {
    tips.push('Du bist nah am Ziel! Noch 1–2 Minuten pro Tour einsparen reicht.');
    tips.push('Parkstrategie: Kenne deine Stammzonen und ihre Parkmöglichkeiten.');
  } else {
    tips.push('Exzellente Pünktlichkeit! Halte dieses Niveau auf Hochbetrieb-Schichten.');
  }

  if (trend === 'sinkend') {
    tips.push('Trend: Pünktlichkeit sinkt — überprüfe ob Routen komplexer geworden sind.');
  } else if (trend === 'steigend') {
    tips.push('Trend: Verbesserung! Deine letzten Anpassungen zeigen Wirkung.');
  }

  return tips.slice(0, 4);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Core Logic ─────────────────────────────────────────────────────────────────

export async function generateCoachingForLocation(
  locationId: string,
  datum?: string,
): Promise<GenerateResult> {
  const supabase = createServiceClient();
  const today = datum ?? isoDate(new Date());
  const since7d = isoDate(new Date(Date.now() - 7 * 86_400_000));

  // Fahrer mit Schicht-Abschluss-Berichten der letzten 7 Tage holen
  const { data: berichte } = await supabase
    .from('schicht_abschluss_berichte')
    .select('driver_id, schicht_datum, puenktlichkeit_pct, lieferungen')
    .eq('location_id', locationId)
    .gte('schicht_datum', since7d)
    .order('schicht_datum', { ascending: false });

  if (!berichte?.length) {
    return { locationId, datum: today, generated: 0, skipped: 0, errors: 0 };
  }

  // Pro Fahrer: letzten Wert + Trend berechnen
  const fahrerMap = new Map<string, { pct: number; verlauf: number[] }>();
  for (const b of berichte) {
    const key = b.driver_id as string;
    if (!fahrerMap.has(key)) fahrerMap.set(key, { pct: 0, verlauf: [] });
    const entry = fahrerMap.get(key)!;
    const pct = b.puenktlichkeit_pct !== null ? Number(b.puenktlichkeit_pct) : null;
    if (pct === null) continue;
    // Neuester Eintrag = erster in der sortierten Liste
    if (entry.verlauf.length === 0) entry.pct = pct;
    entry.verlauf.push(pct);
  }

  // Fahrer-Namen
  const driverIds = Array.from(fahrerMap.keys());
  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', driverIds);

  const nameMap = new Map((employees ?? []).map(e => [e.id, e.full_name ?? 'Fahrer']));

  let generated = 0;
  let skipped = 0;
  let errors = 0;

  for (const [driverId, info] of fahrerMap) {
    // Nur Fahrer die heute Daten haben oder zuletzt heute
    if (info.verlauf.length === 0) { skipped++; continue; }

    const pct = info.pct;
    const kategorie: CoachingKategorie = pct < 60 ? 'kritisch' : pct < 80 ? 'warnung' : 'info';

    // Trend aus letzten 3 Werten
    let trend: 'steigend' | 'sinkend' | 'stabil' = 'stabil';
    if (info.verlauf.length >= 3) {
      const recent = info.verlauf[0];
      const older  = info.verlauf[Math.min(2, info.verlauf.length - 1)];
      if (recent - older > 5)  trend = 'steigend';
      if (older - recent > 5)  trend = 'sinkend';
    }

    const hinweise = buildHinweise(pct, trend);
    const driverName = nameMap.get(driverId) ?? 'Fahrer';

    const { error } = await supabase
      .from('fahrer_coaching_hinweise')
      .upsert({
        location_id:        locationId,
        driver_id:          driverId,
        schicht_datum:      today,
        puenktlichkeit_pct: Math.round(pct * 100) / 100,
        ziel_pct:           80,
        hinweise:           JSON.stringify(hinweise),
        kategorie,
        generiert_am:       new Date().toISOString(),
      }, { onConflict: 'driver_id,schicht_datum' });

    if (error) { errors++; }
    else { generated++; void driverName; }
  }

  return { locationId, datum: today, generated, skipped, errors };
}

export async function generateCoachingAllLocations(datum?: string): Promise<GenerateAllResult> {
  const supabase = createServiceClient();
  const { data: locations } = await supabase
    .from('locations')
    .select('id')
    .eq('active', true);

  if (!locations?.length) return { locations: 0, generated: 0, errors: 0 };

  const results = await Promise.allSettled(
    locations.map(l => generateCoachingForLocation(l.id, datum)),
  );

  let generated = 0;
  let errors = 0;
  for (const r of results) {
    if (r.status === 'fulfilled') generated += r.value.generated;
    else errors++;
  }
  return { locations: locations.length, generated, errors };
}

export async function getCoachingForLocation(
  locationId: string,
  datum?: string,
): Promise<FahrerCoachingHinweis[]> {
  const supabase = createServiceClient();
  const today = datum ?? isoDate(new Date());

  const { data: rows } = await supabase
    .from('fahrer_coaching_hinweise')
    .select('*')
    .eq('location_id', locationId)
    .eq('schicht_datum', today)
    .order('puenktlichkeit_pct', { ascending: true });

  if (!rows?.length) return [];

  const driverIds = rows.map(r => r.driver_id as string);
  const { data: employees } = await supabase
    .from('employees')
    .select('id, full_name')
    .in('id', driverIds);

  const nameMap = new Map((employees ?? []).map(e => [e.id, e.full_name ?? 'Fahrer']));

  return rows.map(r => ({
    id:                r.id,
    locationId:        r.location_id,
    driverId:          r.driver_id,
    driverName:        nameMap.get(r.driver_id) ?? 'Fahrer',
    schichtDatum:      r.schicht_datum,
    puenktlichkeitPct: Number(r.puenktlichkeit_pct),
    zielPct:           Number(r.ziel_pct),
    hinweise:          Array.isArray(r.hinweise) ? r.hinweise as string[] : JSON.parse(String(r.hinweise ?? '[]')),
    kategorie:         r.kategorie as CoachingKategorie,
    gesehenAm:         r.gesehen_am ?? null,
    generiertAm:       r.generiert_am,
  }));
}

export async function getCoachingForDriver(
  driverId: string,
  locationId: string,
): Promise<FahrerCoachingHinweis | null> {
  const supabase = createServiceClient();

  const { data: row } = await supabase
    .from('fahrer_coaching_hinweise')
    .select('*')
    .eq('driver_id', driverId)
    .eq('location_id', locationId)
    .order('schicht_datum', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;

  return {
    id:                row.id,
    locationId:        row.location_id,
    driverId:          row.driver_id,
    driverName:        '',
    schichtDatum:      row.schicht_datum,
    puenktlichkeitPct: Number(row.puenktlichkeit_pct),
    zielPct:           Number(row.ziel_pct),
    hinweise:          Array.isArray(row.hinweise) ? row.hinweise as string[] : JSON.parse(String(row.hinweise ?? '[]')),
    kategorie:         row.kategorie as CoachingKategorie,
    gesehenAm:         row.gesehen_am ?? null,
    generiertAm:       row.generiert_am,
  };
}

export async function markCoachingGesehen(id: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('fahrer_coaching_hinweise')
    .update({ gesehen_am: new Date().toISOString() })
    .eq('id', id)
    .is('gesehen_am', null);
}

export async function pruneOldCoaching(daysOld = 60): Promise<{ pruned: number }> {
  const supabase = createServiceClient();
  const { data } = await supabase.rpc('prune_fahrer_coaching_hinweise', { days_old: daysOld });
  return { pruned: (data as number) ?? 0 };
}
