import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireManagerPlus } from '@/lib/auth/requireRole';
import { PageHeader } from '@/components/layout/page-header';
import { VouchersClient } from './client';

export const dynamic = 'force-dynamic';

export default async function VouchersPage() {
  const employee = await requireManagerPlus();
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: emp } = await sb
    .from('employees').select('tenant_id').eq('id', employee.id).maybeSingle();
  if (!emp?.tenant_id) redirect('/start');

  const { data: vouchers } = await svc
    .from('vouchers')
    .select('*, redemptions:voucher_redemptions(count)')
    .eq('tenant_id', emp.tenant_id)
    .order('created_at', { ascending: false });

  const { data: tenant } = await svc
    .from('tenants')
    .select('oeffnungszeiten_json')
    .eq('id', emp.tenant_id).single();

  return (
    <>
      <PageHeader
        title="Rabatte & Gutscheine"
        description="Aktionscodes für die Bestellseite — und automatische Follow-Up-Rabatte auf gedruckten Bons."
      />
      <VouchersClient
        tenantId={emp.tenant_id}
        vouchers={(vouchers as any[]) ?? []}
        bonAutoEnabled={!!(tenant as any)?.oeffnungszeiten_json?.bon_voucher_enabled}
      />
    </>
  );
}
