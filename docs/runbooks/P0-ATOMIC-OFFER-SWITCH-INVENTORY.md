# P0 Atomic Offer: Switch-Inventar und Runbook

## Aktueller Zustand

Dieser Slice ist **nicht aktiviert**. `P0_ATOMIC_OFFER_ENABLED` ist nur bei
exaktem Wert `true` aktiv. Migration 274 droppt/deaktiviert keine Trigger und
verkabelt keinen Cron-/API-Pfad. Ein fehlender oder `enabled=false` Gate-Eintrag
bewahrt das bisherige Verhalten vollständig.

Vor einem Switch müssen alle realen Writer inventarisiert werden:

| Writer | Typ | Erwartete Aktion vor Canary |
|---|---|---|
| `trg_create_dispatch_batch` → `create_dispatch_batch` → `smart_dispatch_order` | `legacy_db` | Wrapper tenant-gesteuert; Trigger bleibt bestehen |
| `trg_frank_on_ready` → `fn_trigger_frank_on_ready` → `fn_frank_assign_nearest_driver` | `frank_db` | Wrapper tenant-gesteuert; Trigger bleibt bestehen |
| interner Frank-`dispatchTick` | `frank_js` oder `atomic_v1` | liest dieselbe DB-Election; Atomic zusätzlich per Env-Kill-Switch |
| Decline-/Recovery-Redispatch | API/Worker | denselben kanonischen Writer verwenden |
| Auto-Dispatch/Assignment Optimizer | Cron | Schreibmodus inventarisieren und ggf. Shadow-only |

## Preflight-Gate

```bash
psql "$STAGING_DATABASE_URL" \
  -v ON_ERROR_STOP=1 \
  -f scripts/preflight/274_atomic_single_order_offer.sql
```

Blockieren bei:

- fehlender Spalte oder Typabweichung,
- halb gesetzter Assignment-Referenz,
- Order-/Batch-Driver-Mismatch,
- doppeltem Stop-Schlüssel,
- mehreren aktiven Batches/Assignments,
- unbekanntem Writer oder Trigger.

## Additive Staging-Phase

1. Vollständigen, anonymisierten Schema-Klon verwenden.
2. Migration 274 anwenden.
3. Contract-, Behavior- und Zwei-Session-Race-Tests ausführen.
4. `P0_ATOMIC_OFFER_ENABLED` weiterhin nicht setzen.
5. Tabellen, Rechte und PostgREST-Schema-Reload prüfen.

## Shadow und Canary

1. Kandidat nur berechnen und Reason Codes vergleichen; keine RPC ausführen.
2. Einen synthetischen Test-Tenant auswählen.
3. Neue Worker-Version deployen, aber Gate noch deaktiviert lassen.
4. Vorhandene Dispatch-Ticks beenden lassen; keine laufende alte Worker-Version
   darf den Canary-Tenant mehr schreiben.
5. Atomic-Offer-Flag nur im Canary-Worker setzen.
6. Election ausschließlich transaktional setzen:

   ```sql
   SELECT public.fn_dispatch_set_writer_v1(
     '<canary-tenant>'::uuid, 'atomic_v1', true
   );
   ```

   Keine direkten Updates an `dispatch_writer_gates`.
7. Expiry-Worker für `fn_dispatch_expire_offers_v1` aktivieren, bevor das erste
   echte Offer erzeugt wird.
8. Accept und Decline müssen `offer_id` plus `assignment_version` mitsenden.

## Writer-Election

| Gate-Zustand | Verhalten dieses Tenants |
|---|---|
| Zeile fehlt oder `enabled=false` | Bestand unverändert; kein Canary-Switch |
| `legacy_db` | nur `trg_create_dispatch_batch` darf dispatchen |
| `frank_db` | nur `trg_frank_on_ready` darf dispatchen |
| `frank_js` | beide DB-Writer unterdrückt; Frank nutzt seinen Legacy-JS-Write |
| `atomic_v1` | beide DB-Writer und Legacy-JS unterdrückt; nur Atomic-RPC |

Unbekannte Writer werden durch Constraint und Switch-RPC abgelehnt. Der Switch
teilt einen tenant-spezifischen Advisory-Xact-Lock mit Create und Transition.
Ein Switch weg von `atomic_v1` schlägt bei aktiven Offers mit
`ACTIVE_ATOMIC_OFFERS_BLOCK_WRITER_SWITCH` fehl.

## Runtime-Lifecycle (lokal vorbereitet, weiterhin default-off)

Die bestehenden Accept-, Pickup- und Delivered-Endpunkte wechseln nur bei
`P0_ATOMIC_OFFER_ENABLED=true` und offenem tenant-spezifischem
`dispatch_writer_gates(writer='atomic_v1', enabled=true)` auf den atomaren
Pfad. Sonst bleibt ihr Legacy-Verhalten unverändert.

Jede atomare Mutation benötigt:

- `offer_id` (UUID)
- `assignment_version` (positive Ganzzahl)
- `transition_key` (UUID, bei Retry unverändert wiederverwenden)

`POST /api/driver/v1/offers/transition` unterstützt zusätzlich `accept`,
`decline`, `picked_up`, `in_progress`, `complete` und `cancel`. Konflikte
liefern strukturierte `reason_code`-Antworten und HTTP 409.

Der interne Expiry-Worker
`POST /api/driver/v1/internal/atomic-offer-expiry` benötigt den
`x-internal-token` und läuft nur, wenn zusätzlich
`P0_ATOMIC_OFFER_EXPIRY_ENABLED=true` gesetzt ist. Vor dem globalen Expiry-RPC
prüft er fail-closed, dass alle aktuell angebotenen Assignments einem offenen
Atomic-Tenant-Gate zugeordnet werden können.

## Pflichtmetriken

- aktive Assignments pro Order und Driver,
- Offer→Accept/Decline/Expire,
- Version-/CAS-Konflikte,
- Idempotency-Replays und Key-Mismatch,
- Outbox-Latenz und Fehler,
- halb gesetzte Order-Referenzen,
- aktive Offers nach `lease_expires_at`.

## Rollback

1. Neue Offers stoppen, aber den Gate noch nicht schließen.
2. Alle aktiven Offers abschließen, ablehnen oder über die versionierte RPC
   auslaufen lassen.
3. Tenant-Gate per `fn_dispatch_set_writer_v1` auf den vorherigen Writer
   (`legacy_db`, `frank_db` oder `frank_js`) stellen.
4. Canary-Flag entfernen und Atomic-Worker stoppen.
5. Neue Tabellen und Spalten nicht löschen.
6. Bereits erzeugte Offers über die versionierte Expiry-/Cancel-RPC schließen;
   niemals Referenzen per unbedingtem SQL-Update leeren.

## Nicht autorisiert durch dieses Runbook

- globales Deaktivieren oder Droppen bestehender Trigger,
- Produktionsmigration,
- automatischer GitHub-/TestFlight-/Backend-Release,
- Migration vorhandener aktiver Touren ohne separates Task Packet.
