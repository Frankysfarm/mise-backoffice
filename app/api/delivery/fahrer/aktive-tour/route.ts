import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourStop {
  stopp_id: string;
  stopp_nr: number;
  order_id: string;
  bestellnummer: string;
  kunde_name: string;
  adresse: string;
  plz: string;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  notiz: string | null;
  lieferhinweis: string | null;
  gesamtbetrag: number;
  bezahlt: boolean;
  pakete: number;
  eta_min: number | null;
  status: 'ausstehend' | 'unterwegs' | 'abgeschlossen';
}

interface ApiData {
  tour_id: string;
  stopps: TourStop[];
  aktiver_stopp_nr: number | null;
  tour_status: 'zugewiesen' | 'pickup' | 'unterwegs' | 'fertig';
  stopps_fertig: number;
  stopps_gesamt: number;
}

const MOCK: ApiData = {
  tour_id: 't1',
  stopps: [
    {
      stopp_id: 's1', stopp_nr: 1, order_id: 'o1', bestellnummer: '#1042',
      kunde_name: 'Marie Schmidt', adresse: 'Pontstraße 3', plz: '52062',
      lat: 50.776, lng: 6.083, telefon: '+4924112345', notiz: 'Klingel defekt — anrufen!',
      lieferhinweis: 'HG, 2. OG links', gesamtbetrag: 24.50, bezahlt: false, pakete: 2,
      eta_min: 4, status: 'unterwegs',
    },
    {
      stopp_id: 's2', stopp_nr: 2, order_id: 'o2', bestellnummer: '#1043',
      kunde_name: 'Tom Bauer', adresse: 'Jülicher Str. 7', plz: '52070',
      lat: 50.789, lng: 6.071, telefon: '+4924198765', notiz: null,
      lieferhinweis: null, gesamtbetrag: 18.90, bezahlt: true, pakete: 1,
      eta_min: 12, status: 'ausstehend',
    },
  ],
  aktiver_stopp_nr: 1,
  tour_status: 'unterwegs',
  stopps_fertig: 0,
  stopps_gesamt: 2,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driver_id = searchParams.get('driver_id');

  if (!driver_id) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = await createClient();

    const { data: tour, error } = await supabase
      .from('delivery_tours')
      .select(`
        id,
        status,
        delivery_stops(
          id, stopp_nr, adresse, plz, lat, lng, telefon, notiz, lieferhinweis,
          status, eta, completed_at,
          orders(id, order_number, total_amount, is_paid, customer_name, pakete_anzahl)
        )
      `)
      .eq('driver_id', driver_id)
      .in('status', ['zugewiesen', 'pickup', 'unterwegs', 'aktiv'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !tour) return NextResponse.json(MOCK);

    type StopRow = {
      id: string;
      stopp_nr: number;
      adresse: string;
      plz: string;
      lat: number | null;
      lng: number | null;
      telefon: string | null;
      notiz: string | null;
      lieferhinweis: string | null;
      status: string;
      eta: string | null;
      completed_at: string | null;
      orders?: {
        id: string;
        order_number: string | null;
        total_amount: number | null;
        is_paid: boolean | null;
        customer_name: string | null;
        pakete_anzahl: number | null;
      } | null;
    };

    const now = Date.now();
    const stopps_raw = (tour.delivery_stops as StopRow[] ?? []).sort((a, b) => a.stopp_nr - b.stopp_nr);

    const stopps: TourStop[] = stopps_raw.map(s => {
      const st = s.status.toLowerCase();
      const status: TourStop['status'] =
        (st === 'abgeschlossen' || st === 'delivered' || st === 'completed') ? 'abgeschlossen' :
        (st === 'unterwegs' || st === 'aktiv' || st === 'active') ? 'unterwegs' : 'ausstehend';
      return {
        stopp_id: s.id,
        stopp_nr: s.stopp_nr,
        order_id: s.orders?.id ?? s.id,
        bestellnummer: s.orders?.order_number ? `#${s.orders.order_number}` : s.id.slice(0, 6),
        kunde_name: s.orders?.customer_name ?? 'Unbekannt',
        adresse: s.adresse,
        plz: s.plz,
        lat: s.lat,
        lng: s.lng,
        telefon: s.telefon,
        notiz: s.notiz,
        lieferhinweis: s.lieferhinweis,
        gesamtbetrag: s.orders?.total_amount ?? 0,
        bezahlt: s.orders?.is_paid ?? false,
        pakete: s.orders?.pakete_anzahl ?? 1,
        eta_min: s.eta ? Math.max(0, Math.round((new Date(s.eta).getTime() - now) / 60000)) : null,
        status,
      };
    });

    const stopps_fertig = stopps.filter(s => s.status === 'abgeschlossen').length;
    const aktiver_stopp = stopps.find(s => s.status === 'unterwegs');
    const ts = tour.status.toLowerCase();
    const tour_status: ApiData['tour_status'] =
      (ts === 'fertig' || ts === 'completed') ? 'fertig' :
      (ts === 'pickup') ? 'pickup' :
      (ts === 'unterwegs' || ts === 'aktiv' || ts === 'active') ? 'unterwegs' : 'zugewiesen';

    return NextResponse.json({
      tour_id: tour.id,
      stopps,
      aktiver_stopp_nr: aktiver_stopp?.stopp_nr ?? null,
      tour_status,
      stopps_fertig,
      stopps_gesamt: stopps.length,
    } satisfies ApiData);
  } catch {
    return NextResponse.json(MOCK);
  }
}
