import { redirect } from 'next/navigation';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { LoyaltyClient } from './client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Bonus-Programme · Mise' };

const DEV_TENANT_ID = 'd1522124-4b9b-4362-9d9a-882a6a8621f6';

export default async function LoyaltyPage() {
  const sb = await createClient();
  const svc = createServiceClient();

  const { data: { user } } = await sb.auth.getUser();
  let tenantId: string | null = null;
  if (user) {
    const { data: emp } = await sb.from('employees')
      .select('tenant_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    tenantId = emp?.tenant_id ?? null;
  }
  if (!tenantId) tenantId = DEV_TENANT_ID;

  const { data: programs } = await svc
    .from('loyalty_programs')
    .select('id,title,description,trigger_text,threshold,reward_text,emoji,active,sort_order')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true });

  return <LoyaltyClient initialPrograms={(programs as any) ?? []} tenantId={tenantId} />;
}
