/**
 * GET /api/delivery/admin/fahrer-geo-verteilung
 *   ?location_id=<uuid>
 *
 * Phase 1273 — Fahrer-Geo-Verteilungs-Monitor API
 * Wie gut sind aktive Fahrer geografisch über Zonen verteilt?
 * Gibt Coverage-Score + Lücken-Zonen zurück.
 * Multi-Tenant. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ZoneVerteilung {
  zone: string;
  fahrer: number;
  erwartete_auslastung: 'hoch' | 'mittel' | 'gering';
  luecke: boolean;
}

export interface FahrerGeoVerteilungResponse {
  coverage_score: number;
  fahrer_gesamt: number;
  zonen_abgedeckt: number;
  zonen_gesamt: number;
  zonen: ZoneVerteilung[];
  luecken: string[];
  generiert_am: string;
}

function buildMock(locationId: string): FahrerGeoVerteilungResponse {
  const zonen: ZoneVerteilung[] = [
    { zone: 'Mitte', fahrer: 3, erwartete_auslastung: 'hoch', luecke: false },
    { zone: 'Nord',  fahrer: 2, erwartete_auslastung: 'mittel', luecke: false },
    { zone: 'West',  fahrer: 1, erwartete_auslastung: 'mittel', luecke: false },
    { zone: 'Süd',   fahrer: 0, erwartete_auslastung: 'hoch', luecke: true },
  ];
  const abgedeckt = zonen.filter(z => !z.luecke).length;
  const coverage = Math.round((abgedeckt / zonen.length) * 100);
  return {
    coverage_score: coverage,
    fahrer_gesamt: 6,
    zonen_abgedeckt: abgedeckt,
    zonen_gesamt: zonen.length,
    zonen,
    luecken: zonen.filter(z => z.luecke).map(z => z.zone),
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const { data: drivers, error } = await (sb as any)
      .from('mise_drivers')
      .select('id, name, current_zone, on_tour, online')
      .eq('location_id', locationId)
      .eq('online', true);

    if (error || !drivers?.length) return NextResponse.json(buildMock(locationId));

    const { data: orders } = await (sb as any)
      .from('customer_orders')
      .select('delivery_zone')
      .eq('location_id', locationId)
      .in('status', ['confirmed', 'in_progress', 'preparing'])
      .not('delivery_zone', 'is', null);

    const zonenOrderCount: Record<string, number> = {};
    for (const o of (orders ?? [])) {
      const z = o.delivery_zone as string;
      zonenOrderCount[z] = (zonenOrderCount[z] ?? 0) + 1;
    }
    const maxOrders = Math.max(...Object.values(zonenOrderCount), 1);

    const zonenFahrerCount: Record<string, number> = {};
    for (const d of drivers) {
      const z = d.current_zone as string | null ?? 'Unbekannt';
      zonenFahrerCount[z] = (zonenFahrerCount[z] ?? 0) + 1;
    }

    const alleZonen = new Set([...Object.keys(zonenOrderCount), ...Object.keys(zonenFahrerCount)]);
    const zonen: ZoneVerteilung[] = [...alleZonen].map(zone => {
      const fahrer = zonenFahrerCount[zone] ?? 0;
      const orderRatio = (zonenOrderCount[zone] ?? 0) / maxOrders;
      const erwartete_auslastung: ZoneVerteilung['erwartete_auslastung'] =
        orderRatio >= 0.6 ? 'hoch' : orderRatio >= 0.3 ? 'mittel' : 'gering';
      return { zone, fahrer, erwartete_auslastung, luecke: fahrer === 0 && erwartete_auslastung !== 'gering' };
    });

    const abgedeckt = zonen.filter(z => !z.luecke).length;
    const coverage = zonen.length > 0 ? Math.round((abgedeckt / zonen.length) * 100) : 100;

    return NextResponse.json({
      coverage_score: coverage,
      fahrer_gesamt: drivers.length,
      zonen_abgedeckt: abgedeckt,
      zonen_gesamt: zonen.length,
      zonen,
      luecken: zonen.filter(z => z.luecke).map(z => z.zone),
      generiert_am: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
