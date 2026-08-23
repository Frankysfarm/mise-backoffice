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

test('cashier completes a seat cash plus SumUp split payment exactly once', async ({ page }) => {
  const browserErrors: string[] = [];
  const actions: Array<Record<string, any>> = [];
  let confirmCalls = 0;
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  const lineItems = [
    { id: '00000000-0000-4000-8000-000000000411', name: 'Gast 1', quantity: 1, seat: 1, totalCents: 300, remainingCents: 300 },
    { id: '00000000-0000-4000-8000-000000000412', name: 'Gast 2', quantity: 1, seat: 2, totalCents: 390, remainingCents: 390 },
  ];
  const openSplit = {
    splitSessionId: '00000000-0000-4000-8000-000000000401',
    transactionId: '00000000-0000-4000-8000-000000000402',
    orderId: '00000000-0000-4000-8000-000000000403',
    orderNumber: 'QA-SPLIT-1', bonToken: null,
    totalCents: 690, paidCents: 0, remainingCents: 690,
    status: 'open', completed: false, lineItems, payments: [],
  };
  const cashSplit = {
    ...openSplit, paidCents: 300, remainingCents: 390,
    lineItems: [{ ...lineItems[0], remainingCents: 0 }, lineItems[1]],
    payments: [{ id: '00000000-0000-4000-8000-000000000421', method: 'bar', amountCents: 300 }],
  };
  const completedSplit = {
    ...cashSplit, bonToken: 'qa-split-bon', paidCents: 690, remainingCents: 0,
    status: 'paid', completed: true, tseActive: true,
    lineItems: cashSplit.lineItems.map((item) => ({ ...item, remainingCents: 0 })),
    payments: [...cashSplit.payments, { id: '00000000-0000-4000-8000-000000000422', method: 'sumup', amountCents: 390 }],
  };

  await page.route('**/api/pos/split', async (route) => {
    const body = route.request().postDataJSON() as Record<string, any>;
    actions.push(body);
    if (body.action === 'begin') {
      expect(route.request().headers()['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/i);
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, split: openSplit }) });
    }
    if (body.action === 'cash') {
      expect(body).toMatchObject({
        splitSessionId: openSplit.splitSessionId,
        scope: { mode: 'seat', seat: 1 },
        cashReceivedCents: 300,
      });
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, split: cashSplit }) });
    }
    if (body.action === 'create_provider') {
      expect(body).toMatchObject({
        provider: 'sumup', splitSessionId: openSplit.splitSessionId,
        scope: { mode: 'amount', amountCents: 390 },
      });
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({
        ok: true, paymentAttemptId: '00000000-0000-4000-8000-000000000422',
        checkoutUrl: null, providerStatus: 'PENDING',
      }) });
    }
    if (body.action === 'confirm_provider') {
      confirmCalls += 1;
      if (confirmCalls === 1) {
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Zahlungsstatus vorübergehend nicht erreichbar' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        ok: true, status: 'confirmed', split: completedSplit,
      }) });
    }
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'unexpected test action' }) });
  });

  await page.goto('/pos/qa-preview');
  await page.getByRole('button', { name: 'Counter', exact: true }).click();
  await page.getByRole('button', { name: /Iced Matcha/i }).first().click();
  await page.getByRole('button', { name: /Kassieren ·/i }).click();
  await page.getByRole('button', { name: /Split/i }).click();
  await expect(page.getByText('Noch offen')).toBeVisible();

  await page.getByRole('tab', { name: 'Sitz / Gast' }).click();
  await page.getByRole('button', { name: '1', exact: true }).click();
  await page.getByRole('button', { name: 'Bar', exact: true }).click();
  await expect(page.getByText(/Bar verbucht/)).toBeVisible();
  await expect(page.getByText('3,90 €', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: 'Betrag' }).click();
  await page.getByRole('button', { name: 'SumUp', exact: true }).click();
  await expect(page.getByText('Zahlungsstatus vorübergehend nicht erreichbar', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zahlungsstatus erneut prüfen' }).click();
  await expect(page.getByText('Zahlung erfolgreich')).toBeVisible();
  await expect(page.getByText(/QA-SPLIT-1/)).toBeVisible();
  expect(actions.map((body) => body.action)).toEqual(['begin', 'cash', 'create_provider', 'confirm_provider', 'confirm_provider']);
  expect(browserErrors.filter((message) => !message.includes('status of 503'))).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
