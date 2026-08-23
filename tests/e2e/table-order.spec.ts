import { expect, test } from '@playwright/test';

test('guest completes a responsive QR table order with cross-sell and live status', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.route('**/api/order/table', async (route) => {
    expect(route.request().headers()['idempotency-key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        orderNumber: 'FF-QA42',
        orderId: '00000000-0000-4000-8000-000000000042',
        trackingToken: 'qa-tracking-token',
        amountCents: 1980,
      }),
    });
  });
  await page.route('**/api/order/status**', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ paymentStatus: 'paid', orderStatus: 'fertig' }),
  }));

  const response = await page.goto('/t/qa-preview');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Franky’s Farm' })).toBeVisible();
  await expect(page.getByLabel('Tisch 12')).toBeVisible();

  const search = page.getByLabel('Menü durchsuchen');
  await search.fill('vegan');
  await expect(page.getByRole('button', { name: /Iced Strawberry Matcha/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Franky’s Smash Burger/i })).toBeHidden();
  await search.fill('gibt-es-nicht');
  await expect(page.getByRole('heading', { name: 'Nichts gefunden' })).toBeVisible();
  await page.getByRole('button', { name: 'Suche zurücksetzen' }).click();

  await page.getByRole('button', { name: /Franky’s Smash Burger/i }).click();
  await expect(page.getByRole('button', { name: /Bestellung prüfen/i })).toBeVisible();
  await page.waitForFunction(() => window.localStorage.getItem('mise-table-cart:qa-table-token')?.includes('smash-burger'));
  await page.reload();
  await expect(page.getByRole('button', { name: /Bestellung prüfen/i })).toBeVisible();

  await page.getByRole('button', { name: /Bestellung prüfen/i }).click();
  const cart = page.getByRole('dialog', { name: /Artikel/i });
  await expect(cart).toBeVisible();
  await expect(cart.getByText('Franky’s Smash Burger', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(cart).toBeHidden();

  await page.getByRole('button', { name: /Bestellung prüfen/i }).click();
  await page.getByRole('button', { name: /Weiter zur Zahlung/i }).click();
  const crossSell = page.getByRole('dialog', { name: /Willst du noch was/i });
  await expect(crossSell).toBeVisible();
  await crossSell.getByRole('button', { name: /Truffle Fries/i }).click();
  await crossSell.getByRole('button', { name: /Perfekt, weiter/i }).click();

  const payment = page.getByRole('dialog', { name: /Gesamtbetrag/i });
  await expect(payment).toBeVisible();
  await payment.getByRole('button', { name: /Karte/i }).click();

  await expect(page.getByRole('heading', { name: 'Deine Bestellung ist fertig' })).toBeVisible();
  await expect(page.getByText('#QA42')).toBeVisible();
  await expect(page.getByText('19,80 €')).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => (
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  ));
  expect(hasHorizontalOverflow).toBe(false);
  expect(browserErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath('table-order-complete.png'),
    fullPage: true,
  });
});

test('configured item options remain usable with touch-sized controls', async ({ page }) => {
  await page.goto('/t/qa-preview');
  await page.getByRole('button', { name: /Açaí Power Bowl/i }).click();

  const itemDialog = page.getByRole('dialog', { name: 'Açaí Power Bowl' });
  await expect(itemDialog).toBeVisible();
  await itemDialog.getByRole('button', { name: /Protein Açaí/i }).click();
  await itemDialog.getByRole('button', { name: /Pistaziensauce/i }).click();
  await itemDialog.getByRole('button', { name: /Hinzufügen/i }).click();

  await expect(page.getByRole('button', { name: /Bestellung prüfen/i })).toBeVisible();
  const undersizedTargets = await page.locator('[data-testid="table-order-storefront"] button:visible').evaluateAll((buttons) => (
    buttons
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { label: button.getAttribute('aria-label') ?? button.textContent?.trim(), width: rect.width, height: rect.height };
      })
      .filter((target) => target.width < 44 || target.height < 44)
  ));
  expect(undersizedTargets).toEqual([]);
});
