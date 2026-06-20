import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DynamicPricingClient } from './client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function DynamicPricingPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/login');

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = (emp?.location_id as string | null) ?? '';
  if (!locationId) redirect('/');

  return <DynamicPricingClient locationId={locationId} />;
}
