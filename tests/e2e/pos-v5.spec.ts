import { expect, test } from '@playwright/test';

test('cashier completes a real atomic cash-sale request from POS v5', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  let checkoutBody: Record<string, any> | null = null;
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.route('**/api/pos/checkout', async (route) => {
    const key = route.request().headers()['idempotency-key'];
    expect(key).toMatch(/^[0-9a-f-]{36}$/i);
    checkoutBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201, contentType: 'application/json',
      body: JSON.stringify({
        ok: true, transactionId: '00000000-0000-4000-8000-000000000201',
        orderId: '00000000-0000-4000-8000-000000000202', orderNumber: 'QA-1001',
        bonToken: 'qa-bon-token', bonNumber: 'QA-BON-1', amountCents: 1150,
        changeCents: 0, idempotent: false, tseActive: true,
      }),
    });
  });

  const response = await page.goto('/pos/qa-preview');
  expect(response?.status()).toBe(200);
  await page.getByRole('button', { name: 'Counter', exact: true }).click();
  await page.getByRole('button', { name: /Açaí Power Bowl/i }).first().click();
  await page.getByRole('button', { name: /Normal/i }).click();
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByRole('button', { name: /Kassieren ·/i }).click();
  await page.getByRole('button', { name: /Bar/i }).click();
  await page.getByRole('button', { name: 'passend' }).click();
  await page.getByRole('button', { name: /^Bestätigen/ }).click();

  await expect(page.getByText('Zahlung erfolgreich')).toBeVisible();
  await expect(page.getByText(/QA-1001/)).toBeVisible();
  expect(checkoutBody).toMatchObject({
    fulfillment: 'counter', paymentMethod: 'bar',
    registerId: '00000000-0000-4000-8000-000000000004',
    shiftId: '00000000-0000-4000-8000-000000000005',
    items: [{ id: '00000000-0000-4000-8000-000000000101', qty: 1, selections: { size: 'regular' } }],
  });
  expect(browserErrors).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('pos-cash-success.png'), fullPage: true });
});

test('confirmed SumUp checkout is verified before the sale becomes successful', async ({ page }) => {
  let finalCheckout: Record<string, any> | null = null;
  await page.route('**/api/pos/sumup/checkout*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, checkoutId: 'sumup-qa-1', status: 'PENDING', amountCents: 690 }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, status: 'PAID' }) });
    }
  });
  await page.route('**/api/pos/checkout', async (route) => {
    finalCheckout = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
      ok: true, transactionId: '00000000-0000-4000-8000-000000000301',
      orderId: '00000000-0000-4000-8000-000000000302', orderNumber: 'QA-CARD-1',
      bonToken: 'qa-card-bon', amountCents: 690, changeCents: 0, tseActive: true,
    }) });
  });
  await page.goto('/pos/qa-preview');
  await page.getByRole('button', { name: 'Counter', exact: true }).click();
  await page.getByRole('button', { name: /Iced Matcha/i }).first().click();
  await page.getByRole('button', { name: /Kassieren ·/i }).click();
  await page.getByRole('button', { name: /SumUp/i }).click();
  await expect(page.getByText('Zahlung erfolgreich')).toBeVisible();
  expect(finalCheckout).toMatchObject({ paymentMethod: 'karte', sumupCheckoutId: 'sumup-qa-1', fulfillment: 'counter' });
});
test('unpaired SumUp flow fails closed and never claims payment success', async ({ page }) => {
  await page.route('**/api/pos/sumup/checkout*', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'SumUp ist nicht eingerichtet' }),
  }));
  await page.goto('/pos/qa-preview');
  await page.getByRole('button', { name: 'Counter', exact: true }).click();
  await page.getByRole('button', { name: /Iced Matcha/i }).first().click();
  await page.getByRole('button', { name: /Kassieren ·/i }).click();
  await page.getByRole('button', { name: /SumUp/i }).click();
  await expect(page.getByText('Kartenzahlung nicht abgeschlossen')).toBeVisible();
  await expect(page.getByText('SumUp ist nicht eingerichtet')).toBeVisible();
  await expect(page.getByText('Zahlung erfolgreich')).toBeHidden();
});
