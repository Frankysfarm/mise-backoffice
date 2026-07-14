/**
 * GET /api/delivery/admin/lieferzonen-auslastung?location_id=<uuid>
 *
 * Phase 1497 — Lieferzonen-Auslastungs-API
 * Aktive Bestellungen + Fahrer je PLZ-Zone; Status frei/normal/ausgelastet.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZonenAuslastungEintrag {
  plz: string;
  zone_name: string;
  aktive_bestellungen: number;
  fahrer_anzahl: number;
  status: 'frei' | 'normal' | 'ausgelastet';
  empfehlung: string;
}

export interface LieferzonenAuslastungResponse {
  zonen: ZonenAuslastungEintrag[];
  gesamt_bestellungen: number;
  gesamt_fahrer: number;
  location_id: string;
  generiert_am: string;
}

function calcStatus(bestellungen: number, fahrer: number): 'frei' | 'normal' | 'ausgelastet' {
  if (fahrer === 0) return bestellungen > 0 ? 'ausgelastet' : 'frei';
  const ratio = bestellungen / fahrer;
  if (ratio <= 1.5) return 'frei';
  if (ratio <= 3) return 'normal';
  return 'ausgelastet';
}

function calcEmpfehlung(status: string, plz: string, bestellungen: number, fahrer: number): string {
  if (status === 'ausgelastet') return `Zone ${plz}: ${bestellungen} Aufträge, nur ${fahrer} Fahrer — Kapazität erhöhen.`;
  if (status === 'normal') return `Zone ${plz}: Auslastung normal (${bestellungen} Aufträge, ${fahrer} Fahrer).`;
  return `Zone ${plz}: Kapazität frei (${bestellungen} Aufträge, ${fahrer} Fahrer).`;
}

function buildMock(locationId: string): LieferzonenAuslastungResponse {
  const mockZonen: ZonenAuslastungEintrag[] = [
    { plz: '10115', zone_name: 'Zone A', aktive_bestellungen: 2, fahrer_anzahl: 2, status: 'frei', empfehlung: 'Zone 10115: Kapazität frei (2 Aufträge, 2 Fahrer).' },
    { plz: '10117', zone_name: 'Zone B', aktive_bestellungen: 5, fahrer_anzahl: 2, status: 'normal', empfehlung: 'Zone 10117: Auslastung normal (5 Aufträge, 2 Fahrer).' },
    { plz: '10119', zone_name: 'Zone C', aktive_bestellungen: 8, fahrer_anzahl: 1, status: 'ausgelastet', empfehlung: 'Zone 10119: 8 Aufträge, nur 1 Fahrer — Kapazität erhöhen.' },
  ];
  return {
    zonen: mockZonen,
    gesamt_bestellungen: 15,
    gesamt_fahrer: 5,
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

    const { data: deliveryZones } = await (sb as any)
      .from('delivery_zones')
      .select('id, name, postal_codes')
      .eq('location_id', locationId);

    if (!deliveryZones || (deliveryZones as unknown[]).length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const { data: activeOrders } = await (sb as any)
      .from('customer_orders')
      .select('id, delivery_address')
      .eq('location_id', locationId)
      .in('status', ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery']);

    const { data: activeDrivers } = await (sb as any)
      .from('mise_drivers')
      .select('id, current_zone_id')
      .eq('location_id', locationId)
      .eq('aktiv', true);

    type RawOrder = { id: string; delivery_address?: string | null };
    type RawDriver = { id: string; current_zone_id?: string | null };
    type RawZone = { id: string; name: string; postal_codes?: string[] | null };

    const orders = (activeOrders ?? []) as RawOrder[];
    const drivers = (activeDrivers ?? []) as RawDriver[];
    const zones = (deliveryZones ?? []) as RawZone[];

    const zonen: ZonenAuslastungEintrag[] = zones.map((zone) => {
      const postalCodes: string[] = zone.postal_codes ?? [];
      const zoneOrders = orders.filter((o) => {
        const addr = (o.delivery_address ?? '') as string;
        return postalCodes.some((plz) => addr.includes(plz));
      });
      const zoneDrivers = drivers.filter((d) => d.current_zone_id === zone.id);
      const plz = postalCodes[0] ?? zone.id.slice(0, 5);
      const status = calcStatus(zoneOrders.length, zoneDrivers.length);
      return {
        plz,
        zone_name: zone.name ?? `Zone ${plz}`,
        aktive_bestellungen: zoneOrders.length,
        fahrer_anzahl: zoneDrivers.length,
        status,
        empfehlung: calcEmpfehlung(status, plz, zoneOrders.length, zoneDrivers.length),
      };
    });

    const response: LieferzonenAuslastungResponse = {
      zonen,
      gesamt_bestellungen: orders.length,
      gesamt_fahrer: drivers.length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
