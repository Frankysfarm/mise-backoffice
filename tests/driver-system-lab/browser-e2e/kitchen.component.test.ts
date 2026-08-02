import assert from "node:assert/strict"
import { mkdir, stat } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

test("real Chromium advances an item in the production Kitchen component", async (context) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== "true" || !process.env.MISE_TEST_LAB_APP_URL) return context.skip("requires explicit local test-lab app URL")
  const baseUrl = new URL(process.env.MISE_TEST_LAB_APP_URL)
  if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("kitchen E2E permits localhost only")
  const mockedSupabaseOrigin = "http://127.0.0.1:54321"
  const allowedHttpOrigins = new Set([baseUrl.origin, mockedSupabaseOrigin])
  const baseWebSocketUrl = new URL(baseUrl)
  baseWebSocketUrl.protocol = baseWebSocketUrl.protocol === "https:" ? "wss:" : "ws:"
  const allowedWebSocketOrigins = new Set([baseWebSocketUrl.origin, "ws://127.0.0.1:54321"])
  const root = process.env.MISE_TEST_LAB_ARTIFACT_ROOT ?? "artifacts/driver-system-lab/kitchen-component"
  await mkdir(root, { recursive: true })
  const screenshot = join(root, "kitchen-item-finished.png")
  const trace = join(root, "kitchen-trace.zip")
  const browser = await chromium.launch({ headless: process.env.MISE_TEST_LAB_HEADED !== "true" })
  const browserContext = await browser.newContext()
  await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await browserContext.newPage()
  const external: string[] = []
  const pageErrors: string[] = []
  const mutations: unknown[] = []
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message))
  await page.routeWebSocket("**/*", (socket) => {
    const target = new URL(socket.url())
    if (!allowedWebSocketOrigins.has(target.origin)) external.push(target.origin)
    socket.close()
  })
  await page.route("**/*", async (route) => {
    const request = route.request()
    const target = new URL(request.url())
    if (!allowedHttpOrigins.has(target.origin)) {
      external.push(target.origin)
      await route.abort("blockedbyclient")
    } else if (target.origin === mockedSupabaseOrigin) {
      if (request.method() === "PATCH") mutations.push(request.postDataJSON())
      await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-profile": "public" }, contentType: "application/json", body: "[]" })
    } else {
      await route.continue()
    }
  })
  try {
    const response = await page.goto(new URL("/test-lab/actors/kitchen", baseUrl).toString())
    assert.equal(response?.status(), 200)
    await page.waitForLoadState("networkidle")
    await page.getByTestId("kitchen-start-testlab-kitchen-item-1").click()
    await page.getByTestId("kitchen-finish-testlab-kitchen-item-1").click()
    await page.getByText("Alles erledigt.", { exact: true }).waitFor()
    assert.deepEqual(mutations, [{ station_status: "in_arbeit" }, { station_status: "fertig" }])
    assert.deepEqual(external, [])
    assert.deepEqual(pageErrors, [])
    await page.screenshot({ path: screenshot, fullPage: true })
  } finally {
    await browserContext.tracing.stop({ path: trace })
    await browserContext.close()
    await browser.close()
  }
  assert.ok((await stat(screenshot)).size > 0)
  assert.ok((await stat(trace)).size > 0)
})
