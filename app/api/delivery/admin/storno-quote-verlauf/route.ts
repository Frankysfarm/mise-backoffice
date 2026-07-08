/**
 * GET /api/delivery/admin/storno-quote-verlauf?location_id=<uuid>&tage=14
 *
 * Phase 770 — Storno-Quote-Verlauf-API
 * Stornierungsrate (%) je Tag der letzten N Tage + Gesamt-Ø.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const tage = Math.min(30, Math.max(1, parseInt(url.searchParams.get('tage') ?? '14', 10)));

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const seit = new Date(Date.now() - tage * 86_400_000).toISOString();

  const { data: orders } = await sb
    .from('orders')
    .select('id, status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit);

  // Aggregate per day
  const tageMap = new Map<string, { gesamt: number; storniert: number }>();
  for (const o of orders ?? []) {
    const day = (o.created_at as string).slice(0, 10);
    const entry = tageMap.get(day) ?? { gesamt: 0, storniert: 0 };
    entry.gesamt += 1;
    if (o.status === 'cancelled') entry.storniert += 1;
    tageMap.set(day, entry);
  }

  const verlauf = Array.from(tageMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, { gesamt, storniert }]) => ({
      datum,
      gesamt,
      storniert,
      quote: gesamt > 0 ? Math.round((storniert / gesamt) * 1000) / 10 : 0,
    }));

  const totalGesamt = (orders ?? []).length;
  const totalStorniert = (orders ?? []).filter(o => o.status === 'cancelled').length;
  const gesamtQuote = totalGesamt > 0 ? Math.round((totalStorniert / totalGesamt) * 1000) / 10 : 0;

  return NextResponse.json({ verlauf, gesamtQuote, totalGesamt, totalStorniert, tage });
}
