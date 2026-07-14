/**
 * GET /api/delivery/driver/tages-kpi-scoreboard?driver_id=<uuid>
 *
 * Phase 1620 (Support) — Tages-KPI-Scoreboard für Fahrer-App
 * Heutige Touren + Ø Lieferzeit + Pünktlichkeitsrate + Trinkgeld-Rate + Rang unter Fahrern.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesKpiScoreboardResponse {
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeits_rate: number;
  trinkgeld_rate: number;
  rang: number | null;
  fahrer_gesamt: number;
}

function buildMock(driverId: string): TagesKpiScoreboardResponse {
  void driverId;
  return {
    touren_heute: 8,
    avg_lieferzeit_min: 21.4,
    puenktlichkeits_rate: 87.5,
    trinkgeld_rate: 62.0,
    rang: 3,
    fahrer_gesamt: 12,
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    const { data: myBatches, error } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, total_earnings, created_at, delivered_at, promised_at, tip_amount')
      .eq('driver_id', driverId)
      .gte('created_at', `${today}T00:00:00`)
      .not('delivered_at', 'is', null);

    if (error || !myBatches || (myBatches as unknown[]).length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    type BatchRow = {
      id: string;
      total_earnings: number;
      created_at: string;
      delivered_at: string;
      promised_at: string | null;
      tip_amount: number | null;
    };

    const rows = myBatches as BatchRow[];
    const tourCount = rows.length;

    const lieferzeiten = rows
      .map((b) => (new Date(b.delivered_at).getTime() - new Date(b.created_at).getTime()) / 60_000)
      .filter((m) => m >= 0 && m < 120);
    const avgLieferzeit = lieferzeiten.length > 0
      ? lieferzeiten.reduce((s, v) => s + v, 0) / lieferzeiten.length
      : 0;

    const puenktlich = rows.filter((b) => {
      if (!b.promised_at) return true;
      return new Date(b.delivered_at) <= new Date(b.promised_at);
    }).length;
    const puenktlichRate = tourCount > 0 ? (puenktlich / tourCount) * 100 : 0;

    const mitTrinkgeld = rows.filter((b) => (b.tip_amount ?? 0) > 0).length;
    const trinkgeldRate = tourCount > 0 ? (mitTrinkgeld / tourCount) * 100 : 0;

    // Rang: compare against all drivers today (simplified — use batch count as proxy)
    const { data: allDriverBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('driver_id')
      .gte('created_at', `${today}T00:00:00`)
      .not('delivered_at', 'is', null);

    let rang: number | null = null;
    let fahrerGesamt = 1;
    if (allDriverBatches) {
      const countByDriver = new Map<string, number>();
      for (const b of allDriverBatches as { driver_id: string }[]) {
        countByDriver.set(b.driver_id, (countByDriver.get(b.driver_id) ?? 0) + 1);
      }
      fahrerGesamt = countByDriver.size;
      const sorted = [...countByDriver.entries()].sort((a, z) => z[1] - a[1]);
      const myIdx = sorted.findIndex(([id]) => id === driverId);
      if (myIdx >= 0) rang = myIdx + 1;
    }

    return NextResponse.json({
      touren_heute: tourCount,
      avg_lieferzeit_min: Math.round(avgLieferzeit * 10) / 10,
      puenktlichkeits_rate: Math.round(puenktlichRate * 10) / 10,
      trinkgeld_rate: Math.round(trinkgeldRate * 10) / 10,
      rang,
      fahrer_gesamt: fahrerGesamt,
    } satisfies TagesKpiScoreboardResponse);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
