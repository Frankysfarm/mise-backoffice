'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCurrentEmployee } from '@/lib/auth/getCurrentEmployee';
import { revalidatePath } from 'next/cache';
const VALID = ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert', 'storniert'];
export async function advanceOrder(id: string, next: string) {
  if (!VALID.includes(next)) throw new Error('Ungültiger Status: ' + next);
  const emp = await getCurrentEmployee();
  if (!emp?.location_id) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const { error } = await sb.from('customer_orders').update({ status: next }).eq('id', id).eq('location_id', emp.location_id);
  if (error) throw new Error('Update fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/lieferzentrale');
}
export async function rejectOrder(id: string) {
  const emp = await getCurrentEmployee();
  if (!emp?.location_id) throw new Error('Nicht autorisiert');
  const sb = createServiceClient();
  const { error } = await sb.from('customer_orders').update({ status: 'storniert' }).eq('id', id).eq('location_id', emp.location_id);
  if (error) throw new Error('Storno fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/lieferzentrale');
}
