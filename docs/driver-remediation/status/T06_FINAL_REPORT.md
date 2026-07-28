# T06 Final Source Report

Updated: 2026-07-28

## Verdict

`READY_WITH_EXTERNAL_BLOCKERS`.

All locally testable backend, policy, queue and native source work is complete.
Compiled iOS/Android and real-device lifecycle evidence is unavailable on this
host and remains mandatory for overall G5.

## Implemented contract

- Authenticated Driver-v2 derives driver identity and tenant membership on the
  server.
- Events carry installation ID, session, monotonic sequence, capture/receive
  time, location/accuracy, optional speed/heading/altitude, app/build,
  platform/app state, permission/network state, tracking mode, battery state
  and a stable action ID.
- PostgreSQL stores history and current state consistently and prevents older
  packets or retired sessions from reclaiming current.
- Replay fingerprints reject changed payloads and changed authority.
- Quality flags cover delayed, inaccurate, impossible jump, permission and
  offline conditions.
- T07 dispatch uses `gpsEligibleForNewAssignment` and excludes missing, stale
  and untrusted current locations.
- Retention is configurable and remains default-off.
- iOS uses `CLLocationManager`, significant-change updates, server policy
  reconciliation, Keychain credentials and an AES-GCM bounded queue.
- Android provides a foreground location service, notification channel,
  canonical policy reconciliation and Keystore-backed encrypted preferences.
- Both native candidates stop outside approved states and rotate their
  session when canonical driver authority changes.

## Changed commits

- Main: `392170eb` — time-independent GPS regression.
- Main: `e3ab3efa` — canonical device event metadata.
- Native: `4d048c2` — native GPS lifecycle source candidate.
- Native: `d38f19f` — installation/tracking/altitude/battery metadata.

## Verification

| Command | Working directory | Exit | Result |
|---|---|---:|---|
| `scripts/tests/with-local-remediation-postgres.sh scripts/tests/run-280-gps.sh` | main | 0 | monotonic/history/replay/session/race and TS contract PASS |
| focused `tsc -p tsconfig.p0.json` | main | 0 | PASS |
| bundled `scripts/tests/gps-transport.test.ts` | main | 0 | PASS |
| `npm run test:location` | native | 0 | native contract and source integration PASS |
| `./scripts/verify-fast.sh` | native | 0 | 0 errors; PyYAML warning only |
| `./scripts/verify-full.sh` | native | 0 | scaffold completed; explicitly reports missing project-specific mobile/device suite |

## External blockers

- Full Xcode is not installed/selected; iOS compilation cannot run.
- No real iPhone device matrix was executed.
- Java runtime is unavailable; Android compilation cannot run.
- No real Android device matrix was executed.
- No signing or isolated external staging credentials were used.

## Production safety

No production GPS policy, retention, migration, deployment, push, order,
TestFlight build or live tracking was changed.

