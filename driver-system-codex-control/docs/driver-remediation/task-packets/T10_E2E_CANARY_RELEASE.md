# T10 — E2E, Canary and Release Readiness

## Objective

Independently prove the complete system and prepare a reversible release without touching production until approval.

## Required environments

- schema-compatible isolated database;
- backend/worker instances using release candidate SHA;
- driver web/native builds tied to SHA;
- simulated kitchen/storefront/payment adapters;
- iOS and Android real-device test builds.

## Mandatory E2E matrix

1. one order/one driver;
2. multiple drivers/one order;
3. simultaneous orders;
4. two workers race;
5. compatible multi-order trip;
6. opposite directions;
7. stale GPS;
8. driver offline/exception;
9. app background/killed/reopened;
10. network loss/replay;
11. missing/duplicate push;
12. cancellation before/during/after assignment and during hold;
13. duplicate/out-of-order events;
14. kitchen delay;
15. no driver available;
16. shift end with active trip;
17. manual override race;
18. server/worker restart;
19. old GPS packet arrives late;
20. two stores compete for one driver;
21. maximum hold/deadline release;
22. old app/new backend compatibility;
23. missing item/multi-order pickup;
24. routing provider unavailable;
25. rollback after partial rollout.

## Performance and correctness evidence

- zero duplicate active assignment;
- zero partial transactional state after injected failures;
- dispatch and snapshot latency thresholds documented and met;
- GPS freshness behavior documented by device state;
- route/deadline violations counted and within approved threshold;
- no unbounded queue growth or listener leak.

## Release package

Produce:

- migration dry-run and rollback report;
- feature-flag/writer-gate matrix;
- backend and app SHA mapping;
- canary tenant selection procedure;
- monitoring dashboard and alert thresholds;
- automatic/manual rollback criteria;
- operator runbook;
- explicit list of unverified platform limitations.

## Hard stop

Do not deploy, migrate production, enable a production writer/feature flag, send real pushes or publish TestFlight/Store builds without explicit human approval after reviewing this package.

## Acceptance

Gate G9 green and release package complete.
