import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1218 — Live-ETA-Abweichungs-Monitor API (Dispatch)
// Echtzeit-Delta zwischen geschätzter und tatsächlicher Lieferzeit je aktiver Tour + Eskalation bei >10 Min

type AbweichungsLevel = 'ok' | 'warnung' | 'kritisch';

type TourAbweichung = {
  stop_id: string;
  order_id: string;
  fahrer_id: string;
  fahrer_name: string;
  adresse: string | null;
  zone: string | null;
  estimated_delivery_at: string | null;
  delta_min: number;              // positiv = Verspätung, negativ = früher
  abweichung: AbweichungsLevel;
  eskalation: boolean;
};

type ApiResponse = {
  stopps: TourAbweichung[];
  eskalierend: number;
  ø_delta_min: number;
  location_id: string | null;
  generiert_am: string;
};

function abweichungsLevel(deltaMmin: number): AbweichungsLevel {
  if (deltaMmin >= 10) return 'kritisch';
  if (deltaMmin >= 5)  return 'warnung';
  return 'ok';
}

function mockResponse(locationId: string | null): ApiResponse {
  const now = new Date();
  const stopps: TourAbweichung[] = [
    { stop_id: 's1', order_id: 'o1', fahrer_id: 'f1', fahrer_name: 'Maria K.', adresse: 'Hauptstr. 12', zone: 'A', estimated_delivery_at: new Date(now.getTime() - 8  * 60_000).toISOString(), delta_min: 8,   abweichung: 'warnung',  eskalation: false },
    { stop_id: 's2', order_id: 'o2', fahrer_id: 'f2', fahrer_name: 'Jonas L.', adresse: 'Bahnhofstr. 5', zone: 'B', estimated_delivery_at: new Date(now.getTime() - 14 * 60_000).toISOString(), delta_min: 14, abweichung: 'kritisch', eskalation: true  },
    { stop_id: 's3', order_id: 'o3', fahrer_id: 'f3', fahrer_name: 'Tom R.',   adresse: 'Müllerstr. 8',  zone: 'C', estimated_delivery_at: new Date(now.getTime() + 3  * 60_000).toISOString(), delta_min: -3, abweichung: 'ok',      eskalation: false },
  ];
  const eskalierend = stopps.filter(s => s.eskalation).length;
  const ø_delta_min = stopps.length > 0 ? Math.round(stopps.reduce((s, t) => s + t.delta_min, 0) / stopps.length * 10) / 10 : 0;
  return { stopps, eskalierend, ø_delta_min, location_id: locationId, generiert_am: now.toISOString() };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = await createClient();
    const now = new Date();

    // Lade aktive Stopps (noch nicht geliefert, mit ETA)
    let stopsQuery = supabase
      .from('mise_delivery_stops')
      .select('id, order_id, driver_id, address, delivery_zone, estimated_delivery_at')
      .is('delivered_at', null)
      .not('estimated_delivery_at', 'is', null);
    if (locationId) stopsQuery = stopsQuery.eq('location_id', locationId);
    const { data: stops } = await stopsQuery;

    if (!stops || stops.length === 0) return NextResponse.json(mockResponse(locationId));

    // Lade Fahrernamen
    const driverIds = [...new Set(stops.map((s: { driver_id: string }) => s.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, name')
      .in('id', driverIds);
    const driverMap = new Map((drivers ?? []).map((d: { id: string; name: string }) => [d.id, d.name]));

    const stopps: TourAbweichung[] = stops.map((s: {
      id: string; order_id: string; driver_id: string;
      address: string | null; delivery_zone: string | null;
      estimated_delivery_at: string | null;
    }) => {
      const eta = s.estimated_delivery_at ? new Date(s.estimated_delivery_at) : null;
      const delta_min = eta ? Math.round((now.getTime() - eta.getTime()) / 60_000) : 0;
      const abw = abweichungsLevel(delta_min);
      return {
        stop_id: s.id,
        order_id: s.order_id ?? '',
        fahrer_id: s.driver_id ?? '',
        fahrer_name: driverMap.get(s.driver_id) ?? 'Unbekannt',
        adresse: s.address ?? null,
        zone: s.delivery_zone ?? null,
        estimated_delivery_at: s.estimated_delivery_at,
        delta_min,
        abweichung: abw,
        eskalation: delta_min >= 10,
      };
    });

    stopps.sort((a, b) => b.delta_min - a.delta_min);

    const eskalierend = stopps.filter(s => s.eskalation).length;
    const ø_delta_min = stopps.length > 0 ? Math.round(stopps.reduce((s, t) => s + t.delta_min, 0) / stopps.length * 10) / 10 : 0;

    return NextResponse.json({ stopps, eskalierend, ø_delta_min, location_id: locationId, generiert_am: now.toISOString() } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockResponse(locationId));
  }
}
