# GPS Real-Device Test Plan

## Scope and safety

This plan validates the T06 source candidate on non-production test tenants and
test drivers. It must not use production orders, production tracking retention
or real customer addresses. Capture only reason codes, timestamps, sequence
ranges and coarse test-route labels in evidence.

## Required builds

- Backend release-candidate SHA with migrations through `280`.
- iOS build from native branch `codex/t00-native-verify`, commit `d38f19f`.
- Android build from the same native commit.
- T06 policy enabled only for an isolated test tenant.
- Test driver accounts with no production membership.

Record device model, OS version, app version/build, backend SHA, permission
state, battery mode and test start/end for every run.

## Matrix

| Scenario | iOS | Android | Expected evidence |
|---|---:|---:|---|
| App open, active shift | required | required | monotonic sequence, current advances |
| App backgrounded | required | required | background mode recorded, bounded cadence |
| Screen locked | required | required | ordered events or documented OS pause |
| Network loss then reconnect | required | required | encrypted queue grows, ordered replay, no duplicate current |
| App process killed by OS | required | required | documented resume behavior and replay |
| User force-quits/force-stops | required | required | no false relaunch guarantee; manual relaunch reconciles |
| Device restart | required | required | documented platform restart limit and safe policy refresh |
| Low-power/battery saver | required | required | battery metadata and cadence change observed |
| Permission downgraded | required | required | warning; no unapproved tracking |
| Location services disabled | required | required | warning; dispatch marks location unavailable/stale |
| Shift ends while app backgrounded | required | required | tracking stops after canonical reconciliation |
| Session/driver version changes | required | required | new session and sequence reset; retired session fenced |
| Long drive (at least 45 min) | required | required | bounded accuracy/battery/cadence evidence |
| App relaunch with queued events | required | required | encrypted queue survives and replays once |

## Procedure

1. Confirm the test tenant writer and GPS policy are default-off.
2. Install a build tied to the recorded commit.
3. Authenticate with a test-only driver.
4. Enable the isolated GPS policy and start a test shift.
5. Record the canonical snapshot and empty queue baseline.
6. Execute one matrix row without changing other variables.
7. Query only isolated test data for session, sequence, capture/receive times,
   quality flags and current position version.
8. Confirm no older packet replaced current and no duplicate history appeared.
9. End the shift and verify native tracking stops.
10. Disable the test-tenant policy after the run.

## Pass criteria

- Server identity determines driver and tenant.
- Installation/session/sequence metadata is present.
- Current position advances monotonically.
- Duplicate retry is idempotent.
- Stale, inaccurate and implausible points are excluded from new dispatch.
- Offline queue remains encrypted, bounded to 100 and ordered.
- Tracking is absent outside approved operational states.
- Platform limitations match the documented expectations.

Any missing device, signing credential, build environment or test-tenant access
is recorded as `BLOCKED_EXTERNAL`; it is never converted into simulated PASS.

