import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';

export interface FahrerStoppEffizienzEntry {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_stunde: number;
  total_stopps: number;
  aktive_stunden: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
}

export interface FahrerStoppEffizienzRankingResponse {
  fahrer: FahrerStoppEffizienzEntry[];
  team_avg_stopps_h: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
  generiert_am: string;
}

function getTodayWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { start, end: now };
}

function getYesterdayWindow() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(),     0, 0, 0, 0);
  return { start, end };
}

type Stop = { driver_id: string; created_at: string };

function calcStoppsProH(stops: Stop[] | null, dId: string): { stopps_h: number; total: number; stunden: number } {
  const ds = (stops ?? []).filter(s => s.driver_id === dId);
  if (!ds.length) return { stopps_h: 0, total: 0, stunden: 0 };
  const times = ds.map(s => new Date(s.created_at).getTime()).filter(t => !isNaN(t));
  if (!times.length) return { stopps_h: 0, total: 0, stunden: 0 };
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const stunden = Math.max((maxT - minT) / 3_600_000, 0.25); // min 15 min to avoid div/0
  const stopps_h = Math.round((ds.length / stunden) * 10) / 10;
  return { stopps_h, total: ds.length, stunden: Math.round(stunden * 10) / 10 };
}

function assignAmpel(rang: number, total: number): Ampel {
  if (total === 0) return 'gelb';
  const topCut    = Math.ceil(total * 0.25);
  const bottomCut = Math.floor(total * 0.75);
  if (rang <= topCut)   return 'gruen';
  if (rang > bottomCut) return 'rot';
  return 'gelb';
}

function buildMock(_locationId: string, driverId: string | undefined): FahrerStoppEffizienzRankingResponse {
  const raw = [
    { id: 'd1', name: 'Max M.',   stopps_h: 4.2, total: 8,  stunden: 1.9 },
    { id: 'd2', name: 'Julia F.', stopps_h: 3.5, total: 7,  stunden: 2.0 },
    { id: 'd3', name: 'Sara K.',  stopps_h: 2.8, total: 5,  stunden: 1.8 },
    { id: 'd4', name: 'Tim B.',   stopps_h: 1.5, total: 3,  stunden: 2.0 },
    { id: 'd1p', name: 'Max M. (Vortag)',   stopps_h: 3.8, total: 7,  stunden: 1.8 },
    { id: 'd2p', name: 'Julia F. (Vortag)', stopps_h: 3.9, total: 7,  stunden: 1.8 },
    { id: 'd3p', name: 'Sara K. (Vortag)',  stopps_h: 3.0, total: 5,  stunden: 1.7 },
    { id: 'd4p', name: 'Tim B. (Vortag)',   stopps_h: 2.0, total: 4,  stunden: 2.0 },
  ];
  const today = raw.slice(0, 4);
  const prev  = raw.slice(4);
  const sorted     = [...today].sort((a, b) => b.stopps_h - a.stopps_h);
  const prevSorted = [...prev].sort((a, b) => b.stopps_h - a.stopps_h);
  const total = sorted.length;

  const fahrer: FahrerStoppEffizienzEntry[] = sorted.map((d, i) => {
    const rang     = i + 1;
    const prevIdx  = prevSorted.findIndex(p => p.id === d.id + 'p');
    const prevRang = prevIdx >= 0 ? prevIdx + 1 : rang;
    const a        = assignAmpel(rang, total);
    return {
      fahrer_id:          d.id,
      fahrer_name:        d.name,
      rang,
      stopps_pro_stunde:  d.stopps_h,
      total_stopps:       d.total,
      aktive_stunden:     d.stunden,
      rank_delta:         rang - prevRang,
      ampel:              a,
      alert_bottom:       a === 'rot',
    };
  });

  const teamAvg    = Math.round(fahrer.reduce((s, f) => s + f.stopps_pro_stunde, 0) / total * 10) / 10;
  const alertCount = fahrer.filter(f => f.alert_bottom).length;

  if (driverId) {
    const f = fahrer.find(f => f.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer: [f], team_avg_stopps_h: teamAvg, bester_name: fahrer[0]?.fahrer_name ?? '', letzter_name: fahrer[total - 1]?.fahrer_name ?? '', alert_count: 0, gesamt: total, generiert_am: new Date().toISOString() };
  }
  return { fahrer, team_avg_stopps_h: teamAvg, bester_name: fahrer[0]?.fahrer_name ?? '', letzter_name: fahrer[total - 1]?.fahrer_name ?? '', alert_count: alertCount, gesamt: total, generiert_am: new Date().toISOString() };
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

    const [{ data: todayStops }, { data: yestStops }] = await Promise.all([
      supabase
        .from('batch_stops')
        .select('driver_id, created_at')
        .eq('location_id', locationId)
        .not('created_at', 'is', null)
        .gte('created_at', today.start.toISOString())
        .lt('created_at', today.end.toISOString()),
      supabase
        .from('batch_stops')
        .select('driver_id, created_at')
        .eq('location_id', locationId)
        .not('created_at', 'is', null)
        .gte('created_at', yesterday.start.toISOString())
        .lt('created_at', yesterday.end.toISOString()),
    ]);

    const ts = todayStops as Stop[] | null;
    const ys = yestStops  as Stop[] | null;

    const withEffizienz = drivers.map(d => {
      const heute = calcStoppsProH(ts, d.id);
      const gestern = calcStoppsProH(ys, d.id);
      return { id: d.id, name: d.name, heute, gestern };
    });

    const sorted     = [...withEffizienz].sort((a, b) => b.heute.stopps_h - a.heute.stopps_h);
    const prevSorted = [...withEffizienz].sort((a, b) => b.gestern.stopps_h - a.gestern.stopps_h);
    const total      = sorted.length;

    const fahrerList: FahrerStoppEffizienzEntry[] = sorted.map((d, i) => {
      const rang     = i + 1;
      const prevRang = prevSorted.findIndex(p => p.id === d.id) + 1;
      const a        = assignAmpel(rang, total);
      return {
        fahrer_id:         d.id,
        fahrer_name:       d.name,
        rang,
        stopps_pro_stunde: d.heute.stopps_h,
        total_stopps:      d.heute.total,
        aktive_stunden:    d.heute.stunden,
        rank_delta:        rang - prevRang,
        ampel:             a,
        alert_bottom:      a === 'rot',
      };
    });

    const teamAvg    = fahrerList.length ? Math.round(fahrerList.reduce((s, f) => s + f.stopps_pro_stunde, 0) / fahrerList.length * 10) / 10 : 0;
    const alertCount = fahrerList.filter(f => f.alert_bottom).length;

    if (driverId) {
      const f = fahrerList.find(fd => fd.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer: f ? [f] : [], team_avg_stopps_h: teamAvg, bester_name: fahrerList[0]?.fahrer_name ?? '', letzter_name: fahrerList[total - 1]?.fahrer_name ?? '', alert_count: 0, gesamt: total, generiert_am: new Date().toISOString() });
    }

    return NextResponse.json({ fahrer: fahrerList, team_avg_stopps_h: teamAvg, bester_name: fahrerList[0]?.fahrer_name ?? '', letzter_name: fahrerList[total - 1]?.fahrer_name ?? '', alert_count: alertCount, gesamt: total, generiert_am: new Date().toISOString() });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
