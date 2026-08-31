import { expect, test } from '@playwright/test';

test('Bewerber absolviert einen mobilen Bewerbungstest', async ({ page }) => {
  await page.route('**/api/application-assessments/public/demo-token', async (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { session: { candidate: { vorname: 'Mira' }, template: { name: 'Barista-Test', description: 'Kurzer Wissenstest' } }, questions: [{ id: 'session-item-1', question: 'Wann wäschst du deine Hände?', multiple: false, options: [{ id: 'a', label: 'Vor Arbeitsbeginn' }, { id: 'b', label: 'Nie' }] }] } });
    return route.fulfill({ json: { result: { passed: true, score_percent: 100, outcome_message: 'Bestanden – wir melden uns.' } } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/bewerbungstest/demo-token');
  await expect(page.getByRole('heading', { name: 'Barista-Test' })).toBeVisible();
  await page.getByText('Vor Arbeitsbeginn').click();
  await page.getByRole('button', { name: 'Antworten verbindlich abgeben' }).click();
  await expect(page.getByRole('heading', { name: 'Vielen Dank!' })).toBeVisible();
  await expect(page.getByText('Bestanden – wir melden uns.')).toBeVisible();
});
