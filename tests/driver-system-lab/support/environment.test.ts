import assert from "node:assert/strict"
import test from "node:test"
import { assertRunOwnedResource, assertTestLabEnvironment, TestLabSafetyError } from "./environment"

const safe = {
  MISE_TEST_LAB_ENABLED: "true",
  MISE_TEST_LAB_ENV: "local",
  MISE_TEST_LAB_DATABASE_URL: "postgresql://lab:lab@127.0.0.1:5432/mise_driver_test",
  MISE_TEST_LAB_TENANT_ID: "testlab_alpha",
  MISE_TEST_LAB_RUN_ID: "tl_20260801t120000z_1234abcd",
  MISE_TEST_LAB_SEED: "42",
  MISE_TEST_LAB_PUSH_MODE: "sink",
  MISE_TEST_LAB_EMAIL_MODE: "sink",
  MISE_TEST_LAB_SMS_MODE: "sink",
  MISE_TEST_LAB_WHATSAPP_MODE: "sink",
  MISE_TEST_LAB_ROUTING_MODE: "fixture",
} satisfies NodeJS.ProcessEnv

test("accepts an explicit isolated local environment", () => {
  const result = assertTestLabEnvironment(safe)
  assert.equal(result.seed, 42)
  assert.equal(result.databaseUrl.hostname, "127.0.0.1")
})

for (const [name, change] of [
  ["disabled lab", { MISE_TEST_LAB_ENABLED: "false" }],
  ["production database", { MISE_TEST_LAB_DATABASE_URL: "postgresql://x:x@db.prod.supabase.co/postgres" }],
  ["unmarked database", { MISE_TEST_LAB_DATABASE_URL: "postgresql://x:x@localhost/customer_data" }],
  ["production tenant", { MISE_TEST_LAB_TENANT_ID: "restaurant_1" }],
  ["live payments", { STRIPE_SECRET_KEY: "sk_live_forbidden" }],
  ["real push", { MISE_TEST_LAB_PUSH_MODE: "apns" }],
  ["live routing", { MISE_TEST_LAB_ROUTING_MODE: "google" }],
  ["production runtime", { VERCEL_ENV: "production" }],
] as const) {
  test(`fails closed for ${name}`, () => {
    assert.throws(() => assertTestLabEnvironment({ ...safe, ...change }), TestLabSafetyError)
  })
}

test("cleanup cannot target another run", () => {
  const environment = assertTestLabEnvironment(safe)
  assert.doesNotThrow(() => assertRunOwnedResource(environment.runId, environment))
  assert.throws(() => assertRunOwnedResource("tl_20260801t120000z_deadbeef", environment), TestLabSafetyError)
})
