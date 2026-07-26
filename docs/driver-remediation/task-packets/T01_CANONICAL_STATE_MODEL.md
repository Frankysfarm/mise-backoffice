# T01 — Canonical State Model and Architecture Contract

## Objective

Define one server-authoritative domain model before implementation.

## Required design outputs

1. ADR selecting canonical authorities for:
   - order;
   - driver operational state;
   - trip/batch;
   - stop;
   - assignment;
   - kitchen/preparation;
   - GPS current state and history;
   - notification/outbox.
2. State/transition tables for Order, Driver, Assignment, Trip, Stop, Kitchen, GPS and Driver Exception.
3. For every transition: actor, expected state/version, validation, atomic side effects, idempotency key, audit event, timeout/recovery and compatibility behavior.
4. A target flow where server assignment is authoritative and app ACK is technical receipt only.
5. A structured exception flow for emergency, vehicle, GPS/network/device and shift problems.
6. Mapping from all existing Legacy/Mise/Atomic statuses to target states.
7. Compatibility and cutover plan for current backend and current TestFlight/web app.
8. Database invariant list and API contract draft.
9. Failing contract tests or executable fixtures that demonstrate invalid current transitions where feasible.

## Constraints

- Prefer evolution of existing Atomic-v1 foundations over inventing a third parallel model.
- Do not activate flags or migrate production.
- Avoid broad code implementation; this task defines the contract consumed by T02–T06.

## Acceptance

Gate G1 is green and the orchestrator/A3/A4 can implement without inventing additional state semantics.
