import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Gewichtung der 5 Faktoren (Summe = 100%)
const W_TOUREN = 0.30;
const W_REAKTION = 0.20;
const W_ABBRUCH = 0.20;
const W_KM = 0.15;
const W_PAUSE = 0.15;

function ampel(score: number): 'gruen' | 'gelb' | 'rot' {
  if (score >= 75) return 'gruen';
  if (score >= 50) return 'gelb';
  return 'rot';
}

// Normalisierung jedes Faktors auf 0–100 Punkte
function scoreTourenFaktor(touren: number): number {
  // Ziel: 6–10 Touren/Schicht = 100 Punkte
  if (touren >= 6 && touren <= 10) return 100;
  if (touren >= 4 && touren < 6) return 60 + (touren - 4) * 20;
  if (touren > 10 && touren <= 12) return 100 - (touren - 10) * 20;
  if (touren < 4) return Math.max(0, touren * 15);
  return Math.max(0, 60 - (touren - 12) * 20);
}

function scoreReaktionFaktor(sek: number): number {
  // Ziel: ≤60s = 100 Punkte, ≥180s = 0
  if (sek <= 60) return 100;
  if (sek >= 180) return 0;
  return Math.round(100 - ((sek - 60) / 120) * 100);
}

function scoreAbbruchFaktor(pct: number): number {
  // Ziel: 0% = 100 Punkte, ≥20% = 0
  if (pct <= 0) return 100;
  if (pct >= 20) return 0;
  return Math.round(100 - (pct / 20) * 100);
}

function scoreKmFaktor(kmProTour: number): number {
  // Ziel: 3–8 km/Tour = 100 Punkte (effiziente Routen)
  if (kmProTour >= 3 && kmProTour <= 8) return 100;
  if (kmProTour < 3) return Math.max(0, Math.round(kmProTour * 33));
  return Math.max(0, Math.round(100 - (kmProTour - 8) * 8));
}

function scorePauseFaktor(pauseMin: number): number {
  // Ziel: 5–20 Min = 100 Punkte
  if (pauseMin >= 5 && pauseMin <= 20) return 100;
  if (pauseMin < 5) return Math.round((pauseMin / 5) * 60);
  if (pauseMin <= 30) return Math.round(100 - ((pauseMin - 20) / 10) * 40);
  return Math.max(0, Math.round(60 - ((pauseMin - 30) / 30) * 60));
}

function berechneScore(
  touren: number,
  reaktionSek: number,
  abbruchPct: number,
  kmProTour: number,
  pauseMin: number,
): { score: number; faktoren: FaktorDetails } {
  const f_touren = scoreTourenFaktor(touren);
  const f_reaktion = scoreReaktionFaktor(reaktionSek);
  const f_abbruch = scoreAbbruchFaktor(abbruchPct);
  const f_km = scoreKmFaktor(kmProTour);
  const f_pause = scorePauseFaktor(pauseMin);

  const score = Math.round(
    f_touren * W_TOUREN +
    f_reaktion * W_REAKTION +
    f_abbruch * W_ABBRUCH +
    f_km * W_KM +
    f_pause * W_PAUSE,
  );

  return {
    score: Math.min(100, Math.max(0, score)),
    faktoren: { f_touren, f_reaktion, f_abbruch, f_km, f_pause },
  };
}

interface FaktorDetails {
  f_touren: number;
  f_reaktion: number;
  f_abbruch: number;
  f_km: number;
  f_pause: number;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  rang: number;
  faktoren: FaktorDetails;
  // Rohwerte für Anzeige
  touren: number;
  reaktion_sek: number;
  abbruch_pct: number;
  km_pro_tour: number;
  pause_min: number;
}

function mockData(locationId: string, driverId?: string) {
  const drivers = [
    { id: 'd1', name: 'Max M.', touren: 9, reaktion: 45, abbruch: 2, km: 6, pause: 12, touren_vw: 8, reaktion_vw: 50, abbruch_vw: 3, km_vw: 6.5, pause_vw: 14 },
    { id: 'd2', name: 'Sara K.', touren: 7, reaktion: 80, abbruch: 8, km: 9, pause: 25, touren_vw: 7, reaktion_vw: 75, abbruch_vw: 7, km_vw: 8.5, pause_vw: 22 },
    { id: 'd3', name: 'Tim B.', touren: 3, reaktion: 130, abbruch: 15, km: 12, pause: 35, touren_vw: 5, reaktion_vw: 100, abbruch_vw: 10, km_vw: 11, pause_vw: 28 },
    { id: 'd4', name: 'Julia F.', touren: 8, reaktion: 55, abbruch: 4, km: 5, pause: 10, touren_vw: 7, reaktion_vw: 60, abbruch_vw: 5, km_vw: 5.5, pause_vw: 12 },
  ];

  const fahrer: FahrerScore[] = drivers.map((d, i) => {
    const heute = berechneScore(d.touren, d.reaktion, d.abbruch, d.km, d.pause);
    const vw = berechneScore(d.touren_vw, d.reaktion_vw, d.abbruch_vw, d.km_vw, d.pause_vw);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      score: heute.score,
      score_vw: vw.score,
      trend: (heute.score > vw.score ? 'steigend' : heute.score < vw.score ? 'fallend' : 'stabil') as 'steigend' | 'fallend' | 'stabil',
      trend_delta: heute.score - vw.score,
      ampel: ampel(heute.score),
      alert: heute.score < 50,
      rang: i + 1,
      faktoren: heute.faktoren,
      touren: d.touren,
      reaktion_sek: d.reaktion,
      abbruch_pct: d.abbruch,
      km_pro_tour: d.km,
      pause_min: d.pause,
    };
  }).sort((a, b) => b.score - a.score).map((d, i) => ({ ...d, rang: i + 1 }));

  const team_avg = fahrer.reduce((s, f) => s + f.score, 0) / (fahrer.length || 1);
  const team_avg_vw = fahrer.reduce((s, f) => s + f.score_vw, 0) / (fahrer.length || 1);
  const alert_count = fahrer.filter(f => f.alert).length;

  if (driverId) {
    const f = fahrer.find(d => d.fahrer_id === driverId) ?? fahrer[0];
    return { fahrer_single: f, team_avg_score: Math.round(team_avg) };
  }

  return {
    fahrer,
    team_avg_score: Math.round(team_avg),
    team_avg_score_vw: Math.round(team_avg_vw),
    alert_count,
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
    const today = new Date().toISOString().slice(0, 10);
    const lastWeek = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: drivers } = await supabase
      .from('drivers')
      .select('id, name')
      .eq('location_id', locationId)
      .eq('is_active', true);

    if (!drivers?.length) return NextResponse.json(mockData(locationId, driverId));

    async function getTourenCount(dId: string, date: string) {
      const { count } = await supabase
        .from('delivery_tours')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .in('status', ['completed', 'delivered']);
      return count ?? 0;
    }

    async function getReaktionAvg(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('assigned_at, departed_at')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('assigned_at', 'is', null)
        .not('departed_at', 'is', null);
      if (!data?.length) return 60;
      const sums = data.map(r => {
        const diff = (new Date(r.departed_at).getTime() - new Date(r.assigned_at).getTime()) / 1000;
        return diff > 0 ? diff : 60;
      });
      return sums.reduce((a, b) => a + b, 0) / sums.length;
    }

    async function getAbbruchPct(dId: string, date: string): Promise<number> {
      const { count: total } = await supabase
        .from('delivery_tours')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59');
      const { count: abbruch } = await supabase
        .from('delivery_tours')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .in('status', ['cancelled', 'aborted']);
      if (!total) return 0;
      return ((abbruch ?? 0) / total) * 100;
    }

    async function getKmProTour(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('distance_km')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('distance_km', 'is', null);
      if (!data?.length) return 6;
      return data.reduce((s, r) => s + (r.distance_km ?? 0), 0) / data.length;
    }

    async function getPauseMin(dId: string, date: string): Promise<number> {
      const { data } = await supabase
        .from('delivery_tours')
        .select('completed_at, next_assigned_at')
        .eq('driver_id', dId)
        .gte('created_at', date + 'T00:00:00')
        .lte('created_at', date + 'T23:59:59')
        .not('completed_at', 'is', null)
        .not('next_assigned_at', 'is', null)
        .order('completed_at', { ascending: true });
      if (!data?.length) return 10;
      const pauses = data.map(r => {
        const diff = (new Date(r.next_assigned_at).getTime() - new Date(r.completed_at).getTime()) / 60000;
        return diff > 0 ? diff : 0;
      }).filter(d => d > 0);
      if (!pauses.length) return 10;
      return pauses.reduce((a, b) => a + b, 0) / pauses.length;
    }

    const fahrerData = await Promise.all(
      drivers.map(async (d, i) => {
        const [touren, touren_vw, reaktion, reaktion_vw, abbruch, abbruch_vw, km, km_vw, pause, pause_vw] =
          await Promise.all([
            getTourenCount(d.id, today),
            getTourenCount(d.id, lastWeek),
            getReaktionAvg(d.id, today),
            getReaktionAvg(d.id, lastWeek),
            getAbbruchPct(d.id, today),
            getAbbruchPct(d.id, lastWeek),
            getKmProTour(d.id, today),
            getKmProTour(d.id, lastWeek),
            getPauseMin(d.id, today),
            getPauseMin(d.id, lastWeek),
          ]);

        const heute = berechneScore(touren, reaktion, abbruch, km, pause);
        const vw = berechneScore(touren_vw, reaktion_vw, abbruch_vw, km_vw, pause_vw);

        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? 'Fahrer',
          score: heute.score,
          score_vw: vw.score,
          trend: heute.score > vw.score ? 'steigend' : heute.score < vw.score ? 'fallend' : 'stabil',
          trend_delta: heute.score - vw.score,
          ampel: ampel(heute.score),
          alert: heute.score < 50,
          rang: i + 1,
          faktoren: heute.faktoren,
          touren,
          reaktion_sek: Math.round(reaktion),
          abbruch_pct: Math.round(abbruch * 10) / 10,
          km_pro_tour: Math.round(km * 10) / 10,
          pause_min: Math.round(pause),
        } satisfies FahrerScore;
      })
    );

    const sorted = fahrerData.sort((a, b) => b.score - a.score).map((d, i) => ({ ...d, rang: i + 1 }));
    const team_avg = sorted.reduce((s, f) => s + f.score, 0) / (sorted.length || 1);
    const team_avg_vw = sorted.reduce((s, f) => s + f.score_vw, 0) / (sorted.length || 1);
    const alert_count = sorted.filter(f => f.alert).length;

    if (driverId) {
      const f = sorted.find(d => d.fahrer_id === driverId) ?? sorted[0];
      return NextResponse.json({ fahrer_single: f, team_avg_score: Math.round(team_avg) });
    }

    return NextResponse.json({
      fahrer: sorted,
      team_avg_score: Math.round(team_avg),
      team_avg_score_vw: Math.round(team_avg_vw),
      alert_count,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(mockData(locationId, driverId));
  }
}
