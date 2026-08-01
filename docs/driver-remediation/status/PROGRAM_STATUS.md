# Driver Remediation Program Status

Updated: 2026-08-01

| Task | State | Gate | Branch | Commit | Notes |
|---|---|---|---|---|---|
| T00 Baseline, Staging and Toolchain | COMPLETE | G0 GREEN | `codex/driver-remediation` | `f7d6b619` | Snapshots, isolated worktrees, toolchain, native validator and disposable PostgreSQL path verified. |
| T01 Canonical State Model | COMPLETE | G1 GREEN | `codex/driver-remediation` | `8acbe488` | Implementation plus independent specification and test reviews approved. |
| T02 Atomic Single Writer | COMPLETE | G2 GREEN (isolated PostgreSQL) | `codex/driver-remediation` | `43d5ee06` | Two review cycles; DB and adversarial race reviewers approved final hardened implementation. |
| T03 Server API and Client Boundary | COMPLETE | G3 GREEN (isolated PostgreSQL + source/client contracts) | `codex/driver-remediation` | `60932fc9` | API/security and client-boundary reviewers approved after three hardening cycles. |
| T04 Pick/Pickup Correctness | COMPLETE | G4 GREEN | `codex/driver-remediation` | `60621b64` | Atomic whole-batch pickup, cancellation-after-snapshot handling, disabled legacy bypasses and two-device race verified. |
| T05 Recovery/Push/Offline | COMPLETE | G4 GREEN | `codex/driver-remediation` | `a1408ce2`, `0c90ba95` | Ownership-preserving recovery, wake-only push, snapshot-first ACK, strict offline replay and defensive database privileges verified. |
| T06 GPS Transport/Native | LOCAL SOURCE/DB COMPLETE | G5 BLOCKED_EXTERNAL | main + native isolated branches | `e3ab3efa`, native `d38f19f` | Canonical device metadata, monotonic DB transport, encrypted native queues and T07 dispatch eligibility pass locally; compiled iOS/Android and real-device lifecycle evidence require external toolchains/devices. |
| T07 Deterministic Dispatch Baseline | COMPLETE | G6 GREEN | `codex/driver-remediation` | `277b1094` | Independent review approved deterministic default-off/shadow/active behavior and Atomic-v2-only assignment after 400 green overlap races. |
| T09 Operations/Security/Observability | COMPLETE | G8 GREEN (isolated server/PostgreSQL) | `codex/driver-remediation` | `3399cfad`, `426d5924` | Durable role/tenant/location authority, override CAS, alerts, retention, authenticated APIs and scheduler monitor pass locally. |
| T08 Routing/Batching/Kitchen Hold | COMPLETE | G7 GREEN (isolated PostgreSQL + source contracts) | `codex/driver-remediation` | `5fa6b6f3`, `570d953e`, `c02e15e0` | Atomic route append, real Frank evaluation/RPC integration, read-only shadow, persistent hold watchdog and deterministic replay pass twice. |
| T10 E2E Canary Release | LOCAL COMPLETE | G9 BLOCKED_EXTERNAL | `codex/driver-remediation` | `a4460510` | Full isolated aggregate is green; hosted services, networked build, compiled mobile and physical devices remain unavailable. |
| Final Completion 2026-08-01 | LOCAL COMPLETE | PRODUCTION BLOCKED / SHADOW-ONLY | `codex/driver-remediation` | `90786387`…`dec91d43` | Runtime integrity, global optimizer, Google route-before-depart, multi-order cancel/arrival, explicit append consent, canonical UI and push dedupe pass locally. Production schema/device/hosted E2E and dependency-major-upgrade gates remain external/open. |
| Autonomous Test Lab 2026-08-01 | IN PROGRESS | TL-G0 GREEN; release BLOCKED | `codex/driver-remediation` | `c143e83a`…current | Guard, synthetic actors, invariant monitor, chaos controller, independent oracle, 500 seeds, scenario catalog, CLI/reports and preview dashboard implemented locally. Real browser, DB-backed full scenarios, native/device, independent board and human acceptance remain open. |

## Production safety

No production deployment, production database connection, production
migration, feature-flag activation, real order, real push, or TestFlight action
is authorized or has been performed by this program.

## Current critical-file ownership

See `FILE_OWNERSHIP.md`. Until G0 completes, no business-logic critical file is
assigned for modification.

## G0 decision

GREEN. Every pre-existing change is reproducibly snapshotted; both repositories
have isolated worktrees; npm selection and lock ambiguity are documented; lint
is non-interactive; focused lint, typecheck and tests pass; a disposable
PostgreSQL 16 path passes; no production action occurred.

Known baseline debt does not invalidate G0 but remains explicit:

- full lint is red on pre-existing product files;
- a full Next build cannot complete in the restricted environment because
  `next/font/google` retries blocked DNS requests;
- the current manifest contains a direct Linux-only SWC package that makes an
  unforced Darwin npm lock dry-run fail;
- PyYAML is absent from the native scaffold, so its fast validator reports a
  YAML-depth warning.

## G1 decision

GREEN after two review rounds. The first independent review rejected the draft
for GPS, resume, reassignment, version-authority, override, mapping and test
gaps. Those findings were corrected. Final independent specification and test
reviews both returned `APPROVE`; the lead reran all three contract suites and
the focused P0 TypeScript gate successfully.

## G2 decision

GREEN in the required isolated PostgreSQL environment after two rejection and
hardening cycles. Final evidence includes 100 true-overlap two-session races,
exact winner/loser and idempotent replay comparison, 48 failure-injection
boundaries, lifecycle CAS, writer lease/epoch authority, full rollback
projections, migration double-apply, executable preflight stop-gate and
disable/rollback. Independent DB and adversarial race reviewers both returned
`APPROVE`. Full Supabase staging/RLS/PostgREST remains a later G3/G9 proof and
is not inferred from G2.

## G3 decision

GREEN for the isolated server-authoritative boundary. The final PostgreSQL
suite proves authenticated lifecycle RPCs, global idempotency, RLS/direct-write
denial, canonical item resolution, technical ACK, exception audit and a true
two-session stop-CAS race. The client boundary restores/reconciles canonical
snapshots, reloads on unknown Realtime versions and reconnect, persists exact
retry envelopes, rejects ordinary decline and no longer mounts the identified
direct-write/optimistic lifecycle widgets. Independent API/security and client
reviewers both returned `APPROVE`.

## G4 decision

GREEN after repeated adversarial review and correction cycles. T04 proves
whole-batch pickup with exact active order/item manifests, immutable kitchen
resolution provenance, no ordinary driver-side missing-item decision,
transactional cancellation-after-snapshot handling, failure rollback and a
real two-device race. Legacy single-order pickup/depart routes and RPCs cannot
write.

T05 preserves active assignment ownership during stale GPS and recovery,
uses one CAS escalation path, separates provider acceptance from technical app
ACK, treats push as wake-only, restores the canonical snapshot after push,
restart, replay and conflicts, and restricts offline replay to validated,
fingerprinted v2 actions. The isolated PostgreSQL suite proves migration
double-apply, hostile pre-grant revocation, RLS/service-role boundaries,
episode deduplication and restart safety. No production action occurred.

## G5 decision

BLOCKED_EXTERNAL, with all locally executable source/database evidence green. PostgreSQL tests prove
monotonic GPS current-state updates, exact idempotency fingerprints,
cross-tenant and changed-authority rejection, retired-session fencing,
out-of-order history, quality flags and concurrent successor handling. Native
source tests prove authenticated policy gating, bounded encrypted queues,
session rotation, terminal-head recovery and reproducible iOS/Android project
integration.

G5 cannot turn green in the current host environment: the Android project now
reaches Gradle's SDK-location boundary with OpenJDK 17 but the Android SDK is
absent, iOS compilation requires full Xcode/CocoaPods, and the
foreground/background/lock/relaunch/reboot matrix requires real devices.
`gpsEligibleForNewAssignment` is wired into the deterministic T07 candidate
filter and its stale/untrusted exclusions pass locally. Native installation,
tracking-mode, altitude and battery metadata are now part of the canonical
event contract. Full Xcode, the Android SDK and physical device matrices remain
unavailable. Both source paths remain default-off candidates; no production
action occurred.

## G8 decision

GREEN in the isolated server/PostgreSQL environment. The previously approved
redaction contract is now backed by default-off tenant policy, durable
tenant/location role scopes, CAS/idempotent emergency actions, before/after
audit, alert episodes, heartbeat monitoring, tenant-scoped retention and
authenticated operations APIs. The complete suite includes direct-write and
cross-tenant denial plus a parallel override race. External paging and
production dashboards remain rollout configuration; no production flag,
telemetry destination or system was changed.

## G7 decision

GREEN in the isolated remediation environment. Two consecutive fresh-database
runs prove the real two-session append race, exact idempotency/fingerprint
semantics, rollback of every loser projection, persistent hold/release/
cancellation behavior and restart-safe watchdog locking. Frank now evaluates
active routes with canonical GPS, capacity, version, store and deadline inputs,
uses road legs with an explicitly marked conservative fallback, records every
relevant candidate reason, retries a CAS conflict only once and writes only
through the Atomic-v2 append RPC. Shadow mode has an automated unchanged
business-snapshot assertion. T08 remains default-off and no production action
occurred.

## G6 decision

GREEN in the isolated remediation environment after repeated rejection and
hardening cycles. The baseline is default-off, shadow mode preserves the
incumbent operational path and records the actual resulting outcome, and
active mode can write only through Atomic-v2. Candidate decisions are
deterministic and auditable, reject stale/delayed/untrusted GPS, use canonical
driver state, respect backend-configured distances beyond 20 km, fail closed
on incomplete snapshots and exclude loaded routes until T08 can prove route
compatibility. Decision action IDs and Atomic-v2 correlation IDs distinguish
pending, committed and CAS-loser outcomes.

The full runner passed the canonical 100-overlap suite and the retained repeat
runner passed three additional complete suites. One earlier intermittent
failure in the frozen T02 harness was not reproduced across the subsequent 400
overlaps and remains a documented residual risk. G6 does not authorize
production or activate the feature flag.
