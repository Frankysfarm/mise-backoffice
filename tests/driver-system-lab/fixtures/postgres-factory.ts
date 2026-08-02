import { spawn } from "node:child_process"
import type { TestLabEnvironment } from "../support/environment"
import { assertRunOwnedResource, assertTestLabEnvironment } from "../support/environment"
import { createCanonicalActorProfiles } from "../actors/profiles"
import type { CompiledScenarioFixture } from "./scenario-compiler"

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
    child.stdin.on("error", (cause: NodeJS.ErrnoException) => {
      if (cause.code !== "EPIPE") error += ` ${cause.message}`
    })
    child.once("error", () => reject(new Error("psql is required for test-lab data factory")))
    child.once("exit", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(`test-lab PostgreSQL operation failed: ${error.trim().slice(0, 240)}`)))
    child.stdin.end(sql)
  })
}

function jsonValues(rows: readonly unknown[]): string {
  return rows.map((row, index) => `(${index + 1}, ${literal(JSON.stringify(row))}::jsonb)`).join(",\n")
}

export async function createRunData(environment: TestLabEnvironment, fixture?: CompiledScenarioFixture): Promise<{ schema: string; actors: number; fixtureDigest?: string; materializedRows: number }> {
  environment = revalidate(environment)
  if (fixture && (fixture.tenantId !== environment.tenantId || fixture.seed !== environment.seed)) throw new Error("compiled fixture does not match guarded tenant/seed")
  const schema = schemaName(environment.runId)
  const run = literal(environment.runId); const tenant = literal(environment.tenantId)
  const profiles = createCanonicalActorProfiles(environment.runId, environment.tenantId)
  const actorValues = Object.values(profiles).flat().map((actor) => `(${literal(actor.id)}, ${run}, ${tenant}, ${literal(actor.kind)}, ${literal(actor.behavior)}, ${literal(actor.displayName)}, ${literal(JSON.stringify(actor.metadata))}::jsonb)`).join(",\n")
  const fixtureTables = fixture ? [
    ["scenario_stores", fixture.storeRows],
    ["scenario_actors", fixture.actorRows],
    ["scenario_vehicles", fixture.vehicleRows],
    ["scenario_drivers", fixture.driverRows],
    ["scenario_orders", fixture.orderRows],
    ["scenario_timeline", fixture.timeline],
  ] as const : []
  const fixtureInserts = fixtureTables.map(([table, rows]) => rows.length > 0 ? `INSERT INTO "${schema}".${table}(sequence, payload) VALUES ${jsonValues(rows)};` : "").join("\n")
  const providerInsert = fixture ? `INSERT INTO "${schema}".scenario_providers(sequence, payload) VALUES (1, ${literal(JSON.stringify(fixture.providerFixtures))}::jsonb);` : ""
  const manifestInsert = fixture ? `INSERT INTO "${schema}".scenario_manifest(test_run_id, tenant_id, scenario_id, seed, digest, source) VALUES (${run}, ${tenant}, ${literal(fixture.scenarioId)}, ${fixture.seed}, ${literal(fixture.digest)}, ${literal(JSON.stringify(fixture.sourceScenario))}::jsonb);` : ""
  await psql(environment, `
    BEGIN;
    CREATE SCHEMA "${schema}";
    CREATE TABLE "${schema}".test_runs(test_run_id text PRIMARY KEY, tenant_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE "${schema}".synthetic_actors(id text PRIMARY KEY, test_run_id text NOT NULL, tenant_id text NOT NULL, kind text NOT NULL, behavior text NOT NULL, display_name text NOT NULL, metadata jsonb NOT NULL);
    CREATE TABLE "${schema}".synthetic_orders(id text PRIMARY KEY, test_run_id text NOT NULL, tenant_id text NOT NULL, status text NOT NULL);
    CREATE TABLE "${schema}".scenario_manifest(test_run_id text PRIMARY KEY, tenant_id text NOT NULL, scenario_id text NOT NULL, seed bigint NOT NULL, digest text NOT NULL, source jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_stores(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_actors(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_vehicles(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_drivers(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_orders(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_timeline(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    CREATE TABLE "${schema}".scenario_providers(sequence integer PRIMARY KEY, payload jsonb NOT NULL);
    INSERT INTO "${schema}".test_runs VALUES (${run}, ${tenant}, now());
    INSERT INTO "${schema}".synthetic_actors VALUES ${actorValues};
    INSERT INTO "${schema}".synthetic_orders VALUES ('order-1', ${run}, ${tenant}, 'pending');
    ${manifestInsert}
    ${fixtureInserts}
    ${providerInsert}
    COMMIT;
  `)
  const actors = Number(await psql(environment, `SELECT count(*) FROM "${schema}".synthetic_actors WHERE test_run_id=${run} AND tenant_id=${tenant};`))
  if (actors !== 65) throw new Error("test-lab data factory verification failed")
  const materializedRows = Number(await psql(environment, `SELECT (SELECT count(*) FROM "${schema}".scenario_stores) + (SELECT count(*) FROM "${schema}".scenario_actors) + (SELECT count(*) FROM "${schema}".scenario_vehicles) + (SELECT count(*) FROM "${schema}".scenario_drivers) + (SELECT count(*) FROM "${schema}".scenario_orders) + (SELECT count(*) FROM "${schema}".scenario_timeline) + (SELECT count(*) FROM "${schema}".scenario_providers);`))
  const storedDigest = fixture ? await psql(environment, `SELECT digest FROM "${schema}".scenario_manifest WHERE test_run_id=${run} AND tenant_id=${tenant};`) : undefined
  if (fixture && storedDigest !== fixture.digest) throw new Error("compiled fixture manifest verification failed")
  return { schema, actors, fixtureDigest: storedDigest, materializedRows }
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
