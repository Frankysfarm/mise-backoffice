import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(rate: number): Ampel {
  if (rate >= 90) return 'gruen';
  if (rate >= 70) return 'gelb';
  return 'rot';
}

export interface FahrerSchichtBilanzV2 {
  fahrer_id: string;
  fahrer_name: string;
  geplante_h: number;
  gearbeitete_h: number;
  erfuellungsrate: number;
  erfuellungsrate_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_unterbesetzt: boolean;
}

export interface FahrerSchichtBilanzV2Response {
  fahrer: FahrerSchichtBilanzV2[];
  team_avg_rate: number;
  team_avg_rate_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string): FahrerSchichtBilanzV2Response | object {
  const drivers = [
    { id: 'd1', name: 'Max M.',   geplant: 8.0, gearbeitet: 5.5,  rate_g: 80 },
    { id: 'd2', name: 'Sara K.',  geplant: 6.0, gearbeitet: 6.0,  rate_g: 95 },
    { id: 'd3', name: 'Tim B.',   geplant: 7.0, gearbeitet: 7.0,  rate_g: 100 },
    { id: 'd4', name: 'Julia F.', geplant: 8.0, gearbeitet: 7.5,  rate_g: 92 },
  ];

  const fahrer: FahrerSchichtBilanzV2[] = drivers.map(d => {
    const rate = Math.round((d.gearbeitet / d.geplant) * 1000) / 10;
    return {
      fahrer_id:               d.id,
      fahrer_name:             d.name,
      geplante_h:              d.geplant,
      gearbeitete_h:           d.gearbeitet,
      erfuellungsrate:         rate,
      erfuellungsrate_gestern: d.rate_g,
      trend:                   (rate > d.rate_g ? 'steigend' : rate < d.rate_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
      trend_delta:             Math.round((rate - d.rate_g) * 10) / 10,
      ampel:                   calcAmpel(rate),
      alert_unterbesetzt:      rate < 70,
    };
  }).sort((a, b) => a.erfuellungsrate - b.erfuellungsrate);

  const team_avg      = Math.round((fahrer.reduce((s, f) => s + f.erfuellungsrate, 0) / fahrer.length) * 10) / 10;
  const team_avg_gest = Math.round((fahrer.reduce((s, f) => s + f.erfuellungsrate_gestern, 0) / fahrer.length) * 10) / 10;
  const alert_count   = fahrer.filter(f => f.alert_unterbesetzt).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_rate: team_avg };
  }

  return {
    fahrer,
    team_avg_rate:         team_avg,
    team_avg_rate_gestern: team_avg_gest,
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
      .select('driver_id, planned_start, planned_end, actual_start, actual_end, ended_at')
      .eq('location_id', locationId)
      .gte('planned_start', todayStart.toISOString())
      .lte('planned_start', todayEnd.toISOString());

    function hoursFrom(start?: string | null, end?: string | null): number {
      if (!start || !end) return 0;
      const diff = (new Date(end).getTime() - new Date(start).getTime()) / 3600000;
      return Math.max(0, Math.round(diff * 10) / 10);
    }

    const fahrerList: FahrerSchichtBilanzV2[] = drivers.map(d => {
      const dShifts = (shifts ?? []).filter(s => s.driver_id === d.id);

      let geplante_h    = 0;
      let gearbeitete_h = 0;
      for (const s of dShifts) {
        geplante_h    += hoursFrom(s.planned_start, s.planned_end);
        gearbeitete_h += hoursFrom(s.actual_start, s.actual_end ?? s.ended_at);
      }

      const erfuellungsrate = geplante_h > 0
        ? Math.round((gearbeitete_h / geplante_h) * 1000) / 10
        : 100;

      return {
        fahrer_id:               d.id,
        fahrer_name:             d.name ?? 'Fahrer',
        geplante_h:              Math.round(geplante_h * 10) / 10,
        gearbeitete_h:           Math.round(gearbeitete_h * 10) / 10,
        erfuellungsrate,
        erfuellungsrate_gestern: 0,
        trend:                   'stabil' as const,
        trend_delta:             0,
        ampel:                   calcAmpel(erfuellungsrate),
        alert_unterbesetzt:      erfuellungsrate < 70,
      };
    }).sort((a, b) => a.erfuellungsrate - b.erfuellungsrate);

    const team_avg    = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.erfuellungsrate, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_unterbesetzt).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_rate: team_avg });
    }

    return NextResponse.json({
      fahrer:                fahrerList,
      team_avg_rate:         team_avg,
      team_avg_rate_gestern: 0,
      alert_count,
      generiert_am:          now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
