# Remaining Release Blockers

## Produktion

- Produktiver Enum-/Check-/RLS-/Migrationsstand ist unbekannt. Der read-only
  Preflight muss auf dem exakten Ziel mit `affected=0` bestehen.
- Kein gehostetes schema-kompatibles E2E mit echtem PostgREST, RLS, Realtime,
  Google-Sandbox und Push-Providern wurde in diesem Auftrag ausgeführt.
- Die bekannte korrumpierte Order wurde nicht repariert; dafür existiert nur der
  genehmigungspflichtige Preview-/Backup-/Audit-Plan.
- Optimizer und Append-Consent sind absichtlich default-off/shadow-only. Der
  Writer-/API-/UI-Aktivierungsschritt benötigt einen separaten Canary.

## Mobile und Betrieb

- Signierter iOS-/Android-Build und reale Foreground/Background/Locked/Killed/
  Reboot-/Offline-/Permission-Device-Matrix fehlen.
- TestFlight-/Backend-SHA-Kopplung und Old-App/New-Backend-Kompatibilität sind
  nicht extern belegt.
- Restore-Probe, Alert-Ziele, On-call-Übung und Produktionsdisk-Retention fehlen.

## Toolchain/Security

- Acht High- und ein Moderate-npm-Advisory bleiben nach dem kompatiblen Next-
  14.2.35-Patch. Ein Sprung auf einen unterstützten Framework-Major muss separat
  migriert und vollständig regressionsgetestet werden.
- Der Voll-Typecheck ist für das Gesamt-Monorepo nicht als grünes Gate belegt;
  der fokussierte Driver-Typecheck und Produktionsbuild sind grün.

Releaseentscheidung: **BLOCKED für Produktion; SHADOW-ONLY lokal/isoliert.**
# Autonomous test-lab blockers — 2026-08-01

- TL-G1: minimal per-run PostgreSQL factory/cleanup is integrated; canonical storefront/API data creation and all actor profiles are not.
- TL-G2: Playwright/browser binaries, stable app selectors, authentication fixtures and a real click-through trace are absent.
- TL-G4: the independent oracle is green, but a production-decision comparison adapter and stored optimality gaps are open.
- TL-G5: the required categories and over 75 names exist; most are not yet executable full-stack cases.
- TL-G6: deterministic in-process chaos is green; real multi-session DB races, process kills and restart recovery remain to be wired into the lab.
- TL-G7: physical iOS/Android background, lock, terminated-app, push and GPS evidence needs devices/toolchains.
- TL-G8: authenticated dashboard execution/pause/abort, CI, nightly retention and bounded soak are open.
- TL-G9/TL-G10: three fixed-commit reviews rejected the current maturity; post-fix double sign-offs, final judge and employee acceptance have not run.
- The first Next build attempt exhausted the initially available disk space and was stopped safely. After removing only its reproducible `.next` output, a clean retry completed successfully (447 pages, including production-hidden `/test-lab`).

These blockers keep the decision `BLOCKED`. None authorizes production.

Three independent reviews of `8934b878` all returned `REJECT/BLOCKED`. Several
harness defects were subsequently fixed, but no post-fix sign-off is inferred.
