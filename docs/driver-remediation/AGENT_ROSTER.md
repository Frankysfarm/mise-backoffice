# Agent Roster and Ownership

## A0 — Orchestrator / Integrator

Owns planning, status, file ownership, reviews, merges and gate decisions. Does not implement major product logic. May make small integration-only fixes after identifying the responsible task.

## A1 — Baseline & Toolchain Engineer

Runs T00. Owns scripts/config/docs required for reproducible local checks and isolated staging. Must not change dispatch behavior.

## A2 — Domain Architect

Runs T01. Owns ADRs, canonical states, transition contracts, compatibility plan and contract-test specifications. Avoids implementing broad production logic.

## A3 — Database Atomicity Engineer

Runs T02. Exclusive owner of assignment migrations, writer election, transaction RPCs, constraints and SQL race tests. No other agent edits these files concurrently.

## A4 — Driver API Boundary Engineer

Runs T03. Owns versioned driver APIs, server snapshot contract, client mutation migration and RLS-facing application changes. Exclusive owner of `app/fahrer/app/client.tsx` while active.

## A5 — Fulfilment Correctness Engineer

Runs T04. Owns pick/pickup item resolution, multi-order departure invariant and related UI/API tests.

## A6 — Recovery & Messaging Engineer

Runs T05. Owns offline outbox, push/realtime ledger, ACK semantics, reconnect recovery and duplicate/out-of-order handling. Coordinates with A4 on shared client files.

## A7 — Mobile Location Engineer

Runs T06 across the web/backend repository and native driver repository. Owns GPS event schema, monotonic backend update, offline location queue and native iOS/Android lifecycle implementation/tests.

## A8 — Dispatch Optimization Engineer

Runs T07 then T08. Exclusive owner of `lib/frank.ts`, dispatch scorer integration, route insertion, batching and hold policy while active. May not change DB lifecycle contracts without A3/A2 review.

## A9 — Security, Observability & Operations Engineer

Runs T09. Owns telemetry, alerts, manual override, kill switches, RLS/security verification and privacy controls. State/RLS mutations require A3/A4 integration review.

## A10 — QA & Release Engineer

Runs T10. Owns simulation, staging E2E, concurrency harness, device matrix, compatibility matrix, migration dry run, canary and rollback evidence. Does not weaken tests to make gates green.

## Mandatory independent review

- A2 reviews A3 lifecycle semantics.
- A3 reviews A4/A5/A6 state mutations.
- A7 reviews all GPS assumptions in A8.
- A10 independently verifies every claimed gate.
- A0 alone marks a gate green after evidence review.
