/**
 * GET /api/delivery/admin/bestellungs-abbruch-trend?location_id=<uuid>
 *
 * Phase 790 — Bestellungs-Abbruch-Trend-API
 * Stornierungsrate je Wochentag + Stunde der letzten 4 Wochen.
 * Muster-Erkennung: Wochentag + Stunde-Kombination mit höchster Storno-Rate.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WOCHENTAGE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const seit = new Date(Date.now() - 28 * 86_400_000).toISOString();

  const { data: orders } = await sb
    .from('orders')
    .select('id, status, created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit);

  if (!orders || orders.length === 0) {
    return NextResponse.json({
      ok: true,
      nachWochentag: [],
      nachStunde: [],
      hotspot: null,
      gesamtQuote: 0,
      generatedAt: new Date().toISOString(),
    });
  }

  // Aggregate per weekday (0=So … 6=Sa)
  const wdMap = new Map<number, { gesamt: number; storniert: number }>();
  // Aggregate per hour (0–23)
  const hMap = new Map<number, { gesamt: number; storniert: number }>();
  // Aggregate per weekday+hour for hotspot
  const wdHMap = new Map<string, { gesamt: number; storniert: number; wd: number; h: number }>();

  for (const o of orders) {
    const dt = new Date(o.created_at as string);
    const wd = dt.getUTCDay();
    const h = dt.getUTCHours();
    const cancelled = (o.status as string) === 'cancelled';

    const wdEntry = wdMap.get(wd) ?? { gesamt: 0, storniert: 0 };
    wdEntry.gesamt += 1;
    if (cancelled) wdEntry.storniert += 1;
    wdMap.set(wd, wdEntry);

    const hEntry = hMap.get(h) ?? { gesamt: 0, storniert: 0 };
    hEntry.gesamt += 1;
    if (cancelled) hEntry.storniert += 1;
    hMap.set(h, hEntry);

    const key = `${wd}|${h}`;
    const whEntry = wdHMap.get(key) ?? { gesamt: 0, storniert: 0, wd, h };
    whEntry.gesamt += 1;
    if (cancelled) whEntry.storniert += 1;
    wdHMap.set(key, whEntry);
  }

  const nachWochentag = Array.from(wdMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([wd, { gesamt, storniert }]) => ({
      wd,
      label: WOCHENTAGE[wd],
      gesamt,
      storniert,
      quote: gesamt > 0 ? Math.round((storniert / gesamt) * 1000) / 10 : 0,
    }));

  const nachStunde = Array.from(hMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([h, { gesamt, storniert }]) => ({
      h,
      label: `${String(h).padStart(2, '0')}:00`,
      gesamt,
      storniert,
      quote: gesamt > 0 ? Math.round((storniert / gesamt) * 1000) / 10 : 0,
    }));

  // Hotspot: weekday+hour with ≥5 orders and highest storno rate
  let hotspot: { wdLabel: string; stunde: string; quote: number; gesamt: number } | null = null;
  let bestQuote = -1;
  for (const { gesamt, storniert, wd, h } of wdHMap.values()) {
    if (gesamt < 5) continue;
    const q = (storniert / gesamt) * 100;
    if (q > bestQuote) {
      bestQuote = q;
      hotspot = {
        wdLabel: WOCHENTAGE[wd],
        stunde: `${String(h).padStart(2, '0')}:00`,
        quote: Math.round(q * 10) / 10,
        gesamt,
      };
    }
  }

  const totalStorniert = orders.filter(o => (o.status as string) === 'cancelled').length;
  const gesamtQuote = orders.length > 0
    ? Math.round((totalStorniert / orders.length) * 1000) / 10
    : 0;

  return NextResponse.json({
    ok: true,
    nachWochentag,
    nachStunde,
    hotspot,
    gesamtQuote,
    generatedAt: new Date().toISOString(),
  });
}
