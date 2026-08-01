# Production Migration Preflight

Dieses Runbook autorisiert keine Produktion. Es ist vor einer separat genehmigten
Migration vollständig read-only auszuführen.

1. Release-SHA, Backup-ID, Restore-Probe, DB-Version, freie Disk und Maintenance-
   Fenster protokollieren.
2. `scripts/preflight/285_driver_runtime_integrity.sql` mit read-only Rolle ausführen.
   Jede Zeile mit `affected > 0` ist ein Stop-Signal.
3. Tatsächliche Enum-/Check-Werte für Order, Batch, Driver, Stop und Assignment mit
   allen Literalen der Migrationen 274–287 vergleichen. Deutsch/Englisch-Mischung
   ist ohne explizite Kompatibilität BLOCKED.
4. Doppelte aktive Assignments/Batches, verwaiste Stops, gelieferte aber erneut
   dispatchbare Orders, malformed Push-IDs und Dedupe-Konflikte zählen.
5. Funktionssignaturen, Grants/RLS, abhängige Views/Trigger und Rolling-Deployment-
   Kompatibilität prüfen.
6. Dieselbe Migrationskette zweimal in einem Schema-Klon ausführen; Verhalten,
   Zwei-Session-Races und Failpoints müssen grün sein.
7. Erst danach shadow-only Canary mit aktivem Rollback-Watchdog erwägen. Jeder rote
   Punkt bedeutet keine Migration.
