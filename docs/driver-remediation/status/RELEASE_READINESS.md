# Release Readiness

Decision: **NOT READY FOR PRODUCTION**

The source and isolated PostgreSQL system is a strong release candidate:
G0–G4 and G6–G8 are green locally; G5 and G9 remain externally blocked.

Before release:

- complete signed iOS/Android builds and the physical device matrix;
- run hosted isolated E2E with real PostgREST/RLS/Realtime and sandbox
  push/payment/routing;
- rehearse migration, canary, rollback, on-call and driver training;
- approve thresholds and external alert destinations;
- verify old/new app and backend compatibility;
- capture pre/post data-integrity queries and restore evidence.

No production flag, migration, deployment, push, order or TestFlight upload is
authorized by this document.
