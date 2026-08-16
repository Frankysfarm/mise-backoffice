'use server';
import { createServiceClient } from '@/lib/supabase/server';
import { enqueueTourStatusPush } from '@/lib/delivery/push-notify';
import { buildPickupQr } from '@/lib/delivery/pickup-qr';

async function locForToken(token: string) {
  const svc = createServiceClient();
  const { data } = await svc.from('locations').select('id, tenant_id, name, print_method').eq('kitchen_token', token).maybeSingle();
  return data;
}

function bonText(shop: string, o: any, items: any[], prepMin: number): string {
  const line = '--------------------------------';
  const L: string[] = ['      ' + (shop || '').toUpperCase(), '      Kuechen-Bon', line];
  L.push('#' + String(o.bestellnummer || '').slice(-6) + '  ' + new Date().toLocaleString('de-DE'));
  L.push(String(o.typ || '').toUpperCase());
  L.push(line);
  if (o.kunde_name) L.push(String(o.kunde_name));
  if (o.kunde_telefon) L.push('Tel: ' + o.kunde_telefon);
  if (o.typ === 'lieferung' && o.kunde_adresse) L.push(String(o.kunde_adresse));
  L.push(line);
  for (const it of items) L.push((it.menge || 1) + 'x ' + it.name + (it.notiz ? ' (' + it.notiz + ')' : ''));
  if (o.typ === 'lieferung' && Array.isArray(o.pickup_qr_payloads)) {
    L.push(line);
    for (const bag of o.pickup_qr_payloads) L.push(`BEUTEL ${bag.bagIndex}/${o.delivery_bag_count}: ${bag.fallbackCode}`);
  }
  L.push(line);
  if (prepMin) L.push('   FERTIG IN ' + prepMin + ' MIN');
  L.push(''); L.push(''); L.push('');
  return L.join('\n');
}

export async function setPrintMethod(token: string, method: string) {
  const loc = await locForToken(token); if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  await svc.from('locations').update({ print_method: method }).eq('id', loc.id);
  return { ok: true };
}
export async function testPrint(token: string) {
  const loc = await locForToken(token); if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  await svc.from('mise_print_jobs').insert({ location_id: loc.id, payload: bonText((loc as any).name, { bestellnummer: 'TEST00', typ: 'lieferung', kunde_name: 'Test-Kunde' }, [{ menge: 1, name: 'Test-Bon (Drucker OK)', notiz: null }], 0) });
  return { ok: true };
}

export async function getKitchenData(token: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' as const };
  const svc = createServiceClient();
  const [{ data: orders }, { data: items }] = await Promise.all([
    svc.from('customer_orders')
      .select('id, bestellnummer, status, kunde_name, kunde_telefon, kunde_adresse, typ, gesamtbetrag, fertig_am, created_at, mise_driver_id, mise_batch_id, delivery_bag_count, items:order_items(id, name, menge, notiz, pick_missing)')
      .eq('location_id', loc.id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true }),
    svc.from('menu_items').select('id, name, verfuegbar').eq('location_id', loc.id).order('name').limit(200),
  ]);

  // Online-Fahrer des Tenants + Status (Tracking + "auf Rueckweg")
  const { data: dt } = await svc.from('mise_driver_tenants').select('driver_id').eq('location_id', loc.id);
  const dids = [...new Set((dt ?? []).map((x: any) => x.driver_id))];
  let drivers: any[] = [];
  if (dids.length) {
    const { data: drv } = await svc.from('mise_drivers').select('id, name, state, last_lat, last_lng, last_active_at').in('id', dids).neq('state', 'offline');
    const dlist = drv ?? [];
    if (dlist.length) {
      const { data: batches } = await svc.from('mise_delivery_batches')
        .select('id, driver_id, state, stops:mise_delivery_batch_stops(type, completed_at)')
        .in('driver_id', dlist.map((d: any) => d.id))
        .in('state', ['assigned', 'at_restaurant', 'picked_up', 'in_progress']);
      drivers = dlist.map((d: any) => {
        const myB = (batches ?? []).filter((b: any) => b.driver_id === d.id);
        const undelivered = myB.flatMap((b: any) => (b.stops ?? [])).filter((st: any) => st.type === 'dropoff' && !st.completed_at).length;
        const inProgress = myB.some((b: any) => b.state === 'in_progress');
        const fresh = d.last_active_at && (Date.now() - new Date(d.last_active_at).getTime()) < 180000; // 3 Min Heartbeat-Frische
        return { id: d.id, name: d.name, lat: d.last_lat, lng: d.last_lng, state: d.state, undelivered, busy: myB.length > 0, returning: inProgress && undelivered <= 1, stale: !fresh };
      });
    }
  }
  // P1: festhaengende Lieferungen (fertig gekocht, >6 Min, kein Fahrer) -> Owner-Alarm
  const STUCK_MS = 6 * 60_000;
  const nowMs = Date.now();
  const anyDriverWorking = drivers.length > 0;
  const stuckDeliveries = (orders ?? [])
    .filter((od: any) => od.typ === 'lieferung' && od.status === 'fertig' && !od.mise_driver_id && od.fertig_am && (nowMs - new Date(od.fertig_am).getTime()) > STUCK_MS)
    .map((od: any) => ({ id: od.id, bestellnummer: od.bestellnummer, kunde_name: od.kunde_name, kunde_telefon: od.kunde_telefon, waitingMin: Math.round((nowMs - new Date(od.fertig_am).getTime()) / 60_000), noDriverOnline: !anyDriverWorking }));

  const printableOrders = (orders ?? []).map((order: any) => ({
    ...order,
    pickup_qr_payloads: order.typ === 'lieferung'
      ? Array.from({ length: Math.max(1, Math.min(12, Number(order.delivery_bag_count) || 1)) }, (_, index) => buildPickupQr(order.id, index + 1))
      : [],
  }));
  return { orders: printableOrders, items: items ?? [], drivers, stuckDeliveries, printMethod: (loc as any).print_method ?? 'off' };
}

/** Beutelanzahl muss vor dem ersten QR-Scan feststehen. */
export async function setDeliveryBagCount(token: string, orderId: string, count: number) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const bagCount = Math.trunc(count);
  if (bagCount < 1 || bagCount > 12) return { error: 'Beutelanzahl muss zwischen 1 und 12 liegen' };
  const svc = createServiceClient();
  const { data: order } = await svc.from('customer_orders')
    .select('id,typ,mise_batch_id')
    .eq('id', orderId).eq('location_id', loc.id).maybeSingle();
  if (!order || order.typ !== 'lieferung') return { error: 'Lieferbestellung nicht gefunden' };
  if (order.mise_batch_id) {
    const { data: batch } = await svc.from('mise_delivery_batches')
      .select('handoff_state,state').eq('id', order.mise_batch_id).maybeSingle();
    if (batch && (batch.handoff_state !== 'planned' || !['assigned', 'at_restaurant'].includes(batch.state))) {
      return { error: 'Beutelanzahl ist nach Beginn der Übergabe gesperrt' };
    }
  }
  const { data: updated, error } = await svc.rpc('set_delivery_bag_count', {
    p_order_id: orderId,
    p_location_id: loc.id,
    p_bag_count: bagCount,
  });
  return error ? { error: error.message } : updated ? { ok: true } : { error: 'Lieferbestellung nicht gefunden' };
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
  if (!error && (loc as any).print_method === 'cloudprnt') {
    const { data: ord } = await svc.from('customer_orders')
      .select('id, bestellnummer, typ, kunde_name, kunde_telefon, kunde_adresse, delivery_bag_count, items:order_items(name, menge, notiz)')
      .eq('id', orderId).maybeSingle();
    if (ord) {
      const count = Math.max(1, Math.min(12, Number((ord as any).delivery_bag_count) || 1));
      const printable = { ...ord, pickup_qr_payloads: ord.typ === 'lieferung' ? Array.from({ length: count }, (_, index) => buildPickupQr(ord.id, index + 1)) : [] };
      await svc.from('mise_print_jobs').insert({ location_id: loc.id, payload: bonText((loc as any).name, printable, (ord as any).items ?? [], prepMin) });
    }
  }
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

/** Recall: fertige Order zurueck in Zubereitung holen (Fehlgriff korrigieren). */
export async function recallOrder(token: string, orderId: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const { error } = await svc.from('customer_orders').update({ status: 'in_zubereitung' }).eq('id', orderId).eq('location_id', loc.id);
  return error ? { error: error.message } : { ok: true };
}

/** Ein Gericht einer Order als fehlt/da markieren (Kueche kann es nicht machen). */
export async function markItemMissing(token: string, itemId: string, missing: boolean) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  // Mandanten-Trennung: nur Items der EIGENEN Location dürfen geändert werden (order_items hat keine location_id → über die Order prüfen).
  const { data: it } = await svc.from('order_items').select('order_id').eq('id', itemId).maybeSingle();
  if (!it) return { error: 'not_found' };
  const { data: ord } = await svc.from('customer_orders').select('location_id').eq('id', (it as any).order_id).maybeSingle();
  if (!ord || (ord as any).location_id !== loc.id) return { error: 'unauth' };
  const { error } = await svc.from('order_items').update({ pick_missing: missing }).eq('id', itemId);
  return error ? { error: error.message } : { ok: true };
}

/** Bestellung stornieren. */
export async function stornoOrder(token: string, orderId: string) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const nowIso = new Date().toISOString();
  const { data: ord, error } = await svc.from('customer_orders')
    .update({ status: 'storniert', storniert_am: nowIso, storniert_von: 'kueche' })
    .eq('id', orderId).eq('location_id', loc.id)
    .select('mise_batch_id, mise_driver_id, bestellnummer').maybeSingle();
  if (error) return { error: error.message };
  // War schon ein Fahrer zugewiesen → Fahrer per Push informieren (er sieht "storniert" + Order fällt aus seiner Liste).
  if (ord?.mise_driver_id) {
    await enqueueTourStatusPush({
      driverId: ord.mise_driver_id,
      batchId: ord.mise_batch_id ?? '',
      title: 'Bestellung storniert',
      body: `Bestellung #${String(ord.bestellnummer || '').slice(-6)} wurde storniert — bitte nicht ausliefern.`,
      type: 'order_cancelled',
      data: { order_id: orderId },
    }).catch(() => {});
  }
  // P4: war die Order schon dispatcht -> Dropoff-Stop neutralisieren, Tour ggf. canceln
  if (ord?.mise_batch_id) {
    await svc.from('mise_delivery_batch_stops')
      .update({ completed_at: nowIso, cancelled: true })
      .eq('batch_id', ord.mise_batch_id).eq('order_id', orderId).eq('type', 'dropoff');
    const { data: rest } = await svc.from('mise_delivery_batch_stops')
      .select('id').eq('batch_id', ord.mise_batch_id).eq('type', 'dropoff').is('completed_at', null);
    if (!rest || rest.length === 0) {
      await svc.from('mise_delivery_batches').update({ state: 'cancelled' }).eq('id', ord.mise_batch_id);
    }
    await svc.from('customer_orders').update({ mise_batch_id: null }).eq('id', orderId);
  }
  return { ok: true };
}

/** Ausverkauft-Toggle fuer ein Gericht (heute). */
export async function toggleItem(token: string, itemId: string, verfuegbar: boolean) {
  const loc = await locForToken(token);
  if (!loc) return { error: 'unauth' };
  const svc = createServiceClient();
  const { error } = await svc.from('menu_items').update({ verfuegbar }).eq('id', itemId).eq('location_id', loc.id);
  return error ? { error: error.message } : { ok: true };
}
