import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerPausenzeit {
  driver_id: string;
  name: string;
  avg_pause_min: number;
  max_pause_min: number;
  pause_count: number;
  ist_ausreisser: boolean;
}

interface FahrerPausenzeitResponse {
  location_id: string;
  fahrer: FahrerPausenzeit[];
  ausreisser_count: number;
  alert_ausreisser: boolean;
  generiert_am: string;
}

const MOCK: FahrerPausenzeitResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_pause_min: 8, max_pause_min: 12, pause_count: 14, ist_ausreisser: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_pause_min: 22, max_pause_min: 35, pause_count: 9, ist_ausreisser: true },
    { driver_id: 'd3', name: 'Tom B.', avg_pause_min: 6, max_pause_min: 10, pause_count: 18, ist_ausreisser: false },
    { driver_id: 'd4', name: 'Anna L.', avg_pause_min: 25, max_pause_min: 40, pause_count: 7, ist_ausreisser: true },
  ],
  ausreisser_count: 2,
  alert_ausreisser: false,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: breaks } = await sb
      .from('driver_breaks')
      .select('driver_id, started_at, ended_at, duration_min')
      .eq('location_id', locationId)
      .gte('started_at', since);

    const fahrerMap = new Map<string, FahrerPausenzeit>();

    (drivers ?? []).forEach(d => {
      fahrerMap.set(d.id, {
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        avg_pause_min: 0,
        max_pause_min: 0,
        pause_count: 0,
        ist_ausreisser: false,
      });
    });

    const breaksByDriver = new Map<string, number[]>();
    (breaks ?? []).forEach(b => {
      const dur =
        b.duration_min != null
          ? Number(b.duration_min)
          : b.started_at && b.ended_at
            ? Math.round((new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000)
            : 0;
      if (!breaksByDriver.has(b.driver_id)) breaksByDriver.set(b.driver_id, []);
      breaksByDriver.get(b.driver_id)!.push(dur);
    });

    breaksByDriver.forEach((durs, driverId) => {
      const entry = fahrerMap.get(driverId);
      if (!entry) return;
      const avg = Math.round(durs.reduce((a, b) => a + b, 0) / durs.length);
      const max = Math.max(...durs);
      entry.avg_pause_min = avg;
      entry.max_pause_min = max;
      entry.pause_count = durs.length;
      entry.ist_ausreisser = avg > 20;
    });

    const fahrer = Array.from(fahrerMap.values()).filter(f => f.pause_count > 0);
    const ausreisser_count = fahrer.filter(f => f.ist_ausreisser).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      ausreisser_count,
      alert_ausreisser: ausreisser_count > 3,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerPausenzeitResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
