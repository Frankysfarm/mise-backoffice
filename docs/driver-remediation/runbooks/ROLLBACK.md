# Driver Rollback

Rollback ist ein kontrollierter Writer-Stopp, kein ungeprüftes Down-Migration-Skript.

1. Canary-Tenant deaktivieren und Atomic-v2-Lease auslaufen lassen; keine neue
   Zuweisung starten.
2. Aktive Transaktionen/Claims drainen, Snapshot und Audit exportieren, Zeit/SHA
   protokollieren.
3. Applikation auf den letzten belegten SHA zurückrollen. Additive Tabellen und
   Spalten zunächst stehen lassen, damit alte und neue Binaries lesekompatibel sind.
4. Keine aktive Tour automatisch auf Legacy umschreiben. Inkonsistenzen quarantänen
   und über den genehmigten Reparaturplan behandeln.
5. Push-Outbox-Claims freigeben beziehungsweise terminalisieren, ohne Assignment-
   Alarm erneut zu erzeugen.
6. Datenbank-Restore nur bei nachgewiesener irreversibler Schema-/Datenkorruption und
   mit separat bestätigtem Recovery Point.
