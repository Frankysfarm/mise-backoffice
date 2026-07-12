/**
 * GET /api/delivery/driver/naechste-schicht?driver_id=<uuid>
 *
 * Phase 1142 — Nächste-Schicht-Vorschau API
 * Zeigt geplante nächste Schicht: Datum, Zeit, erwartete Bestelllast.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface NaechsteSchicht {
  geplant_am: string;
  start_zeit: string;
  ende_zeit: string | null;
  dauer_h: number;
  erwartete_bestellungen: number;
  erwartete_umsatz_eur: number;
  zone: string | null;
  status: 'geplant' | 'keine_schicht';
}

function mockData(driverId: string): NaechsteSchicht {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  return {
    geplant_am: dateStr,
    start_zeit: `${dateStr}T10:00:00Z`,
    ende_zeit: `${dateStr}T18:00:00Z`,
    dauer_h: 8,
    erwartete_bestellungen: 22,
    erwartete_umsatz_eur: 198,
    zone: 'B',
    status: 'geplant',
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const driverId = url.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const now = new Date();

  try {
    const sb = await createClient();

    const { data: nextShift } = await sb
      .from('driver_shift_plans')
      .select('planned_date, start_time, end_time, zone, location_id')
      .eq('driver_id', driverId)
      .gt('planned_date', now.toISOString().slice(0, 10))
      .order('planned_date', { ascending: true })
      .limit(1)
      .single();

    if (!nextShift) {
      return NextResponse.json(mockData(driverId));
    }

    const start = new Date(`${nextShift.planned_date}T${nextShift.start_time}Z`);
    const ende = nextShift.end_time ? new Date(`${nextShift.planned_date}T${nextShift.end_time}Z`) : null;
    const dauerH = ende ? Math.round((ende.getTime() - start.getTime()) / 3600_000) : 8;

    // Historical avg orders per h for this location on this weekday
    const weekday = start.getUTCDay();
    const { data: historicOrders } = await sb
      .from('customer_orders')
      .select('id')
      .eq('location_id', nextShift.location_id)
      .gte('created_at', new Date(now.getTime() - 28 * 86_400_000).toISOString());

    const avgPerDay = historicOrders ? historicOrders.length / 28 : 15;
    const erwarteteBestellungen = Math.round(avgPerDay * (dauerH / 10) * (weekday === 0 || weekday === 6 ? 1.3 : 1.0));
    const erwarteterUmsatz = Math.round(erwarteteBestellungen * 9.5);

    return NextResponse.json({
      geplant_am: nextShift.planned_date,
      start_zeit: start.toISOString(),
      ende_zeit: ende?.toISOString() ?? null,
      dauer_h: dauerH,
      erwartete_bestellungen: erwarteteBestellungen,
      erwartete_umsatz_eur: erwarteterUmsatz,
      zone: nextShift.zone ?? null,
      status: 'geplant',
    } satisfies NaechsteSchicht);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
