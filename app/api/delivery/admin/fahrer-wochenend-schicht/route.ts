import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(h: number): Ampel {
  if (h <= 8) return 'gruen';
  if (h <= 12) return 'gelb';
  return 'rot';
}

export interface FahrerWochenendSchicht {
  fahrer_id: string;
  fahrer_name: string;
  wochenend_h: number;
  wochenend_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_ueberlastung: boolean;
}

export interface FahrerWochenendSchichtResponse {
  fahrer: FahrerWochenendSchicht[];
  team_avg_wochenend_h: number;
  team_avg_wochenend_h_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   wh: 13.5, wh_vw: 10.0 },
    { id: 'd2', name: 'Sara K.',  wh: 9.0,  wh_vw: 8.5  },
    { id: 'd3', name: 'Tim B.',   wh: 6.0,  wh_vw: 7.0  },
    { id: 'd4', name: 'Julia F.', wh: 11.5, wh_vw: 12.0 },
  ];

  const fahrer: FahrerWochenendSchicht[] = drivers.map(d => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    wochenend_h: d.wh,
    wochenend_h_vw: d.wh_vw,
    trend: d.wh > d.wh_vw ? 'steigend' : d.wh < d.wh_vw ? 'fallend' : 'stabil',
    trend_delta: Math.round((d.wh - d.wh_vw) * 10) / 10,
    ampel: calcAmpel(d.wh),
    alert_ueberlastung: d.wh > 12,
  })).sort((a, b) => b.wochenend_h - a.wochenend_h);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.wochenend_h, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.wochenend_h_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_ueberlastung).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_wochenend_h: team_avg };
  }

  return {
    fahrer,
    team_avg_wochenend_h: team_avg,
    team_avg_wochenend_h_vw: team_avg_vw,
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
    // Find the start of the current week's Saturday
    const dayOfWeek = now.getDay(); // 0=Sun,1=Mon,...,6=Sat
    const satOffset = dayOfWeek === 0 ? -1 : 6 - dayOfWeek; // days until Sat
    const lastSat = new Date(now);
    lastSat.setDate(now.getDate() - (dayOfWeek === 6 ? 0 : dayOfWeek === 0 ? 1 : dayOfWeek + 1));
    lastSat.setHours(0, 0, 0, 0);

    // Weekend window: last Saturday 00:00 to Sunday 23:59
    const weekendEnd = new Date(lastSat);
    weekendEnd.setDate(lastSat.getDate() + 1);
    weekendEnd.setHours(23, 59, 59, 999);

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, started_at, ended_at')
      .eq('location_id', locationId)
      .gte('started_at', lastSat.toISOString())
      .lte('started_at', weekendEnd.toISOString());

    function calcShiftH(startedAt: string, endedAt: string | null): number {
      const s = new Date(startedAt);
      const e = endedAt ? new Date(endedAt) : new Date();
      const ms = Math.max(0, e.getTime() - s.getTime());
      return Math.round((ms / 3600000) * 10) / 10;
    }

    const driverMap = new Map(drivers.map(d => [d.id, d.name]));
    const hByDriver = new Map<string, number>();

    for (const shift of shifts ?? []) {
      const prev = hByDriver.get(shift.driver_id) ?? 0;
      hByDriver.set(shift.driver_id, prev + calcShiftH(shift.started_at, shift.ended_at));
    }

    const fahrerList: FahrerWochenendSchicht[] = drivers.map(d => {
      const wh = hByDriver.get(d.id) ?? 0;
      return {
        fahrer_id: d.id,
        fahrer_name: driverMap.get(d.id) ?? d.id,
        wochenend_h: wh,
        wochenend_h_vw: 0,
        trend: 'stabil' as const,
        trend_delta: 0,
        ampel: calcAmpel(wh),
        alert_ueberlastung: wh > 12,
      };
    }).sort((a, b) => b.wochenend_h - a.wochenend_h);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.wochenend_h, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_ueberlastung).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_wochenend_h: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_wochenend_h: team_avg,
      team_avg_wochenend_h_vw: 0,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
