import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(wechsel: number): Ampel {
  if (wechsel === 1) return 'gruen';
  if (wechsel === 2) return 'gelb';
  return 'rot'; // 0, >=3
}

function alertText(wechsel: number): string | null {
  if (wechsel >= 3) return 'Zu viele Schichtwechsel!';
  if (wechsel === 0) return 'Keine Schicht!';
  return null;
}

export interface FahrerSchichtWechsel {
  fahrer_id: string;
  fahrer_name: string;
  wechsel_anzahl: number;
  wechsel_anzahl_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert: string | null;
}

export interface FahrerSchichtWechselResponse {
  fahrer: FahrerSchichtWechsel[];
  team_avg_wechsel: number;
  team_avg_wechsel_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string): FahrerSchichtWechselResponse | object {
  const drivers = [
    { id: 'd1', name: 'Max M.',   w: 3, wg: 1 },
    { id: 'd2', name: 'Sara K.',  w: 1, wg: 1 },
    { id: 'd3', name: 'Tim B.',   w: 2, wg: 1 },
    { id: 'd4', name: 'Julia F.', w: 0, wg: 1 },
  ];

  const fahrer: FahrerSchichtWechsel[] = drivers.map(d => ({
    fahrer_id:             d.id,
    fahrer_name:           d.name,
    wechsel_anzahl:        d.w,
    wechsel_anzahl_gestern: d.wg,
    trend:                 (d.w > d.wg ? 'steigend' : d.w < d.wg ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
    trend_delta:           d.w - d.wg,
    ampel:                 calcAmpel(d.w),
    alert:                 alertText(d.w),
  })).sort((a, b) => b.wechsel_anzahl - a.wechsel_anzahl);

  const team_avg      = Math.round(drivers.reduce((s, d) => s + d.w,  0) / drivers.length);
  const team_avg_gest = Math.round(drivers.reduce((s, d) => s + d.wg, 0) / drivers.length);
  const alert_count   = fahrer.filter(f => f.alert !== null).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_wechsel: team_avg };
  }

  return {
    fahrer,
    team_avg_wechsel:        team_avg,
    team_avg_wechsel_gestern: team_avg_gest,
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

    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, actual_start, planned_start')
      .eq('location_id', locationId)
      .gte('planned_start', todayStart.toISOString())
      .lte('planned_start', todayEnd.toISOString());

    const fahrerList: FahrerSchichtWechsel[] = drivers.map(d => {
      const dShifts = (shifts ?? []).filter(s => s.driver_id === d.id);
      const wechsel_anzahl = dShifts.length;

      return {
        fahrer_id:              d.id,
        fahrer_name:            d.name ?? 'Fahrer',
        wechsel_anzahl,
        wechsel_anzahl_gestern: 0,
        trend:                  'stabil' as const,
        trend_delta:            0,
        ampel:                  calcAmpel(wechsel_anzahl),
        alert:                  alertText(wechsel_anzahl),
      };
    }).sort((a, b) => b.wechsel_anzahl - a.wechsel_anzahl);

    const team_avg    = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.wechsel_anzahl, 0) / fahrerList.length)
      : 0;
    const alert_count = fahrerList.filter(f => f.alert !== null).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_wechsel: team_avg });
    }

    return NextResponse.json({
      fahrer:                  fahrerList,
      team_avg_wechsel:        team_avg,
      team_avg_wechsel_gestern: 0,
      alert_count,
      generiert_am:            now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
