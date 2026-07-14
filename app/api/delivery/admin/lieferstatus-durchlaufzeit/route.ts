/**
 * GET /api/delivery/admin/lieferstatus-durchlaufzeit?location_id=<uuid>
 *
 * Phase 1617 — Lieferstatus-Durchlaufzeit-API
 * Ø Zeit je Status-Übergang (neu→in-arbeit, in-arbeit→fertig, fertig→unterwegs, unterwegs→geliefert).
 * Trend vs. Vortag. Supabase + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StatusUebergang {
  von: string;
  nach: string;
  label: string;
  avg_min: number;
  avg_min_gestern: number | null;
  trend: 'besser' | 'schlechter' | 'gleich';
  beobachtungen: number;
}

export interface LieferstatusDurchlaufzeitResponse {
  uebergaenge: StatusUebergang[];
  gesamtzeit_avg_min: number;
  location_id: string;
  generiert_am: string;
}

function calcTrend(heute: number, gestern: number | null): 'besser' | 'schlechter' | 'gleich' {
  if (gestern === null) return 'gleich';
  const delta = heute - gestern;
  if (delta < -0.5) return 'besser';
  if (delta > 0.5) return 'schlechter';
  return 'gleich';
}

function buildMock(locationId: string): LieferstatusDurchlaufzeitResponse {
  const uebergaenge: StatusUebergang[] = [
    { von: 'neu', nach: 'in_zubereitung', label: 'Annahme → Zubereitung', avg_min: 2.1, avg_min_gestern: 2.5, trend: 'besser', beobachtungen: 38 },
    { von: 'in_zubereitung', nach: 'fertig', label: 'Zubereitung → Fertig', avg_min: 14.8, avg_min_gestern: 13.9, trend: 'schlechter', beobachtungen: 35 },
    { von: 'fertig', nach: 'unterwegs', label: 'Fertig → Abgeholt', avg_min: 3.4, avg_min_gestern: 3.4, trend: 'gleich', beobachtungen: 33 },
    { von: 'unterwegs', nach: 'geliefert', label: 'Unterwegs → Geliefert', avg_min: 18.2, avg_min_gestern: 19.1, trend: 'besser', beobachtungen: 31 },
  ];
  return {
    uebergaenge,
    gesamtzeit_avg_min: uebergaenge.reduce((s, u) => s + u.avg_min, 0),
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    const { data: orders, error } = await (sb as any)
      .from('orders')
      .select('id, status, created_at, accepted_at, preparation_started_at, ready_at, picked_up_at, delivered_at')
      .eq('location_id', locationId)
      .gte('created_at', `${yesterday}T00:00:00`)
      .not('delivered_at', 'is', null);

    if (error || !orders || (orders as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    type OrderRow = {
      created_at: string | null;
      accepted_at: string | null;
      ready_at: string | null;
      picked_up_at: string | null;
      delivered_at: string | null;
    };

    function avgMinBetween(rows: OrderRow[], getA: (r: OrderRow) => string | null, getB: (r: OrderRow) => string | null) {
      const pairs = rows
        .map((r) => {
          const a = getA(r);
          const b = getB(r);
          if (!a || !b) return null;
          return (new Date(b).getTime() - new Date(a).getTime()) / 60_000;
        })
        .filter((v): v is number => v !== null && v >= 0 && v < 120);
      if (pairs.length === 0) return null;
      return { avg: pairs.reduce((s, v) => s + v, 0) / pairs.length, n: pairs.length };
    }

    const isToday = (r: OrderRow) => r.created_at?.startsWith(today);
    const isYesterday = (r: OrderRow) => r.created_at?.startsWith(yesterday);
    const todayRows = (orders as OrderRow[]).filter(isToday);
    const yestRows = (orders as OrderRow[]).filter(isYesterday);

    const transitions: Array<{ von: string; nach: string; label: string; getA: (r: OrderRow) => string | null; getB: (r: OrderRow) => string | null }> = [
      { von: 'neu', nach: 'in_zubereitung', label: 'Annahme → Zubereitung', getA: (r) => r.created_at, getB: (r) => r.accepted_at },
      { von: 'in_zubereitung', nach: 'fertig', label: 'Zubereitung → Fertig', getA: (r) => r.accepted_at, getB: (r) => r.ready_at },
      { von: 'fertig', nach: 'unterwegs', label: 'Fertig → Abgeholt', getA: (r) => r.ready_at, getB: (r) => r.picked_up_at },
      { von: 'unterwegs', nach: 'geliefert', label: 'Unterwegs → Geliefert', getA: (r) => r.picked_up_at, getB: (r) => r.delivered_at },
    ];

    const uebergaenge: StatusUebergang[] = transitions.map((t) => {
      const today_res = avgMinBetween(todayRows, t.getA, t.getB);
      const yest_res = avgMinBetween(yestRows, t.getA, t.getB);
      const avg_today = today_res?.avg ?? 0;
      const avg_yest = yest_res?.avg ?? null;
      return {
        von: t.von,
        nach: t.nach,
        label: t.label,
        avg_min: Math.round(avg_today * 10) / 10,
        avg_min_gestern: avg_yest !== null ? Math.round(avg_yest * 10) / 10 : null,
        trend: calcTrend(avg_today, avg_yest),
        beobachtungen: today_res?.n ?? 0,
      };
    });

    return NextResponse.json({
      uebergaenge,
      gesamtzeit_avg_min: Math.round(uebergaenge.reduce((s, u) => s + u.avg_min, 0) * 10) / 10,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies LieferstatusDurchlaufzeitResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
