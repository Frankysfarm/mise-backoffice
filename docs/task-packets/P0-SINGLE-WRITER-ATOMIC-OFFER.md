# Task Packet: P0 Single-Writer Atomic Offer

## Problem und Auswirkung

Mehrere Dispatch-Pfade können dieselbe fertige Lieferorder sehen. Der bisherige
Frank-Pfad erzeugt Batch, Stops, Order-Verknüpfung, Audit und Push in getrennten
Requests. Ein Race oder Prozessabbruch kann Doppelzuweisungen oder halbe
Assignments hinterlassen.

## Belegte Baseline / Reproduktion

Read-only Live-Inventur vom 2026-07-24:

- zwei aktive `customer_orders`-Trigger starten unterschiedliche Dispatcher;
- ein zusätzlicher Cron startet Frank;
- vier Orders hatten nur eine von `mise_batch_id`/`mise_driver_id` gesetzt;
- eine Order hatte einen anderen Driver als ihr Batch;
- ein doppelter `(batch_id, order_id, type)`-Stop-Schlüssel verhindert einen
  blinden Unique-Index.

Reproduktionsszenario: Zwei Sessions versuchen zeitgleich dieselbe fertige,
unzugewiesene Lieferorder anzubieten. Vor diesem Slice gibt es keine gemeinsame
Assignment-Lease und keinen Idempotency-Key über alle Writes.

## Scope

- additive Version-/Lease-Spalten;
- kanonische Assignment- und Audit-Tabelle;
- atomare, idempotente RPC für eine einzelne Order;
- atomare Accept-/Decline-/Expiry-Transitions mit Assignment-Version;
- Push-Outbox-Write in derselben Transaktion;
- erwartete Order-Version und Zustands-Guards;
- standardmäßig deaktivierter TypeScript-Integrationsvertrag;
- tenant-spezifische Writer-Election für beide DB-Trigger und Frank-JS;
- serialisierter Writer-Switch mit Active-Offer-Drain-Guard;
- read-only Preflight und deterministische SQL-Vertragstests.

## Non-Goals

- keine Legacy-Trigger droppen oder global deaktivieren;
- kein Merge/Bundling;
- keine Fahrerwahl oder 15-km-Optimierung;
- keine Änderung an Accept/Cancel/Recovery;
- keine Produktion, Migration, GitHub-Push oder Release.

## Akzeptanzkriterien

1. Ein Idempotency-Key liefert bei Retry dasselbe Offer.
2. Pro Order kann höchstens ein aktives Assignment existieren.
3. Orderstatus, Typ, Version, bestehende Assignment-IDs, Driverstatus und
   GPS-Frische werden vor dem Write geprüft.
4. Batch, zwei Stops, Order-Claim, Assignment, Audit und Push entstehen in
   genau einer DB-Transaktion.
5. Bei einem Fehler bleibt kein Teilzustand bestehen.
6. Der Integrationspfad ist ohne explizites Feature Flag aus.
7. Ohne aktivierten Tenant-Gate bleiben alle bestehenden Trigger/Pfade
   unverändert. Mit Gate ist genau ein Writer für diesen Tenant zugelassen.
8. Gleiche Idempotency-Keys werden pro DB-Transaktion serialisiert; ein
   abweichender Request mit demselben Key wird abgelehnt.
9. Order, Driver und Offer müssen demselben Tenant gehören.
10. Eine aktive Offer-Lease reserviert sowohl Order als auch Driver.
11. `atomic_v1` unterdrückt tenant-spezifisch beide DB-Writer und den
    nicht-atomaren Frank-JS-Pfad; andere Tenants bleiben unverändert.
12. Ein Switch weg von `atomic_v1` wird blockiert, solange aktive Offers
    existieren. Switch, Create und Transition teilen denselben Tenant-Lock.

## Erlaubte Module

- `scripts/migrations/274_atomic_single_order_offer.sql`
- `scripts/preflight/274_atomic_single_order_offer.sql`
- `scripts/tests/274_atomic_single_order_offer_contract.sql`
- `lib/delivery/atomic-offer.ts`
- `lib/frank.ts`
- `docs/runbooks/P0-ATOMIC-OFFER-SWITCH-INVENTORY.md`

## Tests und Telemetrie

- Metadaten-/Funktionsvertragstest in einer Rollback-Transaktion.
- Verhaltens-, Cross-Tenant-, Idempotenz- und Failure-Injection-Test in einer
  isolierten PostgreSQL-Instanz.
- Der echte Zwei-Session-Race-Test ist als separates Skript auszuführen; ein
  vollständiges Supabase-Staging-Schema bleibt zusätzlich erforderlich.
- `dispatch_offer_audit` enthält Algorithmusversion, Reason Code,
  Idempotency-Key, erwartete Order-Version und Offer-Ergebnis.

## Rollout

1. Preflight ausführen und vorhandene Inkonsistenzen klassifizieren.
2. Migration in isolierter DB und Vertragstests ausführen.
3. Unabhängiges Review.
4. Migration additiv anwenden; Feature Flag bleibt aus.
5. Shadow/Canary für einen Test-Tenant.
6. Erst nach Beobachtung über `fn_dispatch_set_writer_v1` genau einen Writer
   umschalten; direkte Tabellen-Updates sind nicht Teil des Runbooks.

## Rollback

- Aktive Offers erst auslaufen/abschließen; dann Gate auf den vorherigen Writer.
- Feature Flag ausschalten.
- Neue Tabellen/Spalten während des Stabilitätsfensters nicht löschen.
- RPC-Rechte entziehen, falls der Pfad sofort gesperrt werden muss.

## Datenschutz und Sicherheit

- Preflight liefert nur Zählwerte, keine Namen, Adressen oder Tracks.
- RPC ist `SECURITY DEFINER` mit festem `search_path`.
- Ausführung ist ausschließlich `service_role` erlaubt.

## Explizite Annahmen

- Migrationen 008, 010, 015 und 021 sind vor Migration 274 angewandt.
- `mise_driver_tenants` und die in der Preflight-Datei gelisteten Spalten
  besitzen die erwarteten Typen.
- `mise_push_outbox` besitzt die vom bestehenden Push-Code verwendeten Spalten.
- Der erste Slice unterstützt bewusst nur eine Order pro neuem Batch.
- Die Migration allein schaltet keinen Writer um und beendet keine Legacy-Lease.
- Ein fehlender/deaktivierter Gate-Eintrag bedeutet bewusst „Bestand unverändert“
  und nicht „alle Writer aus“.
