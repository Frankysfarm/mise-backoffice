import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MOCK_DATA = {
  stopps: [
    { stopp_id: 's1', rang: 1, adresse: 'Musterstr. 12, 52062 Aachen', kunde_name: 'M. Müller',  eta_min: 5,  status: 'unterwegs',  lat: 50.776, lng: 6.084 },
    { stopp_id: 's2', rang: 2, adresse: 'Kaiserpl. 4, 52062 Aachen',   kunde_name: 'K. Schmidt', eta_min: 14, status: 'ausstehend', lat: 50.774, lng: 6.086 },
    { stopp_id: 's3', rang: 3, adresse: 'Pontstr. 39, 52062 Aachen',   kunde_name: 'J. Weber',   eta_min: 22, status: 'ausstehend', lat: 50.772, lng: 6.088 },
  ],
  aktiver_stopp_id: 's1',
  verbleibende_stopps: 3,
  tour_eta_gesamt_min: 22,
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const location_id = searchParams.get('location_id');
  const driver_id   = searchParams.get('driver_id');

  if (!location_id || !driver_id) return NextResponse.json(MOCK_DATA);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  );

  try {
    const { data: tour } = await supabase
      .from('delivery_tours')
      .select('id, status')
      .eq('location_id', location_id)
      .eq('driver_id', driver_id)
      .in('status', ['active', 'in_progress'])
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (!tour) return NextResponse.json(MOCK_DATA);

    const { data: rawStops } = await supabase
      .from('batch_stops')
      .select('id, stopp_nr, adresse, lat, lng, status, eta, orders(customer_name)')
      .eq('tour_id', tour.id)
      .order('stopp_nr', { ascending: true });

    const stops = rawStops ?? [];
    if (stops.length === 0) return NextResponse.json(MOCK_DATA);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stopps = (stops as any[]).map((s: {
      id: string; stopp_nr: number; adresse: string; lat: number | null; lng: number | null;
      status: string; eta: string | null; orders: { customer_name: string | null } | null;
    }) => {
      const etaMin = s.eta ? Math.max(0, Math.round((new Date(s.eta).getTime() - Date.now()) / 60000)) : null;
      const status: 'ausstehend' | 'unterwegs' | 'geliefert' =
        s.status === 'delivered' ? 'geliefert' :
        s.status === 'active'    ? 'unterwegs' : 'ausstehend';
      return {
        stopp_id:  s.id,
        rang:      s.stopp_nr,
        adresse:   s.adresse ?? '—',
        kunde_name: s.orders?.customer_name ?? '—',
        eta_min:   etaMin,
        status,
        lat: s.lat,
        lng: s.lng,
      };
    });

    const aktiv = stopps.find((s: { status: string }) => s.status === 'unterwegs');
    const verbleibend = stopps.filter((s: { status: string }) => s.status !== 'geliefert').length;
    const maxEta = stopps.reduce((m: number, s: { eta_min: number | null }) => Math.max(m, s.eta_min ?? 0), 0);

    return NextResponse.json({
      stopps,
      aktiver_stopp_id:     aktiv?.stopp_id ?? null,
      verbleibende_stopps:  verbleibend,
      tour_eta_gesamt_min:  maxEta,
    });
  } catch {
    return NextResponse.json(MOCK_DATA);
  }
}
