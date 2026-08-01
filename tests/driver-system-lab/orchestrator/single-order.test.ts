import assert from "node:assert/strict"
import test from "node:test"
import { assertTestLabEnvironment } from "../support/environment"
import { runSingleOrderModel } from "./single-order"

const environment = assertTestLabEnvironment({ MISE_TEST_LAB_ENABLED: "true", MISE_TEST_LAB_ENV: "local", MISE_TEST_LAB_DATABASE_URL: "postgresql://lab:lab@localhost/mise_lab", MISE_TEST_LAB_TENANT_ID: "testlab_e2e", MISE_TEST_LAB_RUN_ID: "tl_20260801t120000z_abcdef12", MISE_TEST_LAB_SEED: "7" })

test("single order model remains invariant-safe from storefront to delivery", () => {
  const timeline = runSingleOrderModel(environment)
  assert.deepEqual(timeline.map(({ action }) => action), ["place-order-through-storefront", "dispatch", "release-and-driver-pick", "persist-google-contract-route", "depart", "deliver"])
  assert.equal(timeline.at(-1)?.snapshot.orders[0].status, "delivered")
  assert.equal(timeline.at(-1)?.snapshot.drivers[0].status, "idle")
})
