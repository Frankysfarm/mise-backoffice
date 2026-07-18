/**
 * Phase 2348 — Fahrer-Liefergebiet-Optimierung-API
 *
 * GET /api/delivery/admin/fahrer-liefergebiet-opt?location_id=<uuid>
 * Ø Distanz je Lieferzone + Zonen-Auslastung; Alert bei ungleichmäßiger Verteilung;
 * Multi-Tenant; Supabase+Mock.
 *
 * Response: { location_id, zonen: ZoneLiefergebietInfo[], alert_count, rebalancing_empfehlung, generiert_am }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type ZoneAmpel = 'gruen' | 'gelb' | 'rot';

export interface ZoneLiefergebietInfo {
  zone: string;
  zone_name: string;
  avg_distanz_km: number;
  auslastung_pct: number;
  aktive_fahrer: number;
  lieferungen_heute: number;
  ampel: ZoneAmpel;
  alert: boolean;
}

export interface FahrerLiefergebietOptResponse {
  location_id: string;
  zonen: ZoneLiefergebietInfo[];
  alert_count: number;
  rebalancing_empfehlung: string | null;
  generiert_am: string;
}

const ZONE_NAMEN: Record<string, string> = {
  A: 'Express-Zone',
  B: 'Standard-Zone',
  C: 'Weite Zone',
  D: 'Außenzone',
};

const KAPAZITAET: Record<string, number> = { A: 5, B: 8, C: 6, D: 4 };

function zoneAmpel(auslastung: number, avgKm: number): ZoneAmpel {
  if (auslastung >= 90 || avgKm > 10) return 'rot';
  if (auslastung >= 70 || avgKm > 6) return 'gelb';
  return 'gruen';
}

function rebalancingText(zonen: ZoneLiefergebietInfo[]): string | null {
  const ueberlastet = zonen.filter((z) => z.auslastung_pct >= 90);
  const unterlastet = zonen.filter((z) => z.auslastung_pct < 40 && z.aktive_fahrer > 0);
  if (ueberlastet.length > 0 && unterlastet.length > 0) {
    return `Zone ${ueberlastet[0].zone} überlastet — Fahrer aus Zone ${unterlastet[0].zone} umleiten`;
  }
  if (ueberlastet.length > 0) {
    return `Zone ${ueberlastet.map((z) => z.zone).join(', ')} überlastet — zusätzliche Fahrer einplanen`;
  }
  return null;
}

const MOCK: FahrerLiefergebietOptResponse = {
  location_id: 'mock',
  zonen: [
    { zone: 'A', zone_name: 'Express-Zone', avg_distanz_km: 1.8, auslastung_pct: 95, aktive_fahrer: 2, lieferungen_heute: 28, ampel: 'rot', alert: true },
    { zone: 'B', zone_name: 'Standard-Zone', avg_distanz_km: 3.4, auslastung_pct: 62, aktive_fahrer: 3, lieferungen_heute: 41, ampel: 'gelb', alert: false },
    { zone: 'C', zone_name: 'Weite Zone', avg_distanz_km: 6.1, auslastung_pct: 35, aktive_fahrer: 2, lieferungen_heute: 14, ampel: 'gelb', alert: false },
    { zone: 'D', zone_name: 'Außenzone', avg_distanz_km: 12.3, auslastung_pct: 20, aktive_fahrer: 1, lieferungen_heute: 5, ampel: 'rot', alert: true },
  ],
  alert_count: 2,
  rebalancing_empfehlung: 'Zone A überlastet — Fahrer aus Zone D umleiten',
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) {
    return NextResponse.json({ error: 'location_id erforderlich' }, { status: 400 });
  }

  try {
    const sb = await createClient();
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const heuteIso = heute.toISOString();

    const { data: orders, error: oErr } = await sb
      .from('orders')
      .select('id, delivery_zone, total_distance_km, status')
      .eq('location_id', locationId)
      .gte('created_at', heuteIso);

    if (oErr) throw oErr;

    const { data: batches } = await sb
      .from('driver_batches')
      .select('driver_id, zone, status')
      .eq('location_id', locationId)
      .in('status', ['in_progress', 'active', 'unterwegs', 'gestartet']);

    const zoneKeys = ['A', 'B', 'C', 'D'];

    const fahrerByZone = new Map<string, Set<string>>();
    for (const b of batches ?? []) {
      const z = ((b as Record<string, unknown>).zone as string | null) ?? 'B';
      const dId = (b as Record<string, unknown>).driver_id as string | null;
      if (dId) {
        const s = fahrerByZone.get(z) ?? new Set<string>();
        s.add(dId);
        fahrerByZone.set(z, s);
      }
    }

    const zonen: ZoneLiefergebietInfo[] = zoneKeys.map((zone) => {
      const zoneOrders = (orders ?? []).filter(
        (o: Record<string, unknown>) => ((o.delivery_zone as string | null) ?? 'B') === zone
      );
      const lieferungen = zoneOrders.length;
      const distanzen = zoneOrders
        .map((o: Record<string, unknown>) => (o.total_distance_km as number | null) ?? 0)
        .filter((d: number) => d > 0);
      const avgKm = distanzen.length > 0 ? Math.round((distanzen.reduce((a: number, b: number) => a + b, 0) / distanzen.length) * 10) / 10 : 0;
      const kapazitaet = KAPAZITAET[zone] ?? 5;
      const aktiveFahrer = fahrerByZone.get(zone)?.size ?? 0;
      const auslastungPct = Math.min(100, Math.round((lieferungen / (kapazitaet * 5)) * 100));
      const ampel = zoneAmpel(auslastungPct, avgKm);

      return {
        zone,
        zone_name: ZONE_NAMEN[zone] ?? zone,
        avg_distanz_km: avgKm,
        auslastung_pct: auslastungPct,
        aktive_fahrer: aktiveFahrer,
        lieferungen_heute: lieferungen,
        ampel,
        alert: ampel === 'rot',
      };
    });

    const alert_count = zonen.filter((z) => z.alert).length;

    return NextResponse.json({
      location_id: locationId,
      zonen,
      alert_count,
      rebalancing_empfehlung: rebalancingText(zonen),
      generiert_am: new Date().toISOString(),
    } satisfies FahrerLiefergebietOptResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId, generiert_am: new Date().toISOString() });
  }
}
