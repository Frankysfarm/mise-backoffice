#!/usr/bin/env node
// Verhaltens-/Integrationstest für den requeue-festen Stop-Lookup (P0-1).
//
// Baut ein echtes Fixture in der DB: eine Order mit (a) altem CANCELLED-Batch
// mit storniertem Dropoff-Stop und (b) neuem aktiven Batch mit gültigem Stop,
// führt dann EXAKT die PostgREST-Query der delivered-/picked-up-Routen aus und
// beweist, dass genau der Stop im aktiven Batch des Fahrers zurückkommt.
// Räumt alle Fixture-Zeilen am Ende wieder ab (auch im Fehlerfall).
//
// Aufruf (auf dem Server, Env aus .env/.env.local):
//   cd /opt/mise/backoffice && set -a && . ./.env && . ./.env.local && set +a \
//     && node scripts/verify/stop-lookup-requeue.mjs

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) { console.error('FEHLT: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'); process.exit(2); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const rest = (path) => `${URL_BASE}/rest/v1/${path}`;

async function insert(table, rows) {
  const res = await fetch(rest(table), { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`INSERT ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}
async function del(table, filter) {
  const res = await fetch(rest(`${table}?${filter}`), { method: 'DELETE', headers: H });
  if (!res.ok) console.error(`CLEANUP-WARNUNG ${table}: ${res.status} ${await res.text()}`);
}

const created = [];
function track(table, id) { created.push({ table, id }); }

async function main() {
  // Vorhandenen Fahrer + Tenant/Location aus einer echten Order übernehmen (keine neuen Stammdaten).
  const drvRes = await fetch(rest('mise_drivers?select=id&limit=1'), { headers: H });
  const [driver] = await drvRes.json();
  const ordRes = await fetch(rest('customer_orders?select=tenant_id,location_id&typ=eq.lieferung&limit=1'), { headers: H });
  const [ref] = await ordRes.json();
  if (!driver || !ref) throw new Error('Kein Fahrer / keine Referenz-Order in der DB');

  // 1) Fixture-Order
  const [order] = await insert('customer_orders', [{
    tenant_id: ref.tenant_id, location_id: ref.location_id,
    bestellnummer: `VERIFY-SL-${Math.random().toString(36).slice(2, 8)}`,
    typ: 'lieferung', status: 'fertig', kunde_name: 'Verify Fixture',
    kunde_adresse: 'Teststr. 1', kunde_lat: 50.77, kunde_lng: 6.08,
    zwischensumme: 1, gesamtbetrag: 1, zahlungsart: 'bar', bezahlt: false,
  }]);
  track('customer_orders', order.id);

  // 2) Alter Batch: cancelled, mit storniertem Dropoff-Stop
  const [oldBatch] = await insert('mise_delivery_batches', [{
    driver_id: driver.id, state: 'cancelled',
  }]);
  track('mise_delivery_batches', oldBatch.id);
  const [oldStop] = await insert('mise_delivery_batch_stops', [{
    batch_id: oldBatch.id, order_id: order.id, type: 'dropoff', sequence: 2,
    lat: 50.77, lng: 6.08, cancelled: true,
  }]);
  track('mise_delivery_batch_stops', oldStop.id);

  // 3) Neuer Batch: assigned an den Fahrer, gültiger Dropoff-Stop
  const [newBatch] = await insert('mise_delivery_batches', [{
    driver_id: driver.id, state: 'assigned',
  }]);
  track('mise_delivery_batches', newBatch.id);
  const [newStop] = await insert('mise_delivery_batch_stops', [{
    batch_id: newBatch.id, order_id: order.id, type: 'dropoff', sequence: 2,
    lat: 50.77, lng: 6.08, cancelled: false,
  }]);
  track('mise_delivery_batch_stops', newStop.id);

  // 4) Beweis A — ALTE Query (bare maybeSingle-Äquivalent): findet 2 Zeilen -> mehrdeutig
  const oldQ = await fetch(rest(`mise_delivery_batch_stops?select=id&order_id=eq.${order.id}&type=eq.dropoff`), { headers: H });
  const oldRows = await oldQ.json();
  if (oldRows.length < 2) throw new Error(`Fixture unvollständig: ${oldRows.length} Stop-Zeilen`);
  console.log(`Beweis A: alte ungefilterte Query liefert ${oldRows.length} Zeilen (mehrdeutig -> maybeSingle wäre 404)`);

  // 5) Beweis B — NEUE Query (exakt wie delivered/picked-up-Route):
  //    cancelled=false + inner-join auf aktiven Batch DIESES Fahrers
  const embed = `select=id,batch_id,type,mise_delivery_batches!inner(driver_id,state)`
    + `&order_id=eq.${order.id}&type=eq.dropoff&cancelled=eq.false`
    + `&mise_delivery_batches.driver_id=eq.${driver.id}`
    + `&mise_delivery_batches.state=in.(assigned,at_restaurant,picked_up,in_progress)&limit=1`;
  const newQ = await fetch(rest(`mise_delivery_batch_stops?${embed}`), { headers: H });
  if (!newQ.ok) throw new Error(`Neue Query fehlgeschlagen: ${newQ.status} ${await newQ.text()}`);
  const newRows = await newQ.json();
  if (newRows.length !== 1) throw new Error(`Erwartet 1 Stop, bekam ${newRows.length}`);
  if (newRows[0].id !== newStop.id) throw new Error(`FALSCHER Stop: ${newRows[0].id} (erwartet ${newStop.id} im aktiven Batch)`);
  if (newRows[0].batch_id !== newBatch.id) throw new Error('Stop gehört nicht zum aktiven Batch');
  console.log('Beweis B: neue Query liefert exakt den Stop im aktiven Batch des Fahrers');

  // 6) Beweis C — fremder Fahrer bekommt NICHTS (Ownership-Filter wirkt)
  const foreign = '00000000-0000-0000-0000-000000000001';
  const foreignQ = await fetch(rest(`mise_delivery_batch_stops?${embed.replace(driver.id, foreign)}`), { headers: H });
  const foreignRows = await foreignQ.json();
  if (foreignRows.length !== 0) throw new Error('Fremder Fahrer sieht Stops!');
  console.log('Beweis C: fremder Fahrer erhält 0 Stops (Ownership-Filter greift)');

  console.log('STOP-LOOKUP-VERHALTENSTEST: PASS');
}

main()
  .then(() => cleanup(0))
  .catch(async (e) => { console.error('FAIL:', e.message); await cleanup(1); });

async function cleanup(code) {
  for (const { table, id } of created.reverse()) await del(table, `id=eq.${id}`);
  console.log(`Cleanup: ${created.length} Fixture-Zeilen entfernt`);
  process.exit(code);
}
