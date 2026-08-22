import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DomainSettings } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Eigene Domain · Mise' };

export default async function DomainPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, slug, name, custom_domain, custom_domain_status, custom_domain_verified_at, custom_domain_error')
    .eq('id', empRow.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Eigene Domain"
        description="Verbinde deine eigene Web-Adresse — z. B. bestellen.dein-restaurant.de — mit deiner Online-Bestellseite und deinen QR-Tisch-Codes."
        backHref="/pos/setup"
      />
      <DomainSettings
        tenantId={tenant.id}
        slug={tenant.slug}
        name={tenant.name}
        currentDomain={tenant.custom_domain ?? null}
        status={(tenant.custom_domain_status as 'pending' | 'verified' | 'error' | null) ?? null}
        verifiedAt={tenant.custom_domain_verified_at ?? null}
        lastError={tenant.custom_domain_error ?? null}
      />
    </>
  );
}
