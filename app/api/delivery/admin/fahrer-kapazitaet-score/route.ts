import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

function calcAmpel(score: number): Ampel {
  if (score >= 80) return 'gruen';
  if (score >= 60) return 'gelb';
  return 'rot';
}

function calcTrend(curr: number, prev: number): { trend: Trend; delta: number } {
  const delta = Math.round((curr - prev) * 10) / 10;
  if (delta > 2) return { trend: 'steigend', delta };
  if (delta < -2) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

// Kapazitäts-Score: Wie viel % der max. Kapazität (Touren/Schicht) wird genutzt?
// Ziel: ≥80% (gut ausgelastet), <60% = Unterauslastung
function calcKapazitaetScore(deliveredToday: number, maxKapazitaet: number): number {
  if (maxKapazitaet <= 0) return 0;
  return Math.min(100, Math.round((deliveredToday / maxKapazitaet) * 1000) / 10);
}

export interface FahrerKapazitaetScore {
  fahrer_id: string;
  fahrer_name: string;
  kapazitaet_score: number;
  kapazitaet_score_vw: number;
  touren_heute: number;
  max_kapazitaet: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
  alert_unterauslastung: boolean;
}

export interface FahrerKapazitaetScoreResponse {
  fahrer: FahrerKapazitaetScore[];
  team_avg_score: number;
  team_avg_score_vw: number;
  alert_count: number;
  generiert_am: string;
}

function buildMock(_locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.',   touren: 18, kapazitaet: 20 },
    { id: 'd2', name: 'Sara K.',  touren: 11, kapazitaet: 20 },
    { id: 'd3', name: 'Tim B.',   touren: 8,  kapazitaet: 20 },
    { id: 'd4', name: 'Julia F.', touren: 17, kapazitaet: 20 },
  ];

  const fahrer: FahrerKapazitaetScore[] = drivers.map(d => {
    const score = calcKapazitaetScore(d.touren, d.kapazitaet);
    const touren_vw = Math.max(0, d.touren + (Math.random() > 0.5 ? 2 : -2));
    const score_vw = calcKapazitaetScore(touren_vw, d.kapazitaet);
    const { trend, delta } = calcTrend(score, score_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      kapazitaet_score: score,
      kapazitaet_score_vw: score_vw,
      touren_heute: d.touren,
      max_kapazitaet: d.kapazitaet,
      trend,
      trend_delta: delta,
      ampel: calcAmpel(score),
      alert_unterauslastung: score < 60,
    };
  }).sort((a, b) => b.kapazitaet_score - a.kapazitaet_score);

  const team_avg = Math.round((fahrer.reduce((s, f) => s + f.kapazitaet_score, 0) / fahrer.length) * 10) / 10;
  const team_avg_vw = Math.round((fahrer.reduce((s, f) => s + f.kapazitaet_score_vw, 0) / fahrer.length) * 10) / 10;
  const alert_count = fahrer.filter(f => f.alert_unterauslastung).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_score: team_avg };
  }

  return { fahrer, team_avg_score: team_avg, team_avg_score_vw: team_avg_vw, alert_count, generiert_am: new Date().toISOString() };
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
      .select('id, name, location_id, max_daily_deliveries')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (dErr || !drivers?.length) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const vwStart = new Date(todayStart); vwStart.setDate(vwStart.getDate() - 7);
    const vwEnd = new Date(todayEnd); vwEnd.setDate(vwEnd.getDate() - 7);

    const { data: batchesToday } = await supabase
      .from('batches')
      .select('id, driver_id, completed_at')
      .eq('location_id', locationId)
      .not('completed_at', 'is', null)
      .gte('completed_at', todayStart.toISOString())
      .lte('completed_at', todayEnd.toISOString());

    const { data: batchesVw } = await supabase
      .from('batches')
      .select('id, driver_id, completed_at')
      .eq('location_id', locationId)
      .not('completed_at', 'is', null)
      .gte('completed_at', vwStart.toISOString())
      .lte('completed_at', vwEnd.toISOString());

    function countBatches(batches: { driver_id: string }[] | null, dId: string): number {
      return (batches ?? []).filter(b => b.driver_id === dId).length;
    }

    const DEFAULT_MAX_KAPAZITAET = 20;

    const fahrerList: FahrerKapazitaetScore[] = drivers.map(d => {
      const maxKap = (d as { max_daily_deliveries?: number }).max_daily_deliveries ?? DEFAULT_MAX_KAPAZITAET;
      const touren = countBatches(batchesToday ?? [], d.id);
      const touren_vw = countBatches(batchesVw ?? [], d.id);
      const score = calcKapazitaetScore(touren, maxKap);
      const score_vw = calcKapazitaetScore(touren_vw, maxKap);
      const { trend, delta } = calcTrend(score, score_vw);

      return {
        fahrer_id: d.id,
        fahrer_name: d.name,
        kapazitaet_score: score,
        kapazitaet_score_vw: score_vw,
        touren_heute: touren,
        max_kapazitaet: maxKap,
        trend,
        trend_delta: delta,
        ampel: calcAmpel(score),
        alert_unterauslastung: score < 60,
      };
    }).sort((a, b) => b.kapazitaet_score - a.kapazitaet_score);

    const team_avg = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.kapazitaet_score, 0) / fahrerList.length) * 10) / 10
      : 0;
    const team_avg_vw = fahrerList.length
      ? Math.round((fahrerList.reduce((s, f) => s + f.kapazitaet_score_vw, 0) / fahrerList.length) * 10) / 10
      : 0;
    const alert_count = fahrerList.filter(f => f.alert_unterauslastung).length;

    if (driverId) {
      const f = fahrerList.find(d => d.fahrer_id === driverId) ?? fahrerList[0];
      return NextResponse.json({ fahrer_single: f, team_avg_score: team_avg });
    }

    return NextResponse.json({
      fahrer: fahrerList,
      team_avg_score: team_avg,
      team_avg_score_vw: team_avg_vw,
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
