/**
 * GET /api/delivery/admin/schicht-bilanz-fahrer?location_id=<uuid>
 *
 * Phase 1460 — Schicht-Bilanz-API (je Fahrer)
 * Heute-Bilanzzusammenfassung je Fahrer: Stopps, Km, Verdienst, Trinkgeld.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerSchichtBilanz {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  km_heute: number;
  verdienst_heute: number;
  trinkgeld_heute: number;
  gesamt_heute: number;
  schicht_start: string | null;
  aktiv: boolean;
}

export interface SchichtBilanzFahrerResponse {
  fahrer: FahrerSchichtBilanz[];
  location_id: string;
  datum: string;
  generiert_am: string;
  gesamt_stopps: number;
  gesamt_km: number;
  gesamt_verdienst: number;
  gesamt_trinkgeld: number;
}

function buildMock(locationId: string): SchichtBilanzFahrerResponse {
  const heute = new Date().toISOString().slice(0, 10);
  const fahrer: FahrerSchichtBilanz[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max Mustermann', stopps_heute: 12, km_heute: 38.4, verdienst_heute: 48.60, trinkgeld_heute: 7.50, gesamt_heute: 56.10, schicht_start: `${heute}T08:00:00Z`, aktiv: true },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt',   stopps_heute: 9,  km_heute: 27.1, verdienst_heute: 36.00, trinkgeld_heute: 4.20, gesamt_heute: 40.20, schicht_start: `${heute}T09:30:00Z`, aktiv: true },
    { fahrer_id: 'f3', fahrer_name: 'Tom Berger',     stopps_heute: 7,  km_heute: 21.5, verdienst_heute: 28.00, trinkgeld_heute: 2.80, gesamt_heute: 30.80, schicht_start: `${heute}T10:00:00Z`, aktiv: false },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Weber',     stopps_heute: 5,  km_heute: 14.2, verdienst_heute: 20.00, trinkgeld_heute: 1.50, gesamt_heute: 21.50, schicht_start: `${heute}T11:00:00Z`, aktiv: true },
  ];
  return {
    fahrer,
    location_id: locationId,
    datum: heute,
    generiert_am: new Date().toISOString(),
    gesamt_stopps: fahrer.reduce((s, f) => s + f.stopps_heute, 0),
    gesamt_km: parseFloat(fahrer.reduce((s, f) => s + f.km_heute, 0).toFixed(1)),
    gesamt_verdienst: parseFloat(fahrer.reduce((s, f) => s + f.verdienst_heute, 0).toFixed(2)),
    gesamt_trinkgeld: parseFloat(fahrer.reduce((s, f) => s + f.trinkgeld_heute, 0).toFixed(2)),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const heuteStr = new Date().toISOString().slice(0, 10);
    const startOfDay = `${heuteStr}T00:00:00.000Z`;

    const { data: drivers, error: dErr } = await (sb as any)
      .from('mise_drivers')
      .select('id, vorname, nachname, aktiv')
      .eq('location_id', locationId);

    if (dErr || !drivers || (drivers as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    type DriverRow = { id: string; vorname: string; nachname: string; aktiv: boolean };
    const driverRows = drivers as DriverRow[];

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('fahrer_id, gestartet_am, gesamt_km, stopps_anzahl')
      .eq('location_id', locationId)
      .gte('gestartet_am', startOfDay);

    type BatchRow = { fahrer_id: string; gestartet_am: string; gesamt_km: number | null; stopps_anzahl: number | null };
    const batchRows = (batches ?? []) as BatchRow[];

    const { data: stops } = await (sb as any)
      .from('mise_delivery_stops')
      .select('fahrer_id, trinkgeld, status')
      .eq('location_id', locationId)
      .gte('erstellt_am', startOfDay);

    type StopRow = { fahrer_id: string; trinkgeld: number | null; status: string };
    const stopRows = (stops ?? []) as StopRow[];

    const fahrer: FahrerSchichtBilanz[] = driverRows.map(d => {
      const meineBatches = batchRows.filter(b => b.fahrer_id === d.id);
      const meineStopps = stopRows.filter(s => s.fahrer_id === d.id && s.status === 'delivered');
      const stoppsHeute = meineStopps.length || meineBatches.reduce((acc, b) => acc + (b.stopps_anzahl ?? 0), 0);
      const kmHeute = parseFloat(meineBatches.reduce((acc, b) => acc + (b.gesamt_km ?? 0), 0).toFixed(1));
      const trinkgeldHeute = parseFloat(meineStopps.reduce((acc, s) => acc + (s.trinkgeld ?? 0), 0).toFixed(2));
      const verdienstHeute = parseFloat((stoppsHeute * 4.00).toFixed(2));
      const schichtStart = meineBatches.length > 0
        ? meineBatches.reduce((a, b) => a.gestartet_am < b.gestartet_am ? a : b).gestartet_am
        : null;

      return {
        fahrer_id: d.id,
        fahrer_name: `${d.vorname} ${d.nachname}`.trim(),
        stopps_heute: stoppsHeute,
        km_heute: kmHeute,
        verdienst_heute: verdienstHeute,
        trinkgeld_heute: trinkgeldHeute,
        gesamt_heute: parseFloat((verdienstHeute + trinkgeldHeute).toFixed(2)),
        schicht_start: schichtStart,
        aktiv: d.aktiv ?? false,
      };
    });

    const active = fahrer.filter(f => f.stopps_heute > 0 || f.aktiv);
    if (active.length === 0) return NextResponse.json(buildMock(locationId));

    active.sort((a, b) => b.stopps_heute - a.stopps_heute);

    return NextResponse.json({
      fahrer: active,
      location_id: locationId,
      datum: heuteStr,
      generiert_am: new Date().toISOString(),
      gesamt_stopps: active.reduce((s, f) => s + f.stopps_heute, 0),
      gesamt_km: parseFloat(active.reduce((s, f) => s + f.km_heute, 0).toFixed(1)),
      gesamt_verdienst: parseFloat(active.reduce((s, f) => s + f.verdienst_heute, 0).toFixed(2)),
      gesamt_trinkgeld: parseFloat(active.reduce((s, f) => s + f.trinkgeld_heute, 0).toFixed(2)),
    } satisfies SchichtBilanzFahrerResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
