'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
export async function advanceOrder(id: string, next: string) {
  const sb = createServiceClient();
  await sb.from('customer_orders').update({ status: next }).eq('id', id);
  revalidatePath('/neo/app/lieferzentrale');
}
export async function rejectOrder(id: string) {
  const sb = createServiceClient();
  await sb.from('customer_orders').update({ status: 'storniert' }).eq('id', id);
  revalidatePath('/neo/app/lieferzentrale');
}
