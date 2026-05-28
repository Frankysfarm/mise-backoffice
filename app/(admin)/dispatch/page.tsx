import { PageHeader } from '@/components/layout/page-header';
import { createClient } from '@/lib/supabase/server';
import { DispatchBoard } from './client';

export const dynamic = 'force-dynamic';

function normalizeMiseBatch(b: any) {
  return {
    id: b.id,
    status: b.state,
    fahrer_id: b.driver_id,
    startzeit: b.started_at ?? null,
    total_distance_km: b.total_distance_km ?? null,
    total_eta_min: b.total_eta_min ?? null,
    zone: b.zone ?? null,
    fahrer: b.driver ? { vorname: b.driver.name, nachname: '' } : null,
    stops: ((b.stops ?? []) as any[])
      .filter((s: any) => s.type === 'dropoff')
      .map((s: any) => ({
        id: s.id,
        order_id: s.order_id,
        reihenfolge: s.sequence,
        geliefert_am: s.completed_at ?? null,
        order: s.order ?? null,
      })),
    _source: 'smart' as const,
  };
}

export default async function DispatchPage() {
  const supabase = await createClient();

  const [
    { data: readyOrders },
    { data: drivers },
    { data: legacyBatches },
    { data: smartBatches },
    { data: locations },
  ] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id, dispatch_score, delivery_zone, eta_earliest')
      .eq('typ', 'lieferung')
      .in('status', ['fertig', 'unterwegs'])
      .order('fertig_am', { ascending: true }),
    supabase
      .from('driver_status')
      .select('*, employee:employees(id, vorname, nachname, avatar_url, telefon)')
      .order('last_update', { ascending: false }),
    supabase
      .from('delivery_batches')
      .select('id, fahrer_id, status, startzeit, total_distance_km, total_eta_min, zone, fahrer:employees(vorname, nachname), stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer, kunde_name, kunde_adresse))')
      .in('status', ['pickup', 'unterwegs'])
      .order('created_at', { ascending: false }),
    supabase
      .from('mise_delivery_batches')
      .select('id, state, driver_id, started_at, total_distance_km, total_eta_min, zone, driver:mise_drivers(id, name), stops:mise_delivery_batch_stops(id, order_id, sequence, completed_at, type, order:customer_orders(bestellnummer, kunde_name, kunde_adresse))')
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route'])
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name'),
  ]);

  const allBatches = [
    ...((legacyBatches ?? []) as any[]),
    ...((smartBatches ?? []) as any[]).map(normalizeMiseBatch),
  ];

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Live-Übersicht: Fahrer, offene Lieferungen und laufende Touren"
      />
      <DispatchBoard
        initialOrders={(readyOrders as any[]) ?? []}
        initialDrivers={(drivers as any[]) ?? []}
        initialBatches={allBatches}
        locations={(locations as any[]) ?? []}
      />
    </>
  );
}
