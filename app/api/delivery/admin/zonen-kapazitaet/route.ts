/**
 * GET /api/delivery/admin/zonen-kapazitaet?location_id=<uuid>
 *
 * Phase 1672 — Zonen-Kapazitaets-Auslastungs-API
 * Fahrer-Dichte je Zone A/B/C/D + freie Kapazität + Prognose nächste Stunde.
 * Multi-Tenant: location_id je Query. Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ZoneLabel = 'A' | 'B' | 'C' | 'D';
type AmpelStatus = 'niedrig' | 'normal' | 'voll';

interface ZoneKapazitaet {
  zone: ZoneLabel;
  fahrer_aktiv: number;
  fahrer_kapazitaet: number;
  auslastung_pct: number;
  freie_kapazitaet: number;
  ampel: AmpelStatus;
  eta_benchmark_min: number;
  prognose_naechste_stunde: {
    auslastung_pct: number;
    trend: 'steigend' | 'stabil' | 'fallend';
  };
}

interface ZonenKapazitaetResponse {
  location_id: string;
  zonen: ZoneKapazitaet[];
  gesamt_auslastung_pct: number;
  generiert_am: string;
}

const ZONE_ETA: Record<ZoneLabel, number> = { A: 20, B: 28, C: 35, D: 45 };
const ZONE_KAPAZITAET: Record<ZoneLabel, number> = { A: 4, B: 3, C: 3, D: 2 };
const ZONES: ZoneLabel[] = ['A', 'B', 'C', 'D'];

function ampelOf(pct: number): AmpelStatus {
  if (pct >= 90) return 'voll';
  if (pct >= 60) return 'normal';
  return 'niedrig';
}

function buildMock(locationId: string): ZonenKapazitaetResponse {
  const seed = locationId.charCodeAt(0) || 65;
  const rng = (base: number, range: number, s: number) =>
    Math.max(0, Math.round(base + ((seed * s) % range) - range / 2));

  const zonen: ZoneKapazitaet[] = ZONES.map((zone, i) => {
    const kap = ZONE_KAPAZITAET[zone];
    const aktiv = Math.min(kap, rng(Math.round(kap * 0.6), kap, (i + 1) * 7));
    const pct = Math.round((aktiv / kap) * 100);
    const prognosePct = Math.min(100, Math.max(0, pct + rng(0, 30, (i + 1) * 13) - 15));
    return {
      zone,
      fahrer_aktiv: aktiv,
      fahrer_kapazitaet: kap,
      auslastung_pct: pct,
      freie_kapazitaet: kap - aktiv,
      ampel: ampelOf(pct),
      eta_benchmark_min: ZONE_ETA[zone],
      prognose_naechste_stunde: {
        auslastung_pct: prognosePct,
        trend: prognosePct > pct + 5 ? 'steigend' : prognosePct < pct - 5 ? 'fallend' : 'stabil',
      },
    };
  });

  const total = zonen.reduce((s, z) => s + z.fahrer_aktiv, 0);
  const totalKap = zonen.reduce((s, z) => s + z.fahrer_kapazitaet, 0);

  return {
    location_id: locationId,
    zonen,
    gesamt_auslastung_pct: Math.round((total / totalKap) * 100),
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id') ?? 'all';

  try {
    const sb = await createClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Aktive Fahrer je Zone (delivery_batches in letzter Stunde)
    let batchQ = (sb as any)
      .from('delivery_batches')
      .select('zone, driver_id, created_at')
      .is('completed_at', null)
      .gte('created_at', oneHourAgo.toISOString());
    if (locationId !== 'all') batchQ = batchQ.eq('location_id', locationId);
    const { data: batches, error: bErr } = await batchQ;

    // Prognose: Bestellungen letzte Stunde vs. vorletzte Stunde (als Proxy für Auslastungs-Trend)
    let ordQ = (sb as any)
      .from('orders')
      .select('delivery_zone, created_at')
      .gte('created_at', new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString())
      .lt('created_at', now.toISOString());
    if (locationId !== 'all') ordQ = ordQ.eq('location_id', locationId);
    const { data: orders } = await ordQ;

    if (bErr || !batches?.length) {
      return NextResponse.json(buildMock(locationId));
    }

    // Zonen-Kapazität aus delivery_zones
    let zoneQ = (sb as any)
      .from('delivery_zones')
      .select('zone_label, eta_min, kapazitaet')
      .eq('aktiv', true);
    if (locationId !== 'all') zoneQ = zoneQ.eq('location_id', locationId);
    const { data: zoneConfig } = await zoneQ;

    const zoneKap: Record<string, { eta: number; kap: number }> = {};
    for (const z of zoneConfig ?? []) {
      zoneKap[z.zone_label] = {
        eta: z.eta_min ?? ZONE_ETA[z.zone_label as ZoneLabel] ?? 30,
        kap: z.kapazitaet ?? ZONE_KAPAZITAET[z.zone_label as ZoneLabel] ?? 3,
      };
    }

    const fahrerJeZone: Record<string, Set<string>> = { A: new Set(), B: new Set(), C: new Set(), D: new Set() };
    for (const b of batches) {
      const z = (b.zone as string)?.toUpperCase();
      if (z && fahrerJeZone[z]) fahrerJeZone[z].add(b.driver_id);
    }

    // Bestellungen je Zone letzte vs. vorletzte Stunde für Trend
    const ordLast: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const ordPrev: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const o of orders ?? []) {
      const z = (o.delivery_zone as string)?.toUpperCase();
      if (!z || !ordLast[z] !== undefined) continue;
      const age = now.getTime() - new Date(o.created_at).getTime();
      if (age < 60 * 60 * 1000) ordLast[z] = (ordLast[z] ?? 0) + 1;
      else ordPrev[z] = (ordPrev[z] ?? 0) + 1;
    }

    const zonen: ZoneKapazitaet[] = ZONES.map(zone => {
      const cfg = zoneKap[zone] ?? { eta: ZONE_ETA[zone], kap: ZONE_KAPAZITAET[zone] };
      const aktiv = fahrerJeZone[zone]?.size ?? 0;
      const kap = cfg.kap;
      const pct = Math.round((aktiv / kap) * 100);

      const last = ordLast[zone] ?? 0;
      const prev = ordPrev[zone] ?? 0;
      const trendDiff = last - prev;
      const trend: 'steigend' | 'stabil' | 'fallend' =
        trendDiff > 1 ? 'steigend' : trendDiff < -1 ? 'fallend' : 'stabil';
      const prognosePct = Math.min(100, Math.max(0,
        pct + (trend === 'steigend' ? 15 : trend === 'fallend' ? -10 : 0),
      ));

      return {
        zone,
        fahrer_aktiv: aktiv,
        fahrer_kapazitaet: kap,
        auslastung_pct: pct,
        freie_kapazitaet: Math.max(0, kap - aktiv),
        ampel: ampelOf(pct),
        eta_benchmark_min: cfg.eta,
        prognose_naechste_stunde: { auslastung_pct: prognosePct, trend },
      };
    });

    const total = zonen.reduce((s, z) => s + z.fahrer_aktiv, 0);
    const totalKap = zonen.reduce((s, z) => s + z.fahrer_kapazitaet, 0);

    return NextResponse.json({
      location_id: locationId,
      zonen,
      gesamt_auslastung_pct: totalKap > 0 ? Math.round((total / totalKap) * 100) : 0,
      generiert_am: new Date().toISOString(),
    } satisfies ZonenKapazitaetResponse);
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
