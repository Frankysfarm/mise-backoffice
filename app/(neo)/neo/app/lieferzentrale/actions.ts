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
export async function getDriverPositions() {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return [];
  const svc = createServiceClient();
  const { data: links } = await svc.from('mise_driver_tenants').select('driver_id').eq('tenant_id', emp.tenant_id);
  const ids = (links ?? []).map((x: any) => x.driver_id as string).filter(Boolean);
  if (!ids.length) return [];
  const [{ data: drivers }, { data: batches }] = await Promise.all([
    svc.from('mise_drivers').select('id, name, vehicle, state, last_lat, last_lng, last_position_at').in('id', ids),
    svc.from('mise_delivery_batches')
      .select('driver_id, state, total_eta_min, picked_up_at, accepted_at, stops:mise_delivery_batch_stops(sequence, type, lat, lng, completed_at)')
      .in('driver_id', ids)
      .in('state', ['in_progress', 'picked_up', 'at_restaurant', 'assigned', 'pending_acceptance']),
  ]);
  const now = Date.now();
  const batchByDriver = new Map<string, any>();
  for (const b of batches ?? []) batchByDriver.set(b.driver_id as string, b);
  return (drivers ?? []).map((d: any) => {
    const b = batchByDriver.get(d.id);
    const posAgeMs = d.last_position_at ? now - new Date(d.last_position_at).getTime() : Infinity;
    const gps_stale = d.state !== 'offline' && posAgeMs > 5 * 60 * 1000;
    const gps_stale_2min = d.state !== 'offline' && posAgeMs > 2 * 60 * 1000;
    const pos_age_sec = posAgeMs === Infinity ? null : Math.floor(posAgeMs / 1000);
    let overdue = false;
    if (b?.picked_up_at && b?.total_eta_min) {
      const pickupMs = new Date(b.picked_up_at).getTime();
      overdue = (now - pickupMs) > b.total_eta_min * 1.5 * 60 * 1000;
    }
    const stationary = d.state === 'in_progress' && posAgeMs > 10 * 60 * 1000;
    // Next unfinished dropoff stop for polyline
    const nextStop = b?.stops
      ? (b.stops as any[])
          .filter((s: any) => s.type === 'dropoff' && !s.completed_at && s.lat != null && s.lng != null)
          .sort((a: any, z: any) => a.sequence - z.sequence)[0] ?? null
      : null;
    return { ...d, gps_stale, gps_stale_2min, pos_age_sec, overdue, stationary, next_stop: nextStop } as {
      id: string; name: string; vehicle: string; state: string;
      last_lat: number | null; last_lng: number | null; last_position_at: string | null;
      gps_stale: boolean; gps_stale_2min: boolean; pos_age_sec: number | null;
      overdue: boolean; stationary: boolean;
      next_stop: { lat: number; lng: number; sequence: number } | null;
    };
  });
}
export async function getActiveBatches() {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return [];
  const svc = createServiceClient();
  const { data: links } = await svc.from('mise_driver_tenants').select('driver_id').eq('tenant_id', emp.tenant_id);
  const ids = (links ?? []).map((x: any) => x.driver_id as string).filter(Boolean);
  if (!ids.length) return [];
  const { data: batches } = await svc
    .from('mise_delivery_batches')
    .select('id, state, total_eta_min, accepted_at, picked_up_at, created_at, driver_id, driver:mise_drivers(id, name, vehicle), stops:mise_delivery_batch_stops(id, order_id, sequence, type, address, lat, lng, completed_at, order:customer_orders(bestellnummer, kunde_name, gesamtbetrag))')
    .in('driver_id', ids)
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress'])
    .order('created_at', { ascending: false })
    .limit(20);
  return (batches ?? []) as any[];
}
export async function getOrdersForKanban(locationId: string) {
  const svc = createServiceClient();
  const { data: orders } = await svc
    .from('customer_orders')
    .select('id, bestellnummer, status, typ, gesamtbetrag, zwischensumme, bezahlt, kunde_name, voucher_code, voucher_rabatt, reward_items_count, mise_batch_id, mise_driver_id, created_at, items:order_items(name, menge, einzelpreis, notiz)')
    .eq('location_id', locationId)
    .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'])
    .order('created_at', { ascending: true })
    .limit(80);
  return (orders ?? []) as any[];
}
