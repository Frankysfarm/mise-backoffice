import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PrintersClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bondrucker · Mise' };

export default async function PrintersPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb
    .from('employees')
    .select('tenant_id,location_id')
    .eq('id', emp.id)
    .maybeSingle();
  if (!empRow?.tenant_id || !empRow.location_id) redirect('/start');

  const [{ data: tenant }, { data: location }] = await Promise.all([
    svc.from('tenants').select('name, slug, ust_id, adresse_strasse, adresse_plz, adresse_ort').eq('id', empRow.tenant_id).single(),
    svc.from('locations').select('name').eq('id', empRow.location_id).single(),
  ]);

  return (
    <PrintersClient
      tenantName={(tenant as { name: string }).name}
      tenantAddress={`${(tenant as { adresse_strasse?: string }).adresse_strasse ?? ''}, ${(tenant as { adresse_plz?: string }).adresse_plz ?? ''} ${(tenant as { adresse_ort?: string }).adresse_ort ?? ''}`.trim()}
      tenantTaxId={(tenant as { ust_id?: string }).ust_id ?? ''}
      locationName={(location as { name: string }).name}
    />
  );
}
