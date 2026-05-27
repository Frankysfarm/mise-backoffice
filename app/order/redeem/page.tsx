import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  if (!code) redirect('/');

  const svc = createServiceClient();
  // Voucher finden → Tenant/Location → zur passenden Storefront redirecten
  const { data: voucher } = await svc
    .from('vouchers')
    .select('tenant_id')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (!voucher) redirect('/');

  const { data: tenant } = await svc
    .from('tenants')
    .select('slug')
    .eq('id', voucher.tenant_id)
    .single();

  if (tenant?.slug) {
    redirect(`/order/${tenant.slug}?code=${encodeURIComponent(code)}`);
  }
  redirect('/');
}
