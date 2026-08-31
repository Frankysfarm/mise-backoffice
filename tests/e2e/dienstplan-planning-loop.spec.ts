import { test, expect } from '@playwright/test';

test.describe('Dienstplan Planungsrunde', () => {
  test.skip(!process.env.E2E_AUTH_STATE, 'Benötigt authentifizierten Manager- und Mitarbeiter-State gegen eine Testdatenbank.');

  test('Vorlage → Woche → Verfügbarkeit → Vorschlag → Veröffentlichung → Mitarbeitersicht', async ({ browser }) => {
    const manager = await browser.newContext({ storageState: process.env.E2E_AUTH_STATE });
    const page = await manager.newPage();
    await page.goto('/neo/app/dienstplan/templates');
    await expect(page.getByRole('heading', { name: 'Wochenvorlagen' })).toBeVisible();
    await page.getByLabel('Name').fill('E2E Servicewoche');
    await page.getByLabel('Position').fill('Service');
    await page.getByLabel('Benötigte Personen').fill('1');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.goto('/neo/app/dienstplan');
    await page.getByLabel('Vorlage').selectOption({ label: 'E2E Servicewoche' });
    await page.getByRole('button', { name: 'Vorlage anwenden' }).click();
    await page.getByRole('button', { name: 'Verfügbarkeit anfragen' }).click();
    await page.getByRole('button', { name: 'Vorschläge berechnen' }).click();
    await page.getByRole('button', { name: 'Dienstplan veröffentlichen' }).click();
    await page.goto('/mitarbeiter#dienstplan');
    await expect(page.getByRole('heading', { name: 'Meine nächsten Schichten' })).toBeVisible();
    await manager.close();
  });
});
