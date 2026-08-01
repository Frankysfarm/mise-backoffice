# Final Completion Test Evidence

Stand: 2026-08-01. Alle Datenbanktests verwendeten wegwerfbare lokale PostgreSQL-
16-Instanzen. Keine Produktion wurde verbunden oder verändert.

| Nachweis | Ergebnis |
|---|---|
| `npm install` nach Entfernung des direkten Linux-x64-SWC-16-Pakets | PASS |
| `npm run build` mit Next 14.2.35 | PASS; 446 statische Seiten; `/fahrer/app` 75.9 kB, First Load 349 kB |
| fokussierter `tsc -p tsconfig.p0.json` | PASS |
| vollständiger `tsc` | kein Codeurteil; nach langem Lauf manuell beendet, Build überspringt Typen |
| `run-285-runtime-integrity.sh` | PASS |
| `run-285-runtime-integrity-race.sh` | PASS |
| `run-286-route-before-departure.sh` | PASS einschließlich Failpoints |
| `run-287-multi-order-cancel-arrival.sh` | PASS einschließlich Arrival-Race |
| `run-288-explicit-append-consent.sh` | PASS einschließlich Accept/Expiry-Races |
| adaptive optimizer replay/unit | PASS |
| canonical UI/importgraph contract | PASS |
| web/native push client contract | PASS |
| recovery/push and offline-outbox contracts | PASS |
| erweiterter `run-t10-local-release-readiness.sh` | PASS, Exit 0 |
| `git diff --check` | PASS |
| npm production audit nach Next-Patch | kein Critical; 8 High, 1 Moderate verbleiben |

Der erste Migration-285-Verhaltenslauf fand einen echten JSON-Operatorpräzedenz-
Fehler im Dedupe-Trigger. Nach Klammerkorrektur bestanden Verhalten und echte
Zwei-Session-Races. Dieses Fehlersignal wird nicht aus der Historie entfernt.
