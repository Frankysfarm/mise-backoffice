/**
 * GET /api/delivery/admin/routen-optimierung-auto?location_id=<uuid>
 *
 * Phase 1324 — Fahrer-Route-Optimierungs-API (Auto)
 * Findet automatisch die Tour mit dem größten Optimierungspotenzial.
 * Nearest-Neighbor-Algorithmus, Zeitersparnis vs. aktuelle Reihenfolge.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Stop {
  id: string;
  reihenfolge: number;
  lat: number | null;
  lng: number | null;
  kunde_name: string | null;
  kunde_adresse: string | null;
  geliefert_am: string | null;
}

function totalRouteKm(stops: Stop[], startLat: number, startLng: number): number {
  let km = 0;
  let curLat = startLat;
  let curLng = startLng;
  for (const s of stops) {
    if (s.lat != null && s.lng != null) {
      km += haversineKm(curLat, curLng, s.lat, s.lng);
      curLat = s.lat;
      curLng = s.lng;
    }
  }
  return km;
}

function nearestNeighbor(stops: Stop[], startLat: number, startLng: number): Stop[] {
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let curLat = startLat;
  let curLng = startLng;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      if (s.lat == null || s.lng == null) continue;
      const d = haversineKm(curLat, curLng, s.lat, s.lng);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    ordered.push(chosen);
    if (chosen.lat != null && chosen.lng != null) {
      curLat = chosen.lat;
      curLng = chosen.lng;
    }
  }
  return ordered;
}

const MOCK_RESULT = {
  schlechteste_tour: {
    tour_id: 'mock-tour-001',
    fahrer_name: 'Max Mustermann',
    pending_stopps: 4,
    original_km: 12.4,
    optimized_km: 9.1,
    savings_km: 3.3,
    savings_min: 7,
    optimized_order: [
      { id: 's1', pos: 1, kunde_name: 'Anna Schmidt', kunde_adresse: 'Maximilianstr. 12, München' },
      { id: 's2', pos: 2, kunde_name: 'Peter Müller', kunde_adresse: 'Leopoldstr. 45, München' },
      { id: 's3', pos: 3, kunde_name: 'Lisa Weber', kunde_adresse: 'Schleißheimer Str. 8, München' },
      { id: 's4', pos: 4, kunde_name: 'Tom Koch', kunde_adresse: 'Nymphenburger Str. 22, München' },
    ],
  },
  alle_touren: [
    { tour_id: 'mock-tour-001', fahrer_name: 'Max Mustermann', savings_min: 7, savings_km: 3.3 },
    { tour_id: 'mock-tour-002', fahrer_name: 'Sarah Bauer', savings_min: 2, savings_km: 0.9 },
  ],
  generatedAt: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  let locationId = url.searchParams.get('location_id');

  try {
    const sb = await createClient();

    if (!locationId) {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const { data: emp } = await sb
        .from('employees')
        .select('location_id')
        .eq('auth_user_id', user.id)
        .maybeSingle();
      locationId = emp?.location_id ?? null;
    }

    if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

    const { data: batches } = await sb
      .from('mise_delivery_batches')
      .select('id, fahrer_id, driver_id')
      .eq('location_id', locationId)
      .is('abgeschlossen_am', null)
      .limit(20);

    if (!batches || batches.length === 0) {
      return NextResponse.json({ ...MOCK_RESULT, source: 'mock_no_batches' });
    }

    const tourResults = await Promise.all(
      batches.map(async (batch: { id: string; fahrer_id?: string; driver_id?: string }) => {
        const driverId = batch.fahrer_id ?? batch.driver_id;

        let startLat = 48.1351;
        let startLng = 11.5820;
        if (driverId) {
          const { data: pos } = await sb
            .from('driver_locations')
            .select('lat, lng')
            .eq('driver_id', driverId)
            .eq('location_id', locationId!)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (pos?.lat && pos?.lng) { startLat = pos.lat; startLng = pos.lng; }
        }

        const { data: drv } = await sb
          .from('mise_drivers')
          .select('vorname, nachname, name')
          .eq('id', driverId ?? '')
          .maybeSingle();
        const fahrerName = drv
          ? ((drv as any).vorname && (drv as any).nachname
            ? `${(drv as any).vorname} ${(drv as any).nachname}`
            : (drv as any).name ?? 'Unbekannt')
          : 'Unbekannt';

        const { data: stopsRaw } = await sb
          .from('mise_delivery_stops')
          .select('id, reihenfolge, lat, lng, kunde_name, kunde_adresse, geliefert_am')
          .eq('batch_id', batch.id)
          .order('reihenfolge', { ascending: true });

        const stops: Stop[] = (stopsRaw ?? []).map((s: Record<string, unknown>) => ({
          id: s.id as string,
          reihenfolge: (s.reihenfolge as number) ?? 0,
          lat: (s.lat as number | null) ?? null,
          lng: (s.lng as number | null) ?? null,
          kunde_name: (s.kunde_name as string | null) ?? null,
          kunde_adresse: (s.kunde_adresse as string | null) ?? null,
          geliefert_am: (s.geliefert_am as string | null) ?? null,
        }));

        const pending = stops.filter(s => !s.geliefert_am);
        if (pending.length <= 1) return null;

        const originalKm = totalRouteKm(pending, startLat, startLng);
        const optimized = nearestNeighbor(pending, startLat, startLng);
        const optimizedKm = totalRouteKm(optimized, startLat, startLng);
        const savingsKm = Math.max(0, originalKm - optimizedKm);
        const savingsMin = Math.round((savingsKm / 30) * 60);

        return {
          tour_id: batch.id,
          fahrer_name: fahrerName,
          pending_stopps: pending.length,
          original_km: Math.round(originalKm * 10) / 10,
          optimized_km: Math.round(optimizedKm * 10) / 10,
          savings_km: Math.round(savingsKm * 10) / 10,
          savings_min: savingsMin,
          optimized_order: optimized.map((s, i) => ({ ...s, pos: i + 1 })),
        };
      })
    );

    const valid = tourResults.filter(Boolean) as NonNullable<(typeof tourResults)[number]>[];
    if (valid.length === 0) {
      return NextResponse.json({ ...MOCK_RESULT, source: 'mock_no_pending_stops' });
    }

    valid.sort((a, b) => b.savings_min - a.savings_min);
    const worst = valid[0];

    return NextResponse.json({
      schlechteste_tour: worst,
      alle_touren: valid.map(t => ({
        tour_id: t.tour_id,
        fahrer_name: t.fahrer_name,
        savings_min: t.savings_min,
        savings_km: t.savings_km,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ ...MOCK_RESULT, source: 'mock_error' });
  }
}
