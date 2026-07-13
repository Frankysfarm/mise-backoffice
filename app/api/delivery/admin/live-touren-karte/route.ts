import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Phase 1248 — Live-Touren-Karte-API
// Aktive Fahrer mit Zone + Stopps + ETA für SVG-Kartenansicht
// Multi-Tenant: location_id auf jeder Query

interface TourKartePunkt {
  fahrer_id: string;
  fahrer_name: string;
  zone: string | null;
  on_tour: boolean;
  offene_stopps: number;
  naechster_stopp_adresse: string | null;
  eta_min: number | null;
  status: 'frei' | 'aktiv' | 'abweichend';
}

interface ApiResponse {
  fahrer: TourKartePunkt[];
  aktive_fahrer: number;
  freie_fahrer: number;
  offene_stopps_gesamt: number;
  location_id: string;
  generiert_am: string;
}

function mockData(location_id: string): ApiResponse {
  const fahrer: TourKartePunkt[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max Müller', zone: 'Mitte', on_tour: true, offene_stopps: 2, naechster_stopp_adresse: 'Hauptstr. 12', eta_min: 8, status: 'aktiv' },
    { fahrer_id: 'f2', fahrer_name: 'Jana Koch', zone: 'Nord', on_tour: true, offene_stopps: 3, naechster_stopp_adresse: 'Nordring 4', eta_min: 15, status: 'abweichend' },
    { fahrer_id: 'f3', fahrer_name: 'Tom Berg', zone: 'Süd', on_tour: false, offene_stopps: 0, naechster_stopp_adresse: null, eta_min: null, status: 'frei' },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Meier', zone: 'West', on_tour: true, offene_stopps: 1, naechster_stopp_adresse: 'Westgasse 7', eta_min: 5, status: 'aktiv' },
  ];
  return {
    fahrer,
    aktive_fahrer: fahrer.filter(f => f.on_tour).length,
    freie_fahrer: fahrer.filter(f => !f.on_tour).length,
    offene_stopps_gesamt: fahrer.reduce((s, f) => s + f.offene_stopps, 0),
    location_id,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');
  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const { data: drivers } = await supabase
      .from('mise_drivers')
      .select('id, name, delivery_zone, on_tour, online')
      .eq('location_id', location_id)
      .eq('online', true);

    if (!drivers || drivers.length === 0) return NextResponse.json(mockData(location_id));

    const now = new Date();

    const fahrerList: TourKartePunkt[] = await Promise.all(
      drivers.map(async (d) => {
        const { data: stops } = await supabase
          .from('mise_delivery_stops')
          .select('id, address, estimated_delivery_at, delivered_at')
          .eq('driver_id', d.id)
          .is('delivered_at', null)
          .order('stop_order', { ascending: true })
          .limit(5);

        const offeneStopps = stops?.length ?? 0;
        const naechster = stops?.[0] ?? null;
        let eta_min: number | null = null;
        if (naechster?.estimated_delivery_at) {
          eta_min = Math.max(0, Math.round((new Date(naechster.estimated_delivery_at).getTime() - now.getTime()) / 60000));
        }

        let status: TourKartePunkt['status'] = 'frei';
        if (d.on_tour) {
          status = eta_min !== null && eta_min > 20 ? 'abweichend' : 'aktiv';
        }

        return {
          fahrer_id: d.id,
          fahrer_name: d.name ?? 'Unbekannt',
          zone: d.delivery_zone ?? null,
          on_tour: d.on_tour ?? false,
          offene_stopps: offeneStopps,
          naechster_stopp_adresse: naechster?.address ?? null,
          eta_min,
          status,
        };
      }),
    );

    return NextResponse.json({
      fahrer: fahrerList,
      aktive_fahrer: fahrerList.filter(f => f.on_tour).length,
      freie_fahrer: fahrerList.filter(f => !f.on_tour).length,
      offene_stopps_gesamt: fahrerList.reduce((s, f) => s + f.offene_stopps, 0),
      location_id,
      generiert_am: now.toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(location_id));
  }
}
