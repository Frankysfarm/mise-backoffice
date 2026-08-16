#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const QA_PREFIX = 'QA-SAT-20260816';
const QA_EMAILS = [1, 2, 3, 4].map((n) => `qa.saturday.driver${n}@mise-gastro.de`);
const TARGET_TENANT = '0318b8f1-8187-4eae-a886-383126f4bbed';
const TARGET_LOCATION = '3e00a63f-8d6c-4021-880e-76ef5d20acc6';
const API_BASE = 'https://mise-gastro.de';

for (const file of ['.env', '.env.local']) {
  try {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const at = line.indexOf('=');
      process.env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
    }
  } catch { /* optional */ }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const internalToken = process.env.BISS_INTERNAL_TOKEN;
const qrSecret = process.env.DELIVERY_PICKUP_QR_SECRET || process.env.DRIVER_OTP_SECRET;
if (!url || !serviceKey || !anonKey || !internalToken || !qrSecret) {
  throw new Error('Required Supabase, dispatch or QR environment is missing');
}

const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const checks = [];
let qaDrivers = [];
let location = null;

function check(name, condition, details = {}) {
  const result = { name, pass: Boolean(condition), details };
  checks.push(result);
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`, JSON.stringify(details));
  return result.pass;
}

async function dataOf(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function passwordFor(email) {
  return `Qa!${createHash('sha256').update(`${qrSecret}:${email}`).digest('base64url').slice(0, 24)}`;
}

async function findAuthUser(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 100) break;
  }
  return null;
}

async function loadContext() {
  location = await dataOf(
    service.from('locations').select('id,tenant_id,name,lat,lng,kitchen_token').eq('id', TARGET_LOCATION).eq('tenant_id', TARGET_TENANT).single(),
    'load QA location',
  );
  qaDrivers = await dataOf(
    service.from('mise_drivers').select('id,email,name,auth_user_id,state,dispatch_availability').in('email', QA_EMAILS).order('email'),
    'load QA drivers',
  );
  return { location, qaDrivers };
}

async function quarantineLegacyFixtures() {
  const names = ['Max M.', 'Sabine S.', 'Peter P.', 'Anna A.', 'Kunde Ost 1', 'Kunde Ost 2', 'Tour-Test 3 (nicht ausliefern)'];
  const legacy = await dataOf(
    service.from('customer_orders').select('id,bestellnummer,kunde_name,created_at')
      .eq('location_id', TARGET_LOCATION)
      .in('kunde_name', names)
      .gte('created_at', '2026-08-14T00:00:00Z')
      .lt('created_at', '2026-08-16T00:00:00Z')
      .in('status', ['neu', 'in_zubereitung', 'fertig']),
    'find legacy fixtures',
  );
  if (legacy.length > 0) {
    await dataOf(
      service.from('customer_orders').update({ status: 'storniert', storniert_von: 'qa-cleanup', storniert_am: new Date().toISOString() }).in('id', legacy.map((order) => order.id)).select('id'),
      'quarantine legacy fixtures',
    );
  }
  console.log(`INFO quarantined_legacy_fixtures=${legacy.length}`);
  return legacy.length;
}

async function clearQaWork() {
  const orders = await dataOf(
    service.from('customer_orders').select('id,mise_batch_id').like('kunde_name', `${QA_PREFIX}%`),
    'find QA orders',
  );
  const orderIds = orders.map((order) => order.id);
  const driverBatches = qaDrivers.length > 0
    ? await dataOf(service.from('mise_delivery_batches').select('id').in('driver_id', qaDrivers.map((driver) => driver.id)), 'find QA driver batches')
    : [];
  const batchIds = [...new Set([
    ...orders.map((order) => order.mise_batch_id).filter(Boolean),
    ...driverBatches.map((batch) => batch.id),
  ])];

  if (batchIds.length > 0) {
    for (const batchId of batchIds) {
      await service.from('mise_push_outbox').delete().contains('data', { batch_id: batchId });
      await service.from('driver_push_outbox').delete().eq('batch_id', batchId);
    }
    await service.from('customer_orders').update({ mise_batch_id: null, mise_driver_id: null }).in('id', orderIds);
    await service.from('mise_delivery_batch_stops').delete().in('batch_id', batchIds);
    await service.from('mise_delivery_batches').delete().in('id', batchIds);
  }
  if (orderIds.length > 0) {
    for (const orderId of orderIds) {
      await service.from('delivery_alerts').delete().contains('details', { order_id: orderId });
      await service.from('mise_frank_decisions').delete().contains('order_ids', [orderId]);
    }
    const { error } = await service.from('customer_orders').delete().in('id', orderIds);
    if (error) throw new Error(`delete QA orders: ${error.message}`);
  }
  if (qaDrivers.length > 0) {
    await service.from('driver_status').update({ aktueller_batch_id: null }).in('employee_id',
      (await dataOf(service.from('employees').select('id').in('email', QA_EMAILS), 'load QA employees')).map((employee) => employee.id));
  }
  return { orders: orderIds.length, batches: batchIds.length };
}

async function setup() {
  await quarantineLegacyFixtures();
  await loadContext();
  await clearQaWork();
  const now = new Date();
  const rows = [];

  for (let index = 0; index < QA_EMAILS.length; index++) {
    const email = QA_EMAILS[index];
    const password = passwordFor(email);
    let user = await findAuthUser(email);
    if (!user) {
      const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { role: 'driver', qa_fixture: true },
      });
      if (created.error || !created.data.user) throw created.error ?? new Error(`create ${email} failed`);
      user = created.data.user;
    } else {
      const updated = await service.auth.admin.updateUserById(user.id, { password });
      if (updated.error) throw updated.error;
    }

    const employee = await dataOf(
      service.from('employees').upsert({
        auth_user_id: user.id,
        tenant_id: TARGET_TENANT,
        location_id: TARGET_LOCATION,
        vorname: `QA ${index + 1}`,
        nachname: ['Nah', 'Ost', 'West', 'Sued'][index],
        email,
        rolle: 'mitarbeiter',
        status: 'aktiv',
        kann_ausliefern: true,
        fahrzeug_praeferenz: index % 2 === 0 ? 'ebike' : 'car',
      }, { onConflict: 'auth_user_id,tenant_id' }).select('id').single(),
      `upsert employee ${index + 1}`,
    );

    const existing = await dataOf(service.from('mise_drivers').select('id').eq('email', email).maybeSingle(), `find driver ${index + 1}`);
    const driverValues = {
      auth_user_id: user.id,
      email,
      name: `QA Samstag ${index + 1}`,
      vehicle: index % 2 === 0 ? 'bike' : 'car',
      max_radius_km: 15,
      frank_mode: 'auto',
      state: 'idle',
      active: true,
      shift_started_at: now.toISOString(),
      last_lat: Number(location.lat) + [0.0001, 0.004, -0.006, -0.009][index],
      last_lng: Number(location.lng) + [0.0001, 0.005, -0.005, 0.002][index],
      last_position_at: now.toISOString(),
      last_active_at: now.toISOString(),
      last_foreground_at: now.toISOString(),
      approved_at: now.toISOString(),
      rejected: false,
      push_enabled: true,
      expo_push_token: `ExpoPushToken[qa-saturday-driver-${index + 1}]`,
      push_token_updated_at: now.toISOString(),
      current_capacity: 0,
      max_capacity: 4,
      excluded_until: null,
      dispatch_availability: 'available',
      availability_reason: null,
      availability_changed_at: now.toISOString(),
    };
    const driver = existing
      ? await dataOf(service.from('mise_drivers').update(driverValues).eq('id', existing.id).select('id').single(), `update driver ${index + 1}`)
      : await dataOf(service.from('mise_drivers').insert(driverValues).select('id').single(), `insert driver ${index + 1}`);

    await dataOf(
      service.from('mise_driver_tenants').upsert({ driver_id: driver.id, tenant_id: TARGET_TENANT, status: 'active' }, { onConflict: 'driver_id,tenant_id' }).select('id'),
      `membership ${index + 1}`,
    );
    await service.from('driver_shifts').delete().eq('driver_id', driver.id).in('status', ['scheduled', 'active']);
    await dataOf(
      service.from('driver_shifts').insert({
        driver_id: driver.id,
        location_id: TARGET_LOCATION,
        planned_start: new Date(now.getTime() - 60 * 60_000).toISOString(),
        planned_end: new Date(now.getTime() + 12 * 60 * 60_000).toISOString(),
        actual_start: now.toISOString(),
        status: 'active',
      }).select('id'),
      `shift ${index + 1}`,
    );
    rows.push({ index: index + 1, email, userId: user.id, employeeId: employee.id, driverId: driver.id });
  }
  await loadContext();
  console.log(JSON.stringify({ setup: true, drivers: rows.map(({ index, email, driverId }) => ({ index, email, driverId })), location: location.name }, null, 2));
}

async function resetDrivers(overrides = {}) {
  await loadContext();
  const now = new Date().toISOString();
  for (let index = 0; index < qaDrivers.length; index++) {
    const driver = qaDrivers[index];
    const override = overrides[index + 1] ?? {};
    const base = {
      state: 'idle', active: true, shift_started_at: now,
      last_position_at: now, last_active_at: now, last_foreground_at: now,
      approved_at: now, rejected: false, excluded_until: null,
      push_enabled: true, expo_push_token: `ExpoPushToken[qa-saturday-driver-${index + 1}]`,
      dispatch_availability: 'available', availability_reason: null,
      current_capacity: 0,
    };
    await dataOf(service.from('mise_drivers').update({ ...base, ...override }).eq('id', driver.id).select('id'), `reset driver ${index + 1}`);
  }
  await loadContext();
}

async function heartbeat() {
  if (qaDrivers.length === 0) await loadContext();
  const now = new Date().toISOString();
  await service.from('mise_drivers').update({ last_active_at: now, last_foreground_at: now, last_position_at: now }).in('id', qaDrivers.map((driver) => driver.id));
}

const destinations = {
  east1: { address: 'Juelicher Strasse 20, Aachen', lat: 50.7780, lng: 6.1370 },
  east2: { address: 'Juelicher Strasse 100, Aachen', lat: 50.7810, lng: 6.1410 },
  west1: { address: 'Pontstrasse 50, Aachen', lat: 50.7801, lng: 6.0821 },
  west2: { address: 'Vaalser Strasse 120, Aachen', lat: 50.7700, lng: 6.0790 },
  north1: { address: 'Lousbergstrasse 15, Aachen', lat: 50.7850, lng: 6.1240 },
  south1: { address: 'Eupener Strasse 60, Aachen', lat: 50.7540, lng: 6.1100 },
};

let orderSeq = 0;
async function insertOrder(scenario, destination, options = {}) {
  orderSeq += 1;
  const customerName = `${QA_PREFIX}-${scenario}-${String(orderSeq).padStart(3, '0')}`;
  const order = await dataOf(
    service.from('customer_orders').insert({
      tenant_id: TARGET_TENANT,
      location_id: TARGET_LOCATION,
      typ: 'lieferung',
      status: options.status ?? 'in_zubereitung',
      created_at: options.createdAt ?? new Date().toISOString(),
      dispatch_after: options.createdAt ?? new Date().toISOString(),
      kunde_name: customerName,
      kunde_adresse: destination.address,
      kunde_lat: destination.lat,
      kunde_lng: destination.lng,
      kunde_plz: '52062',
      gesamtbetrag: 24.9,
      zwischensumme: 24.9,
      bezahlt: true,
      payment_status: 'paid',
      order_channel: 'pos',
      is_training: true,
      estimated_prep_min: 15,
      priority: options.priority ?? 'normal',
      delivery_bag_count: options.bags ?? 1,
    }).select('id,bestellnummer,created_at').single(),
    `insert order ${customerName}`,
  );
  await dataOf(
    service.from('order_items').insert([
      { order_id: order.id, name: 'QA Pasta', menge: 1, einzelpreis: 16.9 },
      { order_id: order.id, name: 'QA Getraenk', menge: 1, einzelpreis: 8.0 },
    ]).select('id'),
    `insert items ${customerName}`,
  );
  return { ...order, customerName };
}

async function dispatchOrder(orderId) {
  await heartbeat();
  const started = performance.now();
  const response = await fetch(`${API_BASE}/api/delivery/dispatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-internal-token': internalToken },
    body: JSON.stringify({ order_id: orderId }),
  });
  const body = await response.json();
  const latencyMs = Math.round(performance.now() - started);
  if (!response.ok) throw new Error(`dispatch HTTP ${response.status}: ${JSON.stringify(body)}`);
  const assigned = await dataOf(
    service.from('customer_orders').select('id,mise_batch_id,mise_driver_id,dispatch_attempts').eq('id', orderId).single(),
    'load dispatch result',
  );
  return { api: body.result, ...assigned, latencyMs };
}

async function activeQaBatches() {
  return dataOf(
    service.from('mise_delivery_batches')
      .select('id,driver_id,state,assignment_mode,handoff_state,created_at,plan_expires_at,stops:mise_delivery_batch_stops(id,order_id,type,cancelled,completed_at,pick_verification)')
      .in('driver_id', qaDrivers.map((driver) => driver.id))
      .not('state', 'in', '(completed,cancelled)'),
    'load active QA batches',
  );
}

async function completeBatch(batch) {
  const now = new Date().toISOString();
  await service.from('mise_delivery_batch_stops').update({ completed_at: now }).eq('batch_id', batch.id).eq('cancelled', false);
  await service.from('mise_delivery_batches').update({ state: 'completed', completed_at: now, handoff_state: 'committed', committed_at: now }).eq('id', batch.id);
  await service.from('mise_drivers').update({ state: 'idle', current_capacity: 0, last_position_at: now, last_active_at: now, last_foreground_at: now }).eq('id', batch.driver_id);
}

async function scenarioSameDirection() {
  console.log('\nSCENARIO same_direction_capacity');
  await clearQaWork();
  await resetDrivers({ 2: { dispatch_availability: 'paused', availability_reason: 'manual' }, 3: { dispatch_availability: 'paused', availability_reason: 'manual' }, 4: { dispatch_availability: 'paused', availability_reason: 'manual' } });
  const results = [];
  for (let index = 0; index < 5; index++) {
    const order = await insertOrder('SAME', index % 2 ? destinations.east2 : destinations.east1);
    results.push(await dispatchOrder(order.id));
  }
  const assigned = results.filter((result) => result.mise_batch_id);
  const uniqueBatches = new Set(assigned.map((result) => result.mise_batch_id));
  check('same direction bundles four orders into one tour', assigned.length === 4 && uniqueBatches.size === 1, { assigned: assigned.length, batches: uniqueBatches.size });
  check('fifth order waits at capacity four', !results[4].mise_batch_id && results[4].api?.outcome === 'held', { fifth: results[4].api });
}

async function scenarioOppositeDirection() {
  console.log('\nSCENARIO opposite_direction');
  await clearQaWork();
  await resetDrivers({ 2: { dispatch_availability: 'paused', availability_reason: 'manual' }, 3: { dispatch_availability: 'paused', availability_reason: 'manual' }, 4: { dispatch_availability: 'paused', availability_reason: 'manual' } });
  const east = await insertOrder('DIR', destinations.east1);
  const eastResult = await dispatchOrder(east.id);
  const west = await insertOrder('DIR', destinations.west2);
  const westResult = await dispatchOrder(west.id);
  check('opposite directions are not mixed into one active tour', Boolean(eastResult.mise_batch_id) && !westResult.mise_batch_id, { east: eastResult.api, west: westResult.api });
}

async function scenarioEligibility() {
  console.log('\nSCENARIO eligibility_exclusions');
  await clearQaWork();
  const stale = new Date(Date.now() - 30 * 60_000).toISOString();
  await resetDrivers({
    2: { dispatch_availability: 'paused', availability_reason: 'manual' },
    3: { last_position_at: stale, last_active_at: stale },
    4: { expo_push_token: null, voip_push_token: null },
  });
  const eligibility = {};
  for (let index = 0; index < qaDrivers.length; index++) {
    eligibility[index + 1] = await dataOf(service.rpc('mise_driver_is_dispatch_eligible', {
      p_driver_id: qaDrivers[index].id,
      p_tenant_id: TARGET_TENANT,
      p_location_id: TARGET_LOCATION,
      p_at: new Date().toISOString(),
    }), `eligibility driver ${index + 1}`);
  }
  check('paused, stale-GPS and pushless drivers are excluded', eligibility[1] === true && eligibility[2] === false && eligibility[3] === false && eligibility[4] === false, eligibility);
  const order = await insertOrder('ELIG', destinations.north1);
  const result = await dispatchOrder(order.id);
  check('only the fully eligible driver receives the order', result.mise_driver_id === qaDrivers[0].id, { assignedDriver: result.mise_driver_id });
}

async function scenarioExpiry() {
  console.log('\nSCENARIO plan_expiry');
  await clearQaWork();
  await resetDrivers({ 2: { dispatch_availability: 'paused', availability_reason: 'manual' }, 3: { dispatch_availability: 'paused', availability_reason: 'manual' }, 4: { dispatch_availability: 'paused', availability_reason: 'manual' } });
  const order = await insertOrder('EXP', destinations.north1);
  const dispatched = await dispatchOrder(order.id);
  await service.from('mise_delivery_batches').update({ plan_expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', dispatched.mise_batch_id);
  const expired = await dataOf(service.rpc('expire_own_fleet_plans'), 'expire own-fleet plans');
  const after = await dataOf(service.from('customer_orders').select('mise_batch_id,mise_driver_id').eq('id', order.id).single(), 'load expired order');
  const batch = await dataOf(service.from('mise_delivery_batches').select('state,cancellation_reason').eq('id', dispatched.mise_batch_id).single(), 'load expired batch');
  check('unscanned expired plan is atomically requeued', expired >= 1 && !after.mise_batch_id && batch.state === 'cancelled', { expired, order: after, batch });
}

function pickupPayload(orderId, bagIndex) {
  const prefix = 'MISE:PICKUP:v1';
  const signature = createHmac('sha256', qrSecret).update(`${prefix}:${orderId.toLowerCase()}:${bagIndex}`).digest('base64url').slice(0, 24);
  return `${prefix}:${orderId.toLowerCase()}:${bagIndex}:${signature}`;
}

async function loginDriver(index) {
  const email = QA_EMAILS[index - 1];
  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: passwordFor(email) });
  if (error || !data.session) throw error ?? new Error(`login driver ${index} failed`);
  return { client, token: data.session.access_token };
}

async function scanViaApi(batchId, token, value) {
  const response = await fetch(`${API_BASE}/api/driver/v1/batch/${batchId}/handoff/scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ value }),
  });
  return { status: response.status, body: await response.json() };
}

async function scenarioQrAndCustody() {
  console.log('\nSCENARIO qr_handoff_and_custody');
  await clearQaWork();
  await resetDrivers({ 2: { dispatch_availability: 'paused', availability_reason: 'manual' }, 3: { dispatch_availability: 'paused', availability_reason: 'manual' }, 4: { dispatch_availability: 'paused', availability_reason: 'manual' } });
  const order = await insertOrder('QR', destinations.east1, { bags: 2, status: 'fertig' });
  const result = await dispatchOrder(order.id);
  const d1 = await loginDriver(1);
  const d2 = await loginDriver(2);
  const bag1 = pickupPayload(order.id, 1);
  const bag2 = pickupPayload(order.id, 2);
  const wrongDriver = await scanViaApi(result.mise_batch_id, d2.token, bag1);
  const invalid = await scanViaApi(result.mise_batch_id, d1.token, 'INVALID1');
  const first = await scanViaApi(result.mise_batch_id, d1.token, bag1);
  const duplicate = await scanViaApi(result.mise_batch_id, d1.token, bag1);
  const second = await scanViaApi(result.mise_batch_id, d1.token, bag2);
  check('wrong driver and invalid code are rejected', wrongDriver.status === 403 && invalid.status === 400, { wrongDriver: wrongDriver.status, invalid: invalid.status });
  check('multi-bag handoff is incomplete after bag one', first.status === 200 && first.body.duplicate === false && first.body.handoff_ready === false && first.body.scanned_bags?.length === 1, first.body);
  check('duplicate QR scan stays idempotent and reports duplicate', duplicate.status === 200 && duplicate.body.duplicate === true && duplicate.body.scanned_bags?.length === 1, duplicate.body);
  check('last required bag is new and makes handoff ready', second.status === 200 && second.body.duplicate === false && second.body.handoff_ready === true && second.body.scanned_bags?.length === 2, second.body);

  const { data: completed, error: completeError } = await d1.client.rpc('confirm_pickup_complete', { p_batch_id: result.mise_batch_id });
  if (completeError) throw completeError;
  const committed = await dataOf(service.from('mise_delivery_batches').select('state,handoff_state,committed_at').eq('id', result.mise_batch_id).single(), 'load committed handoff');
  check('custody starts only after complete QR handoff', completed?.ok === true && committed.state === 'in_progress' && committed.handoff_state === 'committed', committed);

  await service.from('mise_drivers').update({ last_position_at: new Date(Date.now() - 30 * 60_000).toISOString() }).eq('id', qaDrivers[0].id);
  await service.from('mise_delivery_batches').update({ created_at: new Date(Date.now() - 30 * 60_000).toISOString() }).eq('id', result.mise_batch_id);
  await dataOf(service.rpc('fn_recover_abandoned_tours'), 'recover stale custody');
  const custodyAfterRecovery = await dataOf(service.from('mise_delivery_batches').select('state,handoff_state').eq('id', result.mise_batch_id).single(), 'load custody recovery');
  check('stale GPS after custody never creates a duplicate reassignment', custodyAfterRecovery.state === 'in_progress' && custodyAfterRecovery.handoff_state === 'committed', custodyAfterRecovery);
}

async function scenarioRace() {
  console.log('\nSCENARIO concurrent_dispatch_race');
  await clearQaWork();
  await resetDrivers();
  const order = await insertOrder('RACE', destinations.south1);
  const [left, right] = await Promise.all([dispatchOrder(order.id), dispatchOrder(order.id)]);
  const stops = await dataOf(service.from('mise_delivery_batch_stops').select('id,batch_id').eq('order_id', order.id).eq('type', 'dropoff').eq('cancelled', false), 'load race stops');
  const after = await dataOf(service.from('customer_orders').select('mise_batch_id,mise_driver_id').eq('id', order.id).single(), 'load race order');
  check('two simultaneous dispatch calls create exactly one assignment', Boolean(after.mise_batch_id) && stops.length === 1 && new Set(stops.map((stop) => stop.batch_id)).size === 1, { left: left.api, right: right.api, stops: stops.length, order: after });
}

async function scenarioLogicalMidnight() {
  console.log('\nSCENARIO berlin_midnight');
  await clearQaWork();
  await resetDrivers();
  const tomorrow = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  const eligibleTomorrow = await dataOf(service.rpc('mise_driver_is_dispatch_eligible', {
    p_driver_id: qaDrivers[0].id,
    p_tenant_id: TARGET_TENANT,
    p_location_id: TARGET_LOCATION,
    p_at: tomorrow,
  }), 'tomorrow eligibility');
  check('current login does not receive new orders on the next Berlin workday', eligibleTomorrow === false, { at: tomorrow, eligible: eligibleTomorrow });
}

async function scenarioSaturdayStress() {
  console.log('\nSCENARIO saturday_40_orders_every_3_minutes');
  await clearQaWork();
  await resetDrivers();
  const logicalBase = Date.now() - 2 * 60 * 60_000;
  const directionCycle = [destinations.east1, destinations.east2, destinations.west1, destinations.west2, destinations.north1, destinations.south1];
  const assignments = new Map(qaDrivers.map((driver) => [driver.id, 0]));
  const batchStartStep = new Map();
  const orderResults = [];
  const waiting = [];

  async function finishDue(step, force = false) {
    const active = await activeQaBatches();
    for (const batch of active) {
      const start = batchStartStep.get(batch.id) ?? step;
      if (force || step - start >= 8) await completeBatch(batch);
    }
  }

  async function retryWaiting(step) {
    for (let index = waiting.length - 1; index >= 0; index--) {
      const pending = waiting[index];
      const retry = await dispatchOrder(pending.order.id);
      if (retry.mise_batch_id) {
        waiting.splice(index, 1);
        retry.assignedStep = step;
        orderResults.push(retry);
        assignments.set(retry.mise_driver_id, (assignments.get(retry.mise_driver_id) ?? 0) + 1);
        if (!batchStartStep.has(retry.mise_batch_id)) batchStartStep.set(retry.mise_batch_id, step);
      }
    }
  }

  for (let step = 0; step < 40; step++) {
    await finishDue(step);
    await retryWaiting(step);
    const order = await insertOrder('LOAD', directionCycle[step % directionCycle.length], {
      createdAt: new Date(logicalBase + step * 3 * 60_000).toISOString(),
      priority: step % 13 === 0 ? 'high' : 'normal',
      bags: step % 9 === 0 ? 2 : 1,
    });
    const result = await dispatchOrder(order.id);
    if (result.mise_batch_id) {
      result.assignedStep = step;
      orderResults.push(result);
      assignments.set(result.mise_driver_id, (assignments.get(result.mise_driver_id) ?? 0) + 1);
      if (!batchStartStep.has(result.mise_batch_id)) batchStartStep.set(result.mise_batch_id, step);
    } else {
      waiting.push({ order, enteredStep: step });
    }
  }
  for (let round = 0; waiting.length > 0 && round < 8; round++) {
    await finishDue(40 + round * 8, true);
    await retryWaiting(40 + round * 8);
  }
  const allQaOrders = await dataOf(service.from('customer_orders').select('id,mise_batch_id,mise_driver_id').like('kunde_name', `${QA_PREFIX}-LOAD%`), 'load stress orders');
  const stressBatchIds = [...new Set(allQaOrders.map((order) => order.mise_batch_id).filter(Boolean))];
  const batchRows = stressBatchIds.length
    ? await dataOf(service.from('mise_delivery_batch_stops').select('batch_id,order_id,type,cancelled').in('batch_id', stressBatchIds).eq('type', 'dropoff').eq('cancelled', false), 'load stress stops')
    : [];
  const countsByBatch = {};
  for (const stop of batchRows) countsByBatch[stop.batch_id] = (countsByBatch[stop.batch_id] ?? 0) + 1;
  const loads = [...assignments.values()];
  const latencies = orderResults.map((result) => result.latencyMs).sort((a, b) => a - b);
  const p95 = latencies[Math.max(0, Math.ceil(latencies.length * 0.95) - 1)] ?? null;
  const summary = {
    arrivals: 40,
    intervalMinutes: 3,
    assigned: allQaOrders.filter((order) => order.mise_batch_id).length,
    stillWaiting: allQaOrders.filter((order) => !order.mise_batch_id).length,
    perDriver: Object.fromEntries(qaDrivers.map((driver, index) => [`driver${index + 1}`, assignments.get(driver.id) ?? 0])),
    tours: stressBatchIds.length,
    maxOrdersPerTour: Math.max(0, ...Object.values(countsByBatch)),
    p95DispatchMs: p95,
  };
  check('40 orders at three-minute intervals all receive an assignment', summary.assigned === 40 && summary.stillWaiting === 0, summary);
  check('no tour exceeds driver capacity four', summary.maxOrdersPerTour <= 4, summary);
  check('load is reasonably balanced across four drivers', Math.max(...loads) - Math.min(...loads) <= 4, summary);
  check('automatic dispatch remains responsive under Saturday load', p95 !== null && p95 < 5000, summary);
  await finishDue(100, true);
  return summary;
}

async function runAll() {
  await loadContext();
  if (qaDrivers.length !== 4) throw new Error('Run setup first: four QA drivers are required');
  await scenarioSameDirection();
  await scenarioOppositeDirection();
  await scenarioEligibility();
  await scenarioExpiry();
  await scenarioQrAndCustody();
  await scenarioRace();
  await scenarioLogicalMidnight();
  const stress = await scenarioSaturdayStress();
  const failed = checks.filter((item) => !item.pass);
  console.log('\nQA_REPORT');
  console.log(JSON.stringify({ ok: failed.length === 0, checks, stress }, null, 2));
  if (failed.length > 0) process.exitCode = 2;
}

async function runQrOnly() {
  await loadContext();
  if (qaDrivers.length !== 4) throw new Error('Run setup first: four QA drivers are required');
  await scenarioQrAndCustody();
  const failed = checks.filter((item) => !item.pass);
  console.log('\nQA_QR_REPORT');
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
  if (failed.length > 0) process.exitCode = 2;
}

async function prepareVisualFixture() {
  await loadContext();
  if (qaDrivers.length !== 4) throw new Error('Run setup first: four QA drivers are required');
  await clearQaWork();
  await resetDrivers({
    2: { dispatch_availability: 'paused', availability_reason: 'manual' },
    3: { dispatch_availability: 'paused', availability_reason: 'manual' },
    4: { dispatch_availability: 'paused', availability_reason: 'manual' },
  });
  const first = await insertOrder('VISUAL', destinations.east1, { bags: 2, status: 'fertig' });
  const firstResult = await dispatchOrder(first.id);
  const second = await insertOrder('VISUAL', destinations.east2, { bags: 1, status: 'fertig' });
  const secondResult = await dispatchOrder(second.id);
  const bundled = Boolean(firstResult.mise_batch_id)
    && firstResult.mise_batch_id === secondResult.mise_batch_id
    && firstResult.mise_driver_id === qaDrivers[0].id;
  if (!bundled) throw new Error(`Visual fixture was not bundled to driver one: ${JSON.stringify({ firstResult, secondResult })}`);
  console.log(JSON.stringify({
    visualFixture: true,
    driver: qaDrivers[0].email,
    batchId: firstResult.mise_batch_id,
    orderCount: 2,
    requiredBagScans: 3,
  }, null, 2));
}

async function auditProductionFixtures() {
  await loadContext();
  const active = await dataOf(
    service.from('customer_orders')
      .select('id,bestellnummer,kunde_name,status,created_at,is_training,mise_batch_id,mise_driver_id,bezahlt,zahlungsart,payment_status')
      .eq('location_id', TARGET_LOCATION)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('created_at'),
    'audit active location orders',
  );
  const suspicious = active.filter((order) => order.is_training
    || /qa|test|nicht ausliefern/i.test(`${order.kunde_name ?? ''} ${order.bestellnummer ?? ''}`));
  const tenant = await dataOf(
    service.from('tenants').select('logo_url,theme_primary').eq('id', TARGET_TENANT).single(),
    'audit tenant brand',
  );
  const suspiciousDriverIds = [...new Set(suspicious.map((order) => order.mise_driver_id).filter(Boolean))];
  const suspiciousBatchIds = [...new Set(suspicious.map((order) => order.mise_batch_id).filter(Boolean))];
  const suspiciousDrivers = suspiciousDriverIds.length
    ? await dataOf(service.from('mise_drivers').select('id,name,email,state,active').in('id', suspiciousDriverIds), 'audit suspicious drivers')
    : [];
  const suspiciousBatches = suspiciousBatchIds.length
    ? await dataOf(service.from('mise_delivery_batches').select('id,state,handoff_state,assignment_mode,created_at').in('id', suspiciousBatchIds), 'audit suspicious batches')
    : [];
  const storageResult = await service.schema('storage').from('objects')
    .select('bucket_id,name')
    .or('name.ilike.%franky%,name.ilike.%pasta%')
    .limit(100);
  console.log(JSON.stringify({
    activeOrderCount: active.length,
    suspiciousActiveOrders: suspicious,
    suspiciousDrivers,
    suspiciousBatches,
    tenantBrand: tenant,
    matchingStorageAssets: storageResult.error ? [] : storageResult.data,
    storageAuditError: storageResult.error?.message ?? null,
  }, null, 2));
}

async function repairTenantBrandAsset() {
  const assetPath = '/biss-app/bilder/frankys-pasta-logo.png';
  const check = await fetch(`${API_BASE}${assetPath}`, { method: 'HEAD' });
  if (!check.ok || !check.headers.get('content-type')?.startsWith('image/')) {
    throw new Error(`Verified tenant logo is unavailable: HTTP ${check.status}`);
  }
  const current = await dataOf(
    service.from('tenants').select('logo_url').eq('id', TARGET_TENANT).single(),
    'load current tenant logo',
  );
  if (current.logo_url !== assetPath) {
    await dataOf(
      service.from('tenants').update({ logo_url: assetPath }).eq('id', TARGET_TENANT).select('id').single(),
      'repair tenant logo path',
    );
  }
  console.log(JSON.stringify({ repaired: current.logo_url !== assetPath, logoPath: assetPath }));
}

async function cleanup() {
  await loadContext();
  const work = await clearQaWork();
  const drivers = await dataOf(service.from('mise_drivers').select('id,auth_user_id,email').in('email', QA_EMAILS), 'find cleanup drivers');
  if (drivers.length > 0) {
    await service.from('mise_drivers').delete().in('id', drivers.map((driver) => driver.id));
  }
  for (const email of QA_EMAILS) {
    const user = await findAuthUser(email);
    if (user) {
      const { error } = await service.auth.admin.deleteUser(user.id, true);
      if (error) throw error;
    }
  }
  console.log(JSON.stringify({ cleanup: true, ...work, drivers: drivers.length }, null, 2));
}

const command = process.argv[2] ?? 'run';
if (command === 'setup') await setup();
else if (command === 'run') await runAll();
else if (command === 'qr') await runQrOnly();
else if (command === 'visual') await prepareVisualFixture();
else if (command === 'audit') await auditProductionFixtures();
else if (command === 'quarantine') console.log(JSON.stringify({ quarantined: await quarantineLegacyFixtures() }));
else if (command === 'fix-brand') await repairTenantBrandAsset();
else if (command === 'cleanup') await cleanup();
else if (command === 'status') console.log(JSON.stringify(await loadContext(), null, 2));
else throw new Error(`Unknown command: ${command}`);
