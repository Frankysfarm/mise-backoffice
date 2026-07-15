/**
 * GET /api/delivery/admin/kunden-wiederkehr-rate?location_id=<uuid>
 *
 * Phase 1712 — Kunden-Wiederkehr-Rate-API
 * Anteil Kunden mit ≥2 Bestellungen in letzten 30 Tagen.
 * Trend vs. Vormonat. Je Zone aufgeschlüsselt.
 * Supabase + Mock-Fallback. Multi-Tenant: location_id je Query.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoneWiederkehr {
  zone: string;
  wiederkehr_pct: number;
  kunden_gesamt: number;
  kunden_wiederkehrend: number;
}

interface KundenWiederkehrRateResponse {
  location_id: string;
  wiederkehr_pct: number;
  wiederkehr_pct_vormonat: number;
  trend_pct: number;
  kunden_gesamt: number;
  kunden_wiederkehrend: number;
  zonen: ZoneWiederkehr[];
  generiert_am: string;
}

function buildMock(locationId: string): KundenWiederkehrRateResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const r = (base: number, range: number, s: number) =>
    Math.round(base + ((seed * s) % range) - range / 2);

  const wiederkehr_pct = Math.max(20, Math.min(80, r(45, 30, 7)));
  const wiederkehr_pct_vormonat = Math.max(15, Math.min(78, r(42, 28, 11)));

  return {
    location_id: locationId,
    wiederkehr_pct,
    wiederkehr_pct_vormonat,
    trend_pct: wiederkehr_pct - wiederkehr_pct_vormonat,
    kunden_gesamt: r(120, 80, 13),
    kunden_wiederkehrend: Math.round((r(120, 80, 13) * wiederkehr_pct) / 100),
    zonen: [
      { zone: 'A', wiederkehr_pct: Math.max(20, r(52, 20, 17)), kunden_gesamt: r(40, 20, 19), kunden_wiederkehrend: r(22, 12, 23) },
      { zone: 'B', wiederkehr_pct: Math.max(20, r(44, 20, 29)), kunden_gesamt: r(35, 18, 31), kunden_wiederkehrend: r(16, 10, 37) },
      { zone: 'C', wiederkehr_pct: Math.max(15, r(38, 20, 41)), kunden_gesamt: r(28, 16, 43), kunden_wiederkehrend: r(11, 8, 47) },
      { zone: 'D', wiederkehr_pct: Math.max(10, r(32, 18, 53)), kunden_gesamt: r(17, 12, 59), kunden_wiederkehrend: r(6, 6, 61) },
    ],
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const period30Start = new Date(now);
    period30Start.setUTCDate(period30Start.getUTCDate() - 30);

    const prevMonthEnd = new Date(period30Start);
    const prevMonthStart = new Date(prevMonthEnd);
    prevMonthStart.setUTCDate(prevMonthStart.getUTCDate() - 30);

    async function loadOrders(from: Date, to: Date) {
      let q = (sb as any)
        .from('orders')
        .select('customer_id, delivery_zone')
        .not('customer_id', 'is', null)
        .gte('created_at', from.toISOString())
        .lt('created_at', to.toISOString());

      if (locationId !== 'all') q = q.eq('location_id', locationId);

      const { data, error } = await q;
      if (error || !data) return [];
      return data as Array<{ customer_id: string; delivery_zone: string | null }>;
    }

    const [ordersAktuell, ordersVormonat] = await Promise.all([
      loadOrders(period30Start, now),
      loadOrders(prevMonthStart, prevMonthEnd),
    ]);

    if (!ordersAktuell.length && !ordersVormonat.length) {
      return NextResponse.json(buildMock(locationId));
    }

    function calcWiederkehr(orders: typeof ordersAktuell) {
      const counter: Record<string, number> = {};
      for (const o of orders) counter[o.customer_id] = (counter[o.customer_id] ?? 0) + 1;
      const gesamt = Object.keys(counter).length;
      const wiederkehrend = Object.values(counter).filter(c => c >= 2).length;
      return { gesamt, wiederkehrend, pct: gesamt > 0 ? Math.round((wiederkehrend / gesamt) * 100) : 0 };
    }

    function calcZonen(orders: typeof ordersAktuell): ZoneWiederkehr[] {
      const byZone: Record<string, Record<string, number>> = {};
      for (const o of orders) {
        const z = o.delivery_zone ?? 'X';
        if (!byZone[z]) byZone[z] = {};
        byZone[z][o.customer_id] = (byZone[z][o.customer_id] ?? 0) + 1;
      }
      return Object.entries(byZone)
        .filter(([z]) => ['A', 'B', 'C', 'D'].includes(z))
        .map(([zone, customers]) => {
          const gesamt = Object.keys(customers).length;
          const wiederkehrend = Object.values(customers).filter(c => c >= 2).length;
          return {
            zone,
            kunden_gesamt: gesamt,
            kunden_wiederkehrend: wiederkehrend,
            wiederkehr_pct: gesamt > 0 ? Math.round((wiederkehrend / gesamt) * 100) : 0,
          };
        })
        .sort((a, b) => a.zone.localeCompare(b.zone));
    }

    const aktuell = calcWiederkehr(ordersAktuell);
    const vormonat = calcWiederkehr(ordersVormonat);
    const zonen = calcZonen(ordersAktuell);

    return NextResponse.json({
      location_id: locationId,
      wiederkehr_pct: aktuell.pct,
      wiederkehr_pct_vormonat: vormonat.pct,
      trend_pct: aktuell.pct - vormonat.pct,
      kunden_gesamt: aktuell.gesamt,
      kunden_wiederkehrend: aktuell.wiederkehrend,
      zonen: zonen.length > 0 ? zonen : buildMock(locationId).zonen,
      generiert_am: new Date().toISOString(),
    } satisfies KundenWiederkehrRateResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
