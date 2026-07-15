/**
 * GET /api/delivery/admin/schicht-leistungs-vergleich?location_id=<uuid>
 *
 * Phase 1657 — Schicht-Leistungs-Vergleich-API
 * Fahrer-Performance heute vs. Vorwoche:
 * Stopps/h, Ø Lieferzeit, SLA-Quote, Kundenbewertung.
 * Supabase + Mock-Fallback. Multi-Tenant: location_id je Query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerLeistung {
  driver_id: string;
  fahrer_name: string;
  stopps_h_heute: number;
  stopps_h_vorwoche: number;
  lieferzeit_avg_heute: number;
  lieferzeit_avg_vorwoche: number;
  sla_quote_heute: number;
  sla_quote_vorwoche: number;
  bewertung_avg_heute: number;
  bewertung_avg_vorwoche: number;
}

interface SchichtLeistungsVergleichResponse {
  location_id: string;
  fahrer: FahrerLeistung[];
  generiert_am: string;
}

function buildMock(locationId: string): SchichtLeistungsVergleichResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const rng = (base: number, range: number, s: number) =>
    Math.round((base + ((seed * s) % range) - range / 2) * 10) / 10;

  const fahrer: FahrerLeistung[] = [
    {
      driver_id: 'mock-d1',
      fahrer_name: 'Max M.',
      stopps_h_heute: rng(3.2, 2, 7),
      stopps_h_vorwoche: rng(3.0, 2, 11),
      lieferzeit_avg_heute: rng(28, 10, 3),
      lieferzeit_avg_vorwoche: rng(30, 10, 5),
      sla_quote_heute: rng(92, 10, 13),
      sla_quote_vorwoche: rng(90, 10, 17),
      bewertung_avg_heute: rng(4.5, 0.8, 19),
      bewertung_avg_vorwoche: rng(4.4, 0.8, 23),
    },
    {
      driver_id: 'mock-d2',
      fahrer_name: 'Lisa K.',
      stopps_h_heute: rng(2.8, 2, 29),
      stopps_h_vorwoche: rng(3.1, 2, 31),
      lieferzeit_avg_heute: rng(32, 10, 37),
      lieferzeit_avg_vorwoche: rng(29, 10, 41),
      sla_quote_heute: rng(85, 12, 43),
      sla_quote_vorwoche: rng(91, 10, 47),
      bewertung_avg_heute: rng(4.2, 0.8, 53),
      bewertung_avg_vorwoche: rng(4.6, 0.8, 59),
    },
    {
      driver_id: 'mock-d3',
      fahrer_name: 'Tom B.',
      stopps_h_heute: rng(4.0, 2, 61),
      stopps_h_vorwoche: rng(3.8, 2, 67),
      lieferzeit_avg_heute: rng(25, 10, 71),
      lieferzeit_avg_vorwoche: rng(26, 10, 73),
      sla_quote_heute: rng(96, 6, 79),
      sla_quote_vorwoche: rng(94, 6, 83),
      bewertung_avg_heute: rng(4.7, 0.6, 89),
      bewertung_avg_vorwoche: rng(4.5, 0.6, 97),
    },
  ];

  return { location_id: locationId, fahrer, generiert_am: new Date().toISOString() };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const vorwocheStart = new Date(todayStart);
    vorwocheStart.setUTCDate(vorwocheStart.getUTCDate() - 7);
    const vorwocheEnd = new Date(vorwocheStart);
    vorwocheEnd.setUTCDate(vorwocheEnd.getUTCDate() + 1);

    const SLA_MIN = 45; // SLA-Ziel: 45 Minuten

    async function loadTouren(from: Date, to: Date) {
      let q = (sb as any)
        .from('tours')
        .select('driver_id, created_at, delivered_at, bewertung')
        .not('delivered_at', 'is', null)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());

      if (locationId !== 'all') {
        q = q.eq('location_id', locationId);
      }

      const { data, error } = await q;
      if (error || !data) return [];
      return data as Array<{ driver_id: string; created_at: string; delivered_at: string; bewertung: number | null }>;
    }

    async function loadFahrerNames(ids: string[]) {
      if (!ids.length) return {} as Record<string, string>;
      const { data } = await (sb as any)
        .from('drivers')
        .select('id, name')
        .in('id', ids);
      const map: Record<string, string> = {};
      for (const d of data ?? []) map[d.id] = d.name;
      return map;
    }

    const [tourenHeute, tourenVorwoche] = await Promise.all([
      loadTouren(todayStart, now),
      loadTouren(vorwocheStart, vorwocheEnd),
    ]);

    if (!tourenHeute.length && !tourenVorwoche.length) {
      return NextResponse.json(buildMock(locationId));
    }

    const allDriverIds = [...new Set([...tourenHeute, ...tourenVorwoche].map(t => t.driver_id))];
    const names = await loadFahrerNames(allDriverIds);

    function aggregateTouren(touren: typeof tourenHeute, elapsedH: number) {
      const byDriver: Record<string, { stopps: number; zeiten: number[]; sla_ok: number; bewertungen: number[] }> = {};
      for (const t of touren) {
        if (!byDriver[t.driver_id]) byDriver[t.driver_id] = { stopps: 0, zeiten: [], sla_ok: 0, bewertungen: [] };
        const dmin = (new Date(t.delivered_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        byDriver[t.driver_id].stopps++;
        byDriver[t.driver_id].zeiten.push(dmin);
        if (dmin <= SLA_MIN) byDriver[t.driver_id].sla_ok++;
        if (t.bewertung != null) byDriver[t.driver_id].bewertungen.push(t.bewertung);
      }
      return Object.entries(byDriver).map(([id, v]) => ({
        driver_id: id,
        stopps_h: elapsedH > 0 ? Math.round((v.stopps / elapsedH) * 10) / 10 : 0,
        lieferzeit_avg: v.zeiten.length ? Math.round(v.zeiten.reduce((a, b) => a + b, 0) / v.zeiten.length) : 0,
        sla_quote: v.stopps > 0 ? Math.round((v.sla_ok / v.stopps) * 100) : 0,
        bewertung_avg: v.bewertungen.length
          ? Math.round((v.bewertungen.reduce((a, b) => a + b, 0) / v.bewertungen.length) * 10) / 10
          : 0,
      }));
    }

    const elapsedH = (now.getTime() - todayStart.getTime()) / 3600000;
    const heuteMap = Object.fromEntries(aggregateTouren(tourenHeute, elapsedH).map(r => [r.driver_id, r]));
    const vorwocheMap = Object.fromEntries(aggregateTouren(tourenVorwoche, 8).map(r => [r.driver_id, r]));

    const fahrer: FahrerLeistung[] = allDriverIds.map(id => {
      const h = heuteMap[id];
      const v = vorwocheMap[id];
      return {
        driver_id: id,
        fahrer_name: names[id] ?? id.slice(0, 8),
        stopps_h_heute: h?.stopps_h ?? 0,
        stopps_h_vorwoche: v?.stopps_h ?? 0,
        lieferzeit_avg_heute: h?.lieferzeit_avg ?? 0,
        lieferzeit_avg_vorwoche: v?.lieferzeit_avg ?? 0,
        sla_quote_heute: h?.sla_quote ?? 0,
        sla_quote_vorwoche: v?.sla_quote ?? 0,
        bewertung_avg_heute: h?.bewertung_avg ?? 0,
        bewertung_avg_vorwoche: v?.bewertung_avg ?? 0,
      };
    });

    return NextResponse.json({ location_id: locationId, fahrer, generiert_am: new Date().toISOString() } satisfies SchichtLeistungsVergleichResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
