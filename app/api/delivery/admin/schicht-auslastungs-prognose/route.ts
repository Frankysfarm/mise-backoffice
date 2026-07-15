/**
 * GET /api/delivery/admin/schicht-auslastungs-prognose?location_id=<uuid>
 *
 * Phase 1776 — Schicht-Auslastungs-Prognose-API (Backend)
 * Vorhergesagte Bestellvolumen nächste 2h basierend auf historischer Stunden-Trendlinie;
 * Fahrerbedarf-Empfehlung je Slot; Multi-Tenant; Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StundenSlot {
  /** ISO-Zeitstring "HH:MM" für den Slot-Beginn */
  uhrzeit: string;
  /** Vorhergesagte Bestellanzahl */
  prognose_bestellungen: number;
  /** Empfohlene aktive Fahrer */
  empfohlene_fahrer: number;
  /** Historischer Durchschnitt für diese Stunde */
  historischer_avg: number;
}

export interface SchichtAuslastungsPrognoseAntwort {
  slots: StundenSlot[];
  aktuell_aktive_bestellungen: number;
  aktuell_online_fahrer: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): SchichtAuslastungsPrognoseAntwort {
  const now = new Date();
  const currentHour = now.getHours();
  const seed = locationId?.charCodeAt(0) ?? 77;

  const slots: StundenSlot[] = Array.from({ length: 4 }, (_, i) => {
    const hour = (currentHour + i) % 24;
    const hh = String(hour).padStart(2, '0');
    const baseOrders = 8 + Math.round(Math.sin((hour / 24) * Math.PI * 2 + seed) * 4) + (seed % 4);
    const historisch = Math.max(2, baseOrders - 1 + (i % 2));
    const prognose = Math.max(1, baseOrders + Math.round((seed % 3) - 1));
    return {
      uhrzeit: `${hh}:00`,
      prognose_bestellungen: prognose,
      empfohlene_fahrer: Math.max(1, Math.ceil(prognose / 4)),
      historischer_avg: historisch,
    };
  });

  return {
    slots,
    aktuell_aktive_bestellungen: 4 + (seed % 5),
    aktuell_online_fahrer: 2 + (seed % 3),
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
    const supabase = await createClient();
    const now = new Date();
    const currentHour = now.getHours();

    // Count currently active orders
    const { count: activeCount } = await (supabase as any)
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .in('status', ['accepted', 'preparing', 'in_progress', 'ready', 'dispatched']);

    // Count online drivers
    const { count: driverCount } = await (supabase as any)
      .from('driver_status')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('ist_online', true);

    // Historical order counts per hour from the last 7 days
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: historicalOrders } = await (supabase as any)
      .from('orders')
      .select('created_at')
      .eq('location_id', locationId)
      .gte('created_at', weekAgo);

    const hourCounts: Record<number, number[]> = {};
    for (const o of (historicalOrders ?? [])) {
      const h = new Date(o.created_at).getHours();
      if (!hourCounts[h]) hourCounts[h] = [];
      hourCounts[h].push(1);
    }

    const slots: StundenSlot[] = Array.from({ length: 4 }, (_, i) => {
      const hour = (currentHour + i) % 24;
      const hh = String(hour).padStart(2, '0');
      const counts = hourCounts[hour] ?? [];
      const historischer_avg = counts.length > 0
        ? Math.round(counts.length / 7)
        : 5 + i;
      const prognose_bestellungen = Math.max(1, Math.round(historischer_avg * (i === 0 ? 1.1 : 1.0)));
      return {
        uhrzeit: `${hh}:00`,
        prognose_bestellungen,
        empfohlene_fahrer: Math.max(1, Math.ceil(prognose_bestellungen / 4)),
        historischer_avg,
      };
    });

    return NextResponse.json({
      slots,
      aktuell_aktive_bestellungen: activeCount ?? 0,
      aktuell_online_fahrer: driverCount ?? 0,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtAuslastungsPrognoseAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
