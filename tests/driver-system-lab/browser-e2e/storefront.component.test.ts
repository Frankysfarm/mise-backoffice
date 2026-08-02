import assert from "node:assert/strict"
import { mkdir, stat } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

test("real Chromium completes the production BISS Storefront component", async (context) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== "true" || !process.env.MISE_TEST_LAB_APP_URL) return context.skip("requires explicit local test-lab app URL")
  const baseUrl = new URL(process.env.MISE_TEST_LAB_APP_URL)
  if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("storefront E2E permits localhost only")
  const mockedSupabaseOrigin = "http://127.0.0.1:54321"
  const allowedHttpOrigins = new Set([baseUrl.origin, mockedSupabaseOrigin])
  const baseWebSocketUrl = new URL(baseUrl)
  baseWebSocketUrl.protocol = baseWebSocketUrl.protocol === "https:" ? "wss:" : "ws:"
  const allowedWebSocketOrigins = new Set([baseWebSocketUrl.origin, "ws://127.0.0.1:54321"])
  const root = process.env.MISE_TEST_LAB_ARTIFACT_ROOT ?? "artifacts/driver-system-lab/storefront-component"
  await mkdir(root, { recursive: true })
  const screenshot = join(root, "storefront-order-success.png")
  const trace = join(root, "storefront-trace.zip")
  const browser = await chromium.launch({ headless: process.env.MISE_TEST_LAB_HEADED !== "true" })
  const browserContext = await browser.newContext()
  await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await browserContext.newPage()
  const pageErrors: string[] = []
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message))
  await page.routeWebSocket("**/*", (socket) => {
    const target = new URL(socket.url())
    if (!allowedWebSocketOrigins.has(target.origin)) external.push(target.origin)
    socket.close()
  })
  const external: string[] = []
  let posted: unknown
  await page.route("**/*", async (route) => {
    const request = route.request()
    const target = new URL(request.url())
    if (!allowedHttpOrigins.has(target.origin)) {
      external.push(target.origin)
      await route.abort("blockedbyclient")
    } else if (target.hostname === "127.0.0.1" && target.port === "54321") {
      await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "[]" })
    } else if (target.pathname === "/api/delivery/orders" && request.method() === "POST") {
      posted = request.postDataJSON()
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "testlab-order-1", bestellnummer: "TL-1001" }) })
    } else if (target.pathname === "/api/delivery/public/eta") {
      // A malformed successful response must degrade safely, never crash checkout.
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eta_min: 30 }) })
    } else if (target.pathname === "/api/delivery/eta/live") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ eta_min: 30, load: "normal", drivers_online: 2 }) })
    } else if (target.pathname.startsWith("/api/delivery/")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "neu", eta_min: 30 }) })
    } else {
      await route.continue()
    }
  })
  try {
    const response = await page.goto(new URL("/test-lab/actors/storefront", baseUrl).toString())
    assert.equal(response?.status(), 200)
    await page.waitForLoadState("networkidle")
    await page.getByTestId("storefront-live-eta-minutes").getByText("25", { exact: true }).waitFor()
    await page.getByTestId("storefront-add-testlab-item-bowl").click()
    await page.getByTestId("storefront-open-cart").click()
    await page.getByTestId("storefront-checkout").click()
    await page.getByTestId("storefront-customer-name").fill("Testkunde Eins")
    await page.getByTestId("storefront-customer-phone").fill("synthetic:phone-1")
    await page.getByTestId("storefront-customer-address").fill("Laborstraße 2, Berlin")
    await page.getByTestId("storefront-submit-order").click()
    await page.getByTestId("storefront-order-success").waitFor()
    await page.getByText("#TL-1001", { exact: true }).first().waitFor()
    assert.deepEqual(external, [])
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(posted, {
      location_id: "testlab-location-a",
      items: [{ id: "testlab-item-bowl", name: "Test Bowl", qty: 1, price: 12.5 }],
      customer: { name: "Testkunde Eins", phone: "synthetic:phone-1", address: "Laborstraße 2, Berlin" },
      type: "lieferung",
      payment_method: "bar",
    })
    await page.evaluate(async () => {
      await fetch("http://localhost:9/testlab-egress-probe").catch(() => undefined)
      await new Promise<void>((resolve) => {
        const socket = new WebSocket("ws://localhost:9/testlab-egress-probe")
        socket.addEventListener("close", () => resolve(), { once: true })
        socket.addEventListener("error", () => resolve(), { once: true })
        setTimeout(resolve, 1_000)
      })
    })
    assert.deepEqual(external.sort(), ["http://localhost:9", "ws://localhost:9"])
    await page.screenshot({ path: screenshot, fullPage: true })
  } finally {
    await browserContext.tracing.stop({ path: trace })
    await browserContext.close()
    await browser.close()
  }
  assert.ok((await stat(screenshot)).size > 0)
  assert.ok((await stat(trace)).size > 0)
})
