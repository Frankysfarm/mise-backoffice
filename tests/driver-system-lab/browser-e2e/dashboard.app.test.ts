import assert from "node:assert/strict"
import { mkdir, stat } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

test("real Chromium operates the guarded Next test-lab dashboard", async (context) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== "true" || !process.env.MISE_TEST_LAB_APP_URL) return context.skip("requires explicit local test-lab app URL")
  const baseUrl = new URL(process.env.MISE_TEST_LAB_APP_URL)
  if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("dashboard E2E permits localhost only")
  const artifactRoot = process.env.MISE_TEST_LAB_ARTIFACT_ROOT ?? "artifacts/driver-system-lab/browser-app"
  await mkdir(artifactRoot, { recursive: true })
  const screenshot = join(artifactRoot, "dashboard-preview.png")
  const trace = join(artifactRoot, "dashboard-trace.zip")
  const browser = await chromium.launch({ headless: true })
  const browserContext = await browser.newContext()
  await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await browserContext.newPage()
  const blockedOrigins: string[] = []
  await page.route("**/*", async (route) => {
    const target = new URL(route.request().url())
    if (!["localhost", "127.0.0.1"].includes(target.hostname)) {
      blockedOrigins.push(target.origin)
      await route.abort("blockedbyclient")
      return
    }
    await route.continue()
  })
  try {
    const response = await page.goto(new URL("/test-lab", baseUrl).toString())
    assert.deepEqual(blockedOrigins, [], `dashboard attempted external navigation: ${blockedOrigins.join(", ")}`)
    assert.equal(response?.status(), 200)
    await page.getByTestId("lab-suite").selectOption("smoke")
    await page.getByTestId("lab-seed").fill("4242")
    await page.getByTestId("lab-headed").check()
    await page.getByTestId("lab-preview").click()
    await page.getByText("5 Szenarien, Seed 4242, headed. Start erfolgt sicher über dieselbe CLI.").waitFor()
    const api = await page.request.get(new URL("/api/test-lab/scenarios", baseUrl).toString())
    assert.equal(api.status(), 200)
    const payload = await api.json() as { productionSelectable: boolean; scenarios: unknown[] }
    assert.equal(payload.productionSelectable, false)
    assert.equal(payload.scenarios.length, 115)
    await page.screenshot({ path: screenshot, fullPage: true })
  } finally {
    await browserContext.tracing.stop({ path: trace })
    await browserContext.close()
    await browser.close()
  }
  assert.ok((await stat(screenshot)).size > 0)
  assert.ok((await stat(trace)).size > 0)
})
