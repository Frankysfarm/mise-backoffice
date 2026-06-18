'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
export async function zoneAdjust(id: string, field: string, delta: number, min: number, max: number) {
  const sb = createServiceClient();
  const { data } = await sb.from('delivery_zones').select(field).eq('id', id).single();
  const cur = Number((data as any)?.[field] ?? 0);
  const next = Math.min(max, Math.max(min, +(cur + delta).toFixed(2)));
  await sb.from('delivery_zones').update({ [field]: next }).eq('id', id);
  revalidatePath('/neo/app/fahrer');
}
export async function zoneToggle(id: string, cur: boolean) {
  const sb = createServiceClient();
  await sb.from('delivery_zones').update({ aktiv: !cur }).eq('id', id);
  revalidatePath('/neo/app/fahrer');
}
export async function zoneAdd(tenantId: string, locId: string) {
  const sb = createServiceClient();
  await sb.from('delivery_zones').insert({ tenant_id: tenantId, location_id: locId, radius_km_bis: 5, mindestbestellwert: 15, liefergebuehr: 2.5, free_ab: 0, aktiv: true });
  revalidatePath('/neo/app/fahrer');
}
