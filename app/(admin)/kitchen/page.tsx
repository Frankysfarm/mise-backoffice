import { PageHeader } from '@/components/layout/page-header';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { redirect } from 'next/navigation';
import { KitchenBoard } from './client';

export const dynamic = 'force-dynamic';

export default async function KitchenPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb.from('employees').select('tenant_id,location_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const [
    { data: orders },
    { data: locations },
    { data: drivers },
    { data: batches },
    { data: batchStops },
    { data: miseBatches },
    { data: miseStops },
  ] = await Promise.all([
    svc.from('customer_orders')
      .select('*, items:order_items(id, name, menge, einzelpreis, notiz, extras), tisch:restaurant_tables(nummer)')
      .eq('tenant_id', emp.tenant_id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
      .order('bestellt_am', { ascending: true }),
    svc.from('locations').select('id, name, lat, lng').eq('tenant_id', emp.tenant_id),
    svc.from('employees')
      .select(`
        id, vorname, nachname, rolle, telefon,
        status:driver_status(ist_online, fahrzeug, aktueller_batch_id, last_lat, last_lng, last_update, online_seit)
      `)
      .eq('tenant_id', emp.tenant_id).eq('rolle', 'fahrer').eq('aktiv', true),
    svc.from('delivery_batches')
      .select('id, driver_id, status, started_at')
      .in('status', ['aktiv', 'unterwegs']),
    svc.from('delivery_batch_stops')
      .select('id, batch_id, order_id, reihenfolge, angekommen_am, geliefert_am')
      .order('reihenfolge', { ascending: true }),
    svc.from('mise_delivery_batches')
      .select('id, driver_id, state, started_at')
      .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'on_route']),
    svc.from('mise_delivery_batch_stops')
      .select('id, batch_id, order_id, sequence, arrived_at, completed_at, type')
      .eq('type', 'dropoff')
      .order('sequence', { ascending: true }),
  ]);

  // Normalize mise batches/stops to match legacy schema
  const normalizedMiseBatches = ((miseBatches ?? []) as any[]).map((b: any) => ({
    id: b.id, driver_id: b.driver_id, status: b.state, started_at: b.started_at,
  }));
  const normalizedMiseStops = ((miseStops ?? []) as any[]).map((s: any) => ({
    id: s.id, batch_id: s.batch_id, order_id: s.order_id,
    reihenfolge: s.sequence, angekommen_am: s.arrived_at, geliefert_am: s.completed_at,
  }));

  return (
    <>
      <PageHeader
        title="Küchen-Monitor"
        description="Bestellungen annehmen, zubereiten, Fahrer im Blick behalten."
        actions={<a href="/kitchen/tv" target="_blank" className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm hover:bg-muted transition">📺 TV-Display</a>}
      />
      <KitchenBoard
        initialOrders={(orders as any[]) ?? []}
        locations={(locations as any[]) ?? []}
        initialDrivers={(drivers as any[]) ?? []}
        initialBatches={[...((batches as any[]) ?? []), ...normalizedMiseBatches]}
        initialStops={[...((batchStops as any[]) ?? []), ...normalizedMiseStops]}
      />
    </>
  );
}
