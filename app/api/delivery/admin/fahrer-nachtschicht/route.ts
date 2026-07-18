import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(nacht_h: number): Ampel {
  if (nacht_h <= 0) return 'gruen';
  if (nacht_h <= 4) return 'gelb';
  return 'rot';
}

export interface FahrerNachtschicht {
  fahrer_id: string;
  fahrer_name: string;
  nacht_h: number;
  nacht_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_erschoepfung: boolean;
}

export interface FahrerNachtschichtResponse {
  fahrer: FahrerNachtschicht[];
  team_avg_nacht_h: number;
  team_avg_nacht_h_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   nacht: 5.5, nacht_vw: 3.0 },
    { id: 'd2', name: 'Sara K.',  nacht: 2.0, nacht_vw: 1.5 },
    { id: 'd3', name: 'Tim B.',   nacht: 0.0, nacht_vw: 0.5 },
    { id: 'd4', name: 'Julia F.', nacht: 3.5, nacht_vw: 4.2 },
  ];

  const fahrer: FahrerNachtschicht[] = drivers.map(d => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    nacht_h: d.nacht,
    nacht_h_vw: d.nacht_vw,
    trend: d.nacht > d.nacht_vw ? 'steigend' : d.nacht < d.nacht_vw ? 'fallend' : 'stabil',
    trend_delta: Math.round((d.nacht - d.nacht_vw) * 10) / 10,
    ampel: calcAmpel(d.nacht),
    alert_erschoepfung: d.nacht > 4,
  })).sort((a, b) => b.nacht_h - a.nacht_h);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.nacht_h, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.nacht_h_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_erschoepfung).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_nacht_h: team_avg };
  }

  return {
    fahrer,
    team_avg_nacht_h: team_avg,
    team_avg_nacht_h_vw: team_avg_vw,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    // Night window: 22:00–06:00 — calculate overlap for each driver's shifts today
    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .lte('started_at', todayEnd.toISOString());

    const nightStart = 22; // 22:00
    const nightEnd = 6;   // 06:00 next day

    function calcNachtH(startedAt: string, endedAt: string | null): number {
      const s = new Date(startedAt);
      const e = endedAt ? new Date(endedAt) : new Date();
      const durationMs = e.getTime() - s.getTime();
      if (durationMs <= 0) return 0;

      let nightMs = 0;
      const cur = new Date(s);
      while (cur < e) {
        const h = cur.getHours();
        if (h >= nightStart || h < nightEnd) {
          const nextMs = Math.min(e.getTime(), cur.getTime() + 60000);
          nightMs += nextMs - cur.getTime();
        }
        cur.setTime(cur.getTime() + 60000);
      }
      return Math.round((nightMs / 3600000) * 10) / 10;
    }

    const driverMap = new Map(drivers.map(d => [d.id, d.name]));
    const nachtByDriver = new Map<string, number>();

    for (const shift of shifts ?? []) {
      const prev = nachtByDriver.get(shift.driver_id) ?? 0;
      nachtByDriver.set(shift.driver_id, prev + calcNachtH(shift.started_at, shift.ended_at));
    }

    const fahrerList: FahrerNachtschicht[] = drivers.map(d => {
      const nacht = nachtByDriver.get(d.id) ?? 0;
      return {
        fahrer_id: d.id,
        fahrer_name: driverMap.get(d.id) ?? d.id,
        nacht_h: nacht,
        nacht_h_vw: 0,
        trend: 'stabil' as const,
        trend_delta: 0,
        ampel: calcAmpel(nacht),
        alert_erschoepfung: nacht > 4,
      };
    }).sort((a, b) => b.nacht_h - a.nacht_h);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.nacht_h, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_erschoepfung).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_nacht_h: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_nacht_h: team_avg,
      team_avg_nacht_h_vw: 0,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
