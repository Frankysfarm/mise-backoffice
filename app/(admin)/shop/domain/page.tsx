import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { DomainSettings } from '@/app/(admin)/settings/domain/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Domain · Online-Shop · Mise' };

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  custom_domain_status: 'pending' | 'verified' | 'error' | null;
  custom_domain_verified_at: string | null;
  custom_domain_error: string | null;
};

export default async function ShopDomainPage() {
  const emp = await requireManagerPlus();
  if (!emp.tenant_id) redirect('/start');
  const svc = createServiceClient();

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, slug, name, custom_domain, custom_domain_status, custom_domain_verified_at, custom_domain_error')
    .eq('id', emp.tenant_id)
    .single<TenantRow>();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="Eigene Domain"
        description="Verbinde eine eigene Web-Adresse — z. B. bestellen.dein-restaurant.de — mit deinem Online-Bestellshop und deinen QR-Tisch-Codes."
        backHref="/shop"
      />
      <DomainSettings
        tenantId={tenant.id}
        slug={tenant.slug}
        name={tenant.name}
        currentDomain={tenant.custom_domain}
        status={tenant.custom_domain_status}
        verifiedAt={tenant.custom_domain_verified_at}
        lastError={tenant.custom_domain_error}
      />
    </>
  );
}
