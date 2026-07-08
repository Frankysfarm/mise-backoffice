/**
 * GET /api/delivery/driver/fahrten-chronik?driver_id=<uuid>&limit=10
 *
 * Phase 729 — Fahrten-Chronik
 * Letzte N abgeschlossene Touren des Fahrers mit Zeit, km, Stops, Einnahmen.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EINNAHMEN_PRO_STOP = 0.80;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10)));

  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, distance_km, orders_count, created_at, completed_at')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);

  const fahrten = (batches ?? []).map((b) => {
    const startTime = b.created_at ? new Date(b.created_at) : null;
    const endTime = b.completed_at ? new Date(b.completed_at) : null;
    const dauerMin = startTime && endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60_000)
      : 20;

    let datum = 'Früher';
    if (endTime) {
      if (endTime >= todayStart) datum = 'Heute';
      else if (endTime >= yesterdayStart) datum = 'Gestern';
    }

    const uhrzeit = endTime
      ? endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '--:--';

    const stops = b.orders_count ?? 1;
    const einnahmen = stops * EINNAHMEN_PRO_STOP;

    return {
      id: b.id,
      datum,
      uhrzeit,
      stops,
      km: Math.round((b.distance_km ?? 0) * 10) / 10,
      einnahmen_eur: Math.round(einnahmen * 100) / 100,
      dauer_min: dauerMin,
    };
  });

  return NextResponse.json({ fahrten });
}
