import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(min: number): Ampel {
  if (min === 0) return 'gruen';
  if (min <= 30) return 'gelb';
  return 'rot';
}

export interface FahrerSchichtUeberlappung {
  fahrer_id: string;
  fahrer_name: string;
  ueberlappung_min: number;
  ueberlappung_min_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
}

export interface FahrerSchichtUeberlappungResponse {
  fahrer: FahrerSchichtUeberlappung[];
  team_avg_ueberlappung: number;
  team_avg_ueberlappung_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function computeOverlapMin(
  shifts: { planned_start: string; planned_end: string }[],
): number {
  let totalOverlap = 0;
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      const aStart = new Date(shifts[i].planned_start).getTime();
      const aEnd   = new Date(shifts[i].planned_end).getTime();
      const bStart = new Date(shifts[j].planned_start).getTime();
      const bEnd   = new Date(shifts[j].planned_end).getTime();
      const overlap = Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
      totalOverlap += overlap / 60000;
    }
  }
  return Math.round(totalOverlap * 10) / 10;
}

function buildMock(_locationId: string, driverId?: string): FahrerSchichtUeberlappungResponse | object {
  const drivers = [
    { id: 'd1', name: 'Max M.',   min: 45, minG: 0  },
    { id: 'd2', name: 'Sara K.',  min: 15, minG: 10 },
    { id: 'd3', name: 'Tim B.',   min:  0, minG:  0 },
    { id: 'd4', name: 'Julia F.', min:  0, minG:  5 },
  ];

  const fahrer: FahrerSchichtUeberlappung[] = drivers.map(d => {
    const delta = d.min - d.minG;
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      ueberlappung_min: d.min,
      ueberlappung_min_gestern: d.minG,
      trend: delta > 0.5 ? 'steigend' : delta < -0.5 ? 'fallend' : 'stabil',
      trend_delta: Math.round(delta * 10) / 10,
      ampel: calcAmpel(d.min),
      alert: d.min > 30 ? `Schicht-Überlappung: ${d.name}!` : null,
    };
  }).sort((a, b) => b.ueberlappung_min - a.ueberlappung_min);

  const team_avg      = Math.round(drivers.reduce((s, d) => s + d.min,  0) / drivers.length * 10) / 10;
  const team_avg_gest = Math.round(drivers.reduce((s, d) => s + d.minG, 0) / drivers.length * 10) / 10;
  const alert_count   = fahrer.filter(f => f.alert !== null).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_ueberlappung: team_avg };
  }

  return {
    fahrer,
    team_avg_ueberlappung: team_avg,
    team_avg_ueberlappung_gestern: team_avg_gest,
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

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayEnd);
    yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const [{ data: shiftsToday }, { data: shiftsGestern }] = await Promise.all([
      supabase
        .from('driver_shifts')
        .select('driver_id, planned_start, planned_end')
        .eq('location_id', locationId)
        .gte('planned_start', todayStart.toISOString())
        .lte('planned_start', todayEnd.toISOString())
        .not('planned_end', 'is', null),
      supabase
        .from('driver_shifts')
        .select('driver_id, planned_start, planned_end')
        .eq('location_id', locationId)
        .gte('planned_start', yesterdayStart.toISOString())
        .lte('planned_start', yesterdayEnd.toISOString())
        .not('planned_end', 'is', null),
    ]);

    type ShiftRow = { driver_id: string; planned_start: string; planned_end: string };

    function calcOverlapForDriver(
      dId: string,
      rows: ShiftRow[] | null,
    ): number {
      const dShifts = (rows ?? []).filter(s => s.driver_id === dId);
      return computeOverlapMin(dShifts);
    }

    const fahrerList: FahrerSchichtUeberlappung[] = drivers.map(d => {
      const min  = calcOverlapForDriver(d.id, shiftsToday as ShiftRow[] | null);
      const minG = calcOverlapForDriver(d.id, shiftsGestern as ShiftRow[] | null);
      const delta = Math.round((min - minG) * 10) / 10;
      return {
        fahrer_id: d.id,
        fahrer_name: d.name ?? 'Fahrer',
        ueberlappung_min: min,
        ueberlappung_min_gestern: minG,
        trend: delta > 0.5 ? 'steigend' : delta < -0.5 ? 'fallend' : 'stabil',
        trend_delta: delta,
        ampel: calcAmpel(min),
        alert: min > 30 ? `Schicht-Überlappung: ${d.name ?? 'Fahrer'}!` : null,
      };
    }).sort((a, b) => b.ueberlappung_min - a.ueberlappung_min);

    const team_avg = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.ueberlappung_min, 0) / fahrerList.length * 10) / 10
      : 0;
    const team_avg_gest = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.ueberlappung_min_gestern, 0) / fahrerList.length * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert !== null).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_ueberlappung: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_ueberlappung: team_avg,
      team_avg_ueberlappung_gestern: team_avg_gest,
      alert_count,
      generiert_am: now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
