/**
 * Phase 2211 — Schicht-Bestzeiten-API
 *
 * GET /api/delivery/admin/schicht-bestzeiten?location_id=<uuid>
 * Schnellste Lieferzeit heute; Bester Fahrer nach Stopps/h; Record-Tracker (heute vs. Allzeit-Rekord)
 * Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBestzeit {
  fahrer_id: string;
  fahrer_name: string;
  stopps_pro_stunde: number;
  stopps_heute: number;
  schicht_stunden: number;
}

export interface SchichtBestzeitenAntwort {
  location_id: string;
  schnellste_lieferung_min: number | null;
  schnellste_lieferung_fahrer: string | null;
  allzeit_rekord_min: number | null;
  ist_neuer_rekord: boolean;
  top_fahrer: FahrerBestzeit[];
  letzte_5_lieferungen: { fahrer_name: string; dauer_min: number; zeitpunkt: string }[];
  generiert_am: string;
}

const MOCK: SchichtBestzeitenAntwort = {
  location_id: 'mock',
  schnellste_lieferung_min: 11,
  schnellste_lieferung_fahrer: 'Max M.',
  allzeit_rekord_min: 9,
  ist_neuer_rekord: false,
  top_fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_pro_stunde: 4.2, stopps_heute: 12, schicht_stunden: 2.9 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa K.', stopps_pro_stunde: 3.8, stopps_heute: 10, schicht_stunden: 2.6 },
    { fahrer_id: 'f3', fahrer_name: 'Tom B.', stopps_pro_stunde: 3.4, stopps_heute: 8, schicht_stunden: 2.4 },
  ],
  letzte_5_lieferungen: [
    { fahrer_name: 'Max M.', dauer_min: 11, zeitpunkt: new Date(Date.now() - 5 * 60000).toISOString() },
    { fahrer_name: 'Lisa K.', dauer_min: 18, zeitpunkt: new Date(Date.now() - 22 * 60000).toISOString() },
    { fahrer_name: 'Tom B.', dauer_min: 14, zeitpunkt: new Date(Date.now() - 38 * 60000).toISOString() },
    { fahrer_name: 'Max M.', dauer_min: 21, zeitpunkt: new Date(Date.now() - 55 * 60000).toISOString() },
    { fahrer_name: 'Lisa K.', dauer_min: 16, zeitpunkt: new Date(Date.now() - 72 * 60000).toISOString() },
  ],
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

  const jetzt = new Date();
  const heuteStart = new Date(jetzt);
  heuteStart.setHours(0, 0, 0, 0);

  try {
    const supabase = await createClient();

    // Heutige Lieferungen mit Dauer
    const { data: heuteBatches } = await supabase
      .from('mise_delivery_batches')
      .select(`
        id,
        fahrer_id,
        delivered_at,
        startzeit,
        stop_count,
        employees!fahrer_id (vorname, nachname)
      `)
      .eq('location_id', locationId)
      .eq('status', 'delivered')
      .gte('delivered_at', heuteStart.toISOString())
      .lte('delivered_at', jetzt.toISOString())
      .order('delivered_at', { ascending: false });

    // Allzeit-Rekord (beste Einzellieferung je Stop)
    const { data: allzeitData } = await supabase
      .from('mise_delivery_stops')
      .select('geliefert_am, abgeholt_am')
      .eq('location_id', locationId)
      .not('geliefert_am', 'is', null)
      .not('abgeholt_am', 'is', null)
      .order('geliefert_am', { ascending: false })
      .limit(500);

    type StopRow = { geliefert_am: string | null; abgeholt_am: string | null };
    const allStopDurations: number[] = (allzeitData ?? [])
      .map((s: StopRow) => {
        if (!s.geliefert_am || !s.abgeholt_am) return null;
        return Math.round((new Date(s.geliefert_am).getTime() - new Date(s.abgeholt_am).getTime()) / 60000);
      })
      .filter((d): d is number => d !== null && d > 0 && d < 120);

    const allzeitRekord = allStopDurations.length ? Math.min(...allStopDurations) : null;

    // Heutige Stops für Schnellste-Lieferung
    const { data: heuteStops } = await supabase
      .from('mise_delivery_stops')
      .select(`
        geliefert_am,
        abgeholt_am,
        batch:mise_delivery_batches!batch_id (
          fahrer_id,
          employees!fahrer_id (vorname, nachname)
        )
      `)
      .eq('location_id', locationId)
      .not('geliefert_am', 'is', null)
      .not('abgeholt_am', 'is', null)
      .gte('geliefert_am', heuteStart.toISOString())
      .order('geliefert_am', { ascending: false })
      .limit(100);

    type HeuteStop = {
      geliefert_am: string | null;
      abgeholt_am: string | null;
      batch: { fahrer_id: string; employees: { vorname: string; nachname: string } | null } | null;
    };

    const heuteStopRows: HeuteStop[] = (heuteStops ?? []) as unknown as HeuteStop[];
    const heuteStopDurations = heuteStopRows
      .map((s) => {
        if (!s.geliefert_am || !s.abgeholt_am) return null;
        const dauer = Math.round((new Date(s.geliefert_am).getTime() - new Date(s.abgeholt_am).getTime()) / 60000);
        if (dauer <= 0 || dauer >= 120) return null;
        const emp = s.batch?.employees;
        return {
          dauer,
          fahrer_name: emp ? `${emp.vorname} ${emp.nachname.charAt(0)}.` : 'Unbekannt',
          zeitpunkt: s.geliefert_am,
        };
      })
      .filter((d): d is { dauer: number; fahrer_name: string; zeitpunkt: string } => d !== null)
      .sort((a, b) => a.dauer - b.dauer);

    const schnellste = heuteStopDurations[0] ?? null;

    // Letzte 5 Lieferungen (chronologisch absteigend)
    const letzte5 = heuteStopRows
      .slice(0, 5)
      .map((s) => {
        if (!s.geliefert_am || !s.abgeholt_am) return null;
        const dauer = Math.round((new Date(s.geliefert_am).getTime() - new Date(s.abgeholt_am).getTime()) / 60000);
        if (dauer <= 0 || dauer >= 120) return null;
        const emp = s.batch?.employees;
        return {
          fahrer_name: emp ? `${emp.vorname} ${emp.nachname.charAt(0)}.` : 'Unbekannt',
          dauer_min: dauer,
          zeitpunkt: s.geliefert_am,
        };
      })
      .filter((d): d is { fahrer_name: string; dauer_min: number; zeitpunkt: string } => d !== null);

    // Top-Fahrer nach Stopps/h
    type BatchRow = {
      fahrer_id: string | null;
      delivered_at: string | null;
      startzeit: string | null;
      stop_count: number | null;
      employees: { vorname: string; nachname: string } | null;
    };

    const fahrerMap = new Map<string, { name: string; stopps: number; minuten: number }>();
    for (const b of (heuteBatches ?? []) as unknown as BatchRow[]) {
      if (!b.fahrer_id || !b.delivered_at || !b.startzeit) continue;
      const minuten = (new Date(b.delivered_at).getTime() - new Date(b.startzeit).getTime()) / 60000;
      if (minuten <= 0) continue;
      const prev = fahrerMap.get(b.fahrer_id) ?? { name: '', stopps: 0, minuten: 0 };
      const emp = b.employees;
      fahrerMap.set(b.fahrer_id, {
        name: emp ? `${emp.vorname} ${emp.nachname.charAt(0)}.` : prev.name || 'Unbekannt',
        stopps: prev.stopps + (b.stop_count ?? 0),
        minuten: prev.minuten + minuten,
      });
    }

    const topFahrer: FahrerBestzeit[] = Array.from(fahrerMap.entries())
      .map(([id, v]) => ({
        fahrer_id: id,
        fahrer_name: v.name,
        schicht_stunden: Math.round((v.minuten / 60) * 10) / 10,
        stopps_heute: v.stopps,
        stopps_pro_stunde: v.minuten > 0 ? Math.round((v.stopps / (v.minuten / 60)) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.stopps_pro_stunde - a.stopps_pro_stunde)
      .slice(0, 3);

    const result: SchichtBestzeitenAntwort = {
      location_id: locationId,
      schnellste_lieferung_min: schnellste?.dauer ?? null,
      schnellste_lieferung_fahrer: schnellste?.fahrer_name ?? null,
      allzeit_rekord_min: allzeitRekord,
      ist_neuer_rekord: schnellste !== null && allzeitRekord !== null && schnellste.dauer < allzeitRekord,
      top_fahrer: topFahrer,
      letzte_5_lieferungen: letzte5,
      generiert_am: jetzt.toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
