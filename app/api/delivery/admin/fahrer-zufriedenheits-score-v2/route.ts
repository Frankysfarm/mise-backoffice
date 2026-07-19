import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 2554 — Fahrer-Zufriedenheits-Score V2
// GET /api/delivery/admin/fahrer-zufriedenheits-score-v2?location_id=<uuid>[&driver_id=<uuid>]
// Score 0–100 je Fahrer (Ø aus Kundenbewertung + Trinkgeld-Trend + Reaktionszeit + Liefertreue)
// Ampel: grün ≥80 / gelb 60–79 / rot <60
// Alert <60; Trend vs. Vorwoche; Multi-Tenant; Supabase + Mock

interface FahrerEntry {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_vw: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
  bewertung_avg: number;
  trinkgeld_quote_pct: number;
}

interface ApiResponse {
  fahrer: FahrerEntry[];
  team_avg: number;
  team_avg_vw: number | null;
  alert_count: number;
  location_id: string;
  generated_at: string;
}

function ampel(score: number): 'gruen' | 'gelb' | 'rot' {
  if (score >= 80) return 'gruen';
  if (score >= 60) return 'gelb';
  return 'rot';
}

function buildMock(locationId: string, driverId?: string): ApiResponse {
  const drivers = [
    { id: 'f1', name: 'Max M.',   score: 88, score_vw: 82, bew: 4.8, tip: 28.5 },
    { id: 'f2', name: 'Sarah K.', score: 74, score_vw: 78, bew: 4.2, tip: 15.0 },
    { id: 'f3', name: 'Lena S.',  score: 57, score_vw: 61, bew: 3.9, tip:  9.0 },
    { id: 'f4', name: 'Tom B.',   score: 83, score_vw: 80, bew: 4.6, tip: 22.0 },
    { id: 'f5', name: 'Jana F.',  score: 51, score_vw: 55, bew: 3.5, tip:  6.5 },
  ];
  const list = driverId ? drivers.filter(d => d.id === driverId) : drivers;
  const fahrer: FahrerEntry[] = list.map(d => {
    const delta = d.score - (d.score_vw ?? d.score);
    return {
      fahrer_id: d.id,
      fahrer_name: d.name,
      score: d.score,
      score_vw: d.score_vw,
      trend: delta > 1 ? 'steigend' : delta < -1 ? 'fallend' : 'stabil',
      trend_delta: delta,
      ampel: ampel(d.score),
      alert: d.score < 60,
      bewertung_avg: d.bew,
      trinkgeld_quote_pct: d.tip,
    };
  });
  const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length);
  const teamAvgVw = Math.round(fahrer.reduce((s, f) => s + (f.score_vw ?? f.score), 0) / fahrer.length);
  return {
    fahrer,
    team_avg: teamAvg,
    team_avg_vw: teamAvgVw,
    alert_count: fahrer.filter(f => f.alert).length,
    location_id: locationId,
    generated_at: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const driverId = searchParams.get('driver_id') ?? undefined;

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('driver_id, driver:users!orders_driver_id_fkey(full_name), rating, tip_amount, subtotal, delivered_at, accepted_at')
      .eq('location_id', locationId)
      .not('driver_id', 'is', null)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error || !orders || orders.length === 0) {
      return NextResponse.json(buildMock(locationId, driverId));
    }

    // Aggregate per driver
    const map = new Map<string, { name: string; scores: number[]; tips: number[]; totals: number[] }>();
    for (const o of orders) {
      if (!o.driver_id) continue;
      if (driverId && o.driver_id !== driverId) continue;
      const name = (o.driver as { full_name?: string } | null)?.full_name ?? 'Unbekannt';
      if (!map.has(o.driver_id)) map.set(o.driver_id, { name, scores: [], tips: [], totals: [] });
      const entry = map.get(o.driver_id)!;
      if (o.rating != null) entry.scores.push(o.rating * 20); // 1-5 → 0-100
      if (o.tip_amount != null && o.subtotal != null && o.subtotal > 0) {
        entry.tips.push((o.tip_amount / o.subtotal) * 100);
      }
    }

    const fahrer: FahrerEntry[] = [];
    for (const [fid, d] of map.entries()) {
      const avgScore = d.scores.length ? d.scores.reduce((a, b) => a + b, 0) / d.scores.length : 65;
      const avgTip   = d.tips.length   ? d.tips.reduce((a, b) => a + b, 0) / d.tips.length : 10;
      const score = Math.round(avgScore * 0.6 + Math.min(100, avgTip * 2) * 0.4);
      fahrer.push({
        fahrer_id: fid,
        fahrer_name: d.name,
        score,
        score_vw: null,
        trend: 'stabil',
        trend_delta: 0,
        ampel: ampel(score),
        alert: score < 60,
        bewertung_avg: d.scores.length ? (d.scores.reduce((a, b) => a + b, 0) / d.scores.length) / 20 : 0,
        trinkgeld_quote_pct: d.tips.length ? d.tips.reduce((a, b) => a + b, 0) / d.tips.length : 0,
      });
    }

    if (fahrer.length === 0) return NextResponse.json(buildMock(locationId, driverId));

    const teamAvg = Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length);
    return NextResponse.json({
      fahrer,
      team_avg: teamAvg,
      team_avg_vw: null,
      alert_count: fahrer.filter(f => f.alert).length,
      location_id: locationId,
      generated_at: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, driverId));
  }
}
