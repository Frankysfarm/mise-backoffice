# Driver Canary

Voraussetzungen: grüne lokale Gates, read-only Produktions-Preflight, Backup/Restore-
Nachweis, reproduzierbares Artefakt, kein Critical-Audit-Befund und genehmigtes
Fenster. Ohne diese Voraussetzungen bleibt der Release shadow-only.

Canary beginnt mit einem Tenant, einem Writer und internen Fahrern. Zuerst werden
nur Decisions verglichen; danach höchstens kontrollierte Testorders. Beobachtet
werden Duplicate Assignment/Batch, Push Claim/ACK, stale GPS, Route-pending-Dauer,
CAS-Konflikte, Reminder, Cancel/Append, Drop-off-Abschluss und Recovery.

Sofortiger Stopp bei Doppelzuweisung, Redispatch einer gelieferten Order, Abfahrt
ohne Plan, Drop-off vor Pickup, fremdem Tenantzugriff, nicht terminalem Offline-Push
oder fehlendem Audit. Nach jeder Stufe müssen Metriken und Datenabgleich explizit
freigegeben werden; Zeitablauf ist keine automatische Freigabe.
