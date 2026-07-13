/**
 * GET /api/delivery/admin/schicht-effizienz-bericht
 *   ?location_id=<uuid>
 *
 * Phase 1278 — Schicht-Effizienz-Bericht-API
 * Tagesabschluss-KPIs: Stopps/Fahrer/Stunde, Pünktlichkeitsquote, Gesamt-km, Kosten/Stopp
 * Multi-Tenant: location_id. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SchichtEffizienzBerichtResponse {
  stopps_gesamt: number;
  aktive_fahrer: number;
  schicht_stunden: number;
  stopps_pro_fahrer_stunde: number;
  puenktlichkeits_quote: number;
  gesamt_km: number;
  kosten_pro_stopp_eur: number;
  umsatz_eur: number;
  top_fahrer: string | null;
  top_fahrer_stopps: number;
  location_id: string;
  generiert_am: string;
}

function buildMock(locationId: string): SchichtEffizienzBerichtResponse {
  return {
    stopps_gesamt: 87,
    aktive_fahrer: 5,
    schicht_stunden: 8,
    stopps_pro_fahrer_stunde: 2.18,
    puenktlichkeits_quote: 84,
    gesamt_km: 312,
    kosten_pro_stopp_eur: 2.40,
    umsatz_eur: 3480,
    top_fahrer: 'Max M.',
    top_fahrer_stopps: 22,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [stopsRes, ordersRes, driversRes] = await Promise.all([
      supabase
        .from('mise_delivery_stops')
        .select('id, driver_id, arrived_at, eta_at, estimated_km')
        .eq('location_id', locationId)
        .gte('arrived_at', todayStart.toISOString())
        .not('arrived_at', 'is', null),
      supabase
        .from('customer_orders')
        .select('id, total_price')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString())
        .eq('order_type', 'lieferung'),
      supabase
        .from('mise_drivers')
        .select('id, name')
        .eq('location_id', locationId)
        .eq('status', 'active'),
    ]);

    const stops = stopsRes.data ?? [];
    const orders = ordersRes.data ?? [];
    const drivers = driversRes.data ?? [];

    if (stops.length === 0 && orders.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const stoppGesamt = stops.length;
    const aktiveFahrer = Math.max(drivers.length, 1);
    const schichtStunden = 8;

    const puenktlich = stops.filter(s => {
      if (!s.arrived_at || !s.eta_at) return true;
      return new Date(s.arrived_at) <= new Date(s.eta_at);
    }).length;
    const puenktlichkeitsQuote = stoppGesamt > 0
      ? Math.round((puenktlich / stoppGesamt) * 100)
      : 0;

    const gesamtKm = stops.reduce((s, st) => s + (st.estimated_km ?? 3), 0);
    const umsatzEur = orders.reduce((s, o) => s + (o.total_price ?? 0), 0);
    const kostenProStopp = stoppGesamt > 0
      ? Math.round((gesamtKm * 0.30 / stoppGesamt) * 100) / 100
      : 0;

    const stoppsProFahrerStunde =
      Math.round((stoppGesamt / (aktiveFahrer * schichtStunden)) * 100) / 100;

    // Top-Fahrer
    const stoppsPerDriver: Record<string, number> = {};
    for (const s of stops) {
      if (s.driver_id) stoppsPerDriver[s.driver_id] = (stoppsPerDriver[s.driver_id] ?? 0) + 1;
    }
    let topDriverId: string | null = null;
    let topCount = 0;
    for (const [id, cnt] of Object.entries(stoppsPerDriver)) {
      if (cnt > topCount) { topCount = cnt; topDriverId = id; }
    }
    const topFahrerObj = drivers.find(d => d.id === topDriverId);
    const topFahrer = topFahrerObj?.name ?? null;

    return NextResponse.json({
      stopps_gesamt: stoppGesamt,
      aktive_fahrer: aktiveFahrer,
      schicht_stunden: schichtStunden,
      stopps_pro_fahrer_stunde: stoppsProFahrerStunde,
      puenktlichkeits_quote: puenktlichkeitsQuote,
      gesamt_km: Math.round(gesamtKm),
      kosten_pro_stopp_eur: kostenProStopp,
      umsatz_eur: Math.round(umsatzEur * 100) / 100,
      top_fahrer: topFahrer,
      top_fahrer_stopps: topCount,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies SchichtEffizienzBerichtResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
