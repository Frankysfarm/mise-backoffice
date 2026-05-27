import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { FahrerApp } from './client';

export const dynamic = 'force-dynamic';

export default async function FahrerAppPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login?next=/fahrer/app');

  const svc = createServiceClient();

  const { data: driver } = await svc
    .from('employees')
    .select('id, vorname, nachname, tenant_id, location_id, rolle, fahrzeug_praeferenz')
    .eq('auth_user_id', user.id)
    .eq('kann_ausliefern', true)
    .maybeSingle();

  if (!driver) {
    // Not a driver — kick back to install
    redirect('/fahrer?noaccess=1');
  }

  const [{ data: status }, { data: openBatches }, { data: activeBatch }] = await Promise.all([
    svc.from('driver_status').select('*').eq('employee_id', driver.id).maybeSingle(),
    svc.from('v_open_dispatch_batches').select('*').eq('tenant_id', driver.tenant_id),
    svc.from('delivery_batches')
      .select('*, stops:delivery_batch_stops(*, order:customer_orders(id,bestellnummer,kunde_name,kunde_adresse,kunde_plz,kunde_lat,kunde_lng,gesamtbetrag))')
      .eq('fahrer_id', driver.id)
      .in('status', ['zugewiesen', 'pickup', 'unterwegs'])
      .maybeSingle(),
  ]);

  return (
    <FahrerApp
      driver={driver as any}
      initialStatus={(status as any) ?? null}
      initialOpenBatches={(openBatches as any[]) ?? []}
      initialActiveBatch={(activeBatch as any) ?? null}
    />
  );
}
