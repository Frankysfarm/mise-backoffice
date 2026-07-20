import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

function calcAmpel(ruhe_h: number): Ampel {
  if (ruhe_h >= 11) return 'gruen';
  if (ruhe_h >= 8)  return 'gelb';
  return 'rot';
}

export interface FahrerRuhezeit {
  fahrer_id: string;
  fahrer_name: string;
  ruhe_h: number;
  ruhe_h_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: Ampel;
  alert_zu_kurz: boolean;
}

export interface FahrerRuhezeitenResponse {
  fahrer: FahrerRuhezeit[];
  team_avg_ruhe_h: number;
  team_avg_ruhe_h_gestern: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   ruhe: 6.5,  ruhe_g: 12.0 },
    { id: 'd2', name: 'Sara K.',  ruhe: 9.5,  ruhe_g: 10.0 },
    { id: 'd3', name: 'Tim B.',   ruhe: 13.0, ruhe_g: 11.5 },
    { id: 'd4', name: 'Julia F.', ruhe: 7.0,  ruhe_g: 9.0  },
  ];

  const fahrer: FahrerRuhezeit[] = drivers.map(d => ({
    fahrer_id:     d.id,
    fahrer_name:   d.name,
    ruhe_h:        d.ruhe,
    ruhe_h_gestern: d.ruhe_g,
    trend:         (d.ruhe > d.ruhe_g ? 'steigend' : d.ruhe < d.ruhe_g ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
    trend_delta:   Math.round((d.ruhe - d.ruhe_g) * 10) / 10,
    ampel:         calcAmpel(d.ruhe),
    alert_zu_kurz: d.ruhe < 8,
  })).sort((a, b) => a.ruhe_h - b.ruhe_h);

  const team_avg      = Math.round((fahrer.reduce((s, f) => s + f.ruhe_h, 0) / fahrer.length) * 10) / 10;
  const team_avg_gest = Math.round((fahrer.reduce((s, f) => s + f.ruhe_h_gestern, 0) / fahrer.length) * 10) / 10;
  const alert_count   = fahrer.filter(f => f.alert_zu_kurz).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_ruhe_h: team_avg };
  }

  return {
    fahrer,
    team_avg_ruhe_h:        team_avg,
    team_avg_ruhe_h_gestern: team_avg_gest,
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

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    // Get the most recent ended shift per driver
    const { data: shifts } = await supabase
      .from('driver_shifts')
      .select('driver_id, actual_end, ended_at')
      .eq('location_id', locationId)
      .not('actual_end', 'is', null)
      .order('actual_end', { ascending: false });

    const lastEndByDriver = new Map<string, string>();
    for (const shift of shifts ?? []) {
      const end = shift.actual_end ?? shift.ended_at;
      if (!end) continue;
      if (!lastEndByDriver.has(shift.driver_id)) {
        lastEndByDriver.set(shift.driver_id, end);
      }
    }

    const fahrerList: FahrerRuhezeit[] = drivers.map(d => {
      const lastEnd = lastEndByDriver.get(d.id);
      const ruhe_h  = lastEnd
        ? Math.round(((now.getTime() - new Date(lastEnd).getTime()) / 3600000) * 10) / 10
        : 24; // no previous shift → assume well-rested

      return {
        fahrer_id:      d.id,
        fahrer_name:    d.name,
        ruhe_h,
        ruhe_h_gestern: 0,
        trend:          'stabil' as const,
        trend_delta:    0,
        ampel:          calcAmpel(ruhe_h),
        alert_zu_kurz:  ruhe_h < 8,
      };
    }).sort((a, b) => a.ruhe_h - b.ruhe_h);

    const team_avg  = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.ruhe_h, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_zu_kurz).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_ruhe_h: team_avg });
    }

    return NextResponse.json({
      fahrer:                  fahrerList,
      team_avg_ruhe_h:         team_avg,
      team_avg_ruhe_h_gestern: 0,
      alert_count,
      generiert_am:            now.toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
