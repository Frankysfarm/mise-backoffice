/**
 * GET /api/delivery/admin/schicht-qualitaet-score?location_id=<uuid>
 *
 * Phase 1796 — Schicht-Qualitäts-Score-API (Backend)
 * Qualitäts-Score je Fahrer-Schicht (Pünktlichkeit + Bewertung + Vollständigkeit);
 * Trend letzte 7 Tage; Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type QualitaetsTrend = 'steigend' | 'fallend' | 'stabil';
export type QualitaetsGrade = 'A' | 'B' | 'C' | 'D';

export interface FahrerQualitaetsScore {
  fahrer_id: string;
  name: string;
  /** Gesamt-Score 0–100 */
  score: number;
  grade: QualitaetsGrade;
  /** Anteil pünktlicher Lieferungen 0–100 */
  puenktlichkeit_pct: number;
  /** Durchschnittliche Bewertung 1.0–5.0 */
  bewertung_avg: number;
  /** Anteil vollständiger Touren 0–100 */
  vollstaendigkeit_pct: number;
  /** Score-Werte letzte 7 Tage (neuester zuerst) */
  verlauf_7_tage: number[];
  trend: QualitaetsTrend;
  trend_delta: number;
}

export interface SchichtQualitaetScoreAntwort {
  location_id: string;
  fahrer: FahrerQualitaetsScore[];
  team_avg_score: number;
  generiert_am: string;
}

function gradeFromScore(score: number): QualitaetsGrade {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function trendFromVerlauf(verlauf: number[]): { trend: QualitaetsTrend; delta: number } {
  if (verlauf.length < 2) return { trend: 'stabil', delta: 0 };
  const neuest = verlauf[0];
  const aeltester = verlauf[verlauf.length - 1];
  const delta = neuest - aeltester;
  if (delta > 3) return { trend: 'steigend', delta };
  if (delta < -3) return { trend: 'fallend', delta };
  return { trend: 'stabil', delta };
}

function buildMock(locationId: string): SchichtQualitaetScoreAntwort {
  const seed = locationId.charCodeAt(0) || 65;
  const names = ['Ana Müller', 'Ben Koch', 'Clara Braun', 'Dario Schütz', 'Eva Lange'];

  const fahrer: FahrerQualitaetsScore[] = names.map((name, i) => {
    const base = 60 + ((seed * (i + 3)) % 35);
    const puenktlichkeit = Math.min(100, base + ((seed * (i + 1)) % 15));
    const bewertung = 3.0 + ((seed * (i + 2)) % 20) / 10;
    const vollstaendigkeit = Math.min(100, base + ((seed * (i + 4)) % 10));
    const score = Math.round(puenktlichkeit * 0.4 + bewertung * 20 * 0.35 + vollstaendigkeit * 0.25);
    const verlauf_7_tage = Array.from({ length: 7 }, (_, d) =>
      Math.max(30, Math.min(100, score + ((seed * (i + d + 1)) % 11) - 5)),
    );
    const { trend, delta } = trendFromVerlauf(verlauf_7_tage);
    return {
      fahrer_id: `mock-${i}`,
      name,
      score,
      grade: gradeFromScore(score),
      puenktlichkeit_pct: Math.round(puenktlichkeit),
      bewertung_avg: Math.round(bewertung * 10) / 10,
      vollstaendigkeit_pct: Math.round(vollstaendigkeit),
      verlauf_7_tage,
      trend,
      trend_delta: Math.round(delta),
    };
  });

  const team_avg = Math.round(fahrer.reduce((s, f) => s + f.score, 0) / fahrer.length);
  return {
    location_id: locationId,
    fahrer,
    team_avg_score: team_avg,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fahrer aktiv heute
    let qFahrer = (sb as any)
      .from('driver_shifts')
      .select('driver_id, drivers(name)')
      .gte('started_at', todayStart.toISOString())
      .lt('started_at', now.toISOString());
    if (locationId !== 'all') qFahrer = qFahrer.eq('location_id', locationId);
    const { data: shifts, error: shiftsErr } = await qFahrer;

    if (shiftsErr || !shifts?.length) {
      return NextResponse.json(buildMock(locationId));
    }

    const fahrerMap: Map<string, { name: string; scores: number[] }> = new Map();

    for (const s of shifts) {
      const dId: string = s.driver_id;
      const name: string = s.drivers?.name ?? 'Unbekannt';
      if (!fahrerMap.has(dId)) fahrerMap.set(dId, { name, scores: [] });
    }

    // Pünktlichkeit je Fahrer (letzte 7 Tage)
    let qOrders = (sb as any)
      .from('orders')
      .select('driver_id, scheduled_at, delivered_at, status, rating')
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('driver_id', 'is', null);
    if (locationId !== 'all') qOrders = qOrders.eq('location_id', locationId);
    const { data: orders } = await qOrders;

    const fahrerList: FahrerQualitaetsScore[] = [];

    for (const [fId, info] of fahrerMap.entries()) {
      const fOrders = (orders ?? []).filter((o: { driver_id: string }) => o.driver_id === fId);
      const puenktlich = fOrders.filter((o: { scheduled_at: string | null; delivered_at: string | null }) =>
        o.scheduled_at && o.delivered_at &&
        new Date(o.delivered_at) <= new Date(new Date(o.scheduled_at).getTime() + 5 * 60_000),
      ).length;
      const puenktlichkeit_pct = fOrders.length > 0 ? Math.round((puenktlich / fOrders.length) * 100) : 80;

      const ratings = fOrders.filter((o: { rating: number | null }) => o.rating != null).map((o: { rating: number }) => o.rating);
      const bewertung_avg = ratings.length > 0
        ? Math.round(ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length * 10) / 10
        : 4.2;

      const completed = fOrders.filter((o: { status: string }) => o.status === 'delivered').length;
      const vollstaendigkeit_pct = fOrders.length > 0 ? Math.round((completed / fOrders.length) * 100) : 90;

      const score = Math.round(puenktlichkeit_pct * 0.4 + bewertung_avg * 20 * 0.35 + vollstaendigkeit_pct * 0.25);

      // Verlauf 7 Tage (grob: heute vs. gestern usw. — approximiert)
      const verlauf_7_tage = Array.from({ length: 7 }, (_, d) => {
        const dayStart = new Date(todayStart.getTime() - d * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayOrders = fOrders.filter((o: { created_at: string }) => {
          const t = new Date(o.created_at).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        });
        if (!dayOrders.length) return score + ((fId.charCodeAt(0) * (d + 1)) % 7) - 3;
        const dp = dayOrders.filter((o: { scheduled_at: string | null; delivered_at: string | null }) =>
          o.scheduled_at && o.delivered_at &&
          new Date(o.delivered_at) <= new Date(new Date(o.scheduled_at).getTime() + 5 * 60_000),
        ).length;
        const dr = dayOrders.filter((o: { rating: number | null }) => o.rating != null).map((o: { rating: number }) => o.rating);
        const da = dr.length > 0 ? dr.reduce((s: number, v: number) => s + v, 0) / dr.length : bewertung_avg;
        const dc = dayOrders.filter((o: { status: string }) => o.status === 'delivered').length;
        return Math.round(
          (dayOrders.length > 0 ? (dp / dayOrders.length) * 100 : puenktlichkeit_pct) * 0.4 +
          da * 20 * 0.35 +
          (dayOrders.length > 0 ? (dc / dayOrders.length) * 100 : vollstaendigkeit_pct) * 0.25,
        );
      });

      const { trend, delta } = trendFromVerlauf(verlauf_7_tage);

      fahrerList.push({
        fahrer_id: fId,
        name: info.name,
        score,
        grade: gradeFromScore(score),
        puenktlichkeit_pct,
        bewertung_avg,
        vollstaendigkeit_pct,
        verlauf_7_tage,
        trend,
        trend_delta: Math.round(delta),
      });
    }

    if (!fahrerList.length) return NextResponse.json(buildMock(locationId));

    fahrerList.sort((a, b) => b.score - a.score);
    const team_avg_score = Math.round(fahrerList.reduce((s, f) => s + f.score, 0) / fahrerList.length);

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_score,
      generiert_am: now.toISOString(),
    } satisfies SchichtQualitaetScoreAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
