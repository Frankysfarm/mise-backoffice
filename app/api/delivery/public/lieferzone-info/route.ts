/**
 * GET /api/delivery/public/lieferzone-info?location_id=<uuid>
 *
 * Phase 1655 — Lieferzone-Info (Public)
 * Gibt aktive Lieferzonen der Location zurück (A/B/C/D, ETA, Radius).
 * Supabase + Mock-Fallback. Kein Auth erforderlich.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ZoneInfo {
  zone: 'A' | 'B' | 'C' | 'D' | null;
  eta_min: number;
  radius_km: number;
  beschreibung: string;
  verfuegbar: boolean;
}

function buildMock(locationId: string): ZoneInfo {
  const seed = locationId.charCodeAt(0) % 4;
  const zones = ['A', 'B', 'C', 'D'] as const;
  const zone = zones[seed];
  const etaMap = { A: 20, B: 30, C: 40, D: 50 };
  const radiusMap = { A: 3, B: 5, C: 8, D: 12 };
  return {
    zone,
    eta_min: etaMap[zone],
    radius_km: radiusMap[zone],
    beschreibung: `Zone ${zone} — innerhalb ${radiusMap[zone]} km`,
    verfuegbar: true,
  };
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    // Lieferzonen-Konfiguration aus delivery_zones (falls Tabelle existiert)
    const { data: zones } = await (sb as any)
      .from('delivery_zones')
      .select('zone_label, radius_km, eta_min, aktiv')
      .eq('location_id', locationId)
      .eq('aktiv', true)
      .order('zone_label', { ascending: true })
      .limit(1);

    if (zones && zones.length > 0) {
      const z = zones[0];
      const zone = (['A', 'B', 'C', 'D'].includes(z.zone_label) ? z.zone_label : 'A') as ZoneInfo['zone'];
      return NextResponse.json({
        zone,
        eta_min: z.eta_min ?? 30,
        radius_km: z.radius_km ?? 5,
        beschreibung: `Zone ${zone} — innerhalb ${z.radius_km ?? 5} km`,
        verfuegbar: true,
      } satisfies ZoneInfo);
    }

    // Fallback: delivery_config
    const { data: cfg } = await (sb as any)
      .from('delivery_config')
      .select('config_value')
      .eq('location_id', locationId)
      .eq('config_key', 'lieferzone')
      .maybeSingle();

    if (cfg?.config_value) {
      const val = typeof cfg.config_value === 'object' ? cfg.config_value : {};
      return NextResponse.json({
        zone: (val as { zone?: ZoneInfo['zone'] }).zone ?? 'A',
        eta_min: (val as { eta_min?: number }).eta_min ?? 30,
        radius_km: (val as { radius_km?: number }).radius_km ?? 5,
        beschreibung: (val as { beschreibung?: string }).beschreibung ?? 'Zone A',
        verfuegbar: true,
      } satisfies ZoneInfo);
    }

    return NextResponse.json(buildMock(locationId));
  } catch {
    return NextResponse.json(buildMock(locationId));
  }
}
