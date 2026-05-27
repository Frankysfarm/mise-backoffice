import { PageHeader } from '@/components/layout/page-header';
import { createClient } from '@/lib/supabase/server';
import { DispatchBoard } from './client';

export const dynamic = 'force-dynamic';

export default async function DispatchPage() {
  const supabase = await createClient();

  const [{ data: readyOrders }, { data: drivers }, { data: batches }, { data: locations }] = await Promise.all([
    supabase
      .from('customer_orders')
      .select('id, bestellnummer, status, typ, kunde_name, kunde_adresse, kunde_plz, kunde_lat, kunde_lng, gesamtbetrag, zahlungsart, fertig_am, external_source, location_id')
      .eq('typ', 'lieferung')
      .in('status', ['fertig', 'unterwegs'])
      .order('fertig_am', { ascending: true }),
    supabase
      .from('driver_status')
      .select('*, employee:employees(id, vorname, nachname, avatar_url, telefon)')
      .order('last_update', { ascending: false }),
    supabase
      .from('delivery_batches')
      .select('*, fahrer:employees(vorname, nachname), stops:delivery_batch_stops(id, order_id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer, kunde_name, kunde_adresse))')
      .in('status', ['pickup', 'unterwegs'])
      .order('created_at', { ascending: false }),
    supabase.from('locations').select('id, name'),
  ]);

  return (
    <>
      <PageHeader
        title="Dispatch"
        description="Live-Übersicht: Fahrer, offene Lieferungen und laufende Touren"
      />
      <DispatchBoard
        initialOrders={(readyOrders as any[]) ?? []}
        initialDrivers={(drivers as any[]) ?? []}
        initialBatches={(batches as any[]) ?? []}
        locations={(locations as any[]) ?? []}
      />
    </>
  );
}
