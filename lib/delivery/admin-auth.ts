import 'server-only';
import { getCurrentEmployee, type CurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { createServiceClient } from '@/lib/supabase/server';

export async function getDeliveryAdminActor(): Promise<CurrentEmployee | null> {
  const actor = await getCurrentEmployee();
  if (!actor || !actor.tenant_id) return null;
  if (!['manager', 'backoffice', 'admin'].includes(actor.rolle)) return null;

  // Keep delivery administration fail-closed even on the legacy employee
  // contract where getCurrentEmployee() does not yet expose the status column.
  const { data: activeActor } = await createServiceClient()
    .from('employees')
    .select('id')
    .eq('id', actor.id)
    .eq('tenant_id', actor.tenant_id)
    .in('status', ['aktiv', 'in_training', 'in_probe'])
    .maybeSingle();
  return activeActor ? actor : null;
}

export async function isDeliveryAdminLocation(actor: CurrentEmployee, locationId: string): Promise<boolean> {
  if (!actor.tenant_id || !locationId) return false;
  const { data } = await createServiceClient().from('locations').select('id')
    .eq('id', locationId).eq('tenant_id', actor.tenant_id).maybeSingle();
  return Boolean(data);
}
