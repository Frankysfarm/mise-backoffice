import assert from "node:assert/strict"
import { mkdir, stat } from "node:fs/promises"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"

test("real Chromium accepts an offer in the production Driver component", async (context) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== "true" || !process.env.MISE_TEST_LAB_APP_URL) return context.skip("requires explicit local test-lab app URL")
  const baseUrl = new URL(process.env.MISE_TEST_LAB_APP_URL)
  if (!["localhost", "127.0.0.1"].includes(baseUrl.hostname)) throw new Error("driver E2E permits localhost only")
  const mockOrigin = "http://127.0.0.1:54321"
  const tileOrigins = new Set(["https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org"])
  const allowedHttp = new Set([baseUrl.origin, mockOrigin, ...tileOrigins])
  const appWs = new URL(baseUrl); appWs.protocol = appWs.protocol === "https:" ? "wss:" : "ws:"
  const allowedWs = new Set([appWs.origin, "ws://127.0.0.1:54321"])
  const root = process.env.MISE_TEST_LAB_ARTIFACT_ROOT ?? "artifacts/driver-system-lab/driver-component"
  await mkdir(root, { recursive: true })
  const screenshot = join(root, "driver-offer-accepted.png")
  const trace = join(root, "driver-trace.zip")
  const browser = await chromium.launch({ headless: process.env.MISE_TEST_LAB_HEADED !== "true" })
  const browserContext = await browser.newContext({ serviceWorkers: "block" })
  const syntheticSession = {
    access_token: "synthetic-driver-access", refresh_token: "synthetic-driver-refresh", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "a1000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated" },
  }
  const encodedSession = Buffer.from(JSON.stringify(syntheticSession), "utf8")
    .toString("base64url")
  await browserContext.addCookies([{
    name: "sb-127-auth-token", value: `base64-${encodedSession}`,
    url: baseUrl.origin, sameSite: "Lax",
  }])
  await browserContext.addInitScript(() => {
    if (!localStorage.getItem("mise-driver:canonical-offer:v1")) {
      localStorage.setItem("mise-driver:canonical-offer:v1", JSON.stringify({
        offerId: "a6000000-0000-4000-8000-000000000001", assignmentVersion: 1,
        batchId: "a4000000-0000-4000-8000-000000000001", transitionKeys: {},
      }))
    }
  })
  await browserContext.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await browserContext.newPage()
  const external: string[] = []
  const pageErrors: string[] = []
  const dialogs: string[] = []
  let accepted: { body: unknown; authorization?: string } | null = null
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message))
  page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss() })
  await page.routeWebSocket("**/*", (socket) => {
    const target = new URL(socket.url()); if (!allowedWs.has(target.origin)) external.push(target.origin); socket.close()
  })
  await page.route("**/*", async (route) => {
    const request = route.request(); const target = new URL(request.url())
    if (!allowedHttp.has(target.origin)) { external.push(target.origin); await route.abort("blockedbyclient"); return }
    if (tileOrigins.has(target.origin)) {
      await route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8byWQAAAABJRU5ErkJggg==", "base64",
      ) }); return
    }
    if (target.pathname === "/api/driver/v1/orders/accept" && request.method() === "POST") {
      accepted = { body: request.postDataJSON(), authorization: request.headers().authorization }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true, offer_id: "a6000000-0000-4000-8000-000000000001", assignment_version: 2,
      }) }); return
    }
    if (target.origin === mockOrigin) {
      await route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, contentType: "application/json", body: "[]" }); return
    }
    if (target.pathname.startsWith("/api/driver/v2/")) {
      await route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ ok: false, reason_code: "SYNTHETIC_SNAPSHOT_UNAVAILABLE" }) }); return
    }
    if (target.pathname.startsWith("/api/")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" }); return
    }
    await route.continue()
  })
  try {
    const response = await page.goto(new URL("/test-lab/actors/driver", baseUrl).toString(), { waitUntil: "domcontentloaded" })
    assert.equal(response?.status(), 200)
    const acceptButton = page.getByTestId("driver-accept-a4000000-0000-4000-8000-000000000001")
    await acceptButton.waitFor({ state: "visible" })
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="driver-accept-a4000000-0000-4000-8000-000000000001"]') as HTMLButtonElement | null
      return button && !button.disabled && document.documentElement.dataset.miseDriverOfferListenerReady === "true"
    })
    await page.evaluate(() => {
      // The storage removal makes the following assertion prove that the
      // hydrated native-offer listener, not addInitScript, handled the event.
      localStorage.removeItem("mise-driver:canonical-offer:v1")
      window.dispatchEvent(new CustomEvent("mise-driver-offer-integrated", { detail: {
        offer_id: "a6000000-0000-4000-8000-000000000001",
        assignment_version: 1,
        batch_id: "a4000000-0000-4000-8000-000000000001",
      } }))
    })
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("mise-driver:canonical-offer:v1")
      if (!raw) return false
      const offer = JSON.parse(raw)
      return offer.offerId === "a6000000-0000-4000-8000-000000000001" && offer.assignmentVersion === 1
    })
    await acceptButton.click()
    await page.waitForFunction(() => {
      const raw = localStorage.getItem("mise-driver:canonical-offer:v1")
      return raw ? JSON.parse(raw).assignmentVersion === 2 : false
    })
    assert.deepEqual(accepted, {
      body: { action: "accept", offer_id: "a6000000-0000-4000-8000-000000000001", assignment_version: 1,
        transition_key: (accepted as { body?: { transition_key?: string } } | null)?.body?.transition_key },
      authorization: "Bearer synthetic-driver-access",
    })
    assert.match((accepted as { body: { transition_key: string } }).body.transition_key, /^[0-9a-f-]{36}$/i)
    assert.equal(page.url(), new URL("/test-lab/actors/driver", baseUrl).toString())
    assert.deepEqual(external, [])
    assert.deepEqual(pageErrors, [])
    assert.deepEqual(dialogs, [])
    await page.screenshot({ path: screenshot, fullPage: true })
  } finally {
    await browserContext.tracing.stop({ path: trace }); await browserContext.close(); await browser.close()
  }
  assert.ok((await stat(screenshot)).size > 0); assert.ok((await stat(trace)).size > 0)
})
