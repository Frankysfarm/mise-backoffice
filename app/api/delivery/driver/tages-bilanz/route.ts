/**
 * GET /api/delivery/driver/tages-bilanz?driver_id=<uuid>
 *
 * Phase 709 — Tages-Bilanz-Zusammenfassung für Fahrer
 * Aggregiert heutige Touren, km, Einnahmen (0.80 €/Stop), Trinkgeld und Schichtdauer.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EINNAHMEN_PRO_STOP = 0.80;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();

  const todayStart = new Date();
  todayStart.setUTCHours(5, 0, 0, 0);
  if (todayStart > new Date()) todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  const since = todayStart.toISOString();

  // Fetch today's completed batches for this driver
  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, distance_km, orders_count, created_at, completed_at')
    .eq('driver_id', driverId)
    .eq('status', 'completed')
    .gte('created_at', since);

  const allBatches = batches ?? [];

  const tourenCount = allBatches.length;
  const kmGesamt = allBatches.reduce((s, b) => s + (b.distance_km ?? 0), 0);
  const totalStops = allBatches.reduce((s, b) => s + (b.orders_count ?? 1), 0);
  const einnahmenEur = totalStops * EINNAHMEN_PRO_STOP;

  // Fetch today's tips
  const { data: tips } = await sb
    .from('driver_tips')
    .select('amount')
    .eq('driver_id', driverId)
    .gte('created_at', since);

  const trinkgeldEur = (tips ?? []).reduce((s, t) => s + (t.amount ?? 0), 0);

  // Shift hours: from todayStart to now
  const schichtStunden = (Date.now() - todayStart.getTime()) / 3_600_000;

  // Average tour duration in minutes
  let avgTourMin = 0;
  if (allBatches.length > 0) {
    const totalMin = allBatches.reduce((s, b) => {
      if (b.created_at && b.completed_at) {
        return s + (new Date(b.completed_at).getTime() - new Date(b.created_at).getTime()) / 60_000;
      }
      return s + 25; // default 25 min if no timing
    }, 0);
    avgTourMin = Math.round(totalMin / allBatches.length);
  }

  return NextResponse.json({
    touren_count: tourenCount,
    km_gesamt: Math.round(kmGesamt * 10) / 10,
    einnahmen_eur: Math.round(einnahmenEur * 100) / 100,
    trinkgeld_eur: Math.round(trinkgeldEur * 100) / 100,
    schicht_stunden: Math.round(schichtStunden * 10) / 10,
    avg_tour_min: avgTourMin,
  });
}
