'use server';

import { getAdminContext, isAdminContext } from '@/app/api/admin/_lib/tenant-from-session';
import { createServiceClient } from '@/lib/supabase/server';

export type DispatchStrategy = 'speed' | 'balance' | 'spar';

export async function setDispatchStrategy(
  strategy: DispatchStrategy,
): Promise<{ ok: boolean; error?: string }> {
  if (!['speed', 'balance', 'spar'].includes(strategy)) {
    return { ok: false, error: 'Ungueltige Strategie' };
  }
  const ctx = await getAdminContext();
  if (!isAdminContext(ctx)) return { ok: false, error: 'Nicht autorisiert' };
  const { error } = await createServiceClient()
    .from('tenants')
    .update({ dispatch_strategy: strategy })
    .eq('id', ctx.tenant_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
