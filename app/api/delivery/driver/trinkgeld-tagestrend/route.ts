/**
 * GET /api/delivery/driver/trinkgeld-tagestrend?driver_id=<uuid>&location_id=<uuid>
 *
 * Phase 887 — Trinkgeld-Tagestrend-API
 * Stündliche Trinkgeld-Einnahmen des Fahrers für heute + Bestzeit-Highlight.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id fehlt' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, startzeit, trinkgeld')
    .eq('fahrer_id', driverId)
    .gte('startzeit', todayStart.toISOString())
    .in('status', ['abgeschlossen', 'unterwegs']);

  type BatchRow = { id: string; startzeit: string | null; trinkgeld: number | null };
  const typedBatches = (batches as BatchRow[] | null) ?? [];

  // Aggregate tips by hour
  const byHour: Record<number, number> = {};
  for (let h = 0; h < 24; h++) byHour[h] = 0;

  for (const b of typedBatches) {
    if (!b.startzeit || !b.trinkgeld) continue;
    const h = new Date(b.startzeit).getUTCHours();
    byHour[h] += b.trinkgeld;
  }

  const currentHour = now.getUTCHours();
  const stunden = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    trinkgeld: Math.round(byHour[h] * 100) / 100,
    ist_vergangen: h < currentHour,
    ist_aktuell: h === currentHour,
  })).filter(s => s.ist_vergangen || s.ist_aktuell);

  const total = typedBatches.reduce((s, b) => s + (b.trinkgeld ?? 0), 0);
  const best = stunden.reduce(
    (best, s) => s.trinkgeld > best.trinkgeld ? s : best,
    { hour: 0, trinkgeld: 0, ist_vergangen: false, ist_aktuell: false }
  );

  // Previous week same weekday (same driver, same weekday last 4 weeks avg)
  const weekday = now.getUTCDay();
  const cutoff = new Date(todayStart.getTime() - 28 * 24 * 3_600_000);
  const { data: histBatches } = await sb
    .from('delivery_batches')
    .select('startzeit, trinkgeld')
    .eq('fahrer_id', driverId)
    .gte('startzeit', cutoff.toISOString())
    .lt('startzeit', todayStart.toISOString())
    .in('status', ['abgeschlossen']);

  type HistRow = { startzeit: string | null; trinkgeld: number | null };
  const typedHist = (histBatches as HistRow[] | null) ?? [];
  const sameDayBatches = typedHist.filter(b => b.startzeit && new Date(b.startzeit).getUTCDay() === weekday);
  const histTotal = sameDayBatches.reduce((s, b) => s + (b.trinkgeld ?? 0), 0);
  const uniqueDays = new Set(sameDayBatches.map(b => b.startzeit ? new Date(b.startzeit).toISOString().slice(0, 10) : '')).size;
  const histAvg = uniqueDays > 0 ? histTotal / uniqueDays : 0;

  return NextResponse.json({
    stunden,
    total: Math.round(total * 100) / 100,
    best_hour: best.hour,
    best_trinkgeld: best.trinkgeld,
    hist_avg_tag: Math.round(histAvg * 100) / 100,
    trend: total > histAvg ? 'besser' : total < histAvg * 0.8 ? 'schlechter' : 'normal',
    generatedAt: now.toISOString(),
  });
}
