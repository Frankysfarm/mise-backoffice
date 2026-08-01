# Autonomous driver-system test lab

The lab is a production-denying outer shell around deterministic scenario
execution. Its first boundary is the environment guard. Inside that boundary,
the scenario DSL drives synthetic UI/API actors, fixture providers and a
virtual clock. A permanent invariant monitor observes the canonical model after
every step. An independently implemented enumerating dispatch oracle compares
small decisions. Every run emits JSON, HTML, JUnit and replay metadata under a
unique run ID.

The CLI and future local/staging-only dashboard are adapters over the same
orchestrator. Neither owns a business-state writer. Database changes, when a
scenario needs them, must travel through canonical server contracts and every
created row must carry the run ID and test tenant.
