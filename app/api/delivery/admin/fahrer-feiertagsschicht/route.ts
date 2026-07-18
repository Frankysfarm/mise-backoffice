import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(h: number): Ampel {
  if (h === 0) return 'gruen';
  if (h <= 8) return 'gelb';
  return 'rot';
}

export interface FahrerFeiertagsschicht {
  fahrer_id: string;
  fahrer_name: string;
  feiertag_h: number;
  feiertag_h_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_ueberlastung: boolean;
}

export interface FahrerFeiertagsschichtResponse {
  fahrer: FahrerFeiertagsschicht[];
  team_avg_feiertag_h: number;
  team_avg_feiertag_h_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   fh: 9.5,  fh_vw: 8.0  },
    { id: 'd2', name: 'Sara K.',  fh: 5.0,  fh_vw: 4.5  },
    { id: 'd3', name: 'Tim B.',   fh: 0.0,  fh_vw: 2.0  },
    { id: 'd4', name: 'Julia F.', fh: 7.5,  fh_vw: 8.0  },
  ];

  const fahrer: FahrerFeiertagsschicht[] = drivers.map(d => ({
    fahrer_id: d.id,
    fahrer_name: d.name,
    feiertag_h: d.fh,
    feiertag_h_vw: d.fh_vw,
    trend: d.fh > d.fh_vw ? 'steigend' : d.fh < d.fh_vw ? 'fallend' : 'stabil',
    trend_delta: Math.round((d.fh - d.fh_vw) * 10) / 10,
    ampel: calcAmpel(d.fh),
    alert_ueberlastung: d.fh > 8,
  })).sort((a, b) => b.feiertag_h - a.feiertag_h);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.feiertag_h, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.feiertag_h_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_ueberlastung).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_feiertag_h: team_avg };
  }

  return {
    fahrer,
    team_avg_feiertag_h: team_avg,
    team_avg_feiertag_h_vw: team_avg_vw,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

// German public holidays (fixed dates for current year)
function getFeiertagsWindows(): { start: Date; end: Date }[] {
  const year = new Date().getFullYear();
  const fixed = [
    [1, 1], [5, 1], [10, 3], [11, 1], [12, 25], [12, 26],
  ]; // month (1-based), day
  const windows: { start: Date; end: Date }[] = [];
  for (const [m, d] of fixed) {
    const start = new Date(year, m - 1, d, 0, 0, 0, 0);
    const end = new Date(year, m - 1, d, 23, 59, 59, 999);
    windows.push({ start, end });
  }
  return windows;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const windows = getFeiertagsWindows();

    function calcShiftH(startedAt: string, endedAt: string | null): number {
      const s = new Date(startedAt);
      const e = endedAt ? new Date(endedAt) : new Date();
      const ms = Math.max(0, e.getTime() - s.getTime());
      return Math.round((ms / 3600000) * 10) / 10;
    }

    const hByDriver = new Map<string, number>();

    for (const w of windows) {
      const { data: shifts } = await supabase
        .from('driver_shifts')
        .select('driver_id, started_at, ended_at')
        .eq('location_id', locationId)
        .gte('started_at', w.start.toISOString())
        .lte('started_at', w.end.toISOString());

      for (const shift of shifts ?? []) {
        const prev = hByDriver.get(shift.driver_id) ?? 0;
        hByDriver.set(shift.driver_id, prev + calcShiftH(shift.started_at, shift.ended_at));
      }
    }

    const driverMap = new Map(drivers.map(d => [d.id, d.name]));

    const fahrerList: FahrerFeiertagsschicht[] = drivers.map(d => {
      const fh = Math.round((hByDriver.get(d.id) ?? 0) * 10) / 10;
      return {
        fahrer_id: d.id,
        fahrer_name: driverMap.get(d.id) ?? d.id,
        feiertag_h: fh,
        feiertag_h_vw: 0,
        trend: 'stabil' as const,
        trend_delta: 0,
        ampel: calcAmpel(fh),
        alert_ueberlastung: fh > 8,
      };
    }).sort((a, b) => b.feiertag_h - a.feiertag_h);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.feiertag_h, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_ueberlastung).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_feiertag_h: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_feiertag_h: team_avg,
      team_avg_feiertag_h_vw: 0,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
