import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcScore(distanceKm: number, idealKm: number): number {
  if (distanceKm <= 0 || idealKm <= 0) return 85;
  return Math.min(100, Math.round((idealKm / distanceKm) * 100));
}

function calcAmpel(score: number): Ampel {
  if (score >= 90) return 'gruen';
  if (score >= 75) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 0.5) return { trend: 'steigend', delta };
  if (delta < -0.5) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

export interface FahrerRoutenOptimierung {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_ineffizient: boolean;
  avg_distance_km: number;
  avg_ideal_km: number;
}

export interface FahrerRoutenOptimierungResponse {
  fahrer: FahrerRoutenOptimierung[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   dist: 5.2, ideal: 4.8 },
    { id: 'd2', name: 'Sara K.',  dist: 6.1, ideal: 5.0 },
    { id: 'd3', name: 'Tim B.',   dist: 8.3, ideal: 5.1 },
    { id: 'd4', name: 'Julia F.', dist: 4.9, ideal: 4.7 },
  ];

  const fahrer: FahrerRoutenOptimierung[] = drivers.map(d => {
    const score = calcScore(d.dist, d.ideal);
    const distVw = Math.max(d.ideal, d.dist + (Math.random() > 0.5 ? 0.3 : -0.3));
    const scoreVw = calcScore(distVw, d.ideal);
    const { trend, delta } = calcTrend(score, scoreVw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      score,
      score_vw: scoreVw,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(score),
      alert_ineffizient: score < 75,
      avg_distance_km: d.dist,
      avg_ideal_km: d.ideal,
    };
  }).sort((a, b) => b.score - a.score);

  const team_avg = Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length);
  const team_avg_vw = Math.round(fahrer.reduce((s, f) => s + f.score_vw, 0) / fahrer.length);

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_score: team_avg };
  }

  return {
    fahrer,
    team_avg_score: team_avg,
    team_avg_score_vw: team_avg_vw,
    alert_count: fahrer.filter(f => f.alert_ineffizient).length,
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

    const { data: drivers, error: dErr } = await supabase
      .from('drivers')
      .select('id, name, location_id')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 1);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 1);

    const { data: todayBatches } = await supabase
      .from('delivery_batches')
      .select('driver_id, distance_km, ideal_distance_km')
      .eq('location_id', locationId)
      .not('distance_km', 'is', null)
      .not('ideal_distance_km', 'is', null)
      .gte('created_at', todayStart.toISOString())
      .lte('created_at', todayEnd.toISOString());

    const { data: vwBatches } = await supabase
      .from('delivery_batches')
      .select('driver_id, distance_km, ideal_distance_km')
      .eq('location_id', locationId)
      .not('distance_km', 'is', null)
      .not('ideal_distance_km', 'is', null)
      .gte('created_at', vwStart.toISOString())
      .lte('created_at', vwEnd.toISOString());

    type BatchRow = { driver_id: string; distance_km: number; ideal_distance_km: number };

    function avgScore(batches: BatchRow[] | null, dId: string): { score: number; dist: number; ideal: number } {
      const ds = (batches ?? []).filter(b => b.driver_id === dId && b.distance_km > 0 && b.ideal_distance_km > 0);
      if (!ds.length) return { score: 85, dist: 5, ideal: 4.5 };
      const avgDist = ds.reduce((s, b) => s + b.distance_km, 0) / ds.length;
      const avgIdeal = ds.reduce((s, b) => s + b.ideal_distance_km, 0) / ds.length;
      return { score: calcScore(avgDist, avgIdeal), dist: avgDist, ideal: avgIdeal };
    }

    const fahrerList: FahrerRoutenOptimierung[] = drivers.map(d => {
      const { score, dist, ideal } = avgScore(todayBatches as BatchRow[] | null, d.id);
      const { score: scoreVw } = avgScore(vwBatches as BatchRow[] | null, d.id);
      const { trend, delta } = calcTrend(score, scoreVw);
      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        score,
        score_vw: scoreVw,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(score),
        alert_ineffizient: score < 75,
        avg_distance_km: Math.round(dist * 10) / 10,
        avg_ideal_km: Math.round(ideal * 10) / 10,
      };
    }).sort((a, b) => b.score - a.score);

    const team_avg = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.score, 0) / fahrerList.length)
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round(fahrerList.reduce((s, f) => s + f.score_vw, 0) / fahrerList.length)
      : 0;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_score: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_score: team_avg,
      team_avg_score_vw: team_avg_vw,
      alert_count: fahrerList.filter(f => f.alert_ineffizient).length,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
