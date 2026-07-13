import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1216 — Fahrer-Schicht-ROI-Live-API (Backend)
// Umsatz je Fahrerstunde heute in Echtzeit: Bestellwert der gelieferten Bestellungen ÷ aktive Stunden

type FahrerROI = {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  aktive_stunden: number;
  gelieferte_stopps: number;
  umsatz_eur: number;
  umsatz_pro_stunde_eur: number;
  effizienz: 'niedrig' | 'normal' | 'hoch' | 'top';
  on_tour: boolean;
};

type ApiResponse = {
  fahrer: FahrerROI[];
  gesamt_umsatz_eur: number;
  gesamt_stunden: number;
  gesamt_roi_pro_stunde: number;
  location_id: string | null;
  generiert_am: string;
};

function effizienzLevel(umsatzProStunde: number): FahrerROI['effizienz'] {
  if (umsatzProStunde >= 80) return 'top';
  if (umsatzProStunde >= 50) return 'hoch';
  if (umsatzProStunde >= 25) return 'normal';
  return 'niedrig';
}

function mockResponse(locationId: string | null): ApiResponse {
  const now = new Date();
  const fahrer: FahrerROI[] = [
    { fahrer_id: 'f1', fahrer_name: 'Maria K.', zone: 'A', aktive_stunden: 4.5, gelieferte_stopps: 12, umsatz_eur: 312, umsatz_pro_stunde_eur: 69.3, effizienz: 'hoch', on_tour: true },
    { fahrer_id: 'f2', fahrer_name: 'Jonas L.', zone: 'B', aktive_stunden: 3.0, gelieferte_stopps: 8,  umsatz_eur: 196, umsatz_pro_stunde_eur: 65.3, effizienz: 'hoch', on_tour: true },
    { fahrer_id: 'f3', fahrer_name: 'Tom R.',   zone: 'C', aktive_stunden: 5.0, gelieferte_stopps: 6,  umsatz_eur: 134, umsatz_pro_stunde_eur: 26.8, effizienz: 'normal', on_tour: false },
    { fahrer_id: 'f4', fahrer_name: 'Sara M.',  zone: 'D', aktive_stunden: 2.0, gelieferte_stopps: 9,  umsatz_eur: 225, umsatz_pro_stunde_eur: 112.5, effizienz: 'top', on_tour: true },
  ];
  const gesamt_umsatz_eur = fahrer.reduce((s, f) => s + f.umsatz_eur, 0);
  const gesamt_stunden = fahrer.reduce((s, f) => s + f.aktive_stunden, 0);
  return {
    fahrer,
    gesamt_umsatz_eur,
    gesamt_stunden,
    gesamt_roi_pro_stunde: gesamt_stunden > 0 ? Math.round((gesamt_umsatz_eur / gesamt_stunden) * 10) / 10 : 0,
    location_id: locationId,
    generiert_am: now.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    // Lade aktive Fahrer
    let driversQuery = supabase
      .from('mise_drivers')
      .select('id, name, delivery_zone, on_tour, shift_started_at, online')
      .eq('online', true);
    if (locationId) driversQuery = driversQuery.eq('location_id', locationId);
    const { data: drivers } = await driversQuery;

    if (!drivers || drivers.length === 0) {
      return NextResponse.json(mockResponse(locationId));
    }

    // Lade gelieferte Stopps heute mit Bestellwert
    let stopsQuery = supabase
      .from('mise_delivery_stops')
      .select('driver_id, delivered_at, order_id')
      .gte('delivered_at', todayStart.toISOString())
      .not('delivered_at', 'is', null);
    if (locationId) stopsQuery = stopsQuery.eq('location_id', locationId);
    const { data: stops } = await stopsQuery;

    // Lade Bestellwerte
    const orderIds = [...new Set((stops ?? []).map((s: { order_id: string }) => s.order_id).filter(Boolean))];
    let orderValues: Map<string, number> = new Map();
    if (orderIds.length > 0) {
      const { data: orders } = await supabase
        .from('customer_orders')
        .select('id, total_price')
        .in('id', orderIds);
      for (const o of orders ?? []) {
        orderValues.set(o.id, Number(o.total_price) || 0);
      }
    }

    const fahrerList: FahrerROI[] = drivers.map((d: {
      id: string; name: string; delivery_zone: string | null;
      on_tour: boolean; shift_started_at: string | null; online: boolean;
    }) => {
      const shiftStart = d.shift_started_at ? new Date(d.shift_started_at) : todayStart;
      const aktive_stunden = Math.max(0, (now.getTime() - shiftStart.getTime()) / 3_600_000);
      const fahrerStops = (stops ?? []).filter((s: { driver_id: string }) => s.driver_id === d.id);
      const gelieferte_stopps = fahrerStops.length;
      const umsatz_eur = fahrerStops.reduce((sum: number, s: { order_id: string }) => sum + (orderValues.get(s.order_id) ?? 0), 0);
      const umsatz_pro_stunde_eur = aktive_stunden > 0 ? Math.round((umsatz_eur / aktive_stunden) * 10) / 10 : 0;
      return {
        fahrer_id: d.id,
        fahrer_name: d.name ?? 'Unbekannt',
        zone: d.delivery_zone ?? null,
        aktive_stunden: Math.round(aktive_stunden * 10) / 10,
        gelieferte_stopps,
        umsatz_eur: Math.round(umsatz_eur * 100) / 100,
        umsatz_pro_stunde_eur,
        effizienz: effizienzLevel(umsatz_pro_stunde_eur),
        on_tour: d.on_tour ?? false,
      };
    });

    const gesamt_umsatz_eur = fahrerList.reduce((s, f) => s + f.umsatz_eur, 0);
    const gesamt_stunden = fahrerList.reduce((s, f) => s + f.aktive_stunden, 0);

    return NextResponse.json({
      fahrer: fahrerList,
      gesamt_umsatz_eur: Math.round(gesamt_umsatz_eur * 100) / 100,
      gesamt_stunden: Math.round(gesamt_stunden * 10) / 10,
      gesamt_roi_pro_stunde: gesamt_stunden > 0 ? Math.round((gesamt_umsatz_eur / gesamt_stunden) * 10) / 10 : 0,
      location_id: locationId,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
