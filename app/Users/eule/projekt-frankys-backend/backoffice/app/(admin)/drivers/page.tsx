import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DriversClient } from './client';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empT } = await sb.from('employees').select('tenant_id, location_id').eq('id', emp.id).maybeSingle();
  if (!empT?.tenant_id) redirect('/start');

  const tenantLocIds = ((await svc.from('locations').select('id').eq('tenant_id', empT.tenant_id)).data as any[])?.map((l) => l.id) ?? [];

  const [{ data: drivers }, { data: locations }, { data: tenant }, { data: openOrders }] = await Promise.all([
    svc
      .from('employees')
      .select('id, vorname, nachname, email, telefon, fahrzeug_praeferenz, status, kann_ausliefern, location_id, created_at, driver_status(ist_online, fahrzeug, online_seit, last_update)')
      .eq('tenant_id', empT.tenant_id)
      .eq('kann_ausliefern', true)
      .order('created_at', { ascending: false }),
    svc.from('locations').select('id, name').eq('tenant_id', empT.tenant_id).eq('aktiv', true),
    svc.from('tenants').select('resend_verified_at, name, slug, theme_primary, theme_accent').eq('id', empT.tenant_id).single(),
    svc
      .from('customer_orders')
      .select('id, status, external_source, location_id')
      .eq('typ', 'lieferung')
      .in('status', ['fertig', 'unterwegs'])
      .in('location_id', tenantLocIds.length > 0 ? tenantLocIds : ['00000000-0000-0000-0000-000000000000']),
  ]);

  const sources = new Set<string>();
  let internalCount = 0;
  let externalCount = 0;
  ((openOrders as any[]) ?? []).forEach((o) => {
    if (o.external_source) { sources.add(o.external_source); externalCount++; }
    else internalCount++;
  });

  return (
    <>
      <PageHeader
        title="Fahrer & Zusteller"
        description="Fahrer anlegen, einladen, App-Status sehen — alles an einem Ort."
      />
      <DriversClient
        drivers={(drivers as any[]) ?? []}
        locations={(locations as any[]) ?? []}
        defaultLocationId={empT.location_id}
        resendReady={!!(tenant as any)?.resend_verified_at}
        tenant={tenant as any}
        orderStats={{ internal: internalCount, external: externalCount, sources: Array.from(sources) }}
      />
    </>
  );
}
