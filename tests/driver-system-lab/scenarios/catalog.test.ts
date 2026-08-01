import assert from "node:assert/strict"
import test from "node:test"
import { scenarioCatalog, scenariosForSuite } from "./catalog"

test("catalog contains at least 75 unique named core scenarios and every mandatory category", () => {
  assert.ok(scenarioCatalog.length >= 75)
  assert.equal(new Set(scenarioCatalog.map(({ id }) => id)).size, scenarioCatalog.length)
  for (const suite of ["smoke", "bundle", "kitchen", "departure", "routing", "push", "lifecycle", "device", "race", "security", "soak"]) {
    assert.ok(scenarioCatalog.some((item) => item.suite === suite), `missing ${suite}`)
  }
})

test("suite aliases select deterministic non-empty subsets", () => {
  assert.deepEqual(scenariosForSuite("dispatch"), scenariosForSuite("dispatch"))
  assert.ok(scenariosForSuite("ui").length > 0)
})
