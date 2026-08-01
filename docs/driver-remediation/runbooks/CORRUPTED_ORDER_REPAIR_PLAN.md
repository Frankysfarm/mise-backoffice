# Corrupted Order Repair Plan

Dieses Dokument führt selbst keine Änderung aus.

1. Betroffene Order-ID(s) und alle Batches, Stops, Assignments, Pushes und Audit-
   Ereignisse read-only in eine unveränderliche Evidence-Datei exportieren.
2. Preview klassifiziert terminale Liefer-Evidenz, aktive Custody, doppelte aktive
   Batches und abhängige Abrechnung. Mehrdeutige Custody wird nicht automatisch
   repariert.
3. Vorher Backup plus getesteten Restore-Punkt dokumentieren.
4. Genehmigtes Reparatur-RPC sperrt Order und abhängige Zeilen, verlangt erwartete
   Versionen und Repair-ID, macht alte aktive Assignments/Stops terminal, setzt den
   kanonischen Orderstatus aus belegter Delivery-Evidenz und schreibt Audit.
5. Identischer Retry ist idempotent; abweichender Fingerprint wird abgewiesen.
6. Postcheck beweist: kein aktives Assignment, kein dispatchbarer gelieferter Auftrag,
   keine queued Assignment-Wakes und unveränderte fremde Orders.

Für die bekannte Order `ef0060bf-b15b-4463-a6e1-4216060cc249` wurde absichtlich
keine produktive Reparatur ausgeführt. Sie bleibt bis zu separater Genehmigung ein
Release-/Datenbereinigungsblocker.
