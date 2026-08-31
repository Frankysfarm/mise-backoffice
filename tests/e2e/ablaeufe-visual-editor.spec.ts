import { expect, test } from '@playwright/test';

test.describe('Ablauf-Editor und geführte Checkliste', () => {
  test.skip(true, 'Benötigt authentifizierte Supabase-Daten; die Factory hat laut Koordination keine .env und keine Datenbank.');
  test('Owner erstellt drei Schritte und Mitarbeitende schließen Pflichtnachweise ab', async ({ page }) => {
    await page.goto('/neo/app/ablaeufe/schichtleitfaeden');
    await page.getByRole('link', { name: /Barista/ }).click();
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click();
    await page.getByRole('button', { name: 'Ablauf speichern' }).click();
    await page.getByRole('link', { name: 'Starten' }).click();
    await expect(page.getByRole('button', { name: 'Ablauf abschließen' })).toBeDisabled();
  });
});
