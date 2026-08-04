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
  const mutations: Array<{ pathname: string; body: unknown }> = []
  let finishAttempts = 0
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
    } else if (target.origin === baseUrl.origin && target.pathname.includes("/kitchen/display/testlab-kitchen-token/items/")) {
      const body = request.postDataJSON()
      mutations.push({ pathname: target.pathname, body })
      if ((body as { target_status?: string }).target_status === "fertig") {
          const attempt = finishAttempts++
          if (attempt === 0) {
            await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, reason_code: "KITCHEN_UNAVAILABLE" }) })
            return
          }
          if (attempt === 1) {
            await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, reason_code: "STALE_ITEM_STATUS" }) })
            return
          }
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) })
    } else if (target.origin === mockedSupabaseOrigin) {
      await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-profile": "public" }, contentType: "application/json", body: JSON.stringify([{ id: "testlab-kitchen-item-1" }]) })
    } else {
      await route.continue()
    }
  })
  try {
    const response = await page.goto(new URL("/test-lab/actors/kitchen", baseUrl).toString(), { waitUntil: "domcontentloaded" })
    assert.equal(response?.status(), 200)
    await page.waitForLoadState("networkidle")
    await page.getByTestId("kitchen-start-60000000-0000-4000-8000-000000000001").click()
    await page.getByTestId("kitchen-finish-60000000-0000-4000-8000-000000000001").click()
    await page.getByTestId("kitchen-mutation-error").waitFor()
    await page.getByTestId("kitchen-order-70000000-0000-4000-8000-000000000001").waitFor()
    const staleResponse = page.waitForResponse((response) => response.request().method() === "POST" && response.status() === 409)
    await page.getByTestId("kitchen-finish-60000000-0000-4000-8000-000000000001").click()
    await staleResponse
    await page.getByTestId("kitchen-mutation-error").waitFor()
    await page.getByTestId("kitchen-order-70000000-0000-4000-8000-000000000001").waitFor()
    await page.getByTestId("kitchen-finish-60000000-0000-4000-8000-000000000001").click()
    await page.getByText("Alles erledigt.", { exact: true }).waitFor()
    assert.deepEqual(mutations, [
      { pathname: "/kitchen/display/testlab-kitchen-token/items/60000000-0000-4000-8000-000000000001/advance", body: { expected_status: "offen", target_status: "in_arbeit" } },
      { pathname: "/kitchen/display/testlab-kitchen-token/items/60000000-0000-4000-8000-000000000001/advance", body: { expected_status: "in_arbeit", target_status: "fertig" } },
      { pathname: "/kitchen/display/testlab-kitchen-token/items/60000000-0000-4000-8000-000000000001/advance", body: { expected_status: "in_arbeit", target_status: "fertig" } },
      { pathname: "/kitchen/display/testlab-kitchen-token/items/60000000-0000-4000-8000-000000000001/advance", body: { expected_status: "in_arbeit", target_status: "fertig" } },
    ])
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
