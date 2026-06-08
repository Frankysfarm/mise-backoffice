import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { FahrerApp } from './client';

export const dynamic = 'force-dynamic';

export default async function FahrerAppPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/fahrer/login');

  const svc = createServiceClient();

  const { data: driver } = await svc
    .from('employees')
    .select('id, vorname, nachname, tenant_id, location_id, rolle, fahrzeug_praeferenz')
    .eq('auth_user_id', user.id)
    .eq('kann_ausliefern', true)
    .maybeSingle();

  if (!driver) {
    redirect('/fahrer?noaccess=1');
  }

  // Mise-Driver-ID via auth_user_id ermitteln (für Smart-Dispatch-Batches)
  const { data: miseDriver } = await svc
    .from('mise_drivers')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const [{ data: status }, { data: openBatches }, { data: legacyActiveBatch }, { data: miseActiveBatch }] = await Promise.all([
    svc.from('driver_status').select('*').eq('employee_id', driver.id).maybeSingle(),
    svc.from('v_open_dispatch_batches').select('*').eq('tenant_id', driver.tenant_id),
    // Legacy-Batch (delivery_batches)
    svc.from('delivery_batches')
      .select('*, stops:delivery_batch_stops(*, order:customer_orders(id,bestellnummer,kunde_name,kunde_adresse,kunde_plz,kunde_lat,kunde_lng,gesamtbetrag,bezahlt,zahlungsart,kunde_telefon,eta_earliest,eta_latest,kunde_notiz,kunde_lieferhinweis))')
      .eq('fahrer_id', driver.id)
      .in('status', ['zugewiesen', 'pickup', 'unterwegs'])
      .maybeSingle(),
    // Mise-Batch (mise_delivery_batches) — nur wenn Mise-Driver-Account vorhanden
    miseDriver
      ? svc.from('mise_delivery_batches')
          .select('id, state, stops:mise_delivery_batch_stops(id, batch_id, order_id, sequence, completed_at, type, order:customer_orders(id,bestellnummer,kunde_name,kunde_adresse,kunde_plz,kunde_lat,kunde_lng,gesamtbetrag,bezahlt,zahlungsart,kunde_telefon,eta_earliest,eta_latest,kunde_notiz,kunde_lieferhinweis))')
          .eq('driver_id', miseDriver.id)
          .in('state', ['assigned', 'at_restaurant', 'on_route'])
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Mise-Batch auf Legacy-Format normalisieren (client.tsx erwartet ActiveBatch-Typ)
  const normalizedMiseBatch = miseActiveBatch ? {
    id: (miseActiveBatch as any).id,
    status: (miseActiveBatch as any).state === 'on_route' ? 'unterwegs' : 'pickup',
    started_at: null,
    stops: ((miseActiveBatch as any).stops ?? [])
      .filter((s: any) => s.type === 'dropoff')
      .map((s: any) => ({
        id: s.id,
        batch_id: s.batch_id,
        order_id: s.order_id,
        reihenfolge: s.sequence,
        angekommen_am: null,
        geliefert_am: s.completed_at ?? null,
        order: s.order ?? null,
      })),
  } : null;

  // Legacy-Batch hat Vorrang; Mise-Batch als Fallback
  const activeBatch = legacyActiveBatch ?? normalizedMiseBatch;

  // Offene Mise-Touren (pending_acceptance) fuer diesen Fahrer -> OpenBatch-Format
  // (damit Klingeln + Annehmen greifen; claim laeuft ueber claim_mise_delivery_batch)
  const { data: misePending } = miseDriver
    ? await svc
        .from('mise_delivery_batches')
        .select('id, location_id, created_at, location:locations(name,lat,lng), stops:mise_delivery_batch_stops(order_id, type, order:customer_orders(bestellnummer,kunde_name,kunde_adresse,kunde_plz,kunde_stadt,kunde_lat,kunde_lng,gesamtbetrag,zahlungsart,bezahlt,geschaetzte_lieferung_min))')
        .eq('driver_id', miseDriver.id)
        .eq('state', 'pending_acceptance')
    : { data: null };

  const misePendingOpen = (((misePending as unknown) as any[]) ?? []).flatMap((b: any) =>
    (b.stops ?? [])
      .filter((s: any) => s.type === 'dropoff' && s.order)
      .map((s: any) => ({
        batch_id: b.id,
        tenant_id: (driver as any).tenant_id,
        location_id: b.location_id,
        created_at: b.created_at,
        order_id: s.order_id,
        bestellnummer: s.order.bestellnummer,
        kunde_name: s.order.kunde_name,
        kunde_adresse: s.order.kunde_adresse,
        kunde_plz: s.order.kunde_plz,
        kunde_stadt: s.order.kunde_stadt,
        kunde_lat: s.order.kunde_lat,
        kunde_lng: s.order.kunde_lng,
        gesamtbetrag: s.order.gesamtbetrag,
        geschaetzte_lieferung_min: s.order.geschaetzte_lieferung_min ?? null,
        location_name: b.location?.name ?? 'Restaurant',
        location_lat: b.location?.lat ?? null,
        location_lng: b.location?.lng ?? null,
        source_system: 'mise',
        zahlungsart: s.order.zahlungsart ?? null,
        bezahlt: s.order.bezahlt ?? null,
      })),
  );

  const allOpenBatches = [...(((openBatches as unknown) as any[]) ?? []), ...misePendingOpen];

  return (
    <FahrerApp
      driver={driver as any}
      initialStatus={(status as any) ?? null}
      initialOpenBatches={allOpenBatches}
      initialActiveBatch={(activeBatch as any) ?? null}
    />
  );
}
