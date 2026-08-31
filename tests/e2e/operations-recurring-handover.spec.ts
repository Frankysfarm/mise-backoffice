import { test, expect } from '@playwright/test';

test.describe('wiederkehrende Aufgaben und Übergaben', () => {
  test.skip(!process.env.E2E_AUTH_STATE, 'Benötigt authentifizierten Manager und Backend; Spezifikation ist für die Persona-Abnahme bereit.');
  test.use({ storageState: process.env.E2E_AUTH_STATE });

  test('Regel anlegen, Vorschau sehen und materialisieren', async ({ page }) => {
    await page.goto('/neo/app/ablaeufe/aufgaben');
    await page.getByRole('button', { name: 'Neue Regel' }).click();
    await page.getByLabel('Titel').locator('input').fill('Bar täglich prüfen');
    await expect(page.getByText('Nächste Fälligkeiten')).toBeVisible();
    await page.getByRole('button', { name: 'Regel speichern' }).click();
    await page.getByRole('button', { name: 'Jetzt erzeugen' }).click();
    await expect(page.getByText('Nächste Fälligkeiten wurden erzeugt.')).toBeVisible();
  });

  test('Übergabe erstellen, lesen und bestätigen', async ({ page }) => {
    await page.goto('/neo/app/ablaeufe/aufgaben');
    await page.getByRole('button', { name: 'Übergabe erstellen' }).click();
    await page.getByLabel('Folgeschicht / Person').locator('select').selectOption({ index: 1 });
    await page.getByLabel('Wichtige Hinweise').locator('textarea').fill('Kühlung prüfen');
    await page.getByRole('button', { name: 'Übergabe verbindlich senden' }).click();
    await page.getByRole('button', { name: 'Übergabe-Audit' }).click();
    await expect(page.getByText(/Bestätigung offen|Ungelesen/).first()).toBeVisible();
  });
});
