/**
 * GET /api/delivery/admin/zonen-umsatz-prognose?location_id=<uuid>
 *
 * Phase 1883 — Zonen-Umsatz-Prognose-API
 * Prognose Umsatz je Zone A/B/C/D für die nächsten 2h
 * basierend auf historischem Trend + aktueller Tageszeit.
 * Multi-Tenant. Supabase+Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Trend = 'up' | 'down' | 'gleich';

interface ZonenPrognose {
  zone: string;
  umsatz_aktuell_cents: number;
  umsatz_prognose_2h_cents: number;
  umsatz_ziel_cents: number;
  umsatz_letzte_woche_cents: number;
  bestellungen_aktuell: number;
  bestellungen_prognose_2h: number;
  trend: Trend;
  unter_ziel: boolean;
  prognose_delta_prozent: number;
}

interface ApiAntwort {
  location_id: string;
  zonen: ZonenPrognose[];
  gesamt_unter_ziel: number;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  zonen: [
    {
      zone: 'A',
      umsatz_aktuell_cents: 9600,
      umsatz_prognose_2h_cents: 14400,
      umsatz_ziel_cents: 16000,
      umsatz_letzte_woche_cents: 15200,
      bestellungen_aktuell: 12,
      bestellungen_prognose_2h: 18,
      trend: 'up',
      unter_ziel: false,
      prognose_delta_prozent: -10,
    },
    {
      zone: 'B',
      umsatz_aktuell_cents: 6200,
      umsatz_prognose_2h_cents: 8400,
      umsatz_ziel_cents: 12000,
      umsatz_letzte_woche_cents: 11800,
      bestellungen_aktuell: 8,
      bestellungen_prognose_2h: 11,
      trend: 'down',
      unter_ziel: true,
      prognose_delta_prozent: -30,
    },
    {
      zone: 'C',
      umsatz_aktuell_cents: 3100,
      umsatz_prognose_2h_cents: 4200,
      umsatz_ziel_cents: 6000,
      umsatz_letzte_woche_cents: 5800,
      bestellungen_aktuell: 4,
      bestellungen_prognose_2h: 6,
      trend: 'down',
      unter_ziel: true,
      prognose_delta_prozent: -30,
    },
    {
      zone: 'D',
      umsatz_aktuell_cents: 1200,
      umsatz_prognose_2h_cents: 2000,
      umsatz_ziel_cents: 2200,
      umsatz_letzte_woche_cents: 2100,
      bestellungen_aktuell: 2,
      bestellungen_prognose_2h: 3,
      trend: 'gleich',
      unter_ziel: false,
      prognose_delta_prozent: -9,
    },
  ],
  gesamt_unter_ziel: 2,
  generiert_am: new Date().toISOString(),
};

const ZONES = ['A', 'B', 'C', 'D'] as const;

function calcTrend(aktuell: number, vorwoche: number): Trend {
  const diff = (aktuell - vorwoche) / Math.max(1, vorwoche);
  if (diff > 0.05) return 'up';
  if (diff < -0.05) return 'down';
  return 'gleich';
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setUTCHours(5, 0, 0, 0);
    if (now.getUTCHours() < 5) todayStart.setUTCDate(todayStart.getUTCDate() - 1);

    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);

    const weekStartPrev = new Date(weekStart);
    weekStartPrev.setUTCDate(weekStartPrev.getUTCDate() - 7);

    const { data: orders } = await sb
      .from('customer_orders')
      .select('id, delivery_zone, total_price_cents, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', weekStartPrev.toISOString())
      .not('total_price_cents', 'is', null);

    if (!orders || orders.length === 0) {
      return NextResponse.json({ ...MOCK, location_id: locationId });
    }

    const todayStartMs = todayStart.getTime();
    const weekStartMs = weekStart.getTime();
    const nowMs = now.getTime();

    const minutesIntoDay = (nowMs - todayStartMs) / 60_000;
    const schichtDauerMin = 14 * 60;
    const verbrauchterAnteil = Math.max(0.01, Math.min(1, minutesIntoDay / schichtDauerMin));
    const verbleibendeAnteil = Math.max(0, 1 - verbrauchterAnteil);
    const prognoseHorizon = 120;
    const prognoseAnteil = prognoseHorizon / schichtDauerMin;

    type ZoneAcc = {
      heute_cents: number;
      heute_bestellungen: number;
      vorwoche_cents: number;
    };

    const accMap = new Map<string, ZoneAcc>(
      ZONES.map((z) => [z, { heute_cents: 0, heute_bestellungen: 0, vorwoche_cents: 0 }]),
    );

    for (const o of orders as { id: string; delivery_zone: string | null; total_price_cents: number | null; created_at: string; status: string }[]) {
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (!ZONES.includes(zone as typeof ZONES[number])) continue;

      const acc = accMap.get(zone)!;
      const createdMs = new Date(o.created_at).getTime();
      const umsatz = o.total_price_cents ?? 0;

      if (createdMs >= todayStartMs) {
        acc.heute_cents += umsatz;
        acc.heute_bestellungen++;
      } else if (createdMs >= weekStartMs) {
        acc.vorwoche_cents += umsatz;
      }
    }

    const zonen: ZonenPrognose[] = ZONES.map((z) => {
      const acc = accMap.get(z)!;
      const mock = MOCK.zonen.find((m) => m.zone === z)!;

      const aktuell = acc.heute_cents || mock.umsatz_aktuell_cents;
      const vorwoche = acc.vorwoche_cents || mock.umsatz_letzte_woche_cents;

      const tagessatzPrognose = verbrauchterAnteil > 0.01
        ? Math.round((aktuell / verbrauchterAnteil) * prognoseAnteil)
        : Math.round(vorwoche * prognoseAnteil);

      const prognose2h = aktuell + tagessatzPrognose;
      const ziel = Math.round(vorwoche * 1.05);
      const delta = ziel > 0 ? Math.round(((prognose2h - ziel) / ziel) * 100) : 0;
      const unterZiel = delta < -20;
      const trend = calcTrend(aktuell, vorwoche);

      return {
        zone: z,
        umsatz_aktuell_cents: aktuell,
        umsatz_prognose_2h_cents: prognose2h,
        umsatz_ziel_cents: ziel,
        umsatz_letzte_woche_cents: vorwoche,
        bestellungen_aktuell: acc.heute_bestellungen,
        bestellungen_prognose_2h: Math.round(acc.heute_bestellungen * (1 + prognoseAnteil / verbrauchterAnteil)),
        trend,
        unter_ziel: unterZiel,
        prognose_delta_prozent: delta,
      };
    });

    return NextResponse.json({
      location_id: locationId,
      zonen,
      gesamt_unter_ziel: zonen.filter((z) => z.unter_ziel).length,
      generiert_am: now.toISOString(),
    } satisfies ApiAntwort);
  } catch (err) {
    console.error('[zonen-umsatz-prognose]', err);
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
