import { expect, test } from "@playwright/test";

test("warehouse plan and mobile scan surfaces stay protected", async ({
  page,
}) => {
  for (const path of [
    "/neo/app/lager/plan",
    "/neo/app/lager/platz/00000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(path)}`),
    );
  }
});

test("warehouse stock API rejects unauthenticated writes", async ({ request }) => {
  const response = await request.post("/api/inventory/warehouse", {
    data: { intent: "stock-action" },
    maxRedirects: 0,
  });
  expect([307, 401]).toContain(response.status());
});
