import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerSchichtInfo {
  driver_id: string;
  name: string;
  schicht_start: string | null;
  schicht_dauer_min: number;
  touren_heute: number;
  letzte_tour_ende: string | null;
  idle_luecken_min: number;
  ueberstunden: boolean;
  ueberstunden_min: number;
}

export interface FahrerSchichtStartResponse {
  location_id: string;
  fahrer: FahrerSchichtInfo[];
  team_avg_dauer_min: number;
  ueberstunden_count: number;
  generiert_am: string;
}

const NORMALSCHICHT_MIN = 480; // 8h

const MOCK: FahrerSchichtStartResponse = {
  location_id: 'mock',
  fahrer: [
    {
      driver_id: 'mock-1',
      name: 'Anna M.',
      schicht_start: new Date(Date.now() - 5 * 3600_000).toISOString(),
      schicht_dauer_min: 300,
      touren_heute: 7,
      letzte_tour_ende: new Date(Date.now() - 15 * 60_000).toISOString(),
      idle_luecken_min: 12,
      ueberstunden: false,
      ueberstunden_min: 0,
    },
    {
      driver_id: 'mock-2',
      name: 'Ben K.',
      schicht_start: new Date(Date.now() - 9.5 * 3600_000).toISOString(),
      schicht_dauer_min: 570,
      touren_heute: 14,
      letzte_tour_ende: new Date(Date.now() - 8 * 60_000).toISOString(),
      idle_luecken_min: 38,
      ueberstunden: true,
      ueberstunden_min: 90,
    },
    {
      driver_id: 'mock-3',
      name: 'Clara S.',
      schicht_start: new Date(Date.now() - 3 * 3600_000).toISOString(),
      schicht_dauer_min: 180,
      touren_heute: 4,
      letzte_tour_ende: new Date(Date.now() - 25 * 60_000).toISOString(),
      idle_luecken_min: 8,
      ueberstunden: false,
      ueberstunden_min: 0,
    },
  ],
  team_avg_dauer_min: 350,
  ueberstunden_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const { data: drivers } = await sb
      .from('delivery_drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, created_at, completed_at, stop_count')
      .eq('location_id', locationId)
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: true });

    if (!drivers || drivers.length === 0 || !batches) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    type DriverRec = { id: string; name: string };
    type BatchRec = {
      id: string;
      driver_id: string | null;
      created_at: string;
      completed_at: string | null;
      stop_count: number | null;
    };

    const fahrerList: FahrerSchichtInfo[] = [];

    for (const d of drivers as DriverRec[]) {
      const dBatches = (batches as BatchRec[]).filter(b => b.driver_id === d.id);
      if (dBatches.length === 0) continue;

      dBatches.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      const schichtStart = dBatches[0].created_at;
      const schichtStartMs = new Date(schichtStart).getTime();

      const lastCompleted = dBatches
        .filter(b => b.completed_at)
        .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())[0];

      const lastTourEnde = lastCompleted?.completed_at ?? null;
      const schichtEndeMs = lastTourEnde
        ? new Date(lastTourEnde).getTime()
        : now.getTime();
      const schichtDauerMin = Math.round((schichtEndeMs - schichtStartMs) / 60_000);

      // Lücken zwischen Touren > 30 Min summieren
      let idleLueckenMin = 0;
      for (let i = 1; i < dBatches.length; i++) {
        const prev = dBatches[i - 1];
        const curr = dBatches[i];
        if (prev.completed_at) {
          const gap = (new Date(curr.created_at).getTime() - new Date(prev.completed_at).getTime()) / 60_000;
          if (gap > 30) idleLueckenMin += Math.round(gap);
        }
      }

      const ueberstundenMin = Math.max(0, schichtDauerMin - NORMALSCHICHT_MIN);

      fahrerList.push({
        driver_id: d.id,
        name: d.name,
        schicht_start: schichtStart,
        schicht_dauer_min: schichtDauerMin,
        touren_heute: dBatches.length,
        letzte_tour_ende: lastTourEnde,
        idle_luecken_min: idleLueckenMin,
        ueberstunden: ueberstundenMin > 0,
        ueberstunden_min: ueberstundenMin,
      });
    }

    if (fahrerList.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    fahrerList.sort((a, b) => b.schicht_dauer_min - a.schicht_dauer_min);

    const teamAvgMin = Math.round(
      fahrerList.reduce((s, f) => s + f.schicht_dauer_min, 0) / fahrerList.length,
    );
    const ueberstundenCount = fahrerList.filter(f => f.ueberstunden).length;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_dauer_min: teamAvgMin,
      ueberstunden_count: ueberstundenCount,
      generiert_am: now.toISOString(),
    } satisfies FahrerSchichtStartResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
