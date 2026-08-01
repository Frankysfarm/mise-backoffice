import { createHash, randomUUID } from "node:crypto"

export type TestLabEnvironment = Readonly<{
  environment: "local" | "test" | "staging"
  databaseUrl: URL
  tenantId: string
  runId: string
  seed: number
  artifactRoot: string
}>

const ALLOWED_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "mise-test-db",
  "db.test.mise.internal",
  "db.staging.mise.internal",
])
const FORBIDDEN_HOST_PARTS = ["supabase.co", "mise-gastro.de", "vercel.app"]
const TEST_TENANT_PREFIX = "testlab_"
const RUN_ID = /^tl_[0-9]{8}t[0-9]{6}z_[a-f0-9]{8}$/

export class TestLabSafetyError extends Error {
  constructor(readonly reasons: string[]) {
    super(`TEST LAB SAFETY ABORT: ${reasons.join("; ")}`)
    this.name = "TestLabSafetyError"
  }
}

export function createTestRunId(now = new Date(), entropy = randomUUID()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").toLowerCase()
  return `tl_${stamp}_${createHash("sha256").update(entropy).digest("hex").slice(0, 8)}`
}

function parseSeed(raw: string | undefined): number {
  const seed = raw === undefined ? 1 : Number(raw)
  if (!Number.isSafeInteger(seed) || seed < 0) throw new TestLabSafetyError(["MISE_TEST_LAB_SEED must be a non-negative safe integer"])
  return seed
}

export function assertTestLabEnvironment(env: NodeJS.ProcessEnv = process.env): TestLabEnvironment {
  const reasons: string[] = []
  if (env.MISE_TEST_LAB_ENABLED !== "true") reasons.push("MISE_TEST_LAB_ENABLED must equal true")

  const environment = env.MISE_TEST_LAB_ENV
  const validEnvironment = environment === "local" || environment === "test" || environment === "staging" ? environment : undefined
  if (!validEnvironment) {
    reasons.push("MISE_TEST_LAB_ENV must be local, test, or staging")
  }

  let databaseUrl: URL | undefined
  try {
    databaseUrl = new URL(env.MISE_TEST_LAB_DATABASE_URL ?? "")
  } catch {
    reasons.push("MISE_TEST_LAB_DATABASE_URL must be an explicit URL")
  }
  if (databaseUrl) {
    const hostname = databaseUrl.hostname.toLowerCase()
    if (!ALLOWED_DATABASE_HOSTS.has(hostname)) reasons.push(`database host is not allowlisted: ${hostname}`)
    if (FORBIDDEN_HOST_PARTS.some((part) => hostname === part || hostname.endsWith(`.${part}`))) reasons.push("production/hosted application database host is forbidden")
    if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") reasons.push("only PostgreSQL test databases are allowed")
    const databaseName = databaseUrl.pathname.slice(1).toLowerCase()
    if (!/(test|lab|remediation)/.test(databaseName)) reasons.push("database name must visibly contain test, lab, or remediation")
  }

  const tenantId = env.MISE_TEST_LAB_TENANT_ID ?? ""
  if (!tenantId.startsWith(TEST_TENANT_PREFIX)) reasons.push(`tenant id must start with ${TEST_TENANT_PREFIX}`)

  const runId = env.MISE_TEST_LAB_RUN_ID ?? createTestRunId()
  if (!RUN_ID.test(runId)) reasons.push("test run id has an invalid or non-isolated format")

  if ((env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_")) reasons.push("live Stripe key is forbidden")
  for (const key of ["MISE_TEST_LAB_PUSH_MODE", "MISE_TEST_LAB_EMAIL_MODE", "MISE_TEST_LAB_SMS_MODE", "MISE_TEST_LAB_WHATSAPP_MODE"]) {
    if ((env[key] ?? "sink") !== "sink") reasons.push(`${key} must equal sink`)
  }
  if ((env.MISE_TEST_LAB_ROUTING_MODE ?? "fixture") !== "fixture") reasons.push("routing must use fixture mode unless a separately approved budgeted test is introduced")
  if (env.VERCEL_ENV === "production" || env.MISE_DEPLOYMENT_TIER === "production") reasons.push("production runtime is forbidden")

  if (reasons.length > 0 || !databaseUrl || !validEnvironment) throw new TestLabSafetyError(reasons)
  return Object.freeze({
    environment: validEnvironment,
    databaseUrl,
    tenantId,
    runId,
    seed: parseSeed(env.MISE_TEST_LAB_SEED),
    artifactRoot: env.MISE_TEST_LAB_ARTIFACT_ROOT ?? "artifacts/driver-system-lab",
  })
}

export function assertRunOwnedResource(resourceRunId: string, environment: TestLabEnvironment): void {
  if (resourceRunId !== environment.runId) {
    throw new TestLabSafetyError(["cleanup/mutation target is not owned by this test run"])
  }
}
