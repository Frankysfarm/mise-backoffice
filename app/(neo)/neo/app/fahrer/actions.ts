'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';
const FIELDS = ['mindestbestellwert', 'liefergebuehr', 'free_ab', 'radius_km_bis'];
export async function zoneAdjust(id: string, field: string, delta: number, min: number, max: number) {
  if (!FIELDS.includes(field)) throw new Error('Ungültiges Feld: ' + field);
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const { data, error: e1 } = await sb.from('delivery_zones').select(field).eq('id', id).eq('tenant_id', emp.tenant_id).single();
  if (e1 || !data) throw new Error('Zone nicht gefunden oder kein Zugriff');
  const cur = Number((data as any)[field] ?? 0);
  const next = Math.min(max, Math.max(min, +(cur + delta).toFixed(2)));
  const { error } = await sb.from('delivery_zones').update({ [field]: next }).eq('id', id).eq('tenant_id', emp.tenant_id);
  if (error) throw new Error('Update fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/fahrer');
}
export async function zoneToggle(id: string, cur: boolean) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const { error } = await sb.from('delivery_zones').update({ aktiv: !cur }).eq('id', id).eq('tenant_id', emp.tenant_id);
  if (error) throw new Error('Update fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/fahrer');
}
export async function zoneAdd(tenantId: string, locId: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id || emp.tenant_id !== tenantId) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const { error } = await sb.from('delivery_zones').insert({ tenant_id: emp.tenant_id, location_id: emp.location_id ?? locId, radius_km_bis: 5, mindestbestellwert: 15, liefergebuehr: 2.5, free_ab: 0, aktiv: true });
  if (error) throw new Error('Anlegen fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/fahrer');
}
