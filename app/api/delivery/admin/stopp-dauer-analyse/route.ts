/**
 * GET /api/delivery/admin/stopp-dauer-analyse?location_id=<uuid>
 *
 * Phase 1732 — Stopp-Dauer-Analyse-API (Backend)
 * Ø Dwell-Time je Stopp-Typ heute; Ausreißer >3 Min über Durchschnitt → Alert;
 * Effizienz-Ranking je Fahrer; Multi-Tenant via location_id; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StoppDauerEintrag {
  stopp_typ: string;
  durchschnitt_min: number;
  min_min: number;
  max_min: number;
  anzahl: number;
  ausreisser_anzahl: number;
}

export interface FahrerStoppDauer {
  driver_id: string;
  fahrer_name: string;
  stopps_heute: number;
  avg_dwell_min: number;
  ausreisser: number;
  effizienz_rank: number;
  alert: boolean;
}

export interface StoppDauerResponse {
  typen: StoppDauerEintrag[];
  fahrer: FahrerStoppDauer[];
  location_id: string;
  datum: string;
  generiert_am: string;
}

function buildMock(locationId: string): StoppDauerResponse {
  const today = new Date();
  const datum = today.toISOString().split('T')[0];

  const typen: StoppDauerEintrag[] = [
    { stopp_typ: 'Lieferung', durchschnitt_min: 4.2, min_min: 1.5, max_min: 12.0, anzahl: 34, ausreisser_anzahl: 5 },
    { stopp_typ: 'Übergabe', durchschnitt_min: 3.0, min_min: 1.0, max_min: 8.0, anzahl: 28, ausreisser_anzahl: 3 },
    { stopp_typ: 'Pforte/Eingang', durchschnitt_min: 6.8, min_min: 3.0, max_min: 15.0, anzahl: 12, ausreisser_anzahl: 4 },
    { stopp_typ: 'Abholung Küche', durchschnitt_min: 2.5, min_min: 1.0, max_min: 7.0, anzahl: 18, ausreisser_anzahl: 2 },
  ];

  const fahrer: FahrerStoppDauer[] = [
    { driver_id: 'drv-1', fahrer_name: 'Mehmet A.', stopps_heute: 14, avg_dwell_min: 3.1, ausreisser: 1, effizienz_rank: 1, alert: false },
    { driver_id: 'drv-2', fahrer_name: 'Julia S.', stopps_heute: 12, avg_dwell_min: 4.5, ausreisser: 3, effizienz_rank: 2, alert: false },
    { driver_id: 'drv-3', fahrer_name: 'Kevin R.', stopps_heute: 10, avg_dwell_min: 7.8, ausreisser: 6, effizienz_rank: 3, alert: true },
    { driver_id: 'drv-4', fahrer_name: 'Lena T.', stopps_heute: 8, avg_dwell_min: 5.2, ausreisser: 2, effizienz_rank: 4, alert: false },
  ];

  return { typen, fahrer, location_id: locationId, datum, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const datum = today.toISOString().split('T')[0];

    const { data: stoppData, error } = await supabase
      .from('delivery_tour_stopps')
      .select('stopp_typ, dwell_time_min, driver_id, fahrer_name')
      .eq('location_id', locationId)
      .gte('created_at', todayIso);

    if (error || !stoppData || stoppData.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    // Aggregate by stopp_typ
    const typMap: Record<string, number[]> = {};
    for (const s of stoppData) {
      const typ = (s.stopp_typ as string) ?? 'Lieferung';
      if (!typMap[typ]) typMap[typ] = [];
      typMap[typ].push(s.dwell_time_min as number ?? 0);
    }

    const typen: StoppDauerEintrag[] = Object.entries(typMap).map(([stopp_typ, vals]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const threshold = avg + 3;
      return {
        stopp_typ,
        durchschnitt_min: Math.round(avg * 10) / 10,
        min_min: Math.round(Math.min(...vals) * 10) / 10,
        max_min: Math.round(Math.max(...vals) * 10) / 10,
        anzahl: vals.length,
        ausreisser_anzahl: vals.filter(v => v > threshold).length,
      };
    });

    // Aggregate by driver
    const driverMap: Record<string, { name: string; vals: number[] }> = {};
    for (const s of stoppData) {
      const id = (s.driver_id as string) ?? 'unknown';
      if (!driverMap[id]) driverMap[id] = { name: (s.fahrer_name as string) ?? id, vals: [] };
      driverMap[id].vals.push(s.dwell_time_min as number ?? 0);
    }

    const fahrerUnsorted: Omit<FahrerStoppDauer, 'effizienz_rank'>[] = Object.entries(driverMap).map(([driver_id, { name, vals }]) => {
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const threshold = avg + 3;
      const ausreisser = vals.filter(v => v > threshold).length;
      return {
        driver_id,
        fahrer_name: name,
        stopps_heute: vals.length,
        avg_dwell_min: Math.round(avg * 10) / 10,
        ausreisser,
        alert: ausreisser >= 3 || avg > 8,
      };
    });

    const fahrer: FahrerStoppDauer[] = fahrerUnsorted
      .sort((a, b) => a.avg_dwell_min - b.avg_dwell_min)
      .map((f, i) => ({ ...f, effizienz_rank: i + 1 }));

    return NextResponse.json({ typen, fahrer, location_id: locationId, datum, generiert_am: new Date().toISOString() } satisfies StoppDauerResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
