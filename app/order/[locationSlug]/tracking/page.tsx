import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';
import { TrackingClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Bestellung verfolgen',
  description: 'Verfolge deine Lieferung in Echtzeit.',
};

export default async function TrackingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationSlug: string }>;
  searchParams?: Promise<{ order?: string }>;
}) {
  const { locationSlug } = await params;
  const sp = await searchParams;
  const orderId = sp?.order;

  if (!orderId) notFound();

  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from('customer_orders')
    .select(`
      id, status, created_at, eta_earliest, eta_latest,
      kunde_name, gesamtbetrag, adresse,
      batch:mise_delivery_batches(
        driver:mise_drivers(name, telefon, last_lat, last_lng)
      )
    `)
    .eq('id', orderId)
    .maybeSingle();

  if (!order) notFound();

  const batch = Array.isArray(order.batch) ? order.batch[0] : order.batch;
  const driver = batch?.driver
    ? Array.isArray(batch.driver) ? batch.driver[0] : batch.driver
    : null;

  return (
    <TrackingClient
      locationSlug={locationSlug}
      initialOrder={{
        id: order.id,
        status: order.status as Parameters<typeof TrackingClient>[0]['initialOrder']['status'],
        created_at: order.created_at,
        eta_earliest: order.eta_earliest ?? null,
        eta_latest: order.eta_latest ?? null,
        kunde_name: order.kunde_name ?? null,
        gesamtbetrag: order.gesamtbetrag,
        adresse: order.adresse ?? null,
        driver_name: driver?.name ?? null,
        driver_phone: driver?.telefon ?? null,
        driver_lat: driver?.last_lat ?? null,
        driver_lng: driver?.last_lng ?? null,
      }}
    />
  );
}
