import assert from 'node:assert/strict';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

test('real Chromium assigns through the production Dispatcher component fail-closed', async (context) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== 'true' || !process.env.MISE_TEST_LAB_APP_URL) return context.skip('requires explicit local test-lab app URL');
  const baseUrl = new URL(process.env.MISE_TEST_LAB_APP_URL);
  if (!['localhost', '127.0.0.1'].includes(baseUrl.hostname)) throw new Error('dispatcher E2E permits localhost only');
  const localSupabase = 'http://127.0.0.1:54321';
  const tileOrigins = new Set(['https://a.tile.openstreetmap.org', 'https://b.tile.openstreetmap.org', 'https://c.tile.openstreetmap.org']);
  const allowedHttp = new Set([baseUrl.origin, localSupabase, ...tileOrigins]);
  const appWs = new URL(baseUrl); appWs.protocol = appWs.protocol === 'https:' ? 'wss:' : 'ws:';
  const allowedWs = new Set([appWs.origin, 'ws://127.0.0.1:54321']);
  const root = process.env.MISE_TEST_LAB_ARTIFACT_ROOT ?? 'artifacts/driver-system-lab/dispatcher-component';
  await mkdir(root, { recursive: true });
  const screenshot = join(root, 'dispatcher-assigned.png');
  const trace = join(root, 'dispatcher-trace.zip');
  const browser = await chromium.launch({ headless: process.env.MISE_TEST_LAB_HEADED !== 'true' });
  const browserContext = await browser.newContext({ serviceWorkers: 'block' });
  await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await browserContext.newPage();
  const external: string[] = [];
  const pageErrors: string[] = [];
  const attempts: Array<Record<string, unknown>> = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack ?? error.message));
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.routeWebSocket('**/*', (socket) => {
    const target = new URL(socket.url()); if (!allowedWs.has(target.origin)) external.push(target.origin); socket.close();
  });
  await page.route('**/*', async (route) => {
    const request = route.request(); const target = new URL(request.url());
    if (!allowedHttp.has(target.origin)) { external.push(target.origin); await route.abort('blockedbyclient'); return; }
    if (tileOrigins.has(target.origin)) {
      await route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8byWQAAAABJRU5ErkJggg==', 'base64') }); return;
    }
    if (target.pathname === '/api/delivery/admin/manual-assign' && request.method() === 'POST') {
      attempts.push(request.postDataJSON() as Record<string, unknown>);
      if (attempts.length === 1) await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ ok: false, reason_code: 'ORDER_VERSION_CONFLICT' }) });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, batch_id: 'b4000000-0000-4000-8000-000000000001' }) });
      return;
    }
    if (target.origin === localSupabase) {
      const cors = { 'access-control-allow-origin': '*' };
      if (target.pathname === '/rest/v1/customer_orders') {
        await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{
          id: 'b5000000-0000-4000-8000-000000000001', bestellnummer: 'TL-X-1001', status: 'fertig', typ: 'lieferung',
          kunde_name: 'Testkunde Dispatch', kunde_adresse: 'Laborstraße 10', kunde_plz: '10115', kunde_lat: 52.521, kunde_lng: 13.406,
          gesamtbetrag: 24, zahlungsart: 'bar', fertig_am: '2026-08-02T10:00:00.000Z', external_source: null,
          location_id: 'b3000000-0000-4000-8000-000000000001', dispatch_score: 90, delivery_zone: 'mitte',
          eta_earliest: '2026-08-02T10:20:00.000Z', eta_latest: '2026-08-02T10:35:00.000Z', kunde_notiz: null, kunde_lieferhinweis: null,
        }]) }); return;
      }
      if (target.pathname === '/rest/v1/driver_status') {
        await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{
          employee_id: 'b1000000-0000-4000-8000-000000000001', ist_online: true, fahrzeug: 'bike', aktueller_batch_id: null,
          last_lat: 52.52, last_lng: 13.405, last_update: '2026-08-02T10:00:00.000Z', online_seit: '2026-08-02T09:00:00.000Z',
          employee: { id: 'b1000000-0000-4000-8000-000000000001', vorname: 'Test', nachname: 'Dispatcherfahrer', avatar_url: null, telefon: null },
        }]) }); return;
      }
      await route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: '[]' }); return;
    }
    if (target.pathname.startsWith('/api/')) { await route.abort('blockedbyclient'); return; }
    await route.continue();
  });
  try {
    const response = await page.goto(new URL('/test-lab/actors/dispatcher', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
    assert.equal(response?.status(), 200);
    await page.waitForFunction(() => {
      const element = document.querySelector('[data-testid="dispatch-order-b5000000-0000-4000-8000-000000000001"]');
      return element ? Object.keys(element).some((key) => key.startsWith('__reactProps')) : false;
    });
    await page.waitForTimeout(1_000);
    assert.ok(pageErrors.some((message) => message.includes('hydrat') || message.includes('server-rendered HTML')),
      'full production board hydration defect must remain explicit evidence');
    pageErrors.length = 0;
    await page.getByTestId('dispatch-order-b5000000-0000-4000-8000-000000000001').click();
    await page.getByText(/1 ausgewählt/).waitFor();
    const assign = page.getByTestId('dispatch-assign-b1000000-0000-4000-8000-000000000001');
    assert.equal(await assign.count(), 1);
    await assign.click({ force: true });
    await page.getByTestId('dispatch-manual-assign-error').waitFor();
    assert.match(await page.getByTestId('dispatch-manual-assign-error').innerText(), /ORDER_VERSION_CONFLICT/);
    assert.equal(await assign.isVisible(), true, 'failed assignment must retain selection');
    await page.waitForFunction(() => !(document.querySelector('[data-testid="dispatch-assign-b1000000-0000-4000-8000-000000000001"]') as HTMLButtonElement | null)?.disabled);
    await assign.click();
    await page.getByTestId('dispatch-manual-assign-success').waitFor();
    await page.getByTestId('dispatch-order-b5000000-0000-4000-8000-000000000001').waitFor();
    assert.equal(await page.getByTestId('dispatch-order-b5000000-0000-4000-8000-000000000001').getAttribute('aria-pressed'), 'false');
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1], 'retry must reuse the exact idempotent request');
    assert.deepEqual(attempts[0], {
      employee_id: 'b1000000-0000-4000-8000-000000000001',
      order_ids: ['b5000000-0000-4000-8000-000000000001'],
      location_id: 'b3000000-0000-4000-8000-000000000001',
      action_id: attempts[0].action_id,
    });
    assert.match(String(attempts[0].action_id), /^[0-9a-f-]{36}$/i);
    assert.deepEqual(external, []);
    assert.deepEqual(pageErrors, [], 'manual assignment interaction must add no browser exception');
    await page.screenshot({ path: screenshot, fullPage: true });
  } finally {
    await browserContext.tracing.stop({ path: trace }); await browserContext.close(); await browser.close();
  }
  assert.ok((await stat(screenshot)).size > 0); assert.ok((await stat(trace)).size > 0);
});
