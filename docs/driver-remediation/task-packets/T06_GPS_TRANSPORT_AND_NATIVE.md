# T06 — GPS Transport and Native Lifecycle

## Objective

Provide trustworthy current position and documented platform behavior for dispatch.

## Canonical GPS event

At minimum include:

- driver ID derived from authenticated session;
- tracking session ID;
- monotonically increasing sequence;
- device captured timestamp;
- server received timestamp;
- latitude/longitude;
- accuracy;
- optional speed/heading when available;
- app version/build;
- platform/device capability flags;
- foreground/background state where safely available.

## Backend requirements

1. Validate bounds, timestamp skew, sequence and session.
2. Insert history and update current state with monotonic compare-and-swap semantics.
3. Delayed older events may enter history if valid but never replace newer current state.
4. Check and surface every DB error.
5. Add quality flags for stale, inaccurate, implausible jump and permission/network state.
6. Use bounded idempotent offline replay.
7. Make retention configurable and cleanup verifiable.
8. Expose dispatch-safe freshness/quality decision data.

## Client/native requirements

1. Route foreground GPS through the canonical API, not direct lifecycle-table updates.
2. Implement native iOS background tracking using appropriate native location APIs and entitlement configuration.
3. Implement Android background/foreground-service behavior in a versioned project, not only generated ephemeral files.
4. Start tracking only in approved operational states; visibly stop it at shift end.
5. Persist bounded unsent location events securely and replay in order.
6. Record permission state and actionable operational warnings.
7. Document unavoidable platform limits, especially force-quit/reboot/permission restrictions. Do not claim impossible guarantees.

## Mandatory tests

- in-order and out-of-order sequences;
- duplicate sequence;
- future/old timestamp;
- impossible jump and low accuracy;
- network loss/replay;
- foreground/background/locked screen;
- app termination and relaunch behavior;
- device restart behavior to documented platform limits;
- shift start/end;
- stale GPS exclusion from new assignments;
- iOS and Android real-device evidence.

## Acceptance

Gate G5 green. Production retention and background policy remain blocked until approved.
