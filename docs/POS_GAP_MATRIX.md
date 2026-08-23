# POS-Lückenmatrix"éÝyø§yÔ Restaurantbetrieb

Stand: 23.08.2026 · Branch `factory/table-order-pos-20260822`

## Als echte Funktion vorhanden

- Benutzer-, Mandanten- und Standortzugriff
- Kassen, aktive Kassenschicht und serverseitig geprüfter Mitarbeiter
- Tischplan, QR-Tische und Abhol-/Thekenverkauf
- Menü, Varianten, Optionen, Ausverkauft-Status und Küchenstationen
- Serverseitige Preis-, Steuer- und Trinkgeldberechnung
- Atomare Bar- und SumUp-Verkäufe mit Idempotenz und vollständigen Positionen
- Provider-verifizierte SumUp-Zahlung; unklare oder fehlende Zahlungen schlagen
  geschlossen fehl
- Echte Bonnummer, Bon-URL, Druckansicht und abgesicherter E-Mail-Versand
- TSE-Signierung nach erfolgreicher Buchung, ohne Doppelbuchung bei Wiederholung
- POS-Transaktionen, TSE-Felder, DSFinV-K, Z-Berichte und WORM-Export
- Stornooberfläche, Bargeldbewegungen, Bonhistorie und Abholaufträge

## Noch offen vor vollständiger Betriebsfreigabe

| Priorität | Bereich | Ist-Zustand | Ziel |
| --- | --- | --- | --- |
| P0 | Küche |"éÝyø§yÞAn KüchféÝyø§yÜ ist im Terminal noch nicht vollständig persistent | Order-Tickets, Stationen und Statusübergänge serverseitig speichern |
| P1 | Tischrechnung | Splitten ist noch nicht serverseitig aktiviert | nach Sitz, Position oder Betrag mit mehreren Zahlarten |
| P1 | Storno/Refund | vorhandene Wege sind noch nicht auf einen atomaren Gegenbeleg vereinheitlicht | Berechtigung, Grund, Audit und TSE in einem Ablauf |
| P1 | Tischaktionen | Transfer und Zusammenlegen sind nicht durchgehend atomar | Tischübertragung und Zusammenlegung mit Auditverlauf |
| P1 | Offline/Retry | Idempotenz ist vorhanden, aber keine vollständige Offline-Queue | sichtbarer Sync-Status und sichere Wiederaufnahme |
| P2 | Hardware | Drucker und Kassenlade sind konfigurierbar | echte Status- und Fehlerabnahme je Gerät |
| P2 | Auswertung | Berichte sind vorhanden | Zahlart-, Storno-, Trinkgeld- und Schichtabgleich vervollständigen |

## Abgeschlossenes POS-Arbeitspaket

1. Migration `083_pos_sale_atomic.sql` mit atomarem Verkauf und Idempotenz.
2. Serverseitige Warenkorb-, Options-, Steuer- und Trinkgeldberechnung.
3. Gesicherter Checkout für aktive Mitarbeiter-Kassenschichten.
4. Reale Barzahlung und provider-verifizierter SumUp-Checkout im Terminal v5.
5. Echte Bons einschließlich Drucklink und abgesichertem E-Mail-Versand.
6. Desktop- und Mobilabnahme für Bar, SumUp-Erfolg und Fail-closed-Verhalten.

## Nächstes Arbeitspaket

Persistente Küchenbons und Stationsstatus bilden den nächsten kritischen
Restaurantfluss. Danach folgen Split-Payment, atomare Stornos/Refunds,
Tischtransfer und Offline-Wiederaufnahme.

Eine Oberfläche gilt nicht als fertig, solange ihr Erfolgszustand nur simuliert ist.
