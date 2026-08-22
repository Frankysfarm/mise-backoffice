import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DeliveryZonesClient } from './client';

export const dynamic = 'force-dynamic';

export default async function ShopDeliveryPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empTenant } = await sb
    .from('employees')
    .select('tenant_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empTenant?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, slug')
    .eq('id', empTenant.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  const { data: locations } = await svc
    .from('locations')
    .select('id, name, adresse, plz, stadt, lat, lng')
    .eq('tenant_id', tenant.id)
    .eq('aktiv', true)
    .order('created_at', { ascending: true });

  const primaryLocation = locations?.[0] ?? null;

  const { data: zones } = await svc
    .from('delivery_zones')
    .select('id, radius_km_bis, liefergebuehr, mindestbestellwert, aktiv, sort_order')
    .eq('tenant_id', tenant.id)
    .order('radius_km_bis', { ascending: true });

  return (
    <>
      <PageHeader
        title="Lieferradius & -kosten"
        description="Definiere bis zu welcher Entfernung dein Restaurant liefert — gestaffelt nach Kilometern. Pro Zone: Liefergebühr und Mindestbestellwert."
        backHref="/shop"
      />
      <DeliveryZonesClient
        tenantId={tenant.id}
        primaryLocation={primaryLocation}
        initialZones={zones ?? []}
      />
    </>
  );
}
