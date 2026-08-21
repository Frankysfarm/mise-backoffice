import { expect, test } from '@playwright/test';

test('public entry points render', async ({ page }) => {
  for (const path of ['/login', '/fahrer', '/fahrer/login', '/lieferdienst']) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator('body')).toBeVisible();
  }
});

test('protected backoffice routes redirect to login', async ({ page }) => {
  for (const path of ['/dispatch', '/shop']) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`));
  }
});

test('delivery health endpoint is public and reaches the database', async ({ request }) => {
  const response = await request.get('/api/delivery/health');
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.status).toBe('ok');
  expect(body.checks.database.ok).toBe(true);
});

test('driver ringtone is served as a public audio asset', async ({ request }) => {
  const response = await request.get('/ringtone.wav');

  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('audio/wav');
  expect((await response.body()).byteLength).toBeGreaterThan(0);
});
