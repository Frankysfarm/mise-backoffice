'use server';
import { createServiceClient } from '@/lib/supabase/server';

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
      .select('id, bestellnummer, status, kunde_name, kunde_telefon, kunde_adresse, typ, gesamtbetrag, fertig_am, created_at, mise_driver_id, items:order_items(id, name, menge, notiz, pick_missing)')
      .eq('location_id', loc.id)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at', { ascending: true }),
    svc.from('menu_items').select('id, name, verfuegbar').eq('tenant_id', loc.tenant_id).order('name').limit(200),
  ]);

  // Online-Fahrer des Tenants + Status (Tracking + "auf Rueckweg")
  const { data: dt } = await svc.from('mise_driver_tenants').select('driver_id').eq('tenant_id', loc.tenant_id);
  const dids = [...new Set((dt ?? []).map((x: any) => x.driver_id))];
  let drivers: any[] = [];
  if (dids.length) {
    const { data: drv } = await svc.from('mise_drivers').select('id, name, state, last_lat, last_lng').in('id', dids).neq('state', 'offline');
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
        return { id: d.id, name: d.name, lat: d.last_lat, lng: d.last_lng, state: d.state, undelivered, busy: myB.length > 0, returning: inProgress && undelivered <= 1 };
      });
    }
  }
  return { orders: orders ?? [], items: items ?? [], drivers, printMethod: (loc as any).print_method ?? 'browser' };
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
      .select('bestellnummer, typ, kunde_name, kunde_telefon, kunde_adresse, items:order_items(name, menge, notiz)')
      .eq('id', orderId).maybeSingle();
    if (ord) await svc.from('mise_print_jobs').insert({ location_id: loc.id, payload: bonText((loc as any).name, ord, (ord as any).items ?? [], prepMin) });
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
  const { error } = await svc.from('order_items').update({ pick_missing: missing }).eq('id', itemId);
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
