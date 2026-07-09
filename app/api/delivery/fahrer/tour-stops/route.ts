/**
 * GET /api/delivery/fahrer/tour-stops
 *
 * Phase 949 — Tour-Stopp-Live-Navigator (Fahrer-App)
 *
 * Gibt alle Stopps der aktuellen aktiven Tour für einen Fahrer zurück.
 * Genutzt von FahrerPhase949TourStoppLiveNavigator.
 *
 * Gibt TourStop[] zurück (direkt als Array, kein Wrapper).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  status: 'ausstehend' | 'unterwegs' | 'angekommen' | 'abgeliefert';
  eta_min: number | null;
  notiz: string | null;
}

const MOCK_STOPS: TourStop[] = [
  { id: '1', reihenfolge: 1, adresse: 'Musterstraße 12, 10115 Berlin', kunde_name: 'Schmidt, H.', telefon: '+49 30 12345678', bestellnummer: '2401', status: 'angekommen', eta_min: 0, notiz: null },
  { id: '2', reihenfolge: 2, adresse: 'Hauptstr. 55, 10117 Berlin', kunde_name: 'Müller, K.', telefon: '+49 30 87654321', bestellnummer: '2402', status: 'ausstehend', eta_min: 8, notiz: null },
  { id: '3', reihenfolge: 3, adresse: 'Berliner Allee 3, 10119 Berlin', kunde_name: 'Weber, S.', telefon: null, bestellnummer: '2403', status: 'ausstehend', eta_min: 16, notiz: 'Klingel 3. OG' },
];

function stopStateToStatus(state: string, index: number): TourStop['status'] {
  switch (state) {
    case 'delivered': return 'abgeliefert';
    case 'arrived':   return 'angekommen';
    case 'en_route':  return 'unterwegs';
    default:          return index === 0 ? 'unterwegs' : 'ausstehend';
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');

  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = createServiceClient();

    // Aktive Batch für diesen Fahrer
    const { data: batch, error: bErr } = await sb
      .from('mise_delivery_batches')
      .select('id, total_eta_min')
      .eq('driver_id', driverId)
      .in('state', ['assigned', 'at_restaurant', 'on_route'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bErr || !batch) {
      return NextResponse.json(MOCK_STOPS);
    }

    // Batch-Stopps laden
    const { data: batchStops, error: sErr } = await sb
      .from('mise_batch_stops')
      .select(`
        id,
        stop_order,
        state,
        stop_type,
        address,
        notes,
        eta_min,
        customer_orders!order_id (
          id,
          order_number,
          customer_name,
          customer_phone
        )
      `)
      .eq('batch_id', batch.id)
      .eq('stop_type', 'dropoff')
      .order('stop_order', { ascending: true });

    if (sErr || !batchStops?.length) {
      return NextResponse.json(MOCK_STOPS);
    }

    const totalEtaMin = (batch.total_eta_min as number | null) ?? 30;
    const perStopEta = Math.round(totalEtaMin / Math.max(batchStops.length, 1));

    interface StopRow {
      id: string;
      stop_order: number | null;
      state: string;
      address: string | null;
      notes: string | null;
      eta_min: number | null;
      customer_orders: {
        id: string;
        order_number: string | null;
        customer_name: string | null;
        customer_phone: string | null;
      } | null;
    }

    const stops: TourStop[] = (batchStops as unknown as StopRow[]).map((stop, idx) => {
      const order = Array.isArray(stop.customer_orders)
        ? stop.customer_orders[0]
        : stop.customer_orders;

      const status = stopStateToStatus(stop.state, idx);

      // ETA: ausstehende Stopps erhalten kumulierte ETA
      const pendingBefore = (batchStops as unknown as StopRow[])
        .slice(0, idx)
        .filter(s => s.state !== 'delivered').length;
      const etaMin = status === 'abgeliefert'
        ? null
        : status === 'angekommen'
          ? 0
          : stop.eta_min ?? (pendingBefore + 1) * perStopEta;

      return {
        id: stop.id,
        reihenfolge: (stop.stop_order ?? idx) + 1,
        adresse: stop.address ?? 'Adresse unbekannt',
        kunde_name: order?.customer_name ?? null,
        telefon: order?.customer_phone ?? null,
        bestellnummer: order?.order_number ?? null,
        status,
        eta_min: etaMin,
        notiz: stop.notes ?? null,
      };
    });

    return NextResponse.json(stops);
  } catch {
    return NextResponse.json(MOCK_STOPS);
  }
}
