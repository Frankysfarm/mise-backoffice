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
