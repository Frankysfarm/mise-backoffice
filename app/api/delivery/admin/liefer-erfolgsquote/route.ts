/**
 * GET /api/delivery/admin/liefer-erfolgsquote?location_id=<uuid>&date=YYYY-MM-DD
 *
 * Phase 1491 — Liefer-Erfolgsquote-API
 * Erfolgreiche Lieferungen vs. Gesamt + Storno + 7-Tage-Trend.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TagesQuote {
  datum: string;
  label: string;
  gesamt: number;
  erfolgreich: number;
  storniert: number;
  quote_pct: number;
}

export interface LieferErfolgsquoteResponse {
  heute: {
    gesamt: number;
    erfolgreich: number;
    storniert: number;
    in_zustellung: number;
    quote_pct: number;
    status: 'sehr_gut' | 'gut' | 'mittel' | 'schlecht';
  };
  trend_7d: TagesQuote[];
  durchschnitt_7d_pct: number;
  delta_vs_7d: number;
  location_id: string;
  datum: string;
  generiert_am: string;
}

function quoteStatus(pct: number): LieferErfolgsquoteResponse['heute']['status'] {
  if (pct >= 95) return 'sehr_gut';
  if (pct >= 88) return 'gut';
  if (pct >= 75) return 'mittel';
  return 'schlecht';
}

function buildMock(locationId: string, datum: string): LieferErfolgsquoteResponse {
  const trend: TagesQuote[] = [];
  const now = new Date(datum);
  const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const mockVals = [91, 94, 89, 96, 92, 88, 95];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const label = weekdays[d.getDay()];
    const gesamt = 45 + Math.floor(Math.random() * 30);
    const quotePct = mockVals[6 - i] ?? 92;
    const erfolgreich = Math.round(gesamt * (quotePct / 100));
    const storniert = gesamt - erfolgreich;
    trend.push({ datum: dateStr, label, gesamt, erfolgreich, storniert, quote_pct: quotePct });
  }
  const heute = trend[trend.length - 1]!;
  const avg7d = parseFloat((trend.reduce((s, t) => s + t.quote_pct, 0) / trend.length).toFixed(1));
  const delta = parseFloat((heute.quote_pct - avg7d).toFixed(1));
  return {
    heute: {
      gesamt: heute.gesamt,
      erfolgreich: heute.erfolgreich,
      storniert: heute.storniert,
      in_zustellung: 3,
      quote_pct: heute.quote_pct,
      status: quoteStatus(heute.quote_pct),
    },
    trend_7d: trend,
    durchschnitt_7d_pct: avg7d,
    delta_vs_7d: delta,
    location_id: locationId,
    datum,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id') ?? '';
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  if (!locationId) {
    return NextResponse.json(buildMock('mock', date));
  }

  try {
    const supabase = await createClient();
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;

    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('location_id', locationId)
      .gte('created_at', startOfDay)
      .lte('created_at', endOfDay);

    const rows = orders ?? [];
    const gesamt = rows.length;
    const erfolgreich = rows.filter((o) => o.status === 'delivered').length;
    const storniert = rows.filter((o) => ['cancelled', 'rejected'].includes(o.status)).length;
    const in_zustellung = rows.filter((o) => o.status === 'in_delivery').length;
    const quote_pct = gesamt > 0 ? parseFloat(((erfolgreich / gesamt) * 100).toFixed(1)) : 95;

    // 7-Tage-Trend
    const trend7Start = new Date(date);
    trend7Start.setDate(trend7Start.getDate() - 6);
    const { data: hist } = await supabase
      .from('orders')
      .select('id, status, created_at')
      .eq('location_id', locationId)
      .gte('created_at', trend7Start.toISOString().slice(0, 10) + 'T00:00:00')
      .lte('created_at', endOfDay);

    const byDay = new Map<string, { gesamt: number; erfolgreich: number; storniert: number }>();
    for (const o of hist ?? []) {
      const day = o.created_at.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { gesamt: 0, erfolgreich: 0, storniert: 0 });
      const entry = byDay.get(day)!;
      entry.gesamt++;
      if (o.status === 'delivered') entry.erfolgreich++;
      if (['cancelled', 'rejected'].includes(o.status)) entry.storniert++;
    }

    const weekdays = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const trend_7d: TagesQuote[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(date);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().slice(0, 10);
      const entry = byDay.get(dStr) ?? { gesamt: 0, erfolgreich: 0, storniert: 0 };
      const qPct = entry.gesamt > 0 ? parseFloat(((entry.erfolgreich / entry.gesamt) * 100).toFixed(1)) : 0;
      trend_7d.push({ datum: dStr, label: weekdays[d.getDay()] ?? '?', ...entry, quote_pct: qPct });
    }

    const avg7d = parseFloat((trend_7d.filter((t) => t.gesamt > 0).reduce((s, t) => s + t.quote_pct, 0) / Math.max(trend_7d.filter((t) => t.gesamt > 0).length, 1)).toFixed(1));
    const delta = parseFloat((quote_pct - avg7d).toFixed(1));

    return NextResponse.json({
      heute: { gesamt, erfolgreich, storniert, in_zustellung, quote_pct, status: quoteStatus(quote_pct) },
      trend_7d,
      durchschnitt_7d_pct: avg7d,
      delta_vs_7d: delta,
      location_id: locationId,
      datum: date,
      generiert_am: new Date().toISOString(),
    } satisfies LieferErfolgsquoteResponse);
  } catch {
    return NextResponse.json(buildMock(locationId, date));
  }
}
