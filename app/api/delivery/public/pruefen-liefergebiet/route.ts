import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { haversineKm } from '@/lib/google-maps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Phase 1861 — Liefergebiet-Überprüfungs-API
 * POST /api/delivery/public/pruefen-liefergebiet
 *
 * Prüft ob GPS-Koordinaten (lat/lng) in einem der konfigurierten Lieferzonen liegen.
 * Zone A (< 3 km) / B (3–6 km) / C (6–10 km) / D (> 10 km).
 * Gibt Lieferpauschale, Mindestbestellwert und Basis-ETA zurück.
 * Multi-Tenant (location_id). Supabase + Mock-Fallback.
 */

interface PruefenBody {
  location_id: string;
  lat: number;
  lng: number;
}

interface ZoneInfo {
  name: 'A' | 'B' | 'C' | 'D';
  label: string;
  distanz_km: number;
  lieferbar: boolean;
  lieferpauschale_eur: number;
  mindestbestellwert_eur: number;
  kostenlos_ab_eur: number | null;
  eta_basis_min: number;
}

interface PruefenAntwort {
  location_id: string;
  lat: number;
  lng: number;
  lieferbar: boolean;
  zone: ZoneInfo | null;
  hinweis: string | null;
  geprueft_am: string;
}

const DEFAULT_ZONES = [
  { name: 'A' as const, label: 'Express',   min_km: 0,  max_km: 3,   surcharge_eur: 0,   min_order_eur: 0,  free_delivery_above_eur: 15,   eta_base_min: 20 },
  { name: 'B' as const, label: 'Standard',  min_km: 3,  max_km: 6,   surcharge_eur: 1.5, min_order_eur: 15, free_delivery_above_eur: 25,   eta_base_min: 30 },
  { name: 'C' as const, label: 'Weit',      min_km: 6,  max_km: 10,  surcharge_eur: 2.5, min_order_eur: 20, free_delivery_above_eur: 35,   eta_base_min: 45 },
  { name: 'D' as const, label: 'Außerhalb', min_km: 10, max_km: 999, surcharge_eur: 4.0, min_order_eur: 30, free_delivery_above_eur: null, eta_base_min: 60 },
];

function buildMock(lat: number, lng: number, locationId: string): PruefenAntwort {
  const distanz = Math.abs(lat - 50.776) * 111 + Math.abs(lng - 6.084) * 71;
  const zone = DEFAULT_ZONES.find((z) => distanz >= z.min_km && distanz < z.max_km) ?? DEFAULT_ZONES[3];
  return {
    location_id: locationId,
    lat,
    lng,
    lieferbar: true,
    zone: {
      name: zone.name,
      label: zone.label,
      distanz_km: Math.round(distanz * 10) / 10,
      lieferbar: true,
      lieferpauschale_eur: zone.surcharge_eur,
      mindestbestellwert_eur: zone.min_order_eur,
      kostenlos_ab_eur: zone.free_delivery_above_eur,
      eta_basis_min: zone.eta_base_min,
    },
    hinweis: null,
    geprueft_am: new Date().toISOString(),
  };
}

export async function POST(req: NextRequest) {
  let body: Partial<PruefenBody>;
  try {
    body = (await req.json()) as Partial<PruefenBody>;
  } catch {
    return NextResponse.json({ error: 'Ungültiger Request-Body (JSON erwartet)' }, { status: 400 });
  }

  const { location_id: locationId, lat, lng } = body;

  if (!locationId || typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json(
      { error: 'location_id, lat und lng sind erforderlich' },
      { status: 400 },
    );
  }

  const now = new Date();

  try {
    const sb = await createClient();

    // Location-Koordinaten (Depot) aus der DB laden
    const { data: loc } = await sb
      .from('mise_locations')
      .select('lat, lng')
      .eq('id', locationId)
      .single();

    const depotLat = (loc as { lat?: number } | null)?.lat ?? 50.776;
    const depotLng = (loc as { lng?: number } | null)?.lng ?? 6.084;
    const distanzKm = haversineKm({ lat: depotLat, lng: depotLng }, { lat, lng });

    // Zonen-Konfiguration aus DB
    const { data: zonesData } = await sb
      .from('delivery_zones')
      .select('name, label, min_km, max_km, surcharge_eur, min_order_eur, free_delivery_above_eur, eta_base_min')
      .eq('location_id', locationId)
      .eq('active', true)
      .order('min_km', { ascending: true });

    const zones = (zonesData && zonesData.length > 0)
      ? (zonesData as Array<{
          name: 'A' | 'B' | 'C' | 'D';
          label: string;
          min_km: number;
          max_km: number;
          surcharge_eur: number;
          min_order_eur: number;
          free_delivery_above_eur: number | null;
          eta_base_min: number;
        }>)
      : DEFAULT_ZONES;

    const matchedZone = zones.find(
      (z) => distanzKm >= Number(z.min_km) && distanzKm < Number(z.max_km),
    );

    if (!matchedZone) {
      return NextResponse.json({
        location_id: locationId,
        lat,
        lng,
        lieferbar: false,
        zone: null,
        hinweis: `Adresse liegt ${distanzKm.toFixed(1)} km entfernt — außerhalb des Liefergebiets.`,
        geprueft_am: now.toISOString(),
      } satisfies PruefenAntwort);
    }

    const antwort: PruefenAntwort = {
      location_id: locationId,
      lat,
      lng,
      lieferbar: true,
      zone: {
        name: matchedZone.name,
        label: matchedZone.label,
        distanz_km: Math.round(distanzKm * 10) / 10,
        lieferbar: true,
        lieferpauschale_eur: Number(matchedZone.surcharge_eur),
        mindestbestellwert_eur: Number(matchedZone.min_order_eur),
        kostenlos_ab_eur: matchedZone.free_delivery_above_eur != null
          ? Number(matchedZone.free_delivery_above_eur)
          : null,
        eta_basis_min: Number(matchedZone.eta_base_min),
      },
      hinweis: null,
      geprueft_am: now.toISOString(),
    };

    return NextResponse.json(antwort);
  } catch {
    return NextResponse.json(buildMock(lat, lng, locationId));
  }
}
