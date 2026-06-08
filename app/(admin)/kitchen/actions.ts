'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function advanceOrder(orderId: string, nextStatus: string) {
  const supabase = await createClient();
  const patch: Record<string, unknown> = { status: nextStatus };
  const now = new Date().toISOString();
  if (nextStatus === 'bestätigt') patch.bestaetigt_am = now;
  if (nextStatus === 'in_zubereitung') patch.zubereitung_start = now;
  if (nextStatus === 'fertig') patch.fertig_am = now;

  const { error } = await supabase.from('customer_orders').update(patch).eq('id', orderId);
  if (error) return { ok: false, error: error.message };

  // System-Nachricht in den Chat
  await supabase.from('order_messages').insert({
    order_id: orderId,
    sender: 'system',
    nachricht: systemMsg(nextStatus),
  });

  revalidatePath('/kitchen');
  revalidatePath('/dispatch');
  return { ok: true };
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('customer_orders')
    .update({ status: 'storniert', storniert_am: new Date().toISOString() })
    .eq('id', orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/kitchen');
  return { ok: true };
}

export async function startCookingNow(timingId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  // Fetch existing timing to keep prep_min
  const { data: timing } = await supabase
    .from('kitchen_timings')
    .select('prep_min')
    .eq('id', timingId)
    .maybeSingle();
  const prepMin = (timing as any)?.prep_min ?? 15;
  const readyTarget = new Date(Date.now() + prepMin * 60_000).toISOString();
  const { error } = await supabase
    .from('kitchen_timings')
    .update({ status: 'cooking', cook_start_at: now, ready_target: readyTarget })
    .eq('id', timingId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/kitchen');
  return { ok: true };
}

export async function updatePrepTime(orderId: string, newMinutes: number) {
  const supabase = await createClient();
  const clamped = Math.max(1, Math.min(120, newMinutes));
  const { error } = await supabase
    .from('customer_orders')
    .update({ geschaetzte_zubereitung_min: clamped })
    .eq('id', orderId);
  if (error) return { ok: false };
  revalidatePath('/kitchen');
  return { ok: true };
}

function systemMsg(status: string): string {
  switch (status) {
    case 'bestätigt': return '✓ Bestellung bestätigt';
    case 'in_zubereitung': return '🍳 Zubereitung gestartet';
    case 'fertig': return '✨ Bestellung ist fertig';
    case 'storniert': return '❌ Bestellung wurde storniert';
    default: return `Status: ${status}`;
  }
}
