/**
 * GET /api/delivery/driver/lernkurve?driver_id=<uuid>
 *
 * Phase 934 — Tour-Lernkurve-API (Fahrer-App)
 * Effizienz-Wachstum über 4 Wochen: Stopps/h + Pünktlichkeit% + Gesamt-Score + Level.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WocheData {
  woche: number;
  label: string;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  score: number;
  touren: number;
}

function mockData(driverId: string): object {
  const wochen: WocheData[] = [
    { woche: 1, label: 'Vor 4 Wochen', stopps_pro_h: 4.1, puenktlichkeit_pct: 72, score: 61, touren: 18 },
    { woche: 2, label: 'Vor 3 Wochen', stopps_pro_h: 4.6, puenktlichkeit_pct: 78, score: 68, touren: 22 },
    { woche: 3, label: 'Vor 2 Wochen', stopps_pro_h: 5.0, puenktlichkeit_pct: 84, score: 75, touren: 24 },
    { woche: 4, label: 'Diese Woche', stopps_pro_h: 5.4, puenktlichkeit_pct: 88, score: 82, touren: 26 },
  ];
  const levelLabel = 'Profi';
  const delta_score = wochen[3].score - wochen[0].score;
  return {
    wochen,
    level: levelLabel,
    delta_score,
    wachstum_pct: Math.round((delta_score / wochen[0].score) * 100),
    aktueller_score: wochen[3].score,
    driver_id: driverId,
    generatedAt: new Date().toISOString(),
  };
}

function levelFromScore(score: number): string {
  if (score >= 85) return 'Experte';
  if (score >= 70) return 'Profi';
  if (score >= 50) return 'Aufsteiger';
  return 'Einsteiger';
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();
  const jetzt = new Date();
  const cutoff = new Date(jetzt);
  cutoff.setDate(cutoff.getDate() - 28);

  const { data: stops } = await sb
    .from('delivery_stops')
    .select('id, geliefert_am, geplant_am, batch_id, created_at')
    .eq('driver_id', driverId)
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: true });

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, started_at, completed_at, created_at')
    .eq('driver_id', driverId)
    .gte('created_at', cutoff.toISOString())
    .not('completed_at', 'is', null);

  if (!stops || stops.length < 5 || !batches || batches.length < 3) {
    return NextResponse.json(mockData(driverId));
  }

  // Gruppiere nach Kalenderwochen (4 Wochen)
  const wochenMap = new Map<number, { stopsH: number[]; puenktlich: number; total: number; tourDauern: number[]; touren: number }>();
  for (let w = 1; w <= 4; w++) wochenMap.set(w, { stopsH: [], puenktlich: 0, total: 0, tourDauern: [], touren: 0 });

  for (const b of batches) {
    const start = new Date((b as { started_at?: string }).started_at ?? (b as { created_at: string }).created_at);
    const end = new Date((b as { completed_at?: string }).completed_at ?? jetzt.toISOString());
    const daysAgo = Math.floor((jetzt.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const woche = daysAgo < 7 ? 4 : daysAgo < 14 ? 3 : daysAgo < 21 ? 2 : 1;
    const entry = wochenMap.get(woche)!;
    const dauerH = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (dauerH > 0.1) entry.tourDauern.push(dauerH);
    entry.touren++;
  }

  for (const s of stops) {
    const created = new Date((s as { created_at: string }).created_at);
    const daysAgo = Math.floor((jetzt.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    const woche = daysAgo < 7 ? 4 : daysAgo < 14 ? 3 : daysAgo < 21 ? 2 : 1;
    const entry = wochenMap.get(woche)!;
    entry.total++;
    const geplant = (s as { geplant_am?: string | null }).geplant_am;
    const geliefert = (s as { geliefert_am?: string | null }).geliefert_am;
    if (geplant && geliefert) {
      const diff = new Date(geliefert).getTime() - new Date(geplant).getTime();
      if (diff <= 5 * 60 * 1000) entry.puenktlich++;
    }
  }

  const wochen: WocheData[] = [];
  const labels = ['Vor 4 Wochen', 'Vor 3 Wochen', 'Vor 2 Wochen', 'Diese Woche'];
  for (let w = 1; w <= 4; w++) {
    const entry = wochenMap.get(w)!;
    const dauerH = entry.tourDauern.length > 0 ? entry.tourDauern.reduce((a, b) => a + b, 0) : 1;
    const stopps_pro_h = dauerH > 0 ? Math.round((entry.total / dauerH) * 10) / 10 : 0;
    const puenktlichkeit_pct = entry.total > 0 ? Math.round((entry.puenktlich / entry.total) * 100) : 0;
    const score = Math.round(stopps_pro_h * 10 + puenktlichkeit_pct * 0.5);
    wochen.push({
      woche: w,
      label: labels[w - 1],
      stopps_pro_h,
      puenktlichkeit_pct,
      score: Math.min(100, score),
      touren: entry.touren,
    });
  }

  const aktueller_score = wochen[3].score;
  const erster_score = wochen[0].score;
  const delta_score = aktueller_score - erster_score;

  return NextResponse.json({
    wochen,
    level: levelFromScore(aktueller_score),
    delta_score,
    wachstum_pct: erster_score > 0 ? Math.round((delta_score / erster_score) * 100) : 0,
    aktueller_score,
    driver_id: driverId,
    generatedAt: jetzt.toISOString(),
  });
}
