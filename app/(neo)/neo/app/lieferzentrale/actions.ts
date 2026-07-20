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

// ─── NEU: Health Stats ──────────────────────────────────────────────────────
export async function getHealthStats(): Promise<{
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  onlineDrivers: number;
  waitingOrders: number;
}> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return { avgDeliveryMin: null, onTimePct: null, onlineDrivers: 0, waitingOrders: 0 };
  const svc = createServiceClient();
  const { data: links } = await svc.from('mise_driver_tenants').select('driver_id').eq('tenant_id', emp.tenant_id);
  const driverIds = (links ?? []).map((x: any) => x.driver_id as string).filter(Boolean);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [driversRes, batchesRes, staleRes] = await Promise.all([
    driverIds.length
      ? svc.from('mise_drivers').select('id, state').in('id', driverIds)
      : { data: [] as any[] },
    driverIds.length
      ? svc.from('mise_delivery_batches')
          .select('id, accepted_at, completed_at, total_eta_min, stops:mise_delivery_batch_stops(completed_at, deliver_by)')
          .in('driver_id', driverIds)
          .eq('state', 'completed')
          .gte('completed_at', todayStart.toISOString())
          .limit(200)
      : { data: [] as any[] },
    emp.location_id
      ? svc.from('customer_orders')
          .select('id, bestellnummer, created_at, kunde_name')
          .eq('location_id', emp.location_id)
          .eq('status', 'fertig')
          .eq('typ', 'lieferung')
          .is('mise_batch_id', null)
          .is('mise_driver_id', null)
          .order('created_at', { ascending: true })
          .limit(50)
      : { data: [] as any[] },
  ]);

  const drivers = driversRes.data ?? [];
  const batches = batchesRes.data ?? [];
  const stale = staleRes.data ?? [];

  const onlineDrivers = drivers.filter((d: any) => d.state !== 'offline').length;

  const completedWithBoth = batches.filter((b: any) => b.accepted_at && b.completed_at);
  const avgDeliveryMin = completedWithBoth.length > 0
    ? Math.round(
        completedWithBoth.reduce((sum: number, b: any) => {
          return sum + (new Date(b.completed_at).getTime() - new Date(b.accepted_at).getTime()) / 60000;
        }, 0) / completedWithBoth.length
      )
    : null;

  let onTimeCount = 0;
  let measurableCount = 0;
  for (const b of completedWithBoth) {
    const stops = (b.stops ?? []) as any[];
    const dropoffs = stops.filter((s: any) => s.completed_at);
    for (const s of dropoffs) {
      measurableCount++;
      const completedMs = new Date(s.completed_at).getTime();
      if (s.deliver_by) {
        if (completedMs <= new Date(s.deliver_by).getTime()) onTimeCount++;
      } else {
        const acceptedMs = new Date(b.accepted_at).getTime();
        if (completedMs - acceptedMs < 45 * 60 * 1000) onTimeCount++;
      }
    }
  }
  const onTimePct = measurableCount > 0 ? Math.round((onTimeCount / measurableCount) * 100) : null;

  const now = Date.now();
  const waitingOrders = stale.filter((o: any) => {
    const ageMin = (now - new Date(o.created_at).getTime()) / 60000;
    return ageMin >= 2;
  }).length;

  return { avgDeliveryMin, onTimePct, onlineDrivers, waitingOrders };
}

// ─── NEU: Stale Orders ──────────────────────────────────────────────────────
export type StaleOrder = {
  id: string;
  bestellnummer: string | null;
  created_at: string;
  kunde_name: string | null;
  address: string | null;
  waitMin: number;
};

export async function getStaleOrders(): Promise<StaleOrder[]> {
  const emp = await getCurrentEmployee();
  if (!emp?.location_id) return [];
  const svc = createServiceClient();
  const { data } = await svc
    .from('customer_orders')
    .select('id, bestellnummer, created_at, kunde_name, lieferadresse')
    .eq('location_id', emp.location_id)
    .eq('status', 'fertig')
    .eq('typ', 'lieferung')
    .is('mise_batch_id', null)
    .is('mise_driver_id', null)
    .order('created_at', { ascending: true })
    .limit(50);

  const now = Date.now();
  return ((data ?? []) as any[])
    .filter((o: any) => (now - new Date(o.created_at).getTime()) >= 2 * 60 * 1000)
    .map((o: any) => ({
      id: o.id,
      bestellnummer: o.bestellnummer ?? null,
      created_at: o.created_at,
      kunde_name: o.kunde_name ?? null,
      address: o.lieferadresse ?? null,
      waitMin: Math.floor((now - new Date(o.created_at).getTime()) / 60000),
    }));
}

// ─── NEU: Dispatch Config ───────────────────────────────────────────────────
export async function getDispatchConfig(): Promise<{ preset: string; hold_window_min: number } | null> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return null;
  const svc = createServiceClient();
  const { data } = await svc
    .from('mise_dispatch_config')
    .select('preset, hold_window_min')
    .eq('tenant_id', emp.tenant_id)
    .maybeSingle();
  return data ?? { preset: 'balance', hold_window_min: 5 };
}

export async function setDispatchConfig(preset: string, holdWindowMin: number): Promise<void> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const svc = createServiceClient();
  const { error } = await svc
    .from('mise_dispatch_config')
    .upsert({ tenant_id: emp.tenant_id, preset, hold_window_min: holdWindowMin }, { onConflict: 'tenant_id' });
  if (error) throw new Error('Config-Update fehlgeschlagen: ' + error.message);
}

export async function getOnlineDrivers() {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) return [];
  const svc = createServiceClient();
  const { data: links } = await svc.from('mise_driver_tenants').select('driver_id').eq('tenant_id', emp.tenant_id);
  const ids = (links ?? []).map((x: any) => x.driver_id as string).filter(Boolean);
  if (!ids.length) return [];
  const { data } = await svc
    .from('mise_drivers')
    .select('id, name, vehicle, state')
    .in('id', ids)
    .neq('state', 'offline');
  return (data ?? []) as { id: string; name: string; vehicle: string; state: string }[];
}

// ─── NEU: Cancel & Reassign ─────────────────────────────────────────────────
export async function cancelBatch(batchId: string): Promise<void> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const svc = createServiceClient();
  const { error } = await svc.rpc('cancel_mise_batch', { p_batch_id: batchId, p_reason: 'manual' });
  if (error) throw new Error('Tour-Storno fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/lieferzentrale');
}

export async function reassignBatch(batchId: string, newDriverId: string): Promise<void> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const svc = createServiceClient();
  const { error } = await svc.rpc('reassign_mise_batch', { p_batch_id: batchId, p_new_driver_id: newDriverId });
  if (error) throw new Error('Fahrerwechsel fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/lieferzentrale');
}

export async function reorderBatchStop(stopId: string, newSequence: number): Promise<void> {
  const emp = await getCurrentEmployee();
  if (!emp?.tenant_id) throw new Error('Nicht autorisiert');
  const svc = createServiceClient();
  const { error } = await svc
    .from('mise_delivery_batch_stops')
    .update({ sequence: newSequence })
    .eq('id', stopId);
  if (error) throw new Error('Stop-Reihenfolge fehlgeschlagen: ' + error.message);
  revalidatePath('/neo/app/lieferzentrale');
}

export async function triggerSmartDispatch(): Promise<{ ok: boolean; message?: string }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const bearer = process.env.CRON_SECRET ?? '';
    const res = await fetch(`${baseUrl}/api/cron/smart-dispatch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (!res.ok) return { ok: false, message: await res.text() };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message };
  }
}
