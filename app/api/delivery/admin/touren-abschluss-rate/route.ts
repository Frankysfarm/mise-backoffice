/**
 * GET /api/delivery/admin/touren-abschluss-rate?location_id=<uuid>
 *
 * Phase 780 — Echtzeit-Touren-Abschluss-Rate-API
 * Abschlussquote (%) je Tag, letzte 7 Tage + Schnitt.
 *
 * Response: { ok, verlauf: VerlaufTag[], schnitt7d, heutRate, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface VerlaufTag {
  datum: string;
  gesamt: number;
  abgeschlossen: number;
  rate: number;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ ok: false, error: 'location_id required' }, { status: 400 });
  }

  const sb = await createClient();
  const seit = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const { data: batches, error } = await sb
    .from('mise_delivery_batches')
    .select('id, status, created_at, delivered_at, started_at')
    .eq('location_id', locationId)
    .gte('created_at', seit)
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const tageMap = new Map<string, { gesamt: number; abgeschlossen: number }>();
  for (const b of batches ?? []) {
    const datum = ((b.created_at ?? b.started_at ?? '') as string).slice(0, 10);
    if (!datum) continue;
    const entry = tageMap.get(datum) ?? { gesamt: 0, abgeschlossen: 0 };
    entry.gesamt += 1;
    if (b.status === 'delivered') entry.abgeschlossen += 1;
    tageMap.set(datum, entry);
  }

  const verlauf: VerlaufTag[] = Array.from(tageMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([datum, { gesamt, abgeschlossen }]) => ({
      datum,
      gesamt,
      abgeschlossen,
      rate: gesamt > 0 ? Math.round((abgeschlossen / gesamt) * 1000) / 10 : 0,
    }));

  const totalGesamt = verlauf.reduce((s, v) => s + v.gesamt, 0);
  const totalAbg = verlauf.reduce((s, v) => s + v.abgeschlossen, 0);
  const schnitt7d = totalGesamt > 0 ? Math.round((totalAbg / totalGesamt) * 1000) / 10 : 0;

  const today = new Date().toISOString().slice(0, 10);
  const heutEintrag = verlauf.find((v) => v.datum === today);
  const heutRate = heutEintrag?.rate ?? null;

  return NextResponse.json({
    ok: true,
    verlauf,
    schnitt7d,
    heutRate,
    generatedAt: new Date().toISOString(),
  });
}
