import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'abgeschlossen' | 'unterwegs';
  eta_min: number | null;
}

interface TourScore {
  tour_id: string;
  fahrer_name: string;
  score: number;
  sub_puenktlichkeit: number;
  sub_abschluss: number;
  sub_speed: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  aktuelle_stopp_adresse: string | null;
  stopps: TourStopp[];
  alert_low: boolean;
}

interface ApiData {
  touren: TourScore[];
  flotte_avg_score: number;
  alert_count: number;
}

const MOCK: ApiData = {
  flotte_avg_score: 78,
  alert_count: 1,
  touren: [
    {
      tour_id: 't1', fahrer_name: 'Max M.', score: 91,
      sub_puenktlichkeit: 95, sub_abschluss: 90, sub_speed: 88,
      stopps_gesamt: 6, stopps_fertig: 4,
      aktuelle_stopp_adresse: 'Vaalser Str. 12', alert_low: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Pontstraße 3',    status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Jülicher Str. 7', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 3, adresse: 'Kölner Str. 21',  status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 4, adresse: 'Brand 45',          status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 5, adresse: 'Vaalser Str. 12',   status: 'unterwegs',     eta_min: 4 },
        { stopp_nr: 6, adresse: 'Düppelstr. 8',      status: 'ausstehend',    eta_min: 12 },
      ],
    },
    {
      tour_id: 't2', fahrer_name: 'Sara K.', score: 63,
      sub_puenktlichkeit: 58, sub_abschluss: 70, sub_speed: 60,
      stopps_gesamt: 5, stopps_fertig: 1,
      aktuelle_stopp_adresse: 'Neuköllner Str. 5', alert_low: true,
      stopps: [
        { stopp_nr: 1, adresse: 'Burtscheid 2',       status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Neuköllner Str. 5',  status: 'unterwegs',     eta_min: 7  },
        { stopp_nr: 3, adresse: 'Eupenerstr. 42',     status: 'ausstehend',    eta_min: 18 },
        { stopp_nr: 4, adresse: 'Roermonder Str. 9',  status: 'ausstehend',    eta_min: 27 },
        { stopp_nr: 5, adresse: 'Forster Str. 14',    status: 'ausstehend',    eta_min: 35 },
      ],
    },
    {
      tour_id: 't3', fahrer_name: 'Julia F.', score: 85,
      sub_puenktlichkeit: 88, sub_abschluss: 85, sub_speed: 82,
      stopps_gesamt: 4, stopps_fertig: 3,
      aktuelle_stopp_adresse: 'Lindenplatz 1', alert_low: false,
      stopps: [
        { stopp_nr: 1, adresse: 'Augustastr. 11', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 2, adresse: 'Hartmannstr. 6', status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 3, adresse: 'Prager Ring 3',  status: 'abgeschlossen', eta_min: null },
        { stopp_nr: 4, adresse: 'Lindenplatz 1',  status: 'unterwegs',     eta_min: 3  },
      ],
    },
  ],
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location_id = searchParams.get('location_id');

  if (!location_id) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const { data: tours, error } = await supabase
      .from('delivery_tours')
      .select(`
        id,
        driver_id,
        status,
        started_at,
        drivers(full_name),
        delivery_stops(id, stopp_nr, adresse, plz, status, eta, completed_at, created_at)
      `)
      .eq('location_id', location_id)
      .in('status', ['unterwegs', 'aktiv', 'pickup', 'zugewiesen'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !tours || tours.length === 0) {
      return NextResponse.json(MOCK);
    }

    type TourRow = {
      id: string;
      driver_id: string;
      status: string;
      started_at: string | null;
      drivers?: { full_name: string } | null;
      delivery_stops?: Array<{
        id: string;
        stopp_nr: number;
        adresse: string;
        plz: string;
        status: string;
        eta: string | null;
        completed_at: string | null;
        created_at: string;
      }>;
    };

    const touren: TourScore[] = (tours as TourRow[]).map(t => {
      const stopps = (t.delivery_stops ?? []).sort((a, b) => a.stopp_nr - b.stopp_nr);
      const stopps_fertig = stopps.filter(s => s.status === 'abgeschlossen' || s.status === 'delivered' || s.status === 'completed').length;
      const aktiv = stopps.find(s => s.status === 'unterwegs' || s.status === 'aktiv');
      const now = Date.now();

      const puenktlichkeit = stopps_fertig > 0
        ? Math.round((stopps.filter(s => s.completed_at && s.eta && new Date(s.completed_at) <= new Date(s.eta)).length / stopps_fertig) * 100)
        : 80;
      const abschluss = stopps.length > 0 ? Math.round((stopps_fertig / stopps.length) * 100) : 0;
      const startMs = t.started_at ? new Date(t.started_at).getTime() : now - 30 * 60000;
      const elapsedMin = (now - startMs) / 60000;
      const expectedMin = stopps.length * 8;
      const speed = Math.min(100, Math.round((expectedMin / Math.max(elapsedMin, 1)) * 100));
      const score = Math.round((puenktlichkeit * 0.4) + (abschluss * 0.4) + (speed * 0.2));

      return {
        tour_id: t.id,
        fahrer_name: t.drivers?.full_name ?? t.driver_id,
        score: Math.min(100, Math.max(0, score)),
        sub_puenktlichkeit: puenktlichkeit,
        sub_abschluss: abschluss,
        sub_speed: speed,
        stopps_gesamt: stopps.length,
        stopps_fertig,
        aktuelle_stopp_adresse: aktiv?.adresse ?? null,
        alert_low: score < 65,
        stopps: stopps.map(s => ({
          stopp_nr: s.stopp_nr,
          adresse: s.adresse,
          status: (s.status === 'abgeschlossen' || s.status === 'delivered' || s.status === 'completed')
            ? 'abgeschlossen'
            : (s.status === 'unterwegs' || s.status === 'aktiv') ? 'unterwegs' : 'ausstehend',
          eta_min: s.eta ? Math.max(0, Math.round((new Date(s.eta).getTime() - now) / 60000)) : null,
        })),
      };
    });

    const avg = touren.length ? Math.round(touren.reduce((s, t) => s + t.score, 0) / touren.length) : 0;
    return NextResponse.json({
      touren,
      flotte_avg_score: avg,
      alert_count: touren.filter(t => t.alert_low).length,
    } satisfies ApiData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
