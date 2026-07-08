/**
 * GET /api/delivery/driver/fahrer-streak?driver_id=<uuid>
 *
 * Phase 731 — Fahrer-Streaks-API
 * Aufeinanderfolgende aktive Tage + Touren-Meilensteine des Fahrers.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MEILENSTEINE = [10, 25, 50, 100, 200, 500];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');

  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, completed_at, orders_count')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false });

  const allBatches = batches ?? [];
  const gesamtTouren = allBatches.length;

  // Tages-Streak: aufeinanderfolgende UTC-Tage (heute zählt als laufend)
  const now = new Date();
  const tageSet = new Set<string>();
  for (const b of allBatches) {
    if (b.completed_at) {
      tageSet.add(b.completed_at.slice(0, 10));
    }
  }

  let streak = 0;
  const check = new Date(now);
  check.setUTCHours(0, 0, 0, 0);
  while (true) {
    const dayStr = check.toISOString().slice(0, 10);
    if (!tageSet.has(dayStr)) break;
    streak++;
    check.setUTCDate(check.getUTCDate() - 1);
  }

  // Nächster Meilenstein
  const naechsterMeilenstein = MEILENSTEINE.find((m) => m > gesamtTouren) ?? null;
  const bisNaechsterMeilenstein = naechsterMeilenstein ? naechsterMeilenstein - gesamtTouren : 0;

  return NextResponse.json({
    streak_tage: streak,
    gesamt_touren: gesamtTouren,
    naechster_meilenstein: naechsterMeilenstein,
    bis_meilenstein: bisNaechsterMeilenstein,
    meilensteine_erreicht: MEILENSTEINE.filter((m) => m <= gesamtTouren),
  });
}
