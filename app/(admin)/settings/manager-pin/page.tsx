import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { ManagerPinSettings } from './client';

export const dynamic = 'force-dynamic';

export default async function ManagerPinPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empRow } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empRow?.tenant_id) redirect('/start');

  const { data: managers } = await svc.from('employees')
    .select('id, vorname, nachname, rolle, manager_pin, aktiv')
    .eq('tenant_id', empRow.tenant_id)
    .in('rolle', ['admin', 'inhaber', 'manager'])
    .eq('aktiv', true);

  return (
    <>
      <PageHeader
        title="Manager-PINs"
        description="4-stellige PINs für Manager-Freigaben (Stornos > 20 €, Rabatte etc.)."
        backHref="/pos/terminal"
      />
      <ManagerPinSettings managers={(managers as any[]) ?? []} />
    </>
  );
}
