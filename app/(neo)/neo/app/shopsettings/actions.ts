'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';
export async function toggleShopOnline(locId: string, goOffline: boolean) {
  const emp = await getCurrentEmployee();
  if (!emp?.location_id || emp.location_id !== locId) throw new Error('Nicht autorisiert');
  let until: string | null = null;
  if (goOffline) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(5, 0, 0, 0); until = d.toISOString(); }
  const sb = createServiceClient();
  const { error } = await sb.from('locations').update({ geschlossen_bis: until }).eq('id', emp.location_id);
  if (error) throw new Error('Update fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/shopsettings');
}
