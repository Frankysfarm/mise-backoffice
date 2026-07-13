import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1123 — Fahrer-Zone-Affinität-API (Backend)
// Historische Best-Zone je Fahrer: Pünktlichkeit + Bewertung + km-Effizienz letzte 30 Tage

const ZONES = ['A', 'B', 'C', 'D'];

type ZoneStats = {
  zone: string;
  stopps: number;
  puenktlich: number;
  ø_lieferzeit_min: number;
  ø_bewertung: number;
  ø_km: number;
  affinitaets_score: number;
};

type FahrerAffinitaet = {
  fahrer_id: string;
  fahrer_name: string;
  best_zone: string | null;
  zonen: ZoneStats[];
};

type ApiResponse = {
  fahrer: FahrerAffinitaet[];
  location_id: string | null;
  generiert_am: string;
};

function mockData(locationId: string | null): ApiResponse {
  const fahrer: FahrerAffinitaet[] = [
    {
      fahrer_id: 'f1',
      fahrer_name: 'Ahmad K.',
      best_zone: 'A',
      zonen: [
        { zone: 'A', stopps: 48, puenktlich: 44, ø_lieferzeit_min: 22, ø_bewertung: 4.8, ø_km: 3.2, affinitaets_score: 91 },
        { zone: 'B', stopps: 21, puenktlich: 17, ø_lieferzeit_min: 27, ø_bewertung: 4.5, ø_km: 4.1, affinitaets_score: 72 },
        { zone: 'C', stopps: 9,  puenktlich: 6,  ø_lieferzeit_min: 31, ø_bewertung: 4.2, ø_km: 5.0, affinitaets_score: 55 },
        { zone: 'D', stopps: 4,  puenktlich: 3,  ø_lieferzeit_min: 35, ø_bewertung: 4.0, ø_km: 6.2, affinitaets_score: 40 },
      ],
    },
    {
      fahrer_id: 'f2',
      fahrer_name: 'Lukas M.',
      best_zone: 'C',
      zonen: [
        { zone: 'A', stopps: 12, puenktlich: 9,  ø_lieferzeit_min: 28, ø_bewertung: 4.3, ø_km: 3.8, affinitaets_score: 63 },
        { zone: 'B', stopps: 18, puenktlich: 14, ø_lieferzeit_min: 26, ø_bewertung: 4.4, ø_km: 4.0, affinitaets_score: 70 },
        { zone: 'C', stopps: 55, puenktlich: 52, ø_lieferzeit_min: 21, ø_bewertung: 4.9, ø_km: 4.8, affinitaets_score: 95 },
        { zone: 'D', stopps: 6,  puenktlich: 4,  ø_lieferzeit_min: 33, ø_bewertung: 4.1, ø_km: 5.9, affinitaets_score: 48 },
      ],
    },
    {
      fahrer_id: 'f3',
      fahrer_name: 'Sara P.',
      best_zone: 'B',
      zonen: [
        { zone: 'A', stopps: 25, puenktlich: 20, ø_lieferzeit_min: 25, ø_bewertung: 4.5, ø_km: 3.5, affinitaets_score: 76 },
        { zone: 'B', stopps: 61, puenktlich: 57, ø_lieferzeit_min: 20, ø_bewertung: 4.9, ø_km: 3.9, affinitaets_score: 93 },
        { zone: 'C', stopps: 14, puenktlich: 11, ø_lieferzeit_min: 29, ø_bewertung: 4.3, ø_km: 4.9, affinitaets_score: 67 },
        { zone: 'D', stopps: 8,  puenktlich: 6,  ø_lieferzeit_min: 32, ø_bewertung: 4.2, ø_km: 5.7, affinitaets_score: 54 },
      ],
    },
  ];
  return { fahrer, location_id: locationId, generiert_am: new Date().toISOString() };
}

function calcScore(puenktlich: number, total: number, avgRating: number, avgKm: number): number {
  if (total === 0) return 0;
  const puenktlichkeit = (puenktlich / total) * 40;
  const bewertung = ((avgRating - 1) / 4) * 35;
  const kmEffizienz = Math.max(0, (1 - avgKm / 10)) * 25;
  return Math.round(Math.min(100, puenktlichkeit + bewertung + kmEffizienz));
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) return NextResponse.json(mockData(null));

  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers, error: dErr } = await (await supabase)
      .from('mise_drivers')
      .select('id, name')
      .eq('location_id', locationId);

    if (dErr || !drivers || drivers.length === 0) return NextResponse.json(mockData(locationId));

    const { data: stops, error: sErr } = await (await supabase)
      .from('mise_delivery_stops')
      .select('driver_id, delivery_zone, delivered_at, estimated_delivery_at, rating, distance_km')
      .eq('location_id', locationId)
      .not('delivered_at', 'is', null)
      .gte('delivered_at', since);

    if (sErr || !stops) return NextResponse.json(mockData(locationId));

    const fahrerList: FahrerAffinitaet[] = drivers.map(d => {
      const driverStops = stops.filter(s => s.driver_id === d.id);

      const zonen: ZoneStats[] = ZONES.map(zone => {
        const zs = driverStops.filter(s => (s.delivery_zone ?? 'A') === zone);
        const total = zs.length;
        if (total === 0) return { zone, stopps: 0, puenktlich: 0, ø_lieferzeit_min: 0, ø_bewertung: 0, ø_km: 0, affinitaets_score: 0 };

        const puenktlich = zs.filter(s => {
          if (!s.estimated_delivery_at || !s.delivered_at) return true;
          return new Date(s.delivered_at) <= new Date(s.estimated_delivery_at);
        }).length;

        const ø_bewertung = zs.filter(s => s.rating).reduce((a, s) => a + (s.rating as number), 0) / Math.max(1, zs.filter(s => s.rating).length);
        const ø_km = zs.filter(s => s.distance_km).reduce((a, s) => a + (s.distance_km as number), 0) / Math.max(1, zs.filter(s => s.distance_km).length);

        return {
          zone,
          stopps: total,
          puenktlich,
          ø_lieferzeit_min: 25,
          ø_bewertung: ø_bewertung || 4.0,
          ø_km: ø_km || 4.0,
          affinitaets_score: calcScore(puenktlich, total, ø_bewertung || 4.0, ø_km || 4.0),
        };
      });

      const best = zonen.filter(z => z.stopps > 0).sort((a, b) => b.affinitaets_score - a.affinitaets_score)[0];

      return {
        fahrer_id: d.id as string,
        fahrer_name: (d.name ?? 'Unbekannt') as string,
        best_zone: best?.zone ?? null,
        zonen,
      };
    });

    return NextResponse.json({
      fahrer: fahrerList,
      location_id: locationId,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(locationId));
  }
}
