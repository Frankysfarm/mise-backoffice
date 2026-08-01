# Release Readiness

Decision: **NOT READY FOR PRODUCTION**

Final-completion decision (2026-08-01): **SHADOW-ONLY** for the adaptive
optimizer and **BLOCKED** for a production migration/activation.

The source and isolated PostgreSQL system is a strong release candidate:
G0–G4 and G6–G8 are green locally; G5 and G9 remain externally blocked.

The web production build and project-specific native source/config verifier are
green. Remaining mobile work requires real platform toolchains and devices.

The final-completion branch additionally proves migrations 285–288, including
two-session races and failpoints, and reduces `/fahrer/app` from roughly 905 kB
to 349 kB first-load JS. Next was patched from 14.2.18 to 14.2.35, removing the
observed critical audit item; eight high and one moderate dependency advisories
remain and require a separately tested framework-major upgrade.

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
# Autonomous test-lab release decision — 2026-08-01

Decision: **BLOCKED**. TL-G0 is green with double independent P0 review, but
TL-G1 is the first incomplete gate. TL-G2, TL-G4–TL-G10 also contain explicit
local or external blockers. No production deployment, migration, data change,
real push/order, provider charge or TestFlight operation was performed.
