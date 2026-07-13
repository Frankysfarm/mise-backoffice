/**
 * GET /api/delivery/admin/liefer-prognose?location_id=<uuid>
 *
 * Phase 1309 — Liefer-Prognose-API (Backend)
 * Basierend auf aktueller Queue + Fahrer-Auslastung → ETA-Prognose je Zone.
 * Supabase customer_orders + mise_drivers + Mock-Fallback. Multi-Tenant.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ZoneName = 'A' | 'B' | 'C' | 'D' | 'gesamt';
export type EngpassStufe = 'ok' | 'warnung' | 'kritisch';

export interface ZonePrognose {
  zone: ZoneName;
  eta_min: number;
  queue_laenge: number;
  aktive_fahrer: number;
  engpass: EngpassStufe;
  empfehlung: string | null;
}

export interface LieferPrognoseResponse {
  zonen: ZonePrognose[];
  gesamt_eta_min: number;
  gesamt_engpass: EngpassStufe;
  aktive_fahrer_gesamt: number;
  offene_bestellungen: number;
  location_id: string;
  generiert_am: string;
}

function engpassStufe(queueLaenge: number, aktiveFahrer: number): EngpassStufe {
  if (aktiveFahrer === 0) return 'kritisch';
  const lastPerFahrer = queueLaenge / aktiveFahrer;
  if (lastPerFahrer > 6) return 'kritisch';
  if (lastPerFahrer > 3) return 'warnung';
  return 'ok';
}

function calcEta(queueLaenge: number, aktiveFahrer: number, basisMinuten = 20): number {
  if (aktiveFahrer === 0) return basisMinuten * 2;
  const stopsPerDriver = Math.max(1, queueLaenge / aktiveFahrer);
  return Math.round(basisMinuten + stopsPerDriver * 4);
}

function empfehlung(engpass: EngpassStufe, zone: ZoneName): string | null {
  if (engpass === 'kritisch') return `Zone ${zone}: Sofort weiteren Fahrer einsetzen.`;
  if (engpass === 'warnung') return `Zone ${zone}: Fahrer-Auslastung erhöht — im Auge behalten.`;
  return null;
}

function buildMock(locationId: string): LieferPrognoseResponse {
  const zonen: ZonePrognose[] = [
    { zone: 'A', eta_min: 18, queue_laenge: 4, aktive_fahrer: 2, engpass: 'ok',       empfehlung: null },
    { zone: 'B', eta_min: 28, queue_laenge: 7, aktive_fahrer: 2, engpass: 'warnung',  empfehlung: 'Zone B: Fahrer-Auslastung erhöht — im Auge behalten.' },
    { zone: 'C', eta_min: 42, queue_laenge: 6, aktive_fahrer: 1, engpass: 'kritisch', empfehlung: 'Zone C: Sofort weiteren Fahrer einsetzen.' },
    { zone: 'D', eta_min: 22, queue_laenge: 3, aktive_fahrer: 1, engpass: 'ok',       empfehlung: null },
  ];
  return {
    zonen,
    gesamt_eta_min: 27,
    gesamt_engpass: 'warnung',
    aktive_fahrer_gesamt: 6,
    offene_bestellungen: 20,
    location_id: locationId,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();

    const [ordersRes, driversRes] = await Promise.all([
      (sb as any)
        .from('customer_orders')
        .select('id, delivery_zone, status, created_at')
        .eq('location_id', locationId)
        .in('status', ['confirmed', 'preparing', 'ready', 'picked_up'])
        .order('created_at', { ascending: true }),
      (sb as any)
        .from('mise_drivers')
        .select('id, current_zone')
        .eq('location_id', locationId)
        .eq('ist_online', true),
    ]);

    const orders: { id: string; delivery_zone?: string; status?: string }[] = ordersRes.data ?? [];
    const drivers: { id: string; current_zone?: string }[] = driversRes.data ?? [];

    if (!orders.length && !drivers.length) return NextResponse.json(buildMock(locationId));

    const zoneNames: ZoneName[] = ['A', 'B', 'C', 'D'];
    const zonenMap: Record<string, { queue: number; fahrer: number }> = {};
    for (const z of zoneNames) zonenMap[z] = { queue: 0, fahrer: 0 };

    for (const o of orders) {
      const z = (o.delivery_zone ?? 'A').toUpperCase() as ZoneName;
      if (zonenMap[z]) zonenMap[z].queue += 1;
      else zonenMap['A'].queue += 1;
    }
    for (const d of drivers) {
      const z = (d.current_zone ?? 'A').toUpperCase() as ZoneName;
      if (zonenMap[z]) zonenMap[z].fahrer += 1;
      else zonenMap['A'].fahrer += 1;
    }

    const zonen: ZonePrognose[] = zoneNames.map((z) => {
      const { queue, fahrer } = zonenMap[z];
      const eta = calcEta(queue, fahrer);
      const eng = engpassStufe(queue, fahrer);
      return {
        zone: z,
        eta_min: eta,
        queue_laenge: queue,
        aktive_fahrer: fahrer,
        engpass: eng,
        empfehlung: empfehlung(eng, z),
      };
    });

    const maxEta = Math.max(...zonen.map((z) => z.eta_min));
    const avgEta = Math.round(zonen.reduce((s, z) => s + z.eta_min, 0) / zonen.length);
    const hatKritisch = zonen.some((z) => z.engpass === 'kritisch');
    const hatWarnung = zonen.some((z) => z.engpass === 'warnung');

    return NextResponse.json({
      zonen,
      gesamt_eta_min: avgEta,
      gesamt_engpass: hatKritisch ? 'kritisch' : hatWarnung ? 'warnung' : 'ok',
      aktive_fahrer_gesamt: drivers.length,
      offene_bestellungen: orders.length,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies LieferPrognoseResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
