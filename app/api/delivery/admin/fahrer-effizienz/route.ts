/**
 * GET /api/delivery/admin/fahrer-effizienz?location_id=<uuid>
 *
 * Phase 1667 — Fahrer-Effizienz-Score-API
 * Score (0–100) je Fahrer heute: km/Stopp + Lieferzeit-Pünktlichkeit + Bewertung.
 * 7-Tage-Trend. Multi-Tenant: location_id je Query. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerEffizienz {
  driver_id: string;
  fahrer_name: string;
  score_heute: number;
  score_7d_avg: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
}

interface FahrerEffizienzResponse {
  location_id: string;
  fahrer: FahrerEffizienz[];
  generiert_am: string;
}

function buildMock(locationId: string): FahrerEffizienzResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const rng = (base: number, range: number, s: number) =>
    Math.round((base + ((seed * s) % range) - range / 2) * 10) / 10;

  const fahrer: FahrerEffizienz[] = [
    {
      driver_id: 'mock-d1',
      fahrer_name: 'Max M.',
      score_heute: Math.min(100, Math.max(0, Math.round(rng(82, 20, 7)))),
      score_7d_avg: Math.min(100, Math.max(0, Math.round(rng(78, 20, 11)))),
      trend: 'steigend',
      km_pro_stopp: Math.round(rng(3.4, 2, 13) * 10) / 10,
      puenktlichkeit_pct: Math.min(100, Math.max(0, Math.round(rng(91, 12, 17)))),
      bewertung_avg: Math.min(5, Math.max(1, Math.round(rng(4.5, 0.8, 19) * 10) / 10)),
      stopps_heute: Math.max(1, Math.round(rng(12, 8, 23))),
    },
    {
      driver_id: 'mock-d2',
      fahrer_name: 'Lisa K.',
      score_heute: Math.min(100, Math.max(0, Math.round(rng(74, 20, 29)))),
      score_7d_avg: Math.min(100, Math.max(0, Math.round(rng(79, 20, 31)))),
      trend: 'fallend',
      km_pro_stopp: Math.round(rng(4.1, 2, 37) * 10) / 10,
      puenktlichkeit_pct: Math.min(100, Math.max(0, Math.round(rng(84, 14, 41)))),
      bewertung_avg: Math.min(5, Math.max(1, Math.round(rng(4.2, 0.8, 43) * 10) / 10)),
      stopps_heute: Math.max(1, Math.round(rng(9, 8, 47))),
    },
    {
      driver_id: 'mock-d3',
      fahrer_name: 'Tom B.',
      score_heute: Math.min(100, Math.max(0, Math.round(rng(91, 14, 61)))),
      score_7d_avg: Math.min(100, Math.max(0, Math.round(rng(89, 12, 67)))),
      trend: 'steigend',
      km_pro_stopp: Math.round(rng(2.8, 1.6, 71) * 10) / 10,
      puenktlichkeit_pct: Math.min(100, Math.max(0, Math.round(rng(96, 6, 79)))),
      bewertung_avg: Math.min(5, Math.max(1, Math.round(rng(4.7, 0.6, 83) * 10) / 10)),
      stopps_heute: Math.max(1, Math.round(rng(15, 8, 89))),
    },
  ];

  return { location_id: locationId, fahrer, generiert_am: new Date().toISOString() };
}

function calcScore(kmProStopp: number, puenktlichkeit: number, bewertung: number): number {
  // Effizienz-km: niedrigere km/Stopp = besser; Referenz: 5 km → 100 Punkte, 10 km → 0 Punkte
  const kmScore = Math.max(0, Math.min(100, Math.round((1 - (kmProStopp - 1) / 9) * 100)));
  const punktScore = Math.round(puenktlichkeit);
  const ratingScore = Math.round(((bewertung - 1) / 4) * 100);
  return Math.round(kmScore * 0.3 + punktScore * 0.4 + ratingScore * 0.3);
}

function trendOf(heute: number, avg7d: number): FahrerEffizienz['trend'] {
  const diff = heute - avg7d;
  if (diff > 3) return 'steigend';
  if (diff < -3) return 'fallend';
  return 'stabil';
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(todayStart);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const SLA_MIN = 45;

    async function queryTouren(from: Date, to: Date) {
      let q = (sb as any)
        .from('tours')
        .select('driver_id, created_at, delivered_at, distance_km, bewertung')
        .not('delivered_at', 'is', null)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());

      if (locationId !== 'all') q = q.eq('location_id', locationId);

      const { data, error } = await q;
      if (error || !data) return [];
      return data as Array<{
        driver_id: string;
        created_at: string;
        delivered_at: string;
        distance_km: number | null;
        bewertung: number | null;
      }>;
    }

    const [tourenHeute, touren7d] = await Promise.all([
      queryTouren(todayStart, now),
      queryTouren(sevenDaysAgo, todayStart),
    ]);

    if (!tourenHeute.length && !touren7d.length) {
      return NextResponse.json(buildMock(locationId));
    }

    const allDriverIds = [...new Set([...tourenHeute, ...touren7d].map(t => t.driver_id))];

    async function loadNames(ids: string[]): Promise<Record<string, string>> {
      if (!ids.length) return {};
      const { data } = await (sb as any).from('drivers').select('id, name').in('id', ids);
      const map: Record<string, string> = {};
      for (const d of data ?? []) map[d.id] = d.name;
      return map;
    }

    const names = await loadNames(allDriverIds);

    function aggregate(touren: typeof tourenHeute) {
      const byDriver: Record<string, {
        stopps: number;
        km: number;
        sla_ok: number;
        bewertungen: number[];
      }> = {};

      for (const t of touren) {
        if (!byDriver[t.driver_id]) byDriver[t.driver_id] = { stopps: 0, km: 0, sla_ok: 0, bewertungen: [] };
        const dmin = (new Date(t.delivered_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        byDriver[t.driver_id].stopps++;
        byDriver[t.driver_id].km += t.distance_km ?? 3.5;
        if (dmin <= SLA_MIN) byDriver[t.driver_id].sla_ok++;
        if (t.bewertung != null) byDriver[t.driver_id].bewertungen.push(t.bewertung);
      }

      return byDriver;
    }

    const heuteMap = aggregate(tourenHeute);
    const map7d = aggregate(touren7d);

    const fahrer: FahrerEffizienz[] = allDriverIds.map(id => {
      const h = heuteMap[id];
      const w = map7d[id];

      const kmProStopp = h ? Math.round((h.km / h.stopps) * 10) / 10 : 3.5;
      const puenktlichkeit = h && h.stopps > 0 ? Math.round((h.sla_ok / h.stopps) * 100) : 0;
      const bewertungHeute = h?.bewertungen.length
        ? Math.round((h.bewertungen.reduce((a, b) => a + b, 0) / h.bewertungen.length) * 10) / 10
        : 4.0;

      const scoreHeute = calcScore(kmProStopp, puenktlichkeit, bewertungHeute);

      const kmProStopp7d = w ? Math.round((w.km / w.stopps) * 10) / 10 : kmProStopp;
      const puenkt7d = w && w.stopps > 0 ? Math.round((w.sla_ok / w.stopps) * 100) : puenktlichkeit;
      const bew7d = w?.bewertungen.length
        ? Math.round((w.bewertungen.reduce((a, b) => a + b, 0) / w.bewertungen.length) * 10) / 10
        : bewertungHeute;
      const score7dAvg = calcScore(kmProStopp7d, puenkt7d, bew7d);

      return {
        driver_id: id,
        fahrer_name: names[id] ?? id.slice(0, 8),
        score_heute: Math.min(100, Math.max(0, scoreHeute)),
        score_7d_avg: Math.min(100, Math.max(0, score7dAvg)),
        trend: trendOf(scoreHeute, score7dAvg),
        km_pro_stopp: kmProStopp,
        puenktlichkeit_pct: puenktlichkeit,
        bewertung_avg: bewertungHeute,
        stopps_heute: h?.stopps ?? 0,
      };
    });

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerEffizienzResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
