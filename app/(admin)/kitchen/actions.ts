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

  // Sync kitchen_timings status when order is advanced
  if (nextStatus === 'in_zubereitung') {
    await supabase
      .from('kitchen_timings')
      .update({ status: 'cooking', cook_start_at: now, updated_at: now })
      .eq('order_id', orderId)
      .eq('status', 'scheduled');
  } else if (nextStatus === 'fertig') {
    await supabase
      .from('kitchen_timings')
      .update({ status: 'ready', updated_at: now })
      .eq('order_id', orderId)
      .in('status', ['scheduled', 'cooking']);
  }

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
  await supabase.from('order_messages').insert({
    order_id: orderId,
    sender: 'system',
    nachricht: '❌ Bestellung wurde storniert',
  });
  revalidatePath('/kitchen');
  revalidatePath('/dispatch');
  return { ok: true };
}

export async function startCookingNow(timingId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data: timing } = await supabase
    .from('kitchen_timings')
    .select('prep_min, order_id')
    .eq('id', timingId)
    .maybeSingle();
  const prepMin = (timing as any)?.prep_min ?? 15;
  const readyTarget = new Date(Date.now() + prepMin * 60_000).toISOString();
  const { error } = await supabase
    .from('kitchen_timings')
    .update({ status: 'cooking', cook_start_at: now, ready_target: readyTarget })
    .eq('id', timingId);
  if (error) return { ok: false, error: error.message };
  if ((timing as any)?.order_id) {
    await supabase
      .from('customer_orders')
      .update({ status: 'in_zubereitung', zubereitung_start: now })
      .eq('id', (timing as any).order_id)
      .in('status', ['neu', 'bestätigt']); // only advance if not already further along
    await supabase.from('order_messages').insert({
      order_id: (timing as any).order_id,
      sender: 'system',
      nachricht: '🍳 Zubereitung gestartet',
    });
  }
  revalidatePath('/kitchen');
  revalidatePath('/dispatch');
  return { ok: true };
}

export async function markTimingReady(timingId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  // Also advance the linked customer_order to 'fertig'
  const { data: timing } = await supabase
    .from('kitchen_timings')
    .select('order_id')
    .eq('id', timingId)
    .maybeSingle();
  const { error } = await supabase
    .from('kitchen_timings')
    .update({ status: 'ready', updated_at: now })
    .eq('id', timingId);
  if (error) return { ok: false, error: error.message };
  if ((timing as any)?.order_id) {
    await supabase
      .from('customer_orders')
      .update({ status: 'fertig', fertig_am: now })
      .eq('id', (timing as any).order_id);
    await supabase.from('order_messages').insert({
      order_id: (timing as any).order_id,
      sender: 'system',
      nachricht: '✨ Bestellung ist fertig',
    });
  }
  revalidatePath('/kitchen');
  revalidatePath('/dispatch');
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
