# Critical File Ownership

Updated: 2026-07-27

| File/scope | Active task | Owner | Mode | Notes |
|---|---|---|---|---|
| `lib/frank.ts` | T08 | `t07_dispatch` | exclusive-limited | Routing/batching/hold integration only; T07 baseline and Atomic-v2 writer contract remain frozen. |
| new T08 routing/batching/hold modules, migration and tests | T08 | `t07_dispatch` | exclusive | Default-off/shadow first; no recovery/client/native edits. |
| `lib/delivery/dispatch-engine.ts` | none | released by T07 | protected | Deterministic scoring/reason contract frozen after G6. |
| canonical lifecycle/state-machine modules | none | released after continuation regression | protected | T01 compatibility evidence was refreshed for the T03 boundary; transition semantics remain frozen. |
| dispatch/assignment migrations and RPCs | none | released by T02 | protected | T02 Atomic-v2 migrations/RPCs frozen after G2 approval. |
| `lib/delivery/recovery.ts` | none | released by T05 | protected | Ownership-preserving recovery contract frozen after G4. |
| `app/api/cron/smart-dispatch/route.ts` and `app/api/delivery/tours/[id]/status/route.ts` recovery callsites | none | released by T05 | protected | Recovery failures must remain visible; dispatch/status business logic is frozen. |
| `app/fahrer/app/client.tsx` | none | released by T04/T05 | protected | Atomic pickup and canonical offline/snapshot reconciliation frozen after G4. |
| `app/api/driver/v1/**` lifecycle boundary | none | released by T03 | protected | v1 adapters constrained; future changes require exclusive ownership. |
| `app/api/driver/v2/**` and `lib/delivery/driver-v2-*` | none | released by T03 | protected | Canonical action/snapshot boundary frozen after G3. |
| migration `279_*`, pick/item APIs/tests | none | released by T04 | protected | Atomic multi-order pickup contract frozen after G4. |
| migration `280_*`, GPS API/transport/native files | T06 continuation | program lead | exclusive | G5 local regression and native/source completion; no production retention or device-evidence claims. |
| migration `281_*`, recovery/outbox/push tests | none | released by T05 | protected | Push is wake-up only; assignment authority unchanged. |
| new T09 observability/security modules, tests and runbooks | none | released by T09 safe subset | protected | Default-off source candidate approved; durable integration awaits a separately owned T09 phase. |
| `package.json`, `next.config.js`, ESLint config | none | released by T00 | protected | Tool configuration complete. |
| native verification scripts in `/Users/eule/mise-driver-native-t00` | none | released by T00 | protected | Native T00 commit `0ec66de`; no app logic changed. |
| `docs/driver-remediation/status/*` | program | lead orchestrator | exclusive | Baseline, status, gates and command evidence. |

Ownership must be updated before another task edits a listed scope.
