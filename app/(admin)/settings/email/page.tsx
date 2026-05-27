import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { EmailSettings } from './client';

export const dynamic = 'force-dynamic';

export default async function EmailSettingsPage() {
  const emp = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: empTenant } = await sb.from('employees').select('tenant_id').eq('id', emp.id).maybeSingle();
  if (!empTenant?.tenant_id) redirect('/start');

  const { data: tenant } = await svc
    .from('tenants')
    .select('id, resend_api_key, resend_from_email, resend_from_name, resend_verified_at')
    .eq('id', empTenant.tenant_id)
    .single();
  if (!tenant) redirect('/start');

  return (
    <>
      <PageHeader
        title="E-Mail-Versand"
        description="Verbinde deinen Resend-Account, um E-Mail-Kampagnen und Bestellbestätigungen zu versenden."
      />
      <EmailSettings tenant={tenant as any} />
    </>
  );
}
