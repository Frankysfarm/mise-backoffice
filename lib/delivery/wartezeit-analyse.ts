/**
 * lib/delivery/wartezeit-analyse.ts — Phase 419
 *
 * Wartezeit-Analyse-Engine: Echtzeit-Analyse der Wartezeiten entlang der
 * gesamten Liefer-Pipeline (Küche → Abholung → Zustellung).
 *
 * Public API:
 *   getWartezeitDashboard(locationId, stunden?)
 *     → Gesamt-KPIs + Phasen-Breakdown + Engpass-Identifikation
 *   getWartezeitTrend(locationId, tage?)
 *     → Tägliche Trend-Daten der letzten N Tage
 *   getWartezeitPerFahrer(locationId, limit?)
 *     → Wartezeiten je Fahrer (Abholwartzeit in der Küche)
 *   getKuechenWartezeit(locationId)
 *     → Nur Küchenphase: aktuelle Prep-Wartezeit vs. Ziel
 */
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

// ── Typen ──────────────────────────────────────────────────────────────────────

export type Engpass = 'kueche' | 'abholung' | 'zustellung' | 'keine';

export interface WartezeitPhase {
  name:        string;
  avgMin:      number | null;
  zielMin:     number;
  deltaMin:    number | null;  // avg - ziel (positiv = zu langsam)
  ampel:       'gruen' | 'gelb' | 'rot';
  anteil:      number;         // % Anteil an Gesamt-Wartezeit
}

export interface WartezeitKpis {
  gesamtMin:        number | null;
  kuechemin:        number | null;
  abholungMin:      number | null;
  zustellungMin:    number | null;
  anzahlBestellungen: number;
  engpass:          Engpass;
  engpassDeltaMin:  number | null;
}

export interface WartezeitDashboard {
  kpis:    WartezeitKpis;
  phasen:  WartezeitPhase[];
  ziel: {
    gesamtMin:     number;
    kuechemin:     number;
    abholungMin:   number;
    zustellungMin: number;
  };
  berechnetAm: string;
}

export interface WartezeitTrendRow {
  tag:           string;      // YYYY-MM-DD
  gesamtMin:     number | null;
  kuechemin:     number | null;
  abholungMin:   number | null;
  zustellungMin: number | null;
  anzahl:        number;
}

export interface FahrerWartezeitEntry {
  fahrerId:       string;
  fahrerName:     string | null;
  initials:       string;
  abholungAvgMin: number | null;  // Wartezeit Fahrer beim Pickup
  touren:         number;
  ampel:          'gruen' | 'gelb' | 'rot';
}

export interface KuechenWartezeit {
  avgPrepMin:     number | null;
  zielPrepMin:    number;
  deltaMin:       number | null;
  ampel:          'gruen' | 'gelb' | 'rot';
  aktuelleQueue:  number;         // offene Bestellungen jetzt
  ueberfaellig:   number;         // Bestellungen > ziel
}

// ── Zielwerte (Fallback-Defaults) ─────────────────────────────────────────────

const ZIELE = {
  gesamtMin:     35,
  kuechemin:     15,
  abholungMin:    5,
  zustellungMin: 15,
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function ampelFuerDelta(deltaMin: number | null, toleranz: number): 'gruen' | 'gelb' | 'rot' {
  if (deltaMin === null) return 'gruen';
  if (deltaMin <= toleranz)        return 'gruen';
  if (deltaMin <= toleranz * 2.5)  return 'gelb';
  return 'rot';
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

function stunden(n: number): string {
  return new Date(Date.now() - n * 3600_000).toISOString();
}

// ── getWartezeitDashboard ─────────────────────────────────────────────────────

export async function getWartezeitDashboard(
  locationId: string,
  stundenfenster: number = 8,
): Promise<WartezeitDashboard> {
  const supabase = createServiceClient();
  const seit = stunden(stundenfenster);

  // Lifecycle-Snapshots der letzten N Stunden
  const { data: rows } = await supabase
    .from('order_lifecycle_snapshots')
    .select('kitchen_prep_min, pickup_wait_min, drive_min, total_delivery_min')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('kitchen_prep_min', 'is', null)
    .limit(500);

  const data = rows ?? [];
  const n = data.length;

  const avg = (key: keyof typeof data[0]): number | null => {
    const vals = data.map(r => r[key]).filter((v): v is number => typeof v === 'number');
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const kuechemin     = avg('kitchen_prep_min');
  const abholungMin   = avg('pickup_wait_min');
  const zustellungMin = avg('drive_min');
  const gesamtMin     = avg('total_delivery_min');

  // Engpass: Phase mit größtem positiven Delta
  const deltas: Record<Engpass, number | null> = {
    kueche:      kuechemin     !== null ? kuechemin     - ZIELE.kuechemin     : null,
    abholung:    abholungMin   !== null ? abholungMin   - ZIELE.abholungMin   : null,
    zustellung:  zustellungMin !== null ? zustellungMin - ZIELE.zustellungMin : null,
    keine:       null,
  };

  let engpass: Engpass = 'keine';
  let maxDelta = 0;
  for (const [phase, delta] of Object.entries(deltas)) {
    if (phase === 'keine') continue;
    if (delta !== null && delta > maxDelta) {
      maxDelta = delta;
      engpass = phase as Engpass;
    }
  }
  if (maxDelta <= 0) engpass = 'keine';

  // Phasen-Breakdown
  const gesamtAvg = gesamtMin ?? ((kuechemin ?? 0) + (abholungMin ?? 0) + (zustellungMin ?? 0));
  const anteil = (min: number | null): number => {
    if (!min || !gesamtAvg) return 0;
    return Math.round((min / gesamtAvg) * 100);
  };

  const phasen: WartezeitPhase[] = [
    {
      name:     'Küche (Prep)',
      avgMin:   kuechemin,
      zielMin:  ZIELE.kuechemin,
      deltaMin: deltas.kueche,
      ampel:    ampelFuerDelta(deltas.kueche, 3),
      anteil:   anteil(kuechemin),
    },
    {
      name:     'Abholung (Pickup)',
      avgMin:   abholungMin,
      zielMin:  ZIELE.abholungMin,
      deltaMin: deltas.abholung,
      ampel:    ampelFuerDelta(deltas.abholung, 2),
      anteil:   anteil(abholungMin),
    },
    {
      name:     'Zustellung (Fahrt)',
      avgMin:   zustellungMin,
      zielMin:  ZIELE.zustellungMin,
      deltaMin: deltas.zustellung,
      ampel:    ampelFuerDelta(deltas.zustellung, 3),
      anteil:   anteil(zustellungMin),
    },
  ];

  return {
    kpis: {
      gesamtMin,
      kuechemin,
      abholungMin,
      zustellungMin,
      anzahlBestellungen: n,
      engpass,
      engpassDeltaMin: engpass !== 'keine' ? deltas[engpass] : null,
    },
    phasen,
    ziel: ZIELE,
    berechnetAm: new Date().toISOString(),
  };
}

// ── getWartezeitTrend ─────────────────────────────────────────────────────────

export async function getWartezeitTrend(
  locationId: string,
  tage: number = 7,
): Promise<WartezeitTrendRow[]> {
  const supabase = createServiceClient();
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString();

  const { data: rows } = await supabase
    .from('order_lifecycle_snapshots')
    .select('kitchen_prep_min, pickup_wait_min, drive_min, total_delivery_min, created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('kitchen_prep_min', 'is', null)
    .order('created_at', { ascending: true })
    .limit(2000);

  const byDay = new Map<string, { kueche: number[]; abholung: number[]; zustellung: number[]; gesamt: number[] }>();

  for (const r of rows ?? []) {
    const tag = r.created_at.slice(0, 10);
    if (!byDay.has(tag)) byDay.set(tag, { kueche: [], abholung: [], zustellung: [], gesamt: [] });
    const d = byDay.get(tag)!;
    if (r.kitchen_prep_min != null)    d.kueche.push(r.kitchen_prep_min);
    if (r.pickup_wait_min != null)     d.abholung.push(r.pickup_wait_min);
    if (r.drive_min != null)           d.zustellung.push(r.drive_min);
    if (r.total_delivery_min != null)  d.gesamt.push(r.total_delivery_min);
  }

  const avgArr = (arr: number[]): number | null =>
    arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tag, d]) => ({
      tag,
      gesamtMin:     avgArr(d.gesamt),
      kuechemin:     avgArr(d.kueche),
      abholungMin:   avgArr(d.abholung),
      zustellungMin: avgArr(d.zustellung),
      anzahl:        d.gesamt.length,
    }));
}

// ── getWartezeitPerFahrer ─────────────────────────────────────────────────────

export async function getWartezeitPerFahrer(
  locationId: string,
  limit: number = 15,
): Promise<FahrerWartezeitEntry[]> {
  const supabase = createServiceClient();
  const seit = stunden(24 * 7);  // letzte 7 Tage

  const { data: rows } = await supabase
    .from('order_lifecycle_snapshots')
    .select('fahrer_id, pickup_wait_min')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('fahrer_id', 'is', null)
    .not('pickup_wait_min', 'is', null)
    .limit(2000);

  const byFahrer = new Map<string, number[]>();
  for (const r of rows ?? []) {
    if (!r.fahrer_id) continue;
    if (!byFahrer.has(r.fahrer_id)) byFahrer.set(r.fahrer_id, []);
    byFahrer.get(r.fahrer_id)!.push(r.pickup_wait_min as number);
  }

  // Fahrer-Namen laden
  const fahrerIds = [...byFahrer.keys()];
  const { data: employees } = await supabase
    .from('employees')
    .select('id, first_name, last_name')
    .in('id', fahrerIds);

  const nameMap = new Map<string, string>();
  for (const e of employees ?? []) {
    nameMap.set(e.id, [e.first_name, e.last_name].filter(Boolean).join(' ') || null!);
  }

  const ergebnis: FahrerWartezeitEntry[] = [];
  for (const [fahrerId, vals] of byFahrer.entries()) {
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const name = nameMap.get(fahrerId) ?? null;
    const delta = avg - ZIELE.abholungMin;
    ergebnis.push({
      fahrerId,
      fahrerName:     name,
      initials:       initials(name),
      abholungAvgMin: avg,
      touren:         vals.length,
      ampel:          ampelFuerDelta(delta, 2),
    });
  }

  return ergebnis
    .sort((a, b) => (b.abholungAvgMin ?? 0) - (a.abholungAvgMin ?? 0))
    .slice(0, limit);
}

// ── getKuechenWartezeit ───────────────────────────────────────────────────────

export async function getKuechenWartezeit(locationId: string): Promise<KuechenWartezeit> {
  const supabase = createServiceClient();
  const seit = stunden(2);

  // Letzte 2 Stunden für aktuellen Schnitt
  const { data: recent } = await supabase
    .from('order_lifecycle_snapshots')
    .select('kitchen_prep_min')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .not('kitchen_prep_min', 'is', null)
    .limit(100);

  const vals = (recent ?? []).map(r => r.kitchen_prep_min as number);
  const avgPrepMin = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const deltaMin = avgPrepMin !== null ? avgPrepMin - ZIELE.kuechemin : null;

  // Aktuelle Queue: Bestellungen die noch nicht geliefert sind
  const { count: aktuelleQueue } = await supabase
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['pending', 'confirmed', 'preparing']);

  const { count: ueberfaellig } = await supabase
    .from('customer_orders')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .in('status', ['preparing'])
    .lt('created_at', stunden(ZIELE.kuechemin / 60));

  return {
    avgPrepMin,
    zielPrepMin:   ZIELE.kuechemin,
    deltaMin,
    ampel:         ampelFuerDelta(deltaMin, 3),
    aktuelleQueue: aktuelleQueue ?? 0,
    ueberfaellig:  ueberfaellig ?? 0,
  };
}
