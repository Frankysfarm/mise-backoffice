import { requireManagerPlus } from '@/lib/auth/requireRole';
import { createClient } from '@/lib/supabase/server';
import { LoyaltyAdminClient } from './client';

export default async function LoyaltyAdminPage() {
  await requireManagerPlus();
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  const locationId = emp?.location_id ?? null;

  return <LoyaltyAdminClient locationId={locationId} />;
}
