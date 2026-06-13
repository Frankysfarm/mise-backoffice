'use server';
import { createServiceClient } from '@/lib/supabase/server';

async function locForToken(token: string) {
  const svc = createServiceClient();
  const { data } = await svc.from('locations').select('id, tenant_id').eq('kitchen_token', token).maybeSingle();
  return data;
}

export async function getKitchenData(token: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' as const };
  const svc = createServiceClient();
  const [{ data: orders }, { data: items }] = await Promise.all([
    svc.from('customer_orders')
      .select('id, bestellnummer, status, kunde_name, kunde_telefon, kunde_adresse, typ, gesamtbetrag, fertig_am, created_at, items:order_items(id, name, menge, notiz)')
      .eq('location_id', loc.id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true }),
    svc.from('menu_items').select('id, name, verfuegbar').eq('tenant_id', loc.tenant_id).order('name').limit(200),
  ]);
  return { orders: orders ?? [], items: items ?? [] };
}

/** Annehmen: setzt in_zubereitung + Fertig-Zeitpunkt (jetzt + prepMin). */
export async function acceptOrder(token: string, orderId: string, prepMin: number) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const fertigAm = new Date(Date.now() + prepMin * 60_000).toISOString();
  const { error } = await svc.from('customer_orders')
    .update({ status: 'in_zubereitung', fertig_am: fertigAm })
    .eq('id', orderId).eq('location_id', loc.id);
  return error ? { error: error.message } : { ok: true };
}

/** Fertig: Essen ist bereit -> geht in die Fahrer-/Abhol-Pipeline. */
export async function markFertig(token: string, orderId: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const { error } = await svc.from('customer_orders')
    .update({ status: 'fertig', fertig_am: new Date().toISOString() })
    .eq('id', orderId).eq('location_id', loc.id);
  return error ? { error: error.message } : { ok: true };
}

/** Bestellung stornieren. */
export async function stornoOrder(token: string, orderId: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const { error } = await svc.from('customer_orders')
    .update({ status: 'storniert', storniert_am: new Date().toISOString() })
    .eq('id', orderId).eq('location_id', loc.id);
  return error ? { error: error.message } : { ok: true };
}

/** Ausverkauft-Toggle fuer ein Gericht (heute). */
export async function toggleItem(token: string, itemId: string, verfuegbar: boolean) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const { error } = await svc.from('menu_items').update({ verfuegbar }).eq('id', itemId).eq('tenant_id', loc.tenant_id);
  return error ? { error: error.message } : { ok: true };
}
