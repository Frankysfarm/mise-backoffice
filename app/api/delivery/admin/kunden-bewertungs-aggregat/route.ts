/**
 * GET /api/delivery/admin/kunden-bewertungs-aggregat?location_id=<uuid>
 *
 * Phase 1290 — Kunden-Bewertungs-Aggregat-API (Backend)
 * Ø-Note pro Wochentag + Top-3-Beschwerden + Positiver Trend.
 * Supabase delivery_ratings + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WOCHENTAG_LABEL = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export interface WochentagBewertung {
  wochentag: number;
  label: string;
  durchschnitt: number;
  anzahl: number;
}

export interface KundenBewertungsAggregatResponse {
  wochentag_verlauf: WochentagBewertung[];
  gesamt_schnitt: number;
  top_beschwerden: string[];
  trend: 'positiv' | 'stabil' | 'negativ';
  trend_pct: number;
  total_bewertungen: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): KundenBewertungsAggregatResponse {
  const verlauf: WochentagBewertung[] = WOCHENTAG_LABEL.map((label, i) => ({
    wochentag: i,
    label,
    durchschnitt: +(3.5 + Math.sin(i) * 0.6).toFixed(1),
    anzahl: 10 + i * 3,
  }));
  return {
    wochentag_verlauf: verlauf,
    gesamt_schnitt: 4.1,
    top_beschwerden: ['Zu lange Lieferzeit', 'Bestellung kalt angekommen', 'Artikel fehlte'],
    trend: 'positiv',
    trend_pct: 8,
    total_bewertungen: 147,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = createClient();

    const seit30Tagen = new Date();
    seit30Tagen.setDate(seit30Tagen.getDate() - 30);

    const { data: ratings, error } = await (sb as any)
      .from('delivery_ratings')
      .select('rating, comment, created_at')
      .eq('location_id', locationId)
      .gte('created_at', seit30Tagen.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error || !ratings?.length) return NextResponse.json(buildMock(locationId));

    // Aggregation nach Wochentag
    const dayMap: Record<number, { sum: number; count: number }> = {};
    for (let i = 0; i < 7; i++) dayMap[i] = { sum: 0, count: 0 };

    let totalSum = 0;
    const commentWords: Record<string, number> = {};

    for (const r of ratings as { rating: number; comment?: string; created_at: string }[]) {
      const day = new Date(r.created_at).getDay();
      dayMap[day].sum += r.rating ?? 0;
      dayMap[day].count += 1;
      totalSum += r.rating ?? 0;

      if (r.comment) {
        const words = r.comment.toLowerCase().split(/\s+/);
        for (const w of words) {
          if (w.length > 4) commentWords[w] = (commentWords[w] ?? 0) + 1;
        }
      }
    }

    const verlauf: WochentagBewertung[] = WOCHENTAG_LABEL.map((label, i) => ({
      wochentag: i,
      label,
      durchschnitt: dayMap[i].count > 0 ? +(dayMap[i].sum / dayMap[i].count).toFixed(1) : 0,
      anzahl: dayMap[i].count,
    }));

    const gesamt_schnitt = +(totalSum / ratings.length).toFixed(1);

    // Trend: letzte 7 Tage vs. davor
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = (ratings as { rating: number; created_at: string }[]).filter(r => new Date(r.created_at) >= cutoff);
    const older = (ratings as { rating: number; created_at: string }[]).filter(r => new Date(r.created_at) < cutoff);
    const recentAvg = recent.length ? recent.reduce((s, r) => s + r.rating, 0) / recent.length : gesamt_schnitt;
    const olderAvg = older.length ? older.reduce((s, r) => s + r.rating, 0) / older.length : gesamt_schnitt;
    const delta = recentAvg - olderAvg;
    const trend_pct = olderAvg > 0 ? Math.round((delta / olderAvg) * 100) : 0;
    const trend: 'positiv' | 'stabil' | 'negativ' = delta > 0.1 ? 'positiv' : delta < -0.1 ? 'negativ' : 'stabil';

    // Top-3 Beschwerde-Schlüsselwörter
    const top_beschwerden = Object.entries(commentWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([w]) => w);

    return NextResponse.json({
      wochentag_verlauf: verlauf,
      gesamt_schnitt,
      top_beschwerden: top_beschwerden.length ? top_beschwerden : buildMock(locationId).top_beschwerden,
      trend,
      trend_pct,
      total_bewertungen: ratings.length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
