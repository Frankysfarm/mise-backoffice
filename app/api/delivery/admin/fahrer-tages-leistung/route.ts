/**
 * GET /api/delivery/admin/fahrer-tages-leistung?location_id=<uuid>
 *
 * Phase 1512 - Fahrer-Tages-Leistungs-API
 * Stopps/Verdienst/km/Pünktlichkeit je Fahrer heute; Ranking; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerTagesLeistungEintrag {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  verdienst_heute_eur: number;
  km_heute: number;
  puenktlichkeit_pct: number;
  rang: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

export interface FahrerTagesLeistungResponse {
  fahrer: FahrerTagesLeistungEintrag[];
  team_schnitt_stopps: number;
  team_schnitt_puenktlichkeit_pct: number;
  location_id: string;
  generiert_am: string;
}

const MOCK_FAHRER = [
  { id: 'f1', name: 'Alex M.' },
  { id: 'f2', name: 'Ben K.' },
  { id: 'f3', name: 'Clara S.' },
  { id: 'f4', name: 'David R.' },
  { id: 'f5', name: 'Eva L.' },
];

function buildMock(locationId: string): FahrerTagesLeistungResponse {
  const fahrer: FahrerTagesLeistungEintrag[] = MOCK_FAHRER.map((f, i) => {
    const seed = (f.id.charCodeAt(1) ?? 49) % 5;
    const stopps = 8 + ((seed + i) % 6);
    return {
      fahrer_id: f.id,
      fahrer_name: f.name,
      stopps_heute: stopps,
      verdienst_heute_eur: parseFloat((stopps * 3.5 + (seed * 2)).toFixed(2)),
      km_heute: parseFloat((stopps * 2.8 + seed).toFixed(1)),
      puenktlichkeit_pct: 75 + ((seed * 3 + i * 2) % 23),
      rang: 0,
      trend: (['besser', 'gleich', 'schlechter'] as const)[(seed + i) % 3],
    };
  });

  fahrer.sort((a, b) => b.stopps_heute - a.stopps_heute);
  fahrer.forEach((f, i) => { f.rang = i + 1; });

  const teamSchnittStopps = fahrer.length > 0
    ? Math.round(fahrer.reduce((s, f) => s + f.stopps_heute, 0) / fahrer.length)
    : 0;
  const teamSchnittPuenktlichkeit = fahrer.length > 0
    ? Math.round(fahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / fahrer.length)
    : 0;

  return {
    fahrer,
    team_schnitt_stopps: teamSchnittStopps,
    team_schnitt_puenktlichkeit_pct: teamSchnittPuenktlichkeit,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: batches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('driver_id, status, total_distance_km, created_at')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString());

    const { data: stops } = await (sb as any)
      .from('mise_delivery_stops')
      .select('batch_id, geliefert_am, soll_zeit, driver_id')
      .gte('created_at', todayStart.toISOString());

    const { data: driverRows } = await (sb as any)
      .from('delivery_drivers')
      .select('id, full_name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    const hasBatches = Array.isArray(batches) && batches.length > 0;
    if (!hasBatches) {
      return NextResponse.json(buildMock(locationId));
    }

    type BatchRow = { driver_id?: string | null; status?: string | null; total_distance_km?: number | null; created_at?: string | null };
    type StopRow = { batch_id?: string | null; geliefert_am?: string | null; soll_zeit?: string | null; driver_id?: string | null };
    type DriverRow = { id: string; full_name?: string | null };

    const driverMap = new Map<string, string>();
    ((driverRows as DriverRow[]) ?? []).forEach(d => driverMap.set(d.id, d.full_name ?? d.id));

    const SLA_MIN = 45;
    function isPuenktlich(stop: StopRow): boolean {
      if (!stop.geliefert_am) return false;
      if (stop.soll_zeit) {
        return new Date(stop.geliefert_am).getTime() <= new Date(stop.soll_zeit).getTime() + 2 * 60_000;
      }
      return true;
    }

    const driverStops = new Map<string, StopRow[]>();
    ((stops as StopRow[]) ?? []).forEach(s => {
      if (!s.driver_id) return;
      if (!driverStops.has(s.driver_id)) driverStops.set(s.driver_id, []);
      driverStops.get(s.driver_id)!.push(s);
    });

    const driverBatches = new Map<string, BatchRow[]>();
    ((batches as BatchRow[]) ?? []).forEach(b => {
      if (!b.driver_id) return;
      if (!driverBatches.has(b.driver_id)) driverBatches.set(b.driver_id, []);
      driverBatches.get(b.driver_id)!.push(b);
    });

    const allDriverIds = new Set([...driverBatches.keys(), ...driverStops.keys()]);

    const fahrer: FahrerTagesLeistungEintrag[] = Array.from(allDriverIds).map(driverId => {
      const myBatches = driverBatches.get(driverId) ?? [];
      const myStops = driverStops.get(driverId) ?? [];
      const stoppsHeute = myStops.filter(s => !!s.geliefert_am).length;
      const kmHeute = myBatches.reduce((s, b) => s + (b.total_distance_km ?? 0), 0);
      const puenktlichStopps = myStops.filter(isPuenktlich).length;
      const puenktlichkeitPct = myStops.length > 0
        ? Math.round((puenktlichStopps / myStops.length) * 100)
        : 0;
      const verdienstEur = parseFloat((stoppsHeute * 3.5).toFixed(2));

      return {
        fahrer_id: driverId,
        fahrer_name: driverMap.get(driverId) ?? driverId,
        stopps_heute: stoppsHeute,
        verdienst_heute_eur: verdienstEur,
        km_heute: parseFloat(kmHeute.toFixed(1)),
        puenktlichkeit_pct: puenktlichkeitPct,
        rang: 0,
        trend: 'gleich',
      };
    });

    fahrer.sort((a, b) => b.stopps_heute - a.stopps_heute);
    fahrer.forEach((f, i) => { f.rang = i + 1; });

    const teamSchnittStopps = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.stopps_heute, 0) / fahrer.length)
      : 0;
    const teamSchnittPuenktlichkeit = fahrer.length > 0
      ? Math.round(fahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / fahrer.length)
      : 0;

    return NextResponse.json({
      fahrer,
      team_schnitt_stopps: teamSchnittStopps,
      team_schnitt_puenktlichkeit_pct: teamSchnittPuenktlichkeit,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerTagesLeistungResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
