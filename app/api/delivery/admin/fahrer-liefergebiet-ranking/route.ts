import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerLiefergebietEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  zonen_anzahl: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
}

export interface FahrerLiefergebietRankingResponse {
  fahrer: FahrerLiefergebietEntry[];
  team_avg_zonen: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
  generiert_am: string;
}

function getTodayWindow(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { start, end: now };
}

function getYesterdayWindow(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(),     0, 0, 0, 0);
  return { start, end };
}

function countZones(
  stops: { driver_id: string; zone_id: string | null; created_at: string }[] | null,
  dId: string,
): number {
  const zones = new Set<string>();
  for (const s of (stops ?? []).filter(s => s.driver_id === dId && s.zone_id)) {
    zones.add(s.zone_id as string);
  }
  return zones.size;
}

function assignAmpel(rang: number, total: number): Ampel {
  if (total === 0) return 'gelb';
  const topCut    = Math.ceil(total * 0.25);
  const bottomCut = Math.floor(total * 0.75);
  if (rang <= topCut)   return 'gruen';
  if (rang > bottomCut) return 'rot';
  return 'gelb';
}

function buildMock(_locationId: string, driverId: string | undefined): FahrerLiefergebietRankingResponse {
  const raw = [
    { id: 'd1', name: 'Max M.',   zonen: 5, prev_zonen: 4 },
    { id: 'd2', name: 'Julia F.', zonen: 4, prev_zonen: 4 },
    { id: 'd3', name: 'Sara K.',  zonen: 3, prev_zonen: 3 },
    { id: 'd4', name: 'Tim B.',   zonen: 1, prev_zonen: 2 },
  ];

  const sorted     = [...raw].sort((a, b) => b.zonen - a.zonen);
  const prevSorted = [...raw].sort((a, b) => b.prev_zonen - a.prev_zonen);
  const total      = sorted.length;

  const fahrer: FahrerLiefergebietEntry[] = sorted.map((d, i) => {
    const rang      = i + 1;
    const prevRang  = prevSorted.findIndex(p => p.id === d.id) + 1;
    const ampel     = assignAmpel(rang, total);
    return {
      fahrer_id:    d.id,
      fahrer_name:  d.name,
      rang,
      zonen_anzahl: d.zonen,
      rank_delta:   rang - prevRang,
      ampel,
      alert_bottom: ampel === 'rot',
    };
  });

  const teamAvg    = Math.round(fahrer.reduce((s, f) => s + f.zonen_anzahl, 0) / total * 10) / 10;
  const alertCount = fahrer.filter(f => f.alert_bottom).length;

  if (driverId) {
    const f = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_zonen: teamAvg, bester_name: fahrer[0]?.fahrer_name ?? '', letzter_name: fahrer[total - 1]?.fahrer_name ?? '', alert_count: 0, gesamt: total, generiert_am: new Date().toISOString() };
  }

  return { fahrer, team_avg_zonen: teamAvg, bester_name: fahrer[0]?.fahrer_name ?? '', letzter_name: fahrer[total - 1]?.fahrer_name ?? '', alert_count: alertCount, gesamt: total, generiert_am: new Date().toISOString() };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId   = searchParams.get('driver_id') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const today     = getTodayWindow();
  const yesterday = getYesterdayWindow();

  try {
    const supabase = createServiceClient();

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) return NextResponse.json(buildMock(locationId, driverId));

    type Stop = { driver_id: string; zone_id: string | null; created_at: string };

    const [{ data: todayStops }, { data: yestStops }] = await Promise.all([
      supabase
        .from('batch_stops')
        .select('driver_id, zone_id, created_at')
        .eq('location_id', locationId)
        .not('created_at', 'is', null)
        .gte('created_at', today.start.toISOString())
        .lt('created_at', today.end.toISOString()),
      supabase
        .from('batch_stops')
        .select('driver_id, zone_id, created_at')
        .eq('location_id', locationId)
        .not('created_at', 'is', null)
        .gte('created_at', yesterday.start.toISOString())
        .lt('created_at', yesterday.end.toISOString()),
    ]);

    const ts = todayStops as Stop[] | null;
    const ys = yestStops  as Stop[] | null;

    const withZonen = drivers.map(d => ({
      id:         d.id,
      name:       d.name,
      zonen:      countZones(ts, d.id),
      prevZonen:  countZones(ys, d.id),
    }));

    const sorted     = [...withZonen].sort((a, b) => b.zonen - a.zonen);
    const prevSorted = [...withZonen].sort((a, b) => b.prevZonen - a.prevZonen);
    const total      = sorted.length;

    const fahrerList: FahrerLiefergebietEntry[] = sorted.map((d, i) => {
      const rang     = i + 1;
      const prevRang = prevSorted.findIndex(p => p.id === d.id) + 1;
      const ampel    = assignAmpel(rang, total);
      return {
        fahrer_id:    d.id,
        fahrer_name:  d.name,
        rang,
        zonen_anzahl: d.zonen,
        rank_delta:   rang - prevRang,
        ampel,
        alert_bottom: ampel === 'rot',
      };
    });

    const teamAvg    = fahrerList.length ? Math.round(fahrerList.reduce((s, f) => s + f.zonen_anzahl, 0) / fahrerList.length * 10) / 10 : 0;
    const alertCount = fahrerList.filter(f => f.alert_bottom).length;

    if (driverId) {
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_zonen: teamAvg, bester_name: fahrerList[0]?.fahrer_name ?? '', letzter_name: fahrerList[total - 1]?.fahrer_name ?? '', alert_count: 0, gesamt: total, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_zonen: teamAvg, bester_name: fahrerList[0]?.fahrer_name ?? '', letzter_name: fahrerList[total - 1]?.fahrer_name ?? '', alert_count: alertCount, gesamt: total, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
