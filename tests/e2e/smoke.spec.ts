import { expect, test } from '@playwright/test';

test('public entry points render', async ({ page }) => {
  for (const path of ['/login', '/fahrer', '/fahrer/login']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  }
});

test('protected backoffice routes redirect to login', async ({ page }) => {
  for (const path of ['/dispatch', '/shop', '/lieferdienst', '/pos/terminal-v5', '/mitarbeiter', '/mitarbeiter/inventur/00000000-0000-0000-0000-000000000001']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});

test('login exposes the dedicated employee entry', async ({ page }) => {
  await page.goto('/login?mode=team&next=/mitarbeiter');
  await expect(page.getByRole('button', { name: /Team/i })).toBeVisible();
  await expect(page.getByText(/Schichten, Arbeitszeiten und die wichtigsten Team-Informationen/i)).toBeVisible();
});

test('retired driver API is explicit and leaks no legacy data', async ({ request }) => {
  const response = await request.get('/api/driver-app/data?driver_id=00000000-0000-0000-0000-000000000001');
  expect(response.status()).toBe(410);
  await expect(response.json()).resolves.toMatchObject({ code: 'driver_api_retired' });
});

test('employee PWA manifest is public and valid', async ({ request }) => {
  const response = await request.get('/mitarbeiter.webmanifest');
  expect(response.status()).toBe(200);
  const manifest = await response.json();
  expect(manifest).toMatchObject({ name: 'Mise Team', start_url: '/mitarbeiter', display: 'standalone' });
});

test('order status requires a tracking capability in addition to the order id', async ({ request }) => {
  const response = await request.get('/api/order/status?id=00000000-0000-0000-0000-000000000001');
  expect(response.status()).toBe(400);
  expect(response.headers()['access-control-allow-origin']).toBeUndefined();
});

test('legacy client-priced cash checkout is retired', async ({ request }) => {
  const response = await request.post('/api/order/cash', {
    data: { tenant: 'test', table: '1', amountCents: 1, items: [{ name: 'Manipuliert', qty: 1, priceCents: 1 }] },
  });
  expect(response.status()).toBe(410);
});

test('table checkout rejects requests without a QR capability', async ({ request }) => {
  const response = await request.post('/api/order/table', {
    data: { tableId: '00000000-0000-4000-8000-000000000001', paymentMethod: 'bar', items: [{ id: 'x', qty: 1 }] },
  });
  expect(response.status()).toBe(400);
});

test('delivery-window mutations require the order tracking capability', async ({ request }) => {
  const response = await request.post('/api/delivery/windows', {
    data: {
      order_id: '00000000-0000-4000-8000-000000000001',
      slot_id: '00000000-0000-4000-8000-000000000002',
      location_id: '00000000-0000-4000-8000-000000000003',
    },
  });
  expect(response.status()).toBe(401);
});

test('voice webhook fails closed without a valid signature', async ({ request }) => {
  const response = await request.post('/api/voice-orders/webhook/elevenlabs', {
    data: { type: 'conversation.started', conversation_id: 'conv-test', agent_id: 'agent-test' },
  });
  expect([401, 503]).toContain(response.status());
});

test('delivery health endpoint is public and reaches the database', async ({ request }) => {
  const response = await request.get('/api/delivery/health');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.checks.database.ok).toBe(true);
});

test('driver identity endpoint returns JSON instead of an auth redirect', async ({ request }) => {
  const response = await request.get('/api/fahrer/whoami', { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(await response.json()).toEqual({ isDriver: false });
});

test('driver ringtone is served as a public audio asset', async ({ request }) => {
  const response = await request.get('/ringtone.wav');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('audio/wav');
  expect((await response.body()).byteLength).toBeGreaterThan(0);
});
