# G5 Evidence

Updated: 2026-07-28

| Requirement | Implementation evidence | Test command | Exit | Result | Limitation |
|---|---|---|---:|---|---|
| Canonical event metadata | `gps-transport.ts`, migration `280`, native commit `d38f19f` | GPS SQL + TS suites | 0 | GREEN source | device observation pending |
| Monotonic current state | `fn_ingest_driver_gps_v2` | `run-280-gps.sh` | 0 | GREEN | local PostgreSQL |
| Checked database errors | Driver-v2 checked RPC boundary | focused typecheck/contracts | 0 | GREEN | no external PostgREST staging |
| Bounded idempotent replay | SQL fingerprint plus native encrypted queues | GPS/native contract suites | 0 | GREEN | device persistence pending |
| Invalid/impossible quality | migration quality flags and dispatch trust | GPS SQL + TS suites | 0 | GREEN | thresholds need field validation |
| Dispatch excludes stale/untrusted | `deterministic-dispatch.ts`, `gps-dispatch-eligibility.ts` | T07 and GPS tests | 0 | GREEN | no live activation |
| Tracking state policy | iOS/Android source and native contract | `npm run test:location` | 0 | GREEN source | real lifecycle pending |
| Configurable retention | `mise_gps_transport_config`, cleanup RPC default-off | GPS SQL suite | 0 | GREEN | production privacy approval pending |
| iOS compiled lifecycle matrix | source candidate | unavailable | — | BLOCKED_EXTERNAL | full Xcode, signing and devices required |
| Android compiled lifecycle matrix | source candidate | unavailable | — | BLOCKED_EXTERNAL | Java/Android SDK build and devices required |

## Gate status

**G5: BLOCKED_EXTERNAL**

Confidence in locally executed source/database evidence: high. Confidence in
background behavior on supported physical devices: unverified until
`GPS_DEVICE_TEST_PLAN.md` is executed.

No production action occurred.

