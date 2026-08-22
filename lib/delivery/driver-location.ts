import type { SupabaseClient } from '@supabase/supabase-js';

/** Resolves the operational location without trusting a location id from the device. */
export async function resolveDriverLocationId(
  client: SupabaseClient,
  driverId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const { data: activeShift } = await client.from('driver_shifts')
    .select('location_id')
    .eq('driver_id', driverId)
    .eq('status', 'active')
    .is('actual_end', null)
    .lte('planned_start', now)
    .gt('planned_end', now)
    .order('planned_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeShift?.location_id) return activeShift.location_id as string;

  const { data: identity } = await client.from('mise_drivers')
    .select('auth_user_id')
    .eq('id', driverId)
    .maybeSingle();
  if (identity?.auth_user_id) {
    const { data: employee } = await client.from('employees')
      .select('location_id')
      .eq('auth_user_id', identity.auth_user_id)
      .in('status', ['aktiv', 'in_training', 'in_probe'])
      .not('location_id', 'is', null)
      .limit(1)
      .maybeSingle();
    if (employee?.location_id) return employee.location_id as string;
  }

  const { data: memberships } = await client.from('mise_driver_tenants')
    .select('tenant_id')
    .eq('driver_id', driverId)
    .eq('status', 'active');
  const tenantIds = Array.from(new Set((memberships ?? []).map(row => row.tenant_id as string)));
  if (tenantIds.length !== 1) return null;
  const { data: locations } = await client.from('locations')
    .select('id')
    .eq('tenant_id', tenantIds[0])
    .eq('aktiv', true)
    .limit(2);
  return locations?.length === 1 ? locations[0].id as string : null;
}
