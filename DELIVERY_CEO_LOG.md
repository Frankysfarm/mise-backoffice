# CEO Agent — Anweisungen & Log

## Aktuelle Priorität
**Phase 1 zuerst!** Backend-Architekt soll mit dem Datenmodell beginnen.

## Anweisungen an Backend-Architekt
1. Starte mit `scripts/migrations/001_delivery_zones.sql`
2. Danach `002_delivery_tours.sql` + `003_tour_stops.sql`
3. Dann Dispatch Engine in `lib/delivery/`

## Anweisungen an Frontend-Ingenieur
1. Warte bis Backend mindestens Phase 1 (Datenmodell) fertig hat
2. Starte dann mit dem Küchen-Dashboard
3. Wenn Backend-APIs noch fehlen: Mock-Daten verwenden, aber in DELIVERY_PROGRESS.md notieren

## Reviews
- (noch keine Reviews — erster CEO-Lauf steht aus)

## Architektur-Entscheidungen
- Multi-Tenant über location_id (wie im restlichen System)
- Koordinaten als lat/lng (decimal)
- Zeiten in UTC
- Scoring als numerischer Wert 0-100
