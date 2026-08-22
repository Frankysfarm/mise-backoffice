import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { CoursingSettings } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Gänge / Coursing · Mise' };

export default async function CoursingPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, name, coursing_default_aktiv, coursing_aktive_gaenge')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Gänge / Coursing"
        description="Vorspeise → Hauptgang → Dessert. Sit-Down-Standard für Restaurants. Bestellungen in der Küche werden pro Gang gruppiert."
        backHref="/pos/setup"
      />
      <CoursingSettings
        tenantId={tenant.id}
        defaultAktiv={tenant.coursing_default_aktiv}
        aktiveGaenge={tenant.coursing_aktive_gaenge ?? ['vorspeise','hauptgang','dessert']}
      />
    </>
  );
}
