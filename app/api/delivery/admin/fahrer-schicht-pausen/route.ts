import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(min: number): Ampel {
  if (min >= 20 && min <= 40) return 'gruen';
  if ((min >= 10 && min < 20) || (min > 40 && min <= 60)) return 'gelb';
  return 'rot';
}

function alertText(min: number): string | null {
  if (min < 10)  return 'Zu wenig Pause!';
  if (min > 60)  return 'Zu lange Pause!';
  return null;
}

function deviation(min: number): number {
  if (min >= 20 && min <= 40) return 0;
  if (min < 20) return 20 - min;
  return min - 40;
}

export interface FahrerSchichtPause {
  fahrer_id: string;
  fahrer_name: string;
  pausen_min: number;
  pausen_min_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
}

export interface FahrerSchichtPausenResponse {
  fahrer: FahrerSchichtPause[];
  team_avg_min: number;
  team_avg_min_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string): FahrerSchichtPausenResponse | object {
  const drivers = [
    { id: 'd1', name: 'Max M.',   min: 7,  min_g: 25 },
    { id: 'd2', name: 'Sara K.',  min: 30, min_g: 28 },
    { id: 'd3', name: 'Tim B.',   min: 22, min_g: 20 },
    { id: 'd4', name: 'Julia F.', min: 75, min_g: 35 },
  ];

  const fahrer: FahrerSchichtPause[] = drivers.map(d => ({
    fahrer_id:          d.id,
    fahrer_name:        d.name,
    pausen_min:         d.min,
    pausen_min_gestern: d.min_g,
    trend:              (d.min > d.min_g ? 'steigend' : d.min < d.min_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
    trend_delta:        d.min - d.min_g,
    ampel:              calcAmpel(d.min),
    alert:              alertText(d.min),
  })).sort((a, b) => deviation(b.pausen_min) - deviation(a.pausen_min));

  const team_avg      = Math.round(drivers.reduce((s, d) => s + d.min, 0) / drivers.length);
  const team_avg_gest = Math.round(drivers.reduce((s, d) => s + d.min_g, 0) / drivers.length);
  const alert_count   = fahrer.filter(f => f.alert !== null).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_min: team_avg };
  }

  return {
    fahrer,
    team_avg_min:         team_avg,
    team_avg_min_gestern: team_avg_gest,
    alert_count,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

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

    const { data: breaks } = await supabase
      .from('driver_shift_breaks')
      .select('driver_id, started_at, ended_at')
      .eq('location_id', locationId)
      .gte('started_at', todayStart.toISOString())
      .lte('started_at', todayEnd.toISOString());

    function minutesFrom(start?: string | null, end?: string | null): number {
      if (!start || !end) return 0;
      const diff = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      return Math.max(0, Math.round(diff));
    }

    const fahrerList: FahrerSchichtPause[] = drivers.map(d => {
      const dBreaks = (breaks ?? []).filter(b => b.driver_id === d.id);
      const pausen_min = dBreaks.reduce((s, b) => s + minutesFrom(b.started_at, b.ended_at), 0);

      return {
        fahrer_id:          d.id,
        fahrer_name:        d.name ?? 'Fahrer',
        pausen_min,
        pausen_min_gestern: 0,
        trend:              'stabil' as const,
        trend_delta:        0,
        ampel:              calcAmpel(pausen_min),
        alert:              alertText(pausen_min),
      };
    }).sort((a, b) => deviation(b.pausen_min) - deviation(a.pausen_min));

    const team_avg    = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.pausen_min, 0) / fahrerList.length)
      : 0;
    const alert_count = fahrerList.filter(f => f.alert !== null).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_min: team_avg });
    }

    return NextResponse.json({
      fahrer:               fahrerList,
      team_avg_min:         team_avg,
      team_avg_min_gestern: 0,
      alert_count,
      generiert_am:         now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
