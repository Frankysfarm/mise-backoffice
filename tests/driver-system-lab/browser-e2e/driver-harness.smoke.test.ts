import assert from "node:assert/strict"
import { mkdir, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { chromium } from "playwright"
import { createTestRunId } from "../support/environment"
import { DRIVER_HARNESS_HTML } from "./harness"

test("real Chromium clicks the synthetic driver lifecycle and retains visual evidence", async (testContext) => {
  if (process.env.MISE_TEST_LAB_BROWSER !== "true") {
    return testContext.skip("requires explicit MISE_TEST_LAB_BROWSER=true")
  }
  const runId = createTestRunId(new Date("2026-08-02T00:00:00.000Z"), "00000000-0000-4000-8000-000000000001")
  const artifactDirectory = join(tmpdir(), "mise-driver-system-lab", runId)
  const screenshot = join(artifactDirectory, "driver-harness-delivered.png")
  const trace = join(artifactDirectory, "driver-harness-trace.zip")
  await mkdir(artifactDirectory, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true })
  const page = await context.newPage()
  try {
    await page.setContent(DRIVER_HARNESS_HTML)
    await assertExactlyOne(page.getByTestId("test-only-harness"))
    assert.equal(await page.getByTestId("test-only-harness").getAttribute("data-system-under-test"), "synthetic-browser-harness")

    await page.getByTestId("accept").click()
    await assertStatus(page, "angenommen")

    const navigate = page.getByTestId("navigate")
    assert.equal(await navigate.isDisabled(), true, "route must stay disabled before every required item is picked")
    await page.getByTestId("pick-0").click()
    assert.equal(await navigate.isDisabled(), true)
    await page.getByTestId("pick-1").click()
    assert.equal(await navigate.isEnabled(), true)
    await assertExactlyOne(navigate)
    await navigate.click()
    await assertStatus(page, "unterwegs")

    await assertExactlyOne(page.getByTestId("arrive"))
    await page.getByTestId("arrive").click()
    await assertStatus(page, "angekommen")
    await assertExactlyOne(page.getByTestId("deliver"))
    await page.getByTestId("deliver").click()
    await assertStatus(page, "zugestellt")
    assert.equal(await page.getByTestId("deliver").isHidden(), true)
    await page.screenshot({ path: screenshot, fullPage: true })
  } finally {
    await context.tracing.stop({ path: trace })
    await context.close()
    await browser.close()
  }

  assert.ok((await stat(screenshot)).size > 0, "screenshot evidence must be non-empty")
  assert.ok((await stat(trace)).size > 0, "trace evidence must be non-empty")
  console.log(JSON.stringify({ kind: "synthetic-browser-harness-evidence", runId, screenshot, trace }))
})

async function assertExactlyOne(locator: { count(): Promise<number> }): Promise<void> {
  assert.equal(await locator.count(), 1)
}

async function assertStatus(page: { getByTestId(id: string): { textContent(): Promise<string | null> } }, expected: string): Promise<void> {
  assert.equal(await page.getByTestId("status").textContent(), expected)
}
