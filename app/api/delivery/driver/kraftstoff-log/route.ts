/**
 * GET /api/delivery/driver/kraftstoff-log?driver_id=<uuid>&tage=<7|30>
 *
 * Phase 927 — Kraftstoff-Tracker Backend
 * Tägliches km-Log + geschätzte Kraftstoffkosten je Schicht.
 * Berechnet aus abgeschlossenen Touren (km-Summe je Tag).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KM_PRO_LITER = 12;
const LITER_PREIS_EUR = 1.75;

interface TagLog {
  datum: string;
  km: number;
  liter: number;
  kosten_eur: number;
  touren: number;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const tage = Math.min(30, Math.max(1, parseInt(url.searchParams.get('tage') ?? '7', 10)));

  const sb = await createClient();
  const jetzt = new Date();
  const cutoff = new Date(jetzt);
  cutoff.setDate(cutoff.getDate() - tage);

  const { data: touren } = await sb
    .from('delivery_tours')
    .select('id, total_km, completed_at, created_at')
    .eq('driver_id', driverId)
    .in('status', ['abgeschlossen', 'completed'])
    .gte('completed_at', cutoff.toISOString())
    .order('completed_at', { ascending: true });

  const tagMap = new Map<string, TagLog>();

  for (const tour of touren ?? []) {
    const d = new Date(tour.completed_at ?? tour.created_at);
    const datum = d.toISOString().slice(0, 10);
    const km = Number(tour.total_km ?? 0);

    if (!tagMap.has(datum)) {
      tagMap.set(datum, { datum, km: 0, liter: 0, kosten_eur: 0, touren: 0 });
    }
    const entry = tagMap.get(datum)!;
    entry.km += km;
    entry.touren += 1;
  }

  const logs: TagLog[] = [...tagMap.values()].map((e) => {
    const liter = e.km / KM_PRO_LITER;
    return {
      ...e,
      km: Math.round(e.km * 10) / 10,
      liter: Math.round(liter * 10) / 10,
      kosten_eur: Math.round(liter * LITER_PREIS_EUR * 100) / 100,
    };
  });

  const gesamt_km = logs.reduce((s, l) => s + l.km, 0);
  const gesamt_kosten = logs.reduce((s, l) => s + l.kosten_eur, 0);
  const gesamt_touren = logs.reduce((s, l) => s + l.touren, 0);

  return NextResponse.json({
    logs,
    gesamt_km: Math.round(gesamt_km * 10) / 10,
    gesamt_kosten_eur: Math.round(gesamt_kosten * 100) / 100,
    gesamt_touren,
    zeitraum_tage: tage,
    km_pro_liter: KM_PRO_LITER,
    liter_preis_eur: LITER_PREIS_EUR,
    generatedAt: jetzt.toISOString(),
  });
}
