'use server';

import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import type { FpTriggerMode, FpPlacement } from '@/lib/free-product/types';

async function getTenantId(): Promise<string | null> {
  try {
    const sb = createServiceClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;
    const { data } = await sb.from('employees').select('tenant_id').eq('auth_user_id', user.id).maybeSingle();
    return (data as { tenant_id: string } | null)?.tenant_id ?? null;
  } catch { return null; }
}

export async function saveGratisProduktConfig(payload: {
  aktiv: boolean;
  eligible_item_ids: string[];
  trigger_mode: FpTriggerMode;
  trigger_ab_betrag: number | null;
  trigger_nach_sekunden: number | null;
  placement: FpPlacement;
  cooldown_tage: number;
}): Promise<{ ok: boolean; error?: string }> {
  const tenantId = await getTenantId();
  if (!tenantId) return { ok: false, error: 'Kein Tenant' };

  const sb = createServiceClient();
  const { error } = await sb
    .from('free_product_configs')
    .upsert({ tenant_id: tenantId, ...payload }, { onConflict: 'tenant_id' });

  if (error) return { ok: false, error: error.message };
  revalidatePath('/neo/app/aktionen');
  return { ok: true };
}
