/**
 * GET /api/delivery/admin/liefergebiet-rentabilitaet?location_id=<uuid>
 *
 * Phase 1766 — Liefergebiet-Rentabilitäts-API (Backend)
 * Umsatz je Zone / Lieferkosten je Zone / ROI je Zone heute; Multi-Tenant; Supabase + Mock.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZoneRentabilitaet {
  zone: 'A' | 'B' | 'C' | 'D';
  umsatz_eur: number;
  lieferkosten_eur: number;
  roi_pct: number;
  bestellungen: number;
  avg_umsatz_pro_bestellung: number;
  avg_kosten_pro_bestellung: number;
}

export interface LiefergebietRentabilitaetAntwort {
  zonen: ZoneRentabilitaet[];
  gesamt_umsatz: number;
  gesamt_kosten: number;
  gesamt_roi_pct: number;
  location_id: string;
  datum: string;
  generiert_am: string;
}

function buildMock(locationId: string): LiefergebietRentabilitaetAntwort {
  const datum = new Date().toISOString().split('T')[0];
  const zonen: ZoneRentabilitaet[] = [
    { zone: 'A', umsatz_eur: 1840, lieferkosten_eur: 320, roi_pct: 475, bestellungen: 38, avg_umsatz_pro_bestellung: 48.4, avg_kosten_pro_bestellung: 8.4 },
    { zone: 'B', umsatz_eur: 1260, lieferkosten_eur: 410, roi_pct: 207, bestellungen: 29, avg_umsatz_pro_bestellung: 43.4, avg_kosten_pro_bestellung: 14.1 },
    { zone: 'C', umsatz_eur: 680,  lieferkosten_eur: 290, roi_pct: 134, bestellungen: 16, avg_umsatz_pro_bestellung: 42.5, avg_kosten_pro_bestellung: 18.1 },
    { zone: 'D', umsatz_eur: 310,  lieferkosten_eur: 210, roi_pct:  47, bestellungen:  8, avg_umsatz_pro_bestellung: 38.8, avg_kosten_pro_bestellung: 26.3 },
  ];
  const gesamt_umsatz = zonen.reduce((s, z) => s + z.umsatz_eur, 0);
  const gesamt_kosten = zonen.reduce((s, z) => s + z.lieferkosten_eur, 0);
  const gesamt_roi_pct = gesamt_kosten > 0 ? Math.round((gesamt_umsatz - gesamt_kosten) / gesamt_kosten * 100) : 0;
  return { zonen, gesamt_umsatz, gesamt_kosten, gesamt_roi_pct, location_id: locationId, datum, generiert_am: new Date().toISOString() };
}

const ZONE_RADII_KM: Record<string, [number, number]> = { A: [0, 2], B: [2, 4], C: [4, 7], D: [7, 999] };

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function classifyZone(distKm: number): 'A' | 'B' | 'C' | 'D' {
  for (const [zone, [min, max]] of Object.entries(ZONE_RADII_KM)) {
    if (distKm >= min && distKm < max) return zone as 'A' | 'B' | 'C' | 'D';
  }
  return 'D';
}

const COST_PER_KM = 0.35; // €/km Schätzwert Lieferkosten

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? '';

  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data: location } = await supabase
      .from('locations')
      .select('lat, lng')
      .eq('id', locationId)
      .single();

    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_price, delivery_distance_km, delivery_lat, delivery_lng')
      .eq('location_id', locationId)
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .not('status', 'eq', 'storniert');

    if (!orders || orders.length === 0) {
      return NextResponse.json(buildMock(locationId));
    }

    const acc: Record<string, { umsatz: number; kosten: number; count: number }> = { A: { umsatz: 0, kosten: 0, count: 0 }, B: { umsatz: 0, kosten: 0, count: 0 }, C: { umsatz: 0, kosten: 0, count: 0 }, D: { umsatz: 0, kosten: 0, count: 0 } };

    for (const o of orders) {
      const umsatz = (o.total_price as number) ?? 0;
      let distKm = (o.delivery_distance_km as number) ?? 0;
      if (!distKm && location && o.delivery_lat && o.delivery_lng) {
        distKm = distanceKm(location.lat as number, location.lng as number, o.delivery_lat as number, o.delivery_lng as number);
      }
      const zone = classifyZone(distKm);
      const kosten = Math.round(distKm * COST_PER_KM * 100) / 100;
      acc[zone].umsatz += umsatz;
      acc[zone].kosten += kosten;
      acc[zone].count++;
    }

    const zonen: ZoneRentabilitaet[] = (['A', 'B', 'C', 'D'] as const).map(zone => {
      const { umsatz, kosten, count } = acc[zone];
      const roi_pct = kosten > 0 ? Math.round((umsatz - kosten) / kosten * 100) : 0;
      return {
        zone,
        umsatz_eur: Math.round(umsatz * 100) / 100,
        lieferkosten_eur: Math.round(kosten * 100) / 100,
        roi_pct,
        bestellungen: count,
        avg_umsatz_pro_bestellung: count > 0 ? Math.round(umsatz / count * 100) / 100 : 0,
        avg_kosten_pro_bestellung: count > 0 ? Math.round(kosten / count * 100) / 100 : 0,
      };
    });

    const gesamt_umsatz = zonen.reduce((s, z) => s + z.umsatz_eur, 0);
    const gesamt_kosten = zonen.reduce((s, z) => s + z.lieferkosten_eur, 0);
    const gesamt_roi_pct = gesamt_kosten > 0 ? Math.round((gesamt_umsatz - gesamt_kosten) / gesamt_kosten * 100) : 0;

    return NextResponse.json({ zonen, gesamt_umsatz: Math.round(gesamt_umsatz * 100) / 100, gesamt_kosten: Math.round(gesamt_kosten * 100) / 100, gesamt_roi_pct, location_id: locationId, datum: today, generiert_am: new Date().toISOString() } as LiefergebietRentabilitaetAntwort);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
