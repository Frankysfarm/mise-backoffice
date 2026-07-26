# Critical File Ownership

Updated: 2026-07-26

| File/scope | Active task | Owner | Mode | Notes |
|---|---|---|---|---|
| `lib/frank.ts` | none | unassigned | protected | Pre-T00 changes preserved in baseline commit; no T00 edits allowed. |
| `lib/delivery/dispatch-engine.ts` | none | unassigned | protected | T02/T07 ownership must be exclusive. |
| canonical lifecycle/state-machine modules | T01 | pending T01 agent | exclusive | G0 is green; no other task may edit these contracts. |
| dispatch/assignment migrations and RPCs | none | unassigned | protected | T02 only after G1. |
| `lib/delivery/recovery.ts` | none | unassigned | protected | T05 after stable contracts. |
| `app/fahrer/app/client.tsx` | none | unassigned | protected | T03/T04/T06 must serialize edits. |
| `package.json`, `next.config.js`, ESLint config | none | released by T00 | protected | Tool configuration complete. |
| native verification scripts in `/Users/eule/mise-driver-native-t00` | none | released by T00 | protected | Native T00 commit `0ec66de`; no app logic changed. |
| `docs/driver-remediation/status/*` | program | lead orchestrator | exclusive | Baseline, status, gates and command evidence. |

Ownership must be updated before another task edits a listed scope.
