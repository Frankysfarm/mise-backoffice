import { spawn } from "node:child_process"
import type { TestLabEnvironment } from "../support/environment"
import { assertRunOwnedResource, assertTestLabEnvironment } from "../support/environment"

function schemaName(runId: string): string {
  return `lab_${runId.replaceAll("-", "_")}`
}

function literal(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function revalidate(environment: TestLabEnvironment): TestLabEnvironment {
  return assertTestLabEnvironment({
    MISE_TEST_LAB_ENABLED: "true", MISE_TEST_LAB_ENV: environment.environment,
    MISE_TEST_LAB_DATABASE_URL: environment.databaseUrl.toString(), MISE_TEST_LAB_TENANT_ID: environment.tenantId,
    MISE_TEST_LAB_RUN_ID: environment.runId, MISE_TEST_LAB_SEED: String(environment.seed),
    MISE_TEST_LAB_PUSH_MODE: "sink", MISE_TEST_LAB_EMAIL_MODE: "sink", MISE_TEST_LAB_SMS_MODE: "sink",
    MISE_TEST_LAB_WHATSAPP_MODE: "sink", MISE_TEST_LAB_ROUTING_MODE: "fixture",
  })
}

function psql(environment: TestLabEnvironment, sql: string): Promise<string> {
  const url = environment.databaseUrl
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || "5432", PGDATABASE: url.pathname.slice(1), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGCONNECT_TIMEOUT: "2" },
    })
    let output = ""; let error = ""
    child.stdout.on("data", (chunk) => { output += String(chunk) })
    child.stderr.on("data", (chunk) => { error += String(chunk) })
    child.once("error", () => reject(new Error("psql is required for test-lab data factory")))
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`test-lab PostgreSQL operation failed: ${error.trim().slice(0, 240)}`)))
    child.stdin.end(sql)
  })
}

export async function createRunData(environment: TestLabEnvironment): Promise<{ schema: string; actors: number }> {
  environment = revalidate(environment)
  const schema = schemaName(environment.runId)
  const run = literal(environment.runId); const tenant = literal(environment.tenantId)
  await psql(environment, `
    BEGIN;
    CREATE SCHEMA "${schema}";
    CREATE TABLE "${schema}".test_runs(test_run_id text PRIMARY KEY, tenant_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE "${schema}".synthetic_actors(id text PRIMARY KEY, test_run_id text NOT NULL, tenant_id text NOT NULL, kind text NOT NULL);
    CREATE TABLE "${schema}".synthetic_orders(id text PRIMARY KEY, test_run_id text NOT NULL, tenant_id text NOT NULL, status text NOT NULL);
    INSERT INTO "${schema}".test_runs VALUES (${run}, ${tenant}, now());
    INSERT INTO "${schema}".synthetic_actors VALUES
      ('customer-1', ${run}, ${tenant}, 'customer'), ('kitchen-1', ${run}, ${tenant}, 'kitchen'),
      ('driver-1', ${run}, ${tenant}, 'driver'), ('dispatcher-1', ${run}, ${tenant}, 'dispatcher');
    INSERT INTO "${schema}".synthetic_orders VALUES ('order-1', ${run}, ${tenant}, 'pending');
    COMMIT;
  `)
  const actors = Number(await psql(environment, `SELECT count(*) FROM "${schema}".synthetic_actors WHERE test_run_id=${run} AND tenant_id=${tenant};`))
  if (actors !== 4) throw new Error("test-lab data factory verification failed")
  return { schema, actors }
}

export async function cleanupRunData(environment: TestLabEnvironment, targetRunId: string): Promise<void> {
  environment = revalidate(environment)
  assertRunOwnedResource(targetRunId, environment)
  const schema = schemaName(targetRunId); const run = literal(targetRunId); const tenant = literal(environment.tenantId)
  await psql(environment, `
    BEGIN;
    SELECT pg_advisory_xact_lock(hashtextextended(${literal(`test-lab-cleanup:${schema}`)}, 0));
    DO $cleanup$
    DECLARE owned boolean;
    BEGIN
      SELECT EXISTS(SELECT 1 FROM "${schema}".test_runs WHERE test_run_id=${run} AND tenant_id=${tenant}) INTO owned;
      IF NOT owned THEN RAISE EXCEPTION 'refusing cleanup: run/tenant ownership metadata mismatch'; END IF;
      EXECUTE 'DROP SCHEMA "${schema}" CASCADE';
    END
    $cleanup$;
    COMMIT;
  `)
  const remaining = await psql(environment, `SELECT count(*) FROM pg_namespace WHERE nspname=${literal(schema)};`)
  if (remaining !== "0") throw new Error("test-lab cleanup verification failed")
}
