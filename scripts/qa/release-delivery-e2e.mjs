#!/usr/bin/env node

import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE = process.env.QA_BASE_URL || 'https://mise-gastro.de';
const TENANT_ID = '0318b8f1-8187-4eae-a886-383126f4bbed';
const LOCATION_ID = '3e00a63f-8d6c-4021-880e-76ef5d20acc6';
const DRIVER_EMAILS = [1, 2, 3, 4].map((index) => `qa.saturday.driver${index}@mise-gastro.de`);

for (const file of ['.env', '.env.local']) {
  try {
    for (const raw of readFileSync(file, 'utf8').split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const at = line.indexOf('=');
      if (!process.env[line.slice(0, at).trim()]) {
        process.env[line.slice(0, at).trim()] = line.slice(at + 1).trim();
      }
    }
  } catch { /* optional environment file */ }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const internalToken = process.env.BISS_INTERNAL_TOKEN;
const qrSecret = process.env.DELIVERY_PICKUP_QR_SECRET || process.env.DRIVER_OTP_SECRET;
if (!supabaseUrl || !anonKey || !serviceKey || !internalToken || !qrSecret) {
  throw new Error('Delivery E2E environment is incomplete');
}

const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const passwordFor = (email) => `Qa!${createHash('sha256').update(`${qrSecret}:${email}`).digest('base64url').slice(0, 24)}`;
const result = { checks: [], orderId: null, batchId: null, driverId: null };

function check(name, condition, details = {}) {
  result.checks.push({ name, pass: Boolean(condition), details });
  if (!condition) throw new Error(`${name}: ${JSON.stringify(details)}`);
}

async function dataOf(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function loginPage(page, email) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}/fahrer/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(passwordFor(email));
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/fahrer\/app/, { timeout: 30_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(2_000);
    }
  }
  throw lastError;
}

async function expectJson(response, label) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok()) throw new Error(`${label} HTTP ${response.status()}: ${JSON.stringify(body)}`);
  return body;
}

function pickupPayload(orderId, bagIndex) {
  const prefix = 'MISE:PICKUP:v1';
  const signature = createHmac('sha256', qrSecret)
    .update(`${prefix}:${orderId.toLowerCase()}:${bagIndex}`)
    .digest('base64url')
    .slice(0, 24);
  return `${prefix}:${orderId.toLowerCase()}:${bagIndex}:${signature}`;
}

const drivers = await dataOf(
  service.from('mise_drivers').select('id,email').in('email', DRIVER_EMAILS).order('email'),
  'load QA drivers',
);
if (drivers.length !== 4) throw new Error('Four QA drivers are required');

// This test must never inherit a planned bundle from an earlier QA scenario.
// Only batches whose linked orders are all explicitly marked as training may
// be cancelled here; a real order makes the run fail closed.
const activeQaBatches = await dataOf(
  service.from('mise_delivery_batches')
    .select('id,driver_id,state')
    .in('driver_id', drivers.map((driver) => driver.id))
    .in('state', ['pending_acceptance', 'assigned', 'at_restaurant', 'picked_up', 'in_progress']),
  'load active QA driver batches',
);
if (activeQaBatches.length > 0) {
  const batchIds = activeQaBatches.map((batch) => batch.id);
  const linkedOrders = await dataOf(
    service.from('customer_orders')
      .select('id,mise_batch_id,is_training,status')
      .in('mise_batch_id', batchIds),
    'load active QA batch orders',
  );
  if (linkedOrders.some((order) => order.is_training !== true)) {
    throw new Error('Refusing to isolate QA drivers because an active batch contains a non-training order');
  }
  await dataOf(
    service.from('mise_delivery_batch_stops').update({ cancelled: true }).in('batch_id', batchIds).select('id'),
    'cancel stale QA batch stops',
  );
  await dataOf(
    service.from('mise_delivery_batches').update({ state: 'cancelled' }).in('id', batchIds).select('id'),
    'cancel stale QA batches',
  );
  const cancellableOrderIds = linkedOrders
    .filter((order) => order.status !== 'geliefert')
    .map((order) => order.id);
  if (cancellableOrderIds.length > 0) {
    await dataOf(
      service.from('customer_orders')
        .update({ status: 'storniert' })
        .in('id', cancellableOrderIds)
        .select('id'),
      'cancel stale QA training orders',
    );
  }
  await dataOf(
    service.from('driver_status').update({ aktueller_batch_id: null }).in('aktueller_batch_id', batchIds),
    'clear stale QA driver status',
  );
}

const now = new Date().toISOString();
await dataOf(
  service.from('driver_shifts')
    .delete()
    .in('driver_id', drivers.map((driver) => driver.id))
    .in('status', ['scheduled', 'active'])
    .select('id'),
  'clear stale QA driver shifts',
);
for (let index = 0; index < drivers.length; index++) {
  await dataOf(
    service.from('mise_drivers').update({
      state: 'idle',
      active: true,
      shift_started_at: now,
      last_position_at: now,
      last_active_at: now,
      last_foreground_at: now,
      dispatch_availability: index === 0 ? 'available' : 'paused',
      availability_reason: index === 0 ? null : 'manual',
      current_capacity: 0,
      max_capacity: 4,
      approved_at: now,
      rejected: false,
      excluded_until: null,
      push_enabled: true,
      expo_push_token: `ExpoPushToken[qa-release-driver-${index + 1}]`,
    }).eq('id', drivers[index].id).select('id'),
    `reset QA driver ${index + 1}`,
  );
  await dataOf(
    service.from('driver_shifts').insert({
      driver_id: drivers[index].id,
      location_id: LOCATION_ID,
      planned_start: new Date(Date.now() - 60 * 60_000).toISOString(),
      planned_end: new Date(Date.now() + 12 * 60 * 60_000).toISOString(),
      actual_start: now,
      status: 'active',
    }).select('id'),
    `start QA driver shift ${index + 1}`,
  );
}

const order = await dataOf(
  service.from('customer_orders').insert({
    tenant_id: TENANT_ID,
    location_id: LOCATION_ID,
    typ: 'lieferung',
    status: 'neu',
    created_at: now,
    dispatch_after: now,
    kunde_name: `QA-RELEASE-E2E-20260822-${Date.now()}`,
    kunde_adresse: 'Juelicher Strasse 20, Aachen',
    kunde_lat: 50.7780,
    kunde_lng: 6.1370,
    kunde_plz: '52062',
    gesamtbetrag: 24.90,
    zwischensumme: 24.90,
    bezahlt: true,
    payment_status: 'paid',
    order_channel: 'pos',
    is_training: true,
    estimated_prep_min: 15,
    priority: 'normal',
    delivery_bag_count: 1,
  }).select('id,bestellnummer,status').single(),
  'create training delivery order',
);
result.orderId = order.id;
await dataOf(
  service.from('order_items').insert([
    { order_id: order.id, name: 'QA Release Pasta', menge: 1, einzelpreis: 16.90 },
    { order_id: order.id, name: 'QA Release Getränk', menge: 1, einzelpreis: 8.00 },
  ]).select('id'),
  'create training order items',
);

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await loginPage(page, DRIVER_EMAILS[3]);

  const accepted = await expectJson(await context.request.post(
    `${BASE}/api/lieferdienst/orders/${order.id}/accept`,
    { data: { etaMinutes: 15, locationId: LOCATION_ID } },
  ), 'accept order');
  check('order enters confirmed kitchen queue', accepted.order?.status === 'bestätigt', accepted);

  const cooking = await expectJson(await context.request.patch(
    `${BASE}/api/lieferdienst/orders/${order.id}/status`,
    { data: { status: 'in_zubereitung', locationId: LOCATION_ID } },
  ), 'mark cooking');
  check('kitchen starts preparation', cooking.order?.status === 'in_zubereitung', cooking);

  const ready = await expectJson(await context.request.patch(
    `${BASE}/api/lieferdienst/orders/${order.id}/status`,
    { data: { status: 'fertig', locationId: LOCATION_ID } },
  ), 'mark ready');
  check('kitchen marks order ready', ready.order?.status === 'fertig', ready);
  await context.close();
} finally {
  await browser.close();
}

const dispatchResponse = await fetch(`${BASE}/api/delivery/dispatch`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-internal-token': internalToken },
  body: JSON.stringify({ order_id: order.id }),
});
const dispatchBody = await dispatchResponse.json();
if (!dispatchResponse.ok) throw new Error(`dispatch HTTP ${dispatchResponse.status}: ${JSON.stringify(dispatchBody)}`);

const assigned = await dataOf(
  service.from('customer_orders').select('id,status,mise_batch_id,mise_driver_id').eq('id', order.id).single(),
  'load assignment',
);
result.batchId = assigned.mise_batch_id;
result.driverId = assigned.mise_driver_id;
check('Frank assigns the ready order to the eligible driver',
  Boolean(assigned.mise_batch_id) && assigned.mise_driver_id === drivers[0].id,
  { assigned, dispatch: dispatchBody.result });

const driverClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
const signedIn = await driverClient.auth.signInWithPassword({
  email: DRIVER_EMAILS[0],
  password: passwordFor(DRIVER_EMAILS[0]),
});
if (signedIn.error || !signedIn.data.session) throw signedIn.error ?? new Error('Driver login failed');
const token = signedIn.data.session.access_token;

const scanResponse = await fetch(`${BASE}/api/driver/v1/batch/${assigned.mise_batch_id}/handoff/scan`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  body: JSON.stringify({ value: pickupPayload(order.id, 1) }),
});
const scanBody = await scanResponse.json();
check('driver scans the complete restaurant handoff',
  scanResponse.ok && scanBody.handoff_ready === true && scanBody.scanned_bags?.length === 1,
  { status: scanResponse.status, body: scanBody });

const custody = await driverClient.rpc('confirm_pickup_complete', { p_batch_id: assigned.mise_batch_id });
if (custody.error) throw custody.error;
check('driver takes custody only after the bag scan', custody.data?.ok === true, custody.data ?? {});

async function deliver() {
  const response = await fetch(`${BASE}/api/driver/v1/orders/${order.id}/delivered`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ photo_url: null, signature: null }),
  });
  return { status: response.status, body: await response.json() };
}

const delivered = await deliver();
check('driver completes the delivery atomically',
  delivered.status === 200 && delivered.body.ok === true && delivered.body.batch_completed === true,
  delivered);
const duplicateDelivery = await deliver();
check('duplicate delivery confirmation is idempotent',
  duplicateDelivery.status === 200 && duplicateDelivery.body.ok === true && duplicateDelivery.body.already_delivered === true,
  duplicateDelivery);

const [finalOrder, finalBatch, finalStops, finalDriver] = await Promise.all([
  dataOf(service.from('customer_orders').select('status,geliefert_am,is_training,mise_batch_id,mise_driver_id').eq('id', order.id).single(), 'final order'),
  dataOf(service.from('mise_delivery_batches').select('state,completed_at,handoff_state').eq('id', assigned.mise_batch_id).single(), 'final batch'),
  dataOf(service.from('mise_delivery_batch_stops').select('type,completed_at,cancelled').eq('batch_id', assigned.mise_batch_id).eq('cancelled', false), 'final stops'),
  dataOf(service.from('mise_drivers').select('state,current_capacity').eq('id', drivers[0].id).single(), 'final driver'),
]);
check('final state is consistent across order, tour, stops and driver',
  finalOrder.status === 'geliefert'
    && Boolean(finalOrder.geliefert_am)
    && finalOrder.is_training === true
    && finalBatch.state === 'completed'
    && Boolean(finalBatch.completed_at)
    && finalStops.every((stop) => Boolean(stop.completed_at))
    && ['idle', 'returning'].includes(finalDriver.state)
    && Number(finalDriver.current_capacity) === 0,
  { finalOrder, finalBatch, finalStops, finalDriver });

result.ok = result.checks.every((item) => item.pass);
result.final = { order: finalOrder, batch: finalBatch, stops: finalStops, driver: finalDriver };
console.log(JSON.stringify(result, null, 2));
