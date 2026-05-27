import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { PlatformsSettings } from './client';

export const dynamic = 'force-dynamic';

export default async function PlatformsPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb
    .from('employees').select('tenant_id,location_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const [{ data: configs }, { data: locations }] = await Promise.all([
    svc.from('tenant_platform_configs').select('*').eq('tenant_id', emp.tenant_id).order('source'),
    svc.from('locations').select('id,name').eq('tenant_id', emp.tenant_id).eq('aktiv', true),
  ]);

  return (
    <>
      <PageHeader
        title="Externe Plattformen"
        description="Lieferando, Uber Eats, Wolt und Middleware-Dienste verbinden — alle Bestellungen landen in deinem Küchen-Display."
      />
      <PlatformsSettings
        tenantId={emp.tenant_id}
        defaultLocationId={emp.location_id}
        configs={(configs as any[]) ?? []}
        locations={(locations as any[]) ?? []}
      />
    </>
  );
}
