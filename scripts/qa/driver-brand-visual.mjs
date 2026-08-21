#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE = 'https://mise-gastro.de';
const LOCATION_ID = '3e00a63f-8d6c-4021-880e-76ef5d20acc6';
const QA_EMAILS = [1, 2, 3, 4].map((n) => `qa.saturday.driver${n}@mise-gastro.de`);
const OUTPUT = '/private/tmp/mise-delivery-visual-qa';

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
const qrSecret = process.env.DELIVERY_PICKUP_QR_SECRET || process.env.DRIVER_OTP_SECRET;
if (!url || !serviceKey || !qrSecret) throw new Error('Visual QA environment is incomplete');
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const passwordFor = (email) => `Qa!${createHash('sha256').update(`${qrSecret}:${email}`).digest('base64url').slice(0, 24)}`;

mkdirSync(OUTPUT, { recursive: true });
const report = { output: OUTPUT, screens: [], consoleErrors: [], pageErrors: [], failedResponses: [] };

function watch(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') report.consoleErrors.push({ label, text: message.text().slice(0, 500) });
  });
  page.on('pageerror', (error) => report.pageErrors.push({ label, text: error.message.slice(0, 500) }));
  page.on('response', (response) => {
    if (response.status() >= 400) report.failedResponses.push({ label, status: response.status(), url: response.url().replace(/[?#].*$/, '') });
  });
}

async function metrics(page, label) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const touchViolations = [...document.querySelectorAll('button, a[href], input')]
      .map((element) => {
        const ownRect = element.getBoundingClientRect();
        const labelRect = element.tagName === 'INPUT' ? element.closest('label')?.getBoundingClientRect() : null;
        const rect = labelRect && labelRect.width > 0 && labelRect.height > 0 ? labelRect : ownRect;
        const style = getComputedStyle(element);
        return {
          element: element.tagName.toLowerCase(),
          label: (element.getAttribute('aria-label') || element.textContent || element.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
        };
      })
      .filter((item) => item.visible && (item.width < 44 || item.height < 44));
    const drive = document.querySelector('.drive');
    const driveStyle = drive ? getComputedStyle(drive) : null;
    return {
      viewportWidth,
      documentWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > viewportWidth + 1,
      touchViolations,
      h1: [...document.querySelectorAll('h1,h2')].map((node) => (node.textContent || '').trim()).filter(Boolean).slice(0, 12),
      palette: driveStyle ? {
        accent: driveStyle.getPropertyValue('--accent').trim(),
        background: driveStyle.getPropertyValue('--bg').trim(),
        surface: driveStyle.getPropertyValue('--surface').trim(),
        ink: driveStyle.getPropertyValue('--ink').trim(),
        secondaryInk: driveStyle.getPropertyValue('--ink-2').trim(),
      } : null,
    };
  });
  return { label, ...result };
}

async function login(page, email) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto(`${BASE}/fahrer/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(passwordFor(email));
    await page.locator('button[type="submit"]').click();
    try {
      await page.waitForURL(/\/fahrer\/app/, { timeout: 30_000 });
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await page.waitForTimeout(2_000);
    }
  }
  if (lastError) {
    const safeName = email.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    await page.screenshot({ path: `${OUTPUT}/login-failure-${safeName}.png`, fullPage: true });
    const visibleText = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1_000);
    throw new Error(`Driver login did not reach the app: ${visibleText}`, { cause: lastError });
  }
  await page.locator('header').waitFor({ state: 'visible', timeout: 30_000 });
  await page.waitForTimeout(500);
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

try {
  const loginContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const loginPage = await loginContext.newPage();
  watch(loginPage, 'driver-login');
  await loginPage.goto(`${BASE}/fahrer/login`, { waitUntil: 'domcontentloaded' });
  await loginPage.locator('button[type="submit"]').waitFor({ state: 'visible' });
  await loginPage.screenshot({ path: `${OUTPUT}/driver-login-390.png`, fullPage: true });
  report.screens.push(await metrics(loginPage, 'driver-login-390'));
  await loginContext.close();

  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      deviceScaleFactor: 1,
      geolocation: { latitude: 50.772, longitude: 6.1245 },
      permissions: ['geolocation', 'notifications', 'camera'],
    });
    const page = await context.newPage();
    watch(page, `driver-planned-${width}`);
    await login(page, QA_EMAILS[0]);
    await page.screenshot({ path: `${OUTPUT}/driver-planned-${width}.png`, fullPage: true });
    report.screens.push(await metrics(page, `driver-planned-${width}`));
    if (width === 390) {
      await page.getByRole('button', { name: /Beutel scannen/ }).last().click();
      await page.getByRole('dialog', { name: 'Beutel-Übergabe scannen' }).waitFor({ state: 'visible' });
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUTPUT}/driver-scanner-390.png`, fullPage: true });
      report.screens.push(await metrics(page, 'driver-scanner-390'));
    }
    await context.close();
  }

  const driver4 = await service.from('mise_drivers').select('id').eq('email', QA_EMAILS[3]).single();
  if (driver4.error) throw driver4.error;
  await service.from('mise_drivers').update({ dispatch_availability: 'off_duty', availability_reason: null }).eq('id', driver4.data.id);
  const offContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const offPage = await offContext.newPage();
  watch(offPage, 'driver-off-duty-390');
  await login(offPage, QA_EMAILS[3]);
  await offPage.screenshot({ path: `${OUTPUT}/driver-off-duty-390.png`, fullPage: true });
  report.screens.push(await metrics(offPage, 'driver-off-duty-390'));
  await offContext.close();

  const location = await service.from('locations').select('kitchen_token').eq('id', LOCATION_ID).single();
  if (location.error || !location.data.kitchen_token) throw location.error ?? new Error('Kitchen token missing');
  const kitchenContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const kitchenPage = await kitchenContext.newPage();
  watch(kitchenPage, 'kitchen-1440');
  await kitchenPage.goto(`${BASE}/kuche/${encodeURIComponent(location.data.kitchen_token)}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await kitchenPage.getByRole('button', { name: /Bildschirm starten/ }).waitFor({ state: 'visible' });
  await kitchenPage.screenshot({ path: `${OUTPUT}/kitchen-start-1440.png`, fullPage: true });
  await kitchenPage.getByRole('button', { name: /Bildschirm starten/ }).click();
  await kitchenPage.waitForTimeout(4_500);
  await kitchenPage.screenshot({ path: `${OUTPUT}/kitchen-board-1440.png`, fullPage: true });
  report.screens.push(await metrics(kitchenPage, 'kitchen-board-1440'));
  await kitchenContext.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
