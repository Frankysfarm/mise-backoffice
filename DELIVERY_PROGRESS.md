# Smart Delivery System — Fortschritt

## STATUS: MARKT-REIF ✅ — PHASEN 1–25 + POST-PHASE-9 + POST-PHASE-10 + CEO REVIEW #22 ABGESCHLOSSEN

## Agenten-Team
- **CEO Agent**: Review, QA, Integration, Bug-Fixes (8x/Tag)
- **Backend-Architekt**: DB, APIs, Dispatch Engine (8x/Tag)
- **Frontend-Ingenieur**: Kitchen UI, Fahrer-App, Storefront (8x/Tag)

## Phase 25: Webhook System + External Integration Engine [DONE ✅] — 2026-06-03
- [x] `scripts/migrations/025_webhooks.sql`
  - `delivery_webhooks` Tabelle: URL, HMAC-Secret, Events[], is_active, consecutive_failures, last_delivered_at
  - `delivery_webhook_deliveries` Tabelle: Delivery-Log mit attempt_count + next_retry_at (Retry-Queue)
  - `v_webhook_summary` VIEW: Webhook-Stats (total_delivered, pending_deliveries, failed_deliveries) für Admin
  - 3 Performance-Indizes: Pending-Queue (WHERE delivered_at IS NULL), Admin-Timeline, aktive Webhooks per Location
- [x] `lib/delivery/webhooks.ts` — Webhook Engine (10 Funktionen)
  - `registerWebhook(locationId, url, secret, events[], description)`: validiert URL/Secret/Events, INSERT
  - `listWebhooks(locationId)`: lädt v_webhook_summary mit Stats
  - `getWebhook(locationId, webhookId)`: Einzel-Lookup
  - `updateWebhook(locationId, webhookId, changes)`: partielle Updates (url/secret/events/is_active/description)
  - `deleteWebhook(locationId, webhookId)`: löscht Webhook + Deliveries via CASCADE
  - `queueWebhookEvent(locationId, eventType, payload)`: findet aktive Webhooks die den Event-Typ abonniert haben → Delivery-Einträge anlegen (fire-and-forget)
  - `processWebhookQueue(limit)`: verarbeitet pending Deliveries — HMAC-signiert, POST mit 10s Timeout
    - Retry-Backoff: 1 min → 5 min → 30 min → 2h → 8h (5 Versuche max)
    - Auto-Disable: nach 10 aufeinanderfolgenden Fehlern → is_active = false
    - Signatur-Header: `X-Mise-Signature: <sha256-hmac>`, `X-Mise-Event: <type>`
  - `processAllWebhooks()`: Cron-Wrapper (bis zu 100 Deliveries pro Tick)
  - `sendTestEvent(locationId, webhookId)`: Test-POST direkt (ohne Queue) für URL-Validierung
  - `getDeliveryLog(locationId, webhookId, limit)`: Delivery-History für Admin
- [x] `app/api/delivery/admin/webhooks/route.ts` — Webhook-Verwaltung
  - `GET ?location_id=...` — Liste mit Stats aus v_webhook_summary; Graceful-Fallback wenn Migration fehlt
  - `POST { location_id, url, secret, events[], description? }` — Webhook registrieren (409 bei Duplikat)
- [x] `app/api/delivery/admin/webhooks/[webhookId]/route.ts` — Einzel-Webhook
  - `GET ?location_id=...` — Details; `?log=true&limit=N` → + Delivery-Log (max 200)
  - `PATCH { location_id, url?, secret?, events?, is_active?, description? }` — Felder aktualisieren
  - `DELETE ?location_id=...` — löschen
  - `POST ?action=test { location_id }` — Test-Event senden (gibt ok, status, body, signature zurück)
- [x] Cron-Integration (`app/api/cron/smart-dispatch/route.ts`)
  - `processAllWebhooks()` parallel im 2-Min-Tick
  - Response enthält `webhooks: { processed, succeeded, failed }`
- [x] Tour-Status-Integration (`app/api/delivery/tours/[id]/status/route.ts`)
  - `on_route` → `queueWebhookEvent(batch_picked_up)` — Fahrer hat abgeholt
  - `delivered` → `queueWebhookEvent(batch_completed)` — Tour abgeschlossen
  - `cancelled` → `queueWebhookEvent(batch_cancelled)` — Tour storniert
  - Alle fire-and-forget, blockieren Response nicht
- Build: `./node_modules/.bin/next build` ✓ (0 Fehler, 0 Warnungen)

## Phase 24: Scheduled Orders + Pre-Order Management [DONE ✅] — 2026-06-03
- [x] `scripts/migrations/024_scheduled_orders.sql`
  - `customer_orders.scheduled_at` (timestamptz): Wunsch-Lieferzeitpunkt für Vorbestellungen
  - `customer_orders.schedule_status` ('scheduled'|'released'|'immediate'): Freigabestatus
  - `v_scheduled_orders` VIEW: Vorbestellungen nächste 24h mit kitchen_start_at + ready_for_dispatch
  - `release_due_scheduled_orders()` PL/pgSQL-Funktion: gibt fällige Orders frei (scheduled_at - prep_time <= NOW())
  - 2 Performance-Indizes für cron-basierten Scan + Admin-Übersicht
- [x] `lib/delivery/scheduled.ts` — Scheduled-Orders Engine (7 Funktionen)
  - `releaseScheduledOrders()`: scannt fällige Vorbestellungen, setzt schedule_status='released' (Graceful-Fallback wenn Migration fehlt)
  - `getScheduledQueue(locationId)`: Vorbestellungen nächste 24h via v_scheduled_orders
  - `scheduleOrder(orderId, scheduledAt, locationId)`: setzt scheduled_at + status, Validierung (min. 10 Min Vorlauf, nicht bereits dispatched)
  - `unscheduleOrder(orderId, locationId)`: hebt Vorbestellung auf → sofortiger Dispatch
  - `manuallyReleaseOrder(orderId, locationId)`: Admin-Freigabe (Bypass Zeitcheck)
  - `getScheduledSummary(locationId, hours)`: KPIs für nächste N Stunden (total/pending/released/next_due_in_min)
  - 2 neue DeliveryEventTypes: `order_scheduled` + `order_released_for_dispatch`
- [x] `PATCH /api/delivery/orders/[orderId]/schedule` — Vorab-Zeit setzen/ändern
  - Body: `{ scheduled_at: ISO8601, location_id }` → setzt schedule_status='scheduled'
  - Validierung: ≥10 Min Vorlauf, nicht bereits dispatched/delivered
- [x] `DELETE /api/delivery/orders/[orderId]/schedule` — Vorbestellung aufheben
  - `?location_id=...` → setzt scheduled_at=NULL, schedule_status=NULL
- [x] `GET+POST /api/delivery/admin/scheduled` — Admin-Verwaltung
  - `GET ?location_id=...&hours=4` — Queue + Summary (pending/released/next_due_in_min)
  - `POST { action: 'release', order_id, location_id }` — manuelle Freigabe
  - `POST { action: 'release_all', location_id }` — alle fälligen Orders freigeben
- [x] `lib/delivery/dispatch-engine.ts` — Dispatch-Filter erweitert
  - SELECT enthält jetzt `schedule_status`
  - `.or('schedule_status.is.null,schedule_status.neq.scheduled')` — 'scheduled'-Orders werden übersprungen bis Freigabe
  - `OrderRow` Interface um `schedule_status` erweitert
  - `lib/delivery/recovery.ts`: `OrderRow` + SELECT synchron erweitert
- [x] Cron-Integration (`app/api/cron/smart-dispatch/route.ts`)
  - `releaseScheduledOrders()` parallel im 2-Min-Tick
  - Response enthält `scheduled_releases: N`
- Build: `./node_modules/.bin/next build` ✓ (170 Seiten, 0 Fehler), `tsc --noEmit` ✓ (0 Fehler)

## Phase 23: Proactive Delay Alert System + Auto-Compensation [DONE ✅] — 2026-06-02
- [x] `scripts/migrations/023_delay_alerts.sql`
  - `delivery_delay_alerts` Tabelle: protokolliert Alert-Typen pro Bestellung (UNIQUE per order_id + alert_type → Idempotenz)
  - `delay_compensation_vouchers` Tabelle: auto-erstellte SORRY-XXXXX Gutscheincodes für >30-Min-Verspätungen (UNIQUE per order_id)
  - `v_delayed_orders` VIEW: Lieferbestellungen mit überschrittenem eta_latest + denormalisierter Alert-Status
  - `v_compensation_vouchers` VIEW: Gutscheine mit Bestelldetails für Admin-UI
  - 4 Performance-Indizes für schnellen Delay-Scan + Voucher-Lookup
- [x] `lib/delivery/delay-monitor.ts` — Delay-Monitor Engine (8 Funktionen)
  - `scanDelayedOrders(locationId)`: liest v_delayed_orders, Graceful-Fallback wenn Migration fehlt
  - `recordDelayAlert(orderId, locationId, alertType, delayMin, ...)`: UNIQUE-Guard gegen Duplikat-Alerts
  - `createCompensationVoucher(orderId, locationId, delayMin)`: generiert SORRY-XXXXX Code, Betrag 5/7.50/10€ je Verspätung
  - `processDelayedOrder(order)`: first_notice ab 15 Min, critical_notice + Gutschein ab 30 Min
  - `runDelayMonitor(locationId)`: Scan → Prozess-Schleife mit Error-Isolation pro Order
  - `runDelayMonitorAllLocations()`: Cron-Helfer, alle aktiven Locations parallel
  - `getCompensationVouchers(locationId, limit)`: Liste der Gutscheine für Admin
  - `DeliveryEventType` in events.ts: 3 neue Typen (`delay_first_notice`, `delay_critical_notice`, `delay_compensation_created`)
- [x] `app/api/delivery/admin/delay-monitor/route.ts` — Admin API
  - `GET ?location_id=...&limit=N` — verspätete Bestellungen + Gutscheine + Summary-KPIs
  - `POST { location_id }` — manueller Delay-Scan-Trigger mit Duration-ms
  - Auth-Guard + Graceful-Fehlerbehandlung
- [x] Cron-Integration: `runDelayMonitorAllLocations()` in smart-dispatch/route.ts (parallel Pool)
  - Response enthält `delay_monitor: { scanned, first_notices, critical_notices, vouchers_created }`
- Build: npm run build ✓ (170 Seiten, 0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 22: Customer Satisfaction Tracking + Post-Delivery Rating [DONE ✅] — 2026-06-02
- [x] `scripts/migrations/022_customer_satisfaction.sql`
  - `customer_delivery_ratings` Tabelle: 1-5 Sterne + Kommentar pro Bestellung (UNIQUE per order_id)
  - `rating_token` + `rating_sent_at` Spalten auf `customer_orders` (einmaliger Hash-Token für Rating-Link)
  - `v_driver_satisfaction` VIEW: avg_rating, total/positive/negative/5-star/1-star pro Fahrer
  - `v_location_satisfaction` VIEW: Tages-Aggregation pro Location (avg, positive, negative, with_comment)
  - `recompute_driver_rating_with_satisfaction()` PL/pgSQL: kombiniert ETA-Performance (60%) + Kunden-Rating (40%) → mise_drivers.rating
  - `trg_cdr_recompute` Trigger: auto-recompute nach jeder neuen Kunden-Bewertung
- [x] `lib/delivery/satisfaction.ts` — Satisfaction Engine (6 Funktionen)
  - `generateRatingToken(orderId)`: einmaliger SHA256-Hash-Token, idempotent (existierender Token wird zurückgegeben)
  - `generateMissingRatingTokens(locationId)`: Cron-Helfer, generiert Tokens für alle gelieferten Orders ohne Token (bis 100)
  - `submitCustomerRating({ token, rating, comment })`: Token-Lookup → Rating INSERT, UNIQUE-Guard, Fahrer-ID-Auflösung via Batch
  - `getSatisfactionSummary(locationId, days)`: KPIs + Tages-Trend + Fahrer-Aufschlüsselung + Kommentare
  - `getOrderForToken(token)`: gibt Mindest-Bestellinfo für Rating-Seite zurück (kein PII-Leak)
  - `markRatingTokensSent(orderIds)`: setzt rating_sent_at für Bulk-Tracking
- [x] `app/api/delivery/admin/satisfaction/route.ts` — Admin API
  - `GET ?location_id=...&days=14` — Zufriedenheits-Zusammenfassung (KPIs, Fahrer, Trend, Kommentare)
  - `POST { action: 'generate_tokens', location_id }` — Rating-Tokens manuell generieren
  - Graceful-Fallback wenn Migration 022 noch nicht ausgeführt
- [x] `app/api/delivery/orders/[orderId]/rate/route.ts` — Kunden-Rating API
  - `POST { token, rating, comment? }` — öffentlich, token-geschützt; gibt `alreadyRated: true` bei Duplikat
  - `GET` — Rating-Token generieren/abrufen (Admin-intern)
- [x] `app/rate/[token]/page.tsx` + `client.tsx` — Öffentliche Rating-Seite
  - Server-Component: Token-Lookup + alreadyRated-Check
  - Client: 5-Stern-UI mit Hover-Animation, Farbkodierung (rot→grün), optionaler Kommentar, Submission-State
  - Ungültiger Token: Fehler-Screen; bereits bewertet: Danke-Screen
- [x] Integration in bestehende Pipeline:
  - `tours/[id]/status PATCH`: Bei 'delivered' → `generateRatingToken()` für jeden Dropoff-Stop (fire-and-forget)
  - `cron/smart-dispatch`: `generateMissingRatingTokens()` alle 10 Min für alle aktiven Locations
  - Cron-Response: `rating_tokens_generated` Zähler wenn Rating-Tick aktiv
- Build: npm run build ✓ (172 Seiten, 0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 21: Autonomous Recovery Engine [DONE ✅] — 2026-06-02
- [x] `scripts/migrations/021_recovery_tracking.sql`
  - `delivery_recovery_events` Tabelle: jedes Recovery-Event (cancelled_batch, driver, reason, orders_recovered, new_batch_ids, duration)
  - `customer_orders`: `recovery_count` + `last_recovery_at` Spalten (wie oft wurde diese Bestellung recovery-geführt)
  - `v_recovery_summary` VIEW: Recovery-Events mit Fahrername + Fahrzeug für Admin-Anzeige
  - Index `idx_customer_orders_recovery` für schnelles Re-Queue-Scan
- [x] `lib/delivery/recovery.ts` — Autonomous Recovery Engine
  - `recoverCancelledBatch(batchId, reason, triggerRedispatch)`:
    - Lädt alle nicht-gelieferten Dropoff-Stops des gecancelten Batches
    - Befreit Orders: `mise_batch_id=null`, `priority='high'`, `dispatch_attempts=0`
    - Loggt Recovery-Event in `delivery_recovery_events`
    - Triggert sofortigen Re-Dispatch für die betroffenen Orders (synchron, best-effort)
    - Finalisiert Event-Record mit `orders_requeued` + `new_batch_ids`
  - `getRecoveryEvents(locationId, limit)` — Recovery-History für Admin
  - `scanStaleBatches(staleMinutes)` — findet Batches in `on_route`/`at_restaurant`/`assigned`
    ohne GPS-Ping seit >60 Min, cancelt + recovert sie automatisch (Cron-Helfer)
- [x] `app/api/delivery/admin/recovery/route.ts` — Admin API
  - `GET ?location_id=...&limit=N` — Recovery-Event-History
  - `POST { batch_id, reason? }` — manueller Recovery-Trigger für gecancelte/hängende Batches
  - Graceful-Fallback wenn Migration 021 noch nicht ausgeführt
- [x] `app/api/delivery/tours/[id]/status/route.ts` — Recovery-Integration
  - Bei `state='cancelled'`: `recoverCancelledBatch()` fire-and-forget
  - Orders werden automatisch befreit + mit `priority='high'` re-queued
- [x] `app/api/cron/smart-dispatch/route.ts` — `scanStaleBatches(60)` in Parallel-Pool
  - Prüft jede Minute ob Batches >60 Min ohne GPS-Update hängen → auto-cancel + recovery
  - Response enthält `recovery: { batches_scanned, batches_recovered }`
- Build: npm run build ✓ (0 Fehler, 170 Seiten), git push origin main ✓

## Phase 1: Datenmodell [DONE ✅]
- [x] delivery_zones Tabelle — `scripts/migrations/001_delivery_zones.sql`
- [x] dispatch_scores Tabelle — `scripts/migrations/002_delivery_tours_extend.sql`
- [x] kitchen_timings Tabelle — `scripts/migrations/002_delivery_tours_extend.sql`
- [x] mise_delivery_batches erweitern (zone, dispatch_score, kitchen_start_at, eta-Felder) — Migration 002
- [x] customer_orders erweitern (delivery_zone, dispatch_score, eta_earliest, eta_latest) — Migration 002
- [x] mise_drivers erweitern (current_capacity, max_capacity) — Migration 002
- [x] Performance-Indizes — `scripts/migrations/003_delivery_indexes.sql`
- [x] Fehlende Spalten nachgerüstet — `scripts/migrations/008_missing_columns.sql`
  - `mise_delivery_batches`: `polyline`, `total_distance_km`, `total_eta_min` (tour-optimizer schrieb diese, Spalten fehlten)
  - `mise_drivers`: `max_radius_km`, `rating`, `avg_delivery_min`, `zone` (dispatch-engine las diese, Spalten fehlten → Dispatch schlug lautlos fehl)
- [x] `v_open_dispatch_batches` mit `zahlungsart` + `bezahlt` — `scripts/migrations/009_view_payment_columns.sql`
  - View fehlte Zahlungsfelder → Fahrer-App Bargeld-Indikator zeigte immer €0 (CEO Review #7)
  - `customer_orders`: `mise_batch_id`, `mise_driver_id` IF NOT EXISTS (FK-Sicherheit)
  - `update_driver_zone()` Trigger: setzt `mise_drivers.zone` automatisch via GPS → verbessert `scoreZone()`
- **Hinweis**: delivery_tours/tour_stops sind als mise_delivery_batches/mise_delivery_batch_stops bereits vorhanden (Frank-System). Neue Spalten draufgelegt statt Duplikat.

## Phase 2: Dispatch Engine [DONE ✅]
- [x] `lib/delivery/zones.ts` — Zonen A/B/C/D, Cache, Upsert, Seed-Defaults
- [x] `lib/delivery/scoring.ts` — 10-Faktoren Score (0–100), rankDrivers()
- [x] `lib/delivery/bundling.ts` — Bündel-Check (selbes Restaurant / Detour < 1.5km), appendToTour()
- [x] `lib/delivery/eta.ts` — Dynamische ETA (Küche + Fahrzeit + Zone-Min), quickEta()
- [x] `lib/delivery/kitchen-sync.ts` — Küchen-Timing Upsert, Cron-Sync, Status-Transitions
- [x] `lib/delivery/tour-optimizer.ts` — Google Directions TSP + Nearest-Neighbor Fallback
- [x] `lib/delivery/dispatch-engine.ts` — Kern-Orchestrator (Zone→Score→Bundle→Tour→ETA→KücheSync→Log)

## Phase 3: API-Routes [DONE ✅]
- [x] POST /api/delivery/dispatch — Smart-Dispatch Tick oder Einzel-Order
- [x] GET /api/delivery/tours — Aktive Touren mit Stops + Fahrer
- [x] POST /api/delivery/tours/[id]/optimize — Tour-Routen-Optimierung
- [x] PATCH /api/delivery/tours/[id]/status — Tour-Status-Update
- [x] GET+POST /api/delivery/zones — Zonen-Konfiguration
- [x] GET /api/delivery/eta/[orderId] — Dynamische ETA für Bestellung
- [x] GET /api/delivery/kitchen/queue — Küchen-Queue mit Status
- [x] PATCH /api/delivery/kitchen/[orderId]/status — Küchen-Status-Update
- [x] GET /api/delivery/stats — Liefer-Statistiken

## Phase 3.5: Backend-Erweiterungen [DONE ✅]
- [x] `scripts/migrations/004_bridge_trigger.sql` — Bridge-Trigger mise→legacy, driver_live_positions View, Indizes
- [x] `app/api/cron/smart-dispatch/route.ts` — Vercel Cron Endpoint (alle 2 Min), CRON_SECRET + BISS_INTERNAL_TOKEN Auth
- [x] `vercel.json` — Cron `*/2 * * * *` für `/api/cron/smart-dispatch` eingetragen
- [x] `app/api/delivery/orders/[orderId]/tracking/route.ts` — Kunden-Live-Tracking (ETA-Label, Fahrerstatus, Stops-Vorher)
- [x] `app/api/delivery/admin/drivers/route.ts` — GET+PATCH Fahrer-Management (Live-Position, aktiver Batch, Status)
- [x] `app/api/delivery/admin/heatmap/route.ts` — Liefer-Heatmap (0.01°-Gitter, Gewichte, Zonen)
- [x] `app/api/delivery/admin/overview/route.ts` — Aggregiertes Admin-Dashboard (1 Request: Touren+Fahrer+Stats)

## Phase 4: Küchen-Dashboard [DONE ✅]
- [x] Kanban-Board (3 aktive Spalten: Angenommen → In Zubereitung → Fertig + Unterwegs-View)
- [x] Bestellkarten mit Items + Sonderwünsche (via `order_items` Join)
- [x] Countdown-Timer pro Bestellung (Sekunden-genau, live)
- [x] Farbcodierung (Grün/Gelb/Rot je nach Wartezeit)
- [x] One-Tap Status-Wechsel (bestätigt → in_zubereitung → fertig)
- [x] Sound-Notification neue Bestellung (new_order / urgent / order_picked)
- [x] Supabase Realtime Live-Updates (beide Batch-Tabellen)
- [x] Tablet-optimiertes Layout
- [x] "Warte seit X Min" Badge für Fertig-Bestellungen (CEO #3)

## Phase 5: Fahrer-App [DONE ✅]
- [x] Tour-Übersicht mit Stops (delivery-view.tsx — Fortschrittsbalken, Reihenfolge)
- [x] Karten-Ansicht mit Route — Leaflet-Map in delivery-view.tsx (Marker + Polyline); GET /api/delivery/tours/[id]/route liefert dekodierte Google-Straßenroute
- [x] Stop-Details (Kunde, Adresse, Items via pick-dialog.tsx)
- [x] Status-Buttons (Abgeholt → Zugestellt per Tap)
- [x] Navigation-Link (Apple Maps / Google Maps deeplink)
- [x] Tour-Zusammenfassung (elapsed time, Fortschrittsbalken, Distanz + ETA je Stop)
- [x] GPS-Standort senden (watchPosition → Supabase driver_locations)
- [x] Mobile-first Responsive

## Phase 6: Storefront + Tracking [DONE ✅]
- [x] Dynamische ETA-Anzeige ("19:20–19:40") — SuccessState mit Live-Polling alle 30s
- [x] Smart-Messaging (kein Bündelungs-Hinweis — ETA-basiert)
- [x] Live-Tracking Fahrer-Position — `/track/[bestellnummer]/` mit LiveMap (Leaflet), Fahrer-Avatar, Heading
- [x] `stops_before` Badge — "X Stops vor dir" / "Nächste Lieferung" live via Tracking-API-Polling
- [x] Realtime Order-Status-Updates — Supabase Realtime auf `customer_orders` + `driver_status`

## Phase 7: Admin Dashboard [DONE ✅]
- [x] Zonen-Konfiguration (API: `/api/delivery/zones` ✅, UI: `/delivery/zone` — Tabelle A/B/C/D mit Edit-Dialog)
- [x] Aktive Touren Übersicht — Dispatch Board + statistics-view Live-Panel
- [x] Fahrer-Management (Online/Offline) — statistics-view LiveDriver-Panel + `/api/delivery/admin/drivers`
- [x] Liefer-Statistiken Dashboard — statistics-view mit Tages-KPIs
- [x] Bestell-Heatmap — Top-Zonen-Tabelle in statistics-view (API: `/api/delivery/admin/heatmap`)

## Phase 9: Frontend-Erweiterungen [DONE ✅] — 2026-05-29
- [x] **Dispatch: Live Fahrer-Karte** — `DispatchDriverMap` (Leaflet, dynamisch geladen), zeigt GPS-Fahrer als farbcodierte Marker (grün=frei, orange=unterwegs, blau=zurück) + offene Order-Stops; einklappbares Panel
- [x] **Fahrer-App: Stop-ETA pro Stop** — `DeliveryView` erhält `batchStartedAt` + `totalEtaMin`; zeigt proportionale Ankunftszeit pro Stop (z.B. ~14:35), farbcodiert nach Pünktlichkeit
- [x] **Fahrer-App Pick-Phase** — Cash-to-collect Banner, Route-Vorschau via Google Maps Link, Cash-Indikator pro Stop
- [x] **Kitchen: Überfällig-Alert** — `OverdueOrdersAlert`: pulsierender roter Banner wenn ≥2 Bestellungen >5 Min überfällig, zeigt schlimmste Überschreitung + Bestellnummer
- [x] **Kitchen: „Nächste Fertig"-Countdown** — `in_zubereitung`-Spaltenheader zeigt Countdown bis frühestes Fertigwerden (🍳 2:15 oder ✓ Bereit!)
- [x] **Storefront: ETA-Zeitfenster-Balken** — `EtaWindowBar` visualisiert Lieferfenster als Timeline (Jetzt-Marker + Fenster-Bereich), live-tickend
- [x] **Statistik: Fahrer-Tagesranking** — Tabelle mit deliveries_today vs. gestern + Trend-Pfeile, via `/api/delivery/admin/performance`
- Build: npm run build ✓ (0 Fehler), 5 Commits, git push origin main ✓

## CEO Review #16: Post-Phase-Erweiterungen [DONE ✅] — 2026-06-01
- [x] **Dispatch: LongWaitOrdersPanel** — Bestellungen >8 Min ohne Fahrer werden hervorgehoben (rot); ≥15 Min pulsiert kritisch; klickbar zur direkten Auswahl → Fahrerzuweisung
- [x] **Dispatch: DriverZoneMatchPanel** — GPS-basierte Empfehlung welcher freie Fahrer am nächsten zur offenen Bestell-Zone ist
- [x] **Kitchen: PrepItemsPanel (Küchen-Checkliste)** — Aggregierte Item-Liste aller aktiven Kochbestellungen mit Dringlichkeits-Farbcodierung; nur sichtbar bei ≥3 Items oder ≥2 Bestellungen
- [x] **Kitchen: PickupWaitPanel** — Abholkunden im Status `fertig` mit Wartezeit-Farbcodierung (grün/amber/rot), Alarm ab 10 Min Wartezeit
- [x] **Kitchen: PickupForecastPanel** — Lieferungen die in <20 Min abholbereit sind (Frühwarnung für Küche)
- [x] **Fahrer-App: GPS-Proximity Auto-Arrived** — Automatische Ankunftserkennung per Haversine-Formel (<80m), kein manuelles Tippen; Doppel-Trigger-Schutz via `proximityTriggered` Set
- [x] **Fahrer-App: Re-Center-Button** — Karte auf aktuelle GPS-Position zentrieren mit Leaflet-Animation; erscheint nur bei bekannter GPS-Position
- [x] **Fahrer-App: Stundenlohn-Schätzung** — `≈ €/h` basierend auf Lieferungen × Basis-Provision + km-Anteil; erst ab 5 Min Online-Zeit angezeigt
- [x] **Fahrer-App: Tages-Meilenstein-Balken** — Goldbalken zu nächstem Meilenstein (5/10/15/20/30/50 Lieferungen) mit "Noch X bis zum Ziel"
- [x] **Fahrer-App: Abstand zur Abholung** — GPS-Distanzchip (Fahrer → Restaurant) pro offener Tour; 3-stufig farbcodiert
- [x] **Statistik: Schichtplan-Vorschau** — Nächste 8h Fahrerschichten mit Status (aktiv/kommend/fehlt), Fahrzeug-Emoji, Zeitanzeige via `/api/delivery/admin/shifts?hours=8`
- [x] **Statistik: SLA-Panel** — On-Time-Rate, Ø-Abweichung, Ø-Lieferzeit + Zone-Aufschlüsselung via `/api/delivery/admin/sla`
- [x] **Statistik: Gang-Timer Kitchen** — Countdown-Anzeige nach Kochphasen
- [x] **Dispatch: Zone-Quick-Select** — Schnellauswahl von Bestell-Zonen
- [x] **Storefront: Checkout-ETA aufgeteilt** — Küchen- + Fahrzeit visuell getrennt mit Ankunftszeit
- [x] **Storefront: Abholung-Status-Schritte** — Korrekte Schritte für Abholbestellungen (Angenommen→Zubereitung→Abholbereit→Abgeholt)
- TypeScript: 0 Fehler ✅ | Build: 169 Seiten, 0 Errors ✅ | git push origin main ✓

## Post-Phase-9: Visuelle Verfeinerungen [DONE ✅] — 2026-05-29 (CEO Review #9)
- [x] **Dispatch: DriverRow Return-Countdown** — Zeigt verbleibende Zeit bis Fahrer zurückkommt (~HH:MM), Stop-Fortschrittsbalken; 1s-Tick für Live-Countdown; Farbcodierung blau→orange→grün-pulse
- [x] **Kitchen: SmartTiming Banner verbessert** — Items sortiert (cooking zuerst), overdueCount triggert orange Rahmen, `nextReady`-Pill im Banner-Header, Mini-Fortschrittsbalken pro kochender Bestellung
- [x] **Kitchen: OrderTicket SVG-Ring** — Animierter Ring-Timer für `in_zubereitung`/`bestätigt` Bestellungen; Fortschritts-Balken + Countdown-Text; flaches Badge für andere Stati
- [x] **Fahrer-App: Tour-Fertigzeit im Header** — Zeigt `Tour fertig ~HH:MM` im Fahrer-Header, `✓ Tour abgeschlossen` bei 100% Stops
- [x] **Statistik: Top-Artikel-Widget** — Top-8 meistbestellte Artikel aus heutigen Abschlüssen, Balken-Visualisierung, Medaillensystem (Gold/Silber/Bronze)
- [x] **Storefront: Live-ETA-Indikator** — `LiveEtaBar`: pulsierender Auslastungsindikator (frei/normal/hoch) mit Live-Lieferzeit; neues GET `/api/delivery/eta/live` (öffentlich, polling 60s)
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓, 3 Commits, git push origin main ✓

## Phase 13: Live ETA Refresh für en-route Touren [DONE ✅] — 2026-05-30
- [x] **`scripts/migrations/014_live_eta_refresh.sql`** — Performance-Indices + Admin-View
  - `idx_mise_batches_state_driver` (Partial-Index): `on_route` Batches schnell finden
  - `idx_mise_batch_stops_batch_seq`: Stops in Reihenfolge effizient laden
  - `idx_customer_orders_eta_fields` (Covering-Index): ETA-Felder + status für Refresh
  - `v_en_route_summary` VIEW: Echtzeit-Übersicht aller on_route Touren (GPS-Alter, Lieferstatus, nächste ETA)
- [x] **`lib/delivery/eta.ts`** — `refreshEnRouteEtas()` + `computeEnRouteEta()`
  - `computeEnRouteEta()`: direkte Fahrzeitberechnung ohne Zonen-Minimum (food already picked up)
  - `refreshEnRouteEtas()`: verarbeitet bis zu 30 `on_route` Batches pro Tick
  - Virtuelle Fahrposition: simuliert Route-Reihenfolge (Stop i → Stop i+1)
  - Überspringt bereits gelieferte/stornierte Bestellungen, rückt Position vor
  - Fahrer ohne GPS-Signal werden übersprungen (`last_lat/last_lng` null-Check)
  - `EtaRefreshResult`: `batches_processed`, `orders_updated`, `orders_skipped`, `errors`
- [x] **`app/api/cron/smart-dispatch/route.ts`** — ETA-Refresh in Cron-Tick
  - `refreshEnRouteEtas()` parallel zu Dispatch, Küchen-Sync, Stale-Driver-Cleanup
  - Response enthält `eta_refresh: { batches, updated }` für Monitoring
  - Fehler-tolerant: Catch + Fallback-Objekt, blockiert Cron nicht
- [x] **`app/api/delivery/admin/eta-refresh/route.ts`** — Manueller Trigger (POST)
  - Auth: Authentifizierter Admin-User
  - Gibt `batches_processed`, `orders_updated`, `orders_skipped`, `errors`, `duration_ms` zurück
  - Nützlich nach GPS-Lücken oder bei Test
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 12: Dispatch-Eskalation + Stale-Order-Retry [DONE ✅] — 2026-05-30
- [x] **`scripts/migrations/013_dispatch_escalation.sql`** — Eskalations-Tracking auf `customer_orders`
  - `dispatch_attempts` (int, DEFAULT 0): zählt fehlgeschlagene Dispatch-Versuche
  - `last_dispatch_attempt_at` (timestamptz): letzter Versuch-Zeitpunkt
  - `dispatch_escalated_at` (timestamptz): Zeitpunkt der ersten Radius-Eskalation
  - `v_stale_unassigned_orders` VIEW: alle Lieferbestellungen ohne Zuweisung >10 Min mit `escalation_status`
  - `reset_dispatch_attempts()` Trigger: setzt Zähler zurück wenn `mise_batch_id` gesetzt wird
  - 2 Performance-Indizes für Stale-Order- und Eskalations-Abfragen
- [x] **`lib/delivery/dispatch-engine.ts`** — Eskalations-Logik in `smartDispatchTick()`
  - `radiusFactor = 1.5` nach ≥3 fehlgeschlagenen Versuchen (50% weiterer Radius)
  - Inkrementiert `dispatch_attempts` + setzt `last_dispatch_attempt_at` nach jedem "held"
  - Setzt `dispatch_escalated_at` beim ersten Eskalierungs-Trigger + loggt Event
  - Neues Return-Feld `escalated: number` im Tick-Ergebnis
  - `dispatchSingleOrder()` akzeptiert `radiusFactor` Parameter (default 1.0)
- [x] **`app/api/delivery/admin/stale-orders/route.ts`** — GET + POST
  - `GET ?location_id=...` — Stale-Orders mit Eskalations-Status (Fallback wenn Migration fehlt)
  - `POST { order_id }` — manueller Re-Dispatch mit erweitertem Radius (1.5×)
- [x] **`app/api/delivery/dispatch/route.ts`** — Einzelorder-Dispatch nutzt auch `dispatch_attempts` für Radius-Faktor
- [x] **`app/api/cron/smart-dispatch/route.ts`** — Response enthält `escalated` Zähler
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓

## Post-Phase-10: Visuelle Erweiterungen [DONE ✅] — 2026-05-30 (CEO Review #10)
- [x] **Dispatch: ScoreArcGauge** — SVG-Halbkreis-Gauge mit Notensystem A–F (Excellent/Sehr gut/Gut/Befriedigend/Verbesserung nötig) + Tier-Aufschlüsselung
- [x] **Dispatch: Revenue-on-Route Panel** — Zeigt laufenden Umsatz (unterwegs + wartet auf Abholung) im Score-Summary
- [x] **Kitchen: KitchenShiftStats** — Schnappschuss-Chips am Kopf: Fertig heute, /Std-Rate, in Zubereitung, wartet auf Fahrer, kritisch überzogen
- [x] **Kitchen: Zone-Bündelungs-Chip** — Fertig-Lieferbestellungen gleicher Zone erhalten `→ bündeln!`-Chip mit Link zu `/dispatch`
- [x] **Kitchen: CookingAlertBar** — Proaktiver Alert für Bestellungen mit Kochstart <5 Min (orange) oder überfällig (rot+puls); Mini-Progress-Bar je Bestellung
- [x] **Fahrer-App: NextStopHero** — Prominente Hero-Karte für nächsten Stop (Kunde, Adresse, ETA-Uhr, Entfernung, Bar/Online-Badge, Navigationsbutton)
- [x] **Fahrer-App: GPS-Speed ETA** — `StopEtaBar` nutzt Live-GPS-Geschwindigkeit für präzise Ankunftszeit (Fallback 15 km/h)
- [x] **Statistik: 15-Min-Tagesgang-Heatmap** — Balkendiagramm der Bestelldichte (letzte 4h in 15-Min-Slots), Peak-Anzeige
- [x] **Statistik: ShiftRevenuePanel** — Umsatz nach Typ (Lieferung/Abholung/Vor Ort) + Zahlungsart-Aufschlüsselung
- [x] **Storefront/Checkout: Live-ETA-Widget** — Küchenauslastung (quiet/normal/busy) + geschätzte Lieferzeit im Checkout-Formular
- Bug behoben: CookingAlertBar Mini-Progress-Bar zeigte immer 100% → Fix: 0%=5Min-vorher, 100%=Kochstart (CEO Review #10)
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓, git push origin main ✓

## Vorhandene Basis (CEO-Review 2026-05-28)
**Funktioniert bereits:**
- Dispatch Board `/dispatch` — manuelle Auftragsverteilung, Live-Realtime
- Liefer-Übersicht `/lieferdienst` — KPIs, Fahrer-Status, Plattform-Links
- Fahrer-App `/fahrer/app` — Push-Notifications, Basis-Struktur vorhanden
- Driver-API `/api/driver/v1/` — Auth (OTP), Aktive Touren, Sessions
- Delivery Admin `/delivery` — Zonen, Konditionen, Plattformen

**TypeScript-Status:** 0 Fehler (CEO-Review #10: 0 Fehler bestätigt)
**Build-Status:** Kompiliert sauber (npm run build ✅ — CEO-Review #10, 2026-05-30)
**Build-Achtung:** Nur `npm run build` verwenden! `npx next build` nutzt globales Next.js 16 (Turbopack-Fehler).

## CEO-Log
Siehe DELIVERY_CEO_LOG.md

## Offene Fragen / Hinweise für Frontend-Ingenieur
- Migrations 001–003 müssen in Supabase ausgeführt werden (scripts/migrations/)
- `lib/delivery/dispatch-engine.ts` → `smartDispatchTick()` kann den bestehenden `dispatchTick()` aus frank.ts ersetzen oder parallel laufen
- ETA-Labels: `GET /api/delivery/eta/[orderId]` liefert `display_label` z.B. "19:20–19:40"
- Realtime: Küchen-Dashboard kann `kitchen_timings` Tabelle via Supabase Realtime subscriben
- Zonen-Farben aus `delivery_zones.color` für Dashboard-Farbcodierung nutzen

## Neue API-Endpunkte (Phase 3.5)
| Endpoint | Methode | Zweck |
|---|---|---|
| `/api/cron/smart-dispatch` | GET | Vercel Cron — alle 2 Min Smart-Dispatch |
| `/api/delivery/orders/[id]/tracking` | GET | Kunden-Live-Tracking (öffentlich) |
| `/api/delivery/admin/drivers` | GET+PATCH | Fahrer-Management im Admin |
| `/api/delivery/admin/heatmap` | GET | Bestell-Heatmap-Daten |
| `/api/delivery/admin/overview` | GET | Aggregierter Dashboard-Snapshot |

## Phase 3.6: Bridge-Konsolidierung [DONE ✅]
- [x] `scripts/migrations/005_open_batches_view.sql`
  - `v_open_dispatch_batches` VIEW — union Legacy (status='pickup') + Mise (state='pending_acceptance')
    für Fahrer-App Inbox (vorher fehlend, jetzt korrekt dokumentiert)
  - `assign_to_driver()` RPC — atomischer Bridge-Write: manuelle Dispatch-Zuweisung
    schreibt in BEIDE Systeme (delivery_batches + mise_delivery_batches via auth_user_id-Lookup)
  - `claim_mise_delivery_batch()` RPC — Fahrer-App kann Mise-Batches annehmen
- [x] `app/(admin)/dispatch/client.tsx` — assignToDriver() nutzt assign_to_driver RPC + Legacy-Fallback
- [x] `app/fahrer/app/page.tsx` — lädt aktiven Batch aus Legacy + Mise (Mise als Fallback),
    Mise-Driver-Lookup via employees.auth_user_id → mise_drivers.auth_user_id
- [x] `app/fahrer/app/client.tsx` — Realtime + markDelivered() für beide Batch-Systeme
- [x] Phantom-Pfad `app/Users/eule/...` entfernt (war accidental commit, build-blocking unter Turbopack)
- **Build-Hinweis**: `npm run build` (Next.js 14.2.18 lokal) ✅ — NICHT `npx next build` (nutzt globales Next.js 16 → Turbopack-Fehler)

## Phase 3.7: Batch-Claim-Bug-Fix + Performance-API [DONE ✅]
- [x] `scripts/migrations/007_consolidation_and_perf.sql`
  - `v_open_dispatch_batches` — `source_system` Spalte ('legacy'|'mise') ergänzt
    **BUG FIX**: Fahrer-App rief `claim_delivery_batch` für Mise-Batches auf → immer Fehler
  - `v_driver_performance_stats` — Fahrer-KPIs (heute/gestern, aktiver Batch, letzter Standort)
  - `increment_driver_deliveries()` Trigger — `mise_drivers.total_deliveries` automatisch hochzählen
  - `v_delivery_batch_unified` — schreibgeschützte Admin-View: beide Systeme vereint
- [x] `app/fahrer/app/client.tsx`
  - `OpenBatch` Typ um `source_system` erweitert
  - `claimBatch()` ruft jetzt `claim_mise_delivery_batch` für Mise-Batches auf,
    `claim_delivery_batch` nur für Legacy-Batches
- [x] `app/api/delivery/admin/performance/route.ts`
  - `GET /api/delivery/admin/performance?location_id=...` — Fahrer-KPIs aus `v_driver_performance_stats`
  - Fallback-Antwort wenn View noch nicht in DB (Migration noch nicht ausgeführt)

## Phase 8: Multi-Tenant-Härtung + Küchen-Cron [DONE ✅]
- [x] `scripts/migrations/010_location_id_on_batches.sql`
  - `mise_delivery_batches.location_id` hinzugefügt (FK → locations)
  - Backfill bestehender Zeilen via stops → customer_orders → location_id
  - Index `idx_mise_batches_location_state` für performante Admin-Abfragen
  - Trigger `trg_batch_location_from_stop` als Sicherheitsnetz (auto-set beim ersten Stop-Insert)
- [x] `lib/delivery/dispatch-engine.ts` — `location_id: o.location_id` beim Batch-Insert gesetzt
- [x] `app/api/delivery/tours/route.ts` — `.eq('location_id', locationId)` Filter ergänzt
  - **Bug fix**: Batches wurden ohne Location-Filter geladen → alle Touren aus allen Tenants sichtbar
- [x] `app/api/delivery/stats/route.ts` — `.eq('location_id', locationId)` Filter für Touren-Query
  - **Bug fix**: Stats-Touren waren ungefilterter Cross-Tenant-Dump
- [x] `app/api/delivery/admin/overview/route.ts` — `.eq('location_id', locationId)` + String-Konkatenation entfernt
  - **Bug fix**: Aktive Touren im Overview-Panel zeigten Touren aus fremden Locations
  - **Fix**: `.select()` als Single-Literal (kein `+` mehr) — CEO-Regel aus Review #3
- [x] `app/api/cron/smart-dispatch/route.ts` — `syncKitchenNotifications()` in Parallel-Aufruf ergänzt
  - **Bug fix**: Geplante Küchen-Timings (`status='scheduled'`) transitierten nie automatisch zu 'cooking'
    weil `syncKitchenNotifications()` nur im Kitchen-Queue-Endpoint aufgerufen wurde, nicht im Cron
  - Ergebnis: `kitchen.notified` + `kitchen.locations` jetzt in Cron-Response

## Phase 10: Produktions-Härtung [DONE ✅] — 2026-05-29
- [x] `scripts/migrations/011_production_hardening.sql`
  - `cancel_order_from_batch(p_order_id)` — atomisch: Stop löschen, Batch stornieren wenn leer, Order stornieren
  - `mark_stale_drivers_offline()` — Fahrer offline stellen wenn kein GPS-Ping seit 30 Min; wird im Cron aufgerufen
  - Index `idx_mise_drivers_state_updated` für Stale-Driver-Erkennung
  - Index `idx_customer_orders_pending_dispatch` für Dispatch-Backlog-Health-Check
  - Index `idx_mise_batch_stops_order` für schnelles Stop-Löschen bei Stornierung
- [x] `app/api/delivery/orders/[orderId]/cancel/route.ts` — `PATCH` Stornierung
  - Prüft: Lieferung, nicht bereits storniert/abgeschlossen/geliefert
  - Nutzt `cancel_order_from_batch` RPC (atomisch), Fallback auf direktes Update
  - Re-optimiert verbleibende Tour-Stops (best-effort)
  - Loggt `batch_cancelled` Event
- [x] `app/api/delivery/health/route.ts` — `GET` Health-Check (kein Auth)
  - `status: 'ok' | 'degraded' | 'down'`
  - Checks: DB-Konnektivität, Zonen konfiguriert, Online-Fahrer, Dispatch-Backlog (<20 Pending = ok)
  - HTTP 503 bei DB-Ausfall, sonst 200
- [x] `app/api/cron/smart-dispatch/route.ts` — Stale-Driver-Cleanup ergänzt
  - `mark_stale_drivers_offline()` parallel zu Dispatch + Küchen-Sync
  - Response enthält `stale_drivers_cleaned: number`
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 11: Driver-State-Bugfixes [DONE ✅] — 2026-05-29
- [x] **KRITISCH: `dispatch-engine.ts` loadActiveDrivers()** — State-Filter `['online','auf_tour']` → `['idle','assigned','at_restaurant','en_route','returning']`
  - Ursache: Reale States (gesetzt von driver-app/me/online) sind `idle|assigned|at_restaurant|en_route|returning`, NICHT `online|auf_tour`
  - Symptom: Dispatch-Engine fand NIE Fahrer → jede Bestellung war "Kein aktiver Fahrer verfügbar" → alle Orders wurden gehalten
- [x] **KRITISCH: `health/route.ts`** — `mise_drivers.location_id` entfernt (Spalte existiert nicht!) + States korrigiert
  - Ursache: mise_drivers hat KEINE location_id-Spalte → PostgREST-Fehler bei jedem Health-Check mit location_id
  - Symptom: drivers_online count immer 0 + potentieller 400-Fehler
- [x] **`overview/route.ts`** — `state === 'online' || state === 'auf_tour'` → `state !== 'offline'`
  - Symptom: driversOnline im Admin-Dashboard immer 0
- [x] **`eta/live/route.ts`** — `driver_status` (Legacy-Tabelle) → `mise_drivers` mit korrekten States
  - CEO-Review #9 hatte bereits den fehlenden location_id-Filter auf driver_status angemerkt
  - Fix: benutzt jetzt mise_drivers (das echte Smart-Dispatch-System) konsistent
- [x] **`scripts/migrations/012_fix_driver_states.sql`** — `mark_stale_drivers_offline()` korrigiert
  - Migration 011 verwendete States `'available'` und `'on_delivery'` die nie vorkommen
  - Symptom: Stale-Fahrer-Cleanup im Cron bereinigt nie irgendeinen Fahrer
  - Index `idx_mise_drivers_state_updated` neu erstellt mit richtigen States
  - Neuer Index `idx_mise_drivers_active_state` für Dispatch-Pool-Abfragen

## Phase 14: Route-Polyline API + Karten-Ansicht [DONE ✅] — 2026-05-30
- [x] **`lib/delivery/polyline.ts`** — Google Encoded Polyline Decoder/Encoder
  - `decodePolyline(encoded)`: Precision-5-Dekodierung → `LatLng[]`
  - `encodePolyline(points)`: Encoder (für Static-Map-URLs + Tests)
  - Null-safe: leerer Input → leeres Array, kein Crash
- [x] **`app/api/delivery/tours/[id]/route/route.ts`** — `GET` Straßenroute für Fahrer-Map
  - Auth: Supabase Session (Admin oder Fahrer-App via Cookie)
  - Gibt `polyline_points` (dekodiert) + `stop_markers` + `has_google_route` zurück
  - Fallback: wenn kein Google-Polyline → Stop-Koordinaten als gerade Linie
  - `total_distance_km` + `total_eta_min` aus Batch
- [x] **Phase 5 Karten-Ansicht** als erledigt markiert
  - Leaflet-Map bereits in `delivery-view.tsx` implementiert (Marker + Polyline)
  - Neue Route-API ermöglicht Upgrade auf tatsächliche Straßenroute statt gerader Linien
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 15: Driver Push Notification bei Dispatch [DONE ✅] — 2026-05-31
- [x] **`lib/delivery/push-notify.ts`** — Fahrer Push-Notification Modul
  - `enqueueBatchPush()`: Schreibt in `mise_push_outbox` wenn Tour dispatched oder gebündelt wird
  - `enqueueTourStatusPush()`: Allgemeiner Status-Push (Tour/Bestellung storniert, Tour geändert)
  - Eigener Service-Client (kein N+1, fire-and-forget Pattern)
- [x] **`lib/delivery/dispatch-engine.ts`** — Push nach Dispatch/Bundle
  - `dispatchSingleOrder()`: ruft `enqueueBatchPush()` nach erfolgreicher Zuweisung auf
  - Fire-and-forget (`.catch(() => {})`) — Push-Fehler blockieren nie den Dispatch
- [x] **`app/api/delivery/orders/[orderId]/cancel/route.ts`** — Fahrer bei Stornierung benachrichtigen
  - `enqueueTourStatusPush()` bei `tour_cancelled` (ganzer Batch) oder `order_cancelled` (ein Stop)
  - Fahrer erhält Nachricht: "Tour storniert" oder "Bestellung X entfernt · N Stops verbleiben"
- [x] **`scripts/migrations/015_push_notify_dispatch.sql`** — Performance-Indices + Monitoring-View
  - `idx_mise_push_outbox_unsent`: push-flush-Cron Partial-Index (sent_at IS NULL)
  - `idx_mise_push_outbox_batch`: JSON-Index für Batch-ID-Lookup im Outbox
  - `idx_driver_push_outbox_unsent`: VAPID-Web-Push Partial-Index
  - `v_push_delivery_stats` VIEW: Push-Durchsatz letzte 24h (mise + webpush Kanäle)
- [x] **`app/api/delivery/admin/push-stats/route.ts`** — `GET` Monitoring-Endpoint
  - Zeigt delivered/failed/pending für beide Push-Kanäle (mise + webpush)
  - Type-Breakdown (order_assigned, tour_cancelled, order_cancelled etc.)
  - Auth: Authentifizierter Admin-User
- Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 16: Driver Auto-Rating + SLA Tracking [DONE ✅] — 2026-05-31
- [x] **`scripts/migrations/016_driver_rating.sql`** — Feedback-Loop für Dispatch-Scoring
  - `delivery_performance` Tabelle: pro-Stop SLA-Audit (eta_earliest/latest, completed_at, deviation, on_time, delivery_min)
  - `recompute_driver_rating(p_driver_id)` PL/pgSQL-Funktion: berechnet mise_drivers.rating (1–5) + avg_delivery_min aus letzten 30 Lieferungen
  - `record_stop_performance()` Trigger-Funktion: auto-record nach `mise_delivery_batch_stops.completed_at`-Update
  - `trg_perf_on_stop_complete` Trigger: AFTER UPDATE OF completed_at (nur dropoff-Stops)
  - `v_delivery_sla` VIEW: On-Time-Rate, Abweichung, Lieferzeit aggregiert pro Fahrer/Zone/Tag
  - 4 Performance-Indizes inkl. Partial-Index für SLA-Berechnungen
  - mise_drivers.rating + avg_delivery_min Defaults gesichert (4.5 / 25 Min)
- [x] **`lib/delivery/rating.ts`** — TypeScript-Wrappers
  - `recordDeliveryPerformance()`: manueller Insert in delivery_performance (für Bulk-Nachholen)
  - `recomputeDriverRating()`: ruft DB-Funktion auf — aktualisiert Rating nach min. 3 Datenpunkten
  - `getSlaSummary()`: aggregierte SLA-Stats für eine Location (overall + byDriver + byZone)
- [x] **`app/api/delivery/admin/sla/route.ts`** — `GET ?location_id=...&days=7`
  - On-Time-Rate (%), avg Abweichung, avg Lieferzeit — overall + per Fahrer + per Zone
  - Fallback-Antwort wenn delivery_performance noch leer (_hint Erklärung)
  - Auth: eingeloggter Admin-User
- [x] **`app/api/delivery/tours/[id]/status/route.ts`** — Enhanced: Rating nach Tour-Abschluss
  - Bei Übergang → 'delivered': `recomputeDriverRating()` fire-and-forget nach dem Status-Update
  - Fahrer-Rating aktualisiert sich sofort nach Tourende → nächste Dispatch-Entscheidung nutzt frischen Wert
- Build: npm run build ✓ (169 Seiten, 0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 17: Schicht-Management + Einsatzplanung [DONE ✅] — 2026-05-31
- [x] **`scripts/migrations/017_shift_management.sql`** — Datenmodell + DB-Logik
  - `driver_shifts` Tabelle: geplante/tatsächliche Schichten (scheduled→active→completed/missed/cancelled)
  - `coverage_requirements` Tabelle: Mindest-/Ziel-Fahrerzahl pro Wochentag/Stunde
  - `v_shift_coverage` VIEW: Abdeckungs-Analyse nächste 24h (slot_start, gap, covered)
  - `auto_close_missed_shifts()` Funktion: markiert vergessene Schichten (>30 Min ohne Start → missed)
  - 4 Performance-Indizes inkl. Partial-Index für aktive/geplante Schichten
- [x] **`lib/delivery/shifts.ts`** — TypeScript-Modul
  - `getActiveShifts()`: laufende Schichten einer Location
  - `getUpcomingShifts()`: geplante Schichten der nächsten N Stunden
  - `getShiftsByDate()`: Tages-Ansicht (Kalender)
  - `startShift()` / `endShift()` / `cancelShift()`: Schicht-Aktionen
  - `getCoverageGaps()`: Unterdeckungs-Analyse via v_shift_coverage
  - `getCoverageRequirements()` / `upsertCoverageRequirement()`: Anforderungs-Verwaltung
  - `autoCloseMissedShifts()`: Cron-Hilfsfunktion (fire-and-forget kompatibel)
  - `getCurrentCoverageStatus()`: Schnapp­schuss für Health-Check
- [x] **`app/api/delivery/admin/shifts/route.ts`** — GET + POST
  - `GET ?location_id=...&date=YYYY-MM-DD` — Tages-Schichten (Kalender)
  - `GET ?location_id=...&hours=N&status=...` — Kommende Schichten mit Filter
  - `POST { driver_id, location_id, planned_start, planned_end, notes }` — Schicht erstellen
- [x] **`app/api/delivery/admin/shifts/[id]/route.ts`** — PATCH + DELETE
  - `PATCH { status?, actual_start?, actual_end?, planned_start?, planned_end?, notes? }` — Schicht updaten
  - `DELETE` — Schicht stornieren (nur scheduled)
- [x] **`app/api/delivery/admin/coverage/route.ts`** — GET + POST
  - `GET ?location_id=...&hours=24&gaps_only=true` — Abdeckungs-Analyse (alle Slots oder nur Gaps)
  - `POST { location_id, day_of_week, hour_of_day, min_drivers, target_drivers }` — Anforderung setzen
  - Summary-Block: total_slots, covered_slots, uncovered_slots, worst_gap
- [x] **Cron-Erweiterung** (`app/api/cron/smart-dispatch/route.ts`)
  - `autoCloseMissedShifts()` parallel zu Dispatch + Küchen-Sync + ETA-Refresh
  - Response enthält `shifts_closed` Zähler für Monitoring
- [x] **Health-Check-Erweiterung** (`app/api/delivery/health/route.ts`)
  - Neuer Check `shift_coverage`: `uncovered_slots` + `understaffed_slots` nächste Stunde
  - `ok: false` wenn Coverage-Lücken bestehen → `status: 'degraded'`
- Build: npx tsc --noEmit ✓ (0 Fehler)

## Phase 18: Driver Payout Engine + Financial Reports [DONE ✅] — 2026-06-01
- [x] **`scripts/migrations/018_payout_engine.sql`** — Datenmodell + DB-Logik
  - `driver_payout_configs` Tabelle: Location-spezifische Vergütungs-Konfiguration (Basis, km-Rate, Spitzenzeiten, Rating-Bonus, Meilenstein-Boni)
  - `driver_payout_records` Tabelle: Einzelabrechnungen pro Lieferung (base + km + peak + rating + milestone Boni)
  - `driver_payout_periods` Tabelle: Tages-/Wochen-Perioden-Zusammenfassung (draft → approved → paid Workflow)
  - `generate_driver_period_payout(driver_id, location_id, start, end, type)` PL/pgSQL-Funktion: aggregiert Records zu Period, verknüpft Records mit Period-ID
  - `v_pending_payouts` VIEW: Alle offenen (draft/approved) Perioden mit Fahrername
  - `v_daily_payout_summary` VIEW: Tages-Aggregation pro Location (Fahrer, Lieferungen, Gesamt-Payout, Spitzenzeit-Anteil)
  - 4 Performance-Indizes (Fahrer/Location/Zeitraum, Unpaid-Partial-Index)
- [x] **`lib/delivery/payout.ts`** — TypeScript Payout Engine (400+ Zeilen)
  - `getPayoutConfig()`: Lädt Konfiguration oder erstellt Default (inkl. 6 Default-Spitzenzeiten-Fenster)
  - `upsertPayoutConfig()`: Konfiguration speichern (UPSERT via location_id)
  - `calculateDeliveryPayout()`: Einzellieferung berechnen + DB-Record schreiben (fire-and-forget kompatibel)
    - Automatische km-Berechnung via Haversine (Restaurant → Kunde) wenn nicht übergeben
    - Fahrer-Rating aus DB geladen wenn nicht übergeben
    - Tages-Lieferungen gezählt für Meilenstein-Prüfung
    - Peak-Zeit-Erkennung via Wochentag + Zeitfenster-Vergleich
    - Breakdown-String für Admin-Anzeige (z.B. "Basis: €3.00 | km-Bonus: €0.85 (3.4km × €0.25) | Spitzenzeit: +€0.60")
  - `generatePeriodPayout()` / `generateAllPeriodsForDate()`: Periodenabschluss (täglich/wöchentlich)
  - `getDriverPayouts()` / `getPeriodPayouts()`: Abrechnungen auflisten (filterbar nach Fahrer, Status, Datum)
  - `approvePeriod()` / `markPeriodPaid()`: Approval-Workflow (draft → approved → paid)
  - `getPayoutSummary()`: Heutiger Überblick (aktive Fahrer, Lieferungen, Gesamt-Payout, Top-5-Fahrer)
- [x] **`GET+POST /api/delivery/admin/payout-config`** — Vergütungskonfiguration
  - GET: Aktuelle Konfiguration laden (auto-erstellt Default wenn keine vorhanden)
  - POST: Konfiguration speichern (Basis, km-Rate, Peak-Fenster, Meilensteine, ...)
- [x] **`GET+POST /api/delivery/admin/payouts`** — Abrechnungs-Management
  - GET `?view=summary`: Tages-Überblick (Fahrer, Lieferungen, Gesamt-Payout, Top-Fahrer)
  - GET `?view=records`: Einzelabrechnungen (filterbar: driver_id, since, paid_out)
  - GET `?view=periods`: Periodenübersicht (filterbar: driver_id, status)
  - POST `{action: "generate_daily", location_id, date}`: Tages-Perioden für alle Fahrer generieren
  - POST `{action: "approve_period", period_id}`: Periode freigeben
  - POST `{action: "mark_paid", period_id}`: Periode als bezahlt markieren
- [x] **`tours/[id]/status` PATCH** — Payout-Berechnung nach Tour-Abschluss
  - Bei Übergang → 'delivered': Payout-Records für alle abgeschlossenen Dropoff-Stops erstellt (fire-and-forget)
  - Parallel zu bereits vorhandenem Rating-Recompute
- Build: npm run build ✓ (169 Seiten, 0 Fehler) ✅

## Phase 19: Demand Forecasting Engine [DONE ✅] — 2026-06-01
- [x] **`scripts/migrations/019_demand_forecast.sql`** — Datenmodell + Views
  - `delivery_demand_snapshots` Tabelle: stündlicher Bedarfs-Snapshot pro Location (orders_count, delivered_count, avg_delivery_min, peak_zone)
  - UNIQUE-Index (location_id, snapshot_hour): idempotente UPSERTs, kein Datenmüll
  - `v_hourly_demand_pattern` VIEW: Wochentag+Stunden-Muster aus letzten 8 Wochen (avg, stddev, peak, data_points)
  - `v_forecast_coverage_recs` VIEW: Fahrer-Empfehlung aus Muster (ceil(avg/3), ceil(peak/3), min data_points≥2)
- [x] **`lib/delivery/forecast.ts`** — TypeScript Forecasting Engine
  - `snapshotDemand(locationId)` — Stunden-Snapshot für eine Location (idempotent via UPSERT)
  - `snapshotAllLocations()` — Alle aktiven Locations in einem Aufruf (Cron-Helfer, fire-and-forget)
  - `getForecast(locationId, hours)` — Vorhersage für nächste N Stunden: expectedOrders, confidenceOrders (±1σ), peakOrders, recommendedDrivers
  - `updateCoverageFromForecast(locationId)` — Auto-Update `coverage_requirements` aus Forecast-Muster (≥4 data_points → verlässlich)
  - Berlin-UTC-Offset korrekt berechnet (CET/CEST via lastSunday-Algorithmus)
- [x] **`GET+POST /api/delivery/admin/forecast`** — Forecast-API
  - `GET ?location_id=...&hours=6` — Stündliche Vorhersage + Summary (peak, total, max recommended drivers)
  - `POST { action: 'snapshot' }` — Snapshot manuell triggern (Admin, Testing)
  - `POST { action: 'update_coverage' }` — Coverage-Requirements sofort aus Forecast aktualisieren
- [x] **Cron-Integration** (`app/api/cron/smart-dispatch/route.ts`)
  - `snapshotAllLocations()` alle 30 Min (Minute :00–:01 oder :30–:31)
  - Response enthält `demand_snapshot: { locations, snapshots }` wenn aktiv
  - Fehler-tolerant: catch + null → kein Cron-Block
- Build: npm run build ✓ (170 Seiten, 0 Fehler), npx tsc --noEmit ✓ (0 Fehler)

## Phase 20: Operational Alerts Engine [DONE ✅] — 2026-06-01
- [x] **`scripts/migrations/020_operational_alerts.sql`** — Datenmodell + Views
  - `delivery_alert_rules` Tabelle: konfigurierbare Schwellenwerte pro Location + Alert-Typ (UNIQUE constraint)
  - `delivery_alerts` Tabelle: Alert-Verlauf mit resolved_at + resolved_by (auto oder User-ID)
  - `v_active_alerts` VIEW: Aktive Alarme sortiert nach Severity + Alter
  - `v_alert_summary` VIEW: Zusammenfassung pro Location (total, critical, warning, latest_alert_at)
  - 4 Performance-Indizes: partial auf (resolved_at IS NULL) für schnelle aktive-Alarm-Abfragen
- [x] **`lib/delivery/alerts.ts`** — TypeScript Alerts Engine (260+ Zeilen)
  - 5 Alert-Typen: `dispatch_queue_high` | `no_drivers_online` | `kitchen_overload` | `stale_orders_critical` | `eta_accuracy_low`
  - `getAlertRules(locationId)`: Regeln laden + Default-Seed beim ersten Aufruf (5 Defaults)
  - `upsertAlertRule()`: Regel überschreiben (UPSERT via location_id+alert_type)
  - `getActiveAlerts()` / `getAlertHistory()`: Alarm-Listen
  - `resolveAlert(alertId, resolvedBy)`: manuelles Auflösen
  - `fireAlert()`: Dedup-Guard — nur ein aktiver Alarm pro Typ gleichzeitig
  - `autoResolve()`: Auto-Auflösung sobald Bedingung nicht mehr zutrifft
  - `evaluateAlerts(locationId)`: prüft alle aktiven Regeln, gibt { created, resolved } zurück
  - `evaluateAlertsAllLocations()`: Cron-Helfer für alle aktiven Locations
- [x] **`GET+POST /api/delivery/admin/alerts`** — Alert-Management
  - `GET ?view=active`: aktive Alarme + count nach Severity
  - `GET ?view=history&limit=N`: letzten N Alarme
  - `POST { action: 'evaluate' }`: Regeln manuell triggern (Tests)
  - `POST { action: 'resolve_all' }`: alle aktiven Alarme auflösen
- [x] **`PATCH+DELETE /api/delivery/admin/alerts/[id]`** — Einzel-Alarm
  - `PATCH { action: 'resolve' }`: Alarm manuell auflösen (resolved_by = user_id)
  - `DELETE`: Alarm löschen (Bereinigung)
- [x] **`GET+POST /api/delivery/admin/alert-rules`** — Regel-Management
  - `GET ?location_id=...`: Regeln laden (mit Default-Seed)
  - `POST { alert_type, threshold_value, window_minutes, severity, enabled }`: Regel setzen/anpassen
- [x] **Cron-Erweiterung** (`app/api/cron/smart-dispatch/route.ts`)
  - `evaluateAlertsAllLocations()` parallel zu Dispatch + ETA-Refresh + Shifts
  - Response enthält `alerts: { created, resolved }` für Monitoring
- Build: npm run build ✓ (170 Seiten, 0 Fehler)

## Letzte Änderungen
- 2026-06-03: CEO-Agent — Review #22: 4 neue Frontend-Features geprüft, 1 Bug behoben
  - Geprüft: KitchenBigDisplayGrid TV-Modus, BatchRow-Adressen, SpeedArcGauge (Fahrer), Fahrer-Banner (Storefront), Fahrer-ETA-Chip (Kitchen)
  - Bug-Fix: success-state.tsx — fahrer_vorname nicht in customer_orders-Tabelle → Fahrer-Name via GET /tracking nachgeladen
  - Bug-Fix: tracking/route.ts — driver_name in Response ergänzt (mise_drivers.employee_id → employees.vorname, parallel zu GPS)
  - Build: ✓ (170 Seiten, 0 Fehler), tsc --noEmit: 0 Fehler
- 2026-06-03: Backend-Architekt — Phase 24: Scheduled Orders + Pre-Order Management
  - scripts/migrations/024_scheduled_orders.sql: scheduled_at + schedule_status Spalten + v_scheduled_orders VIEW + release_due_scheduled_orders() Funktion
  - lib/delivery/scheduled.ts: 7 Funktionen (releaseScheduledOrders, getScheduledQueue, scheduleOrder, unscheduleOrder, manuallyReleaseOrder, getScheduledSummary)
  - PATCH+DELETE /api/delivery/orders/[orderId]/schedule: Vorab-Zeit setzen + aufheben
  - GET+POST /api/delivery/admin/scheduled: Admin-Queue + manuelle Freigabe
  - dispatch-engine.ts + recovery.ts: schedule_status in SELECT + OR-Filter für Dispatch
  - Cron: releaseScheduledOrders() parallel → scheduled_releases in Response
  - Build: ✓ (170 Seiten, 0 Fehler), tsc --noEmit: 0 Fehler
- 2026-06-02: Backend-Architekt — Phase 22: Customer Satisfaction Tracking + Post-Delivery Rating
  - scripts/migrations/022_customer_satisfaction.sql: customer_delivery_ratings + v_driver_satisfaction + v_location_satisfaction + recompute_driver_rating_with_satisfaction() + Trigger
  - lib/delivery/satisfaction.ts: 6 Funktionen (generateRatingToken, generateMissingRatingTokens, submitCustomerRating, getSatisfactionSummary, getOrderForToken, markRatingTokensSent)
  - GET+POST /api/delivery/admin/satisfaction: Zufriedenheits-Zusammenfassung + Token-Generierung
  - POST /api/delivery/orders/[orderId]/rate: Kunden-Bewertung einreichen (öffentlich, token-geschützt)
  - app/rate/[token]: Öffentliche Rating-Seite mit 5-Stern-UI + Kommentar
  - Integration: tours/status → Rating-Token nach Lieferung; Cron → generateMissingRatingTokens alle 10 Min
  - Build: npm run build ✓ (172 Seiten, 0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-06-01: Backend-Architekt — Phase 20: Operational Alerts Engine
  - scripts/migrations/020_operational_alerts.sql: delivery_alert_rules + delivery_alerts + v_active_alerts + v_alert_summary
  - lib/delivery/alerts.ts: 5 Alert-Typen, Default-Seed, Dedup-Guard, Auto-Resolve, evaluateAlertsAllLocations()
  - GET+POST /api/delivery/admin/alerts: aktive Alarme + Verlauf + evaluate + resolve_all
  - PATCH+DELETE /api/delivery/admin/alerts/[id]: Einzel-Alarm auflösen / löschen
  - GET+POST /api/delivery/admin/alert-rules: Schwellenwerte konfigurieren
  - Cron: evaluateAlertsAllLocations() parallel → alerts: { created, resolved } in Response
  - Build: npm run build ✓ (170 Seiten, 0 Fehler)
- 2026-06-01: Backend-Architekt — Phase 19: Demand Forecasting Engine
  - scripts/migrations/019_demand_forecast.sql: delivery_demand_snapshots + v_hourly_demand_pattern + v_forecast_coverage_recs
  - lib/delivery/forecast.ts: snapshotDemand() + snapshotAllLocations() + getForecast() + updateCoverageFromForecast()
  - GET+POST /api/delivery/admin/forecast: Vorhersage abrufen + Snapshot/Coverage-Update triggern
  - Cron: snapshotAllLocations() alle 30 Min (minute :00/:30) → demand_snapshot in Response
  - Build: npm run build ✓ (170 Seiten, 0 Fehler)
- 2026-06-01: CEO-Agent — Review #18: TypeScript-Fix + 5 neue Features geprüft (Phase 19 + 4 UI)
  - Bug-Fix: delivery-view.tsx:75 — payload-Typ explizit gesetzt → 0 TypeScript-Fehler
  - Forecasting-Backend: forecast.ts + /api/delivery/admin/forecast geprüft ✅
  - Fahrer Realtime+Vibration+ETA-Countdown: delivery-view.tsx ✅
  - Bedarfsvorhersage Panel in Statistics: statistics-view.tsx ✅
  - ETA-Refresh-Button + Chronik-Panel: dispatch/client.tsx ✅
  - Build: 170 Seiten, 0 Fehler ✅
- 2026-06-01: CEO-Agent — Review #17: Payout-Frontend + 3 neue UI-Features geprüft
  - app/(admin)/drivers/payouts/page.tsx + client.tsx: Payout-Admin-UI (Übersicht/Records/Perioden)
  - sidebar.tsx: "Fahrer-Abrechnung" unter Fahrer-Gruppe ergänzt
  - Build: 170 Seiten, 0 Fehler ✅
- 2026-06-01: Frontend-Ingenieur — kritische Badges Küche, ETA-Fenster Dispatch, GPS-Tempo Fahrer
  - kitchen/client.tsx: criticalCount-Badge (Kanban-Header) + absolute Fertigzeit im OrderTicket
  - dispatch/client.tsx: ETA-Fenster-Chip (eta_earliest–eta_latest) + Dringlichkeits-Ring-Dot
  - delivery-view.tsx: GPS-Geschwindigkeits-Badge (farbcodiert: grün/amber/rot)
- 2026-06-01: Backend-Architekt — Phase 18: Driver Payout Engine + Financial Reports
  - scripts/migrations/018_payout_engine.sql: 3 Tabellen + PL/pgSQL-Funktion + 2 Views + 4 Indizes
  - lib/delivery/payout.ts: 8 Funktionen (getPayoutConfig, upsertPayoutConfig, calculateDeliveryPayout, generatePeriodPayout, generateAllPeriodsForDate, getDriverPayouts, getPeriodPayouts, getPayoutSummary)
  - GET+POST /api/delivery/admin/payout-config: Vergütungskonfiguration
  - GET+POST /api/delivery/admin/payouts: Abrechnungs-Management (summary/records/periods + generate/approve/mark_paid)
  - tours/[id]/status PATCH: Payout-Records bei Tour-Abschluss (fire-and-forget)
  - Build: npm run build ✓ (169 Seiten, 0 Fehler)
- 2026-05-31: Backend-Architekt — Phase 17: Schicht-Management + Einsatzplanung
  - scripts/migrations/017_shift_management.sql: driver_shifts + coverage_requirements + v_shift_coverage + auto_close_missed_shifts()
  - lib/delivery/shifts.ts: 10 Funktionen (getActive/Upcoming/ByDate, start/end/cancel, coverage gaps/reqs, cron)
  - GET+POST /api/delivery/admin/shifts: Schichten auflisten + erstellen
  - PATCH+DELETE /api/delivery/admin/shifts/[id]: Schicht updaten + stornieren
  - GET+POST /api/delivery/admin/coverage: Abdeckungs-Analyse + Anforderungen setzen
  - Cron: autoCloseMissedShifts() parallel → shifts_closed in Response
  - Health: shift_coverage Check → degraded bei Lücken
  - npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-31: Backend-Architekt — Phase 16: Driver Auto-Rating + SLA Tracking
  - scripts/migrations/016_driver_rating.sql: delivery_performance + recompute_driver_rating() + trigger + v_delivery_sla
  - lib/delivery/rating.ts: recordDeliveryPerformance() + recomputeDriverRating() + getSlaSummary()
  - GET /api/delivery/admin/sla: SLA-Bericht (On-Time-Rate, Abweichung, Lieferzeit, byDriver, byZone)
  - tours/[id]/status PATCH: rating recompute nach 'delivered' (fire-and-forget)
  - Build: npm run build ✓ (169 Seiten), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-31: CEO Review #14 — 6 Frontend-Commits QA-geprüft, 2 Bugs behoben
  - Fahrer-App: Zustellung-Flow (markDelivered → beide Systeme + customer_orders) ✅
  - Fahrer-App: markArrived-Button + Angekommen-Badge ✅
  - Fahrer-App: TourCloseButton schließt Tour in beiden Systemen ✅
  - Fahrer-App: SchichtStats zählt Legacy + Mise Lieferungen korrekt ✅
  - Fahrer-App: aktueller_batch_id wird nach Mise-Tour-Annahme in driver_status gesetzt ✅
  - Kitchen: Initialdaten laden beide Systeme (Legacy + Mise) parallel ✅
  - Kitchen: computeDriverStates erkennt Mise-Fahrer korrekt als unterwegs ✅
  - Dispatch: aktueller_batch_id wird nach Dispatch-Zuweisung in driver_status gesetzt ✅
  - Bug behoben: TourCloseButton setzte mise_drivers.state nicht zurück → Fix: state=returning sofort gesetzt
  - Bug behoben: TS2339 employee_id auf DriverScoreInput in dispatch-engine.ts → Fix: nearby.find() Lookup
  - Build: npm run build ✓ (169 Seiten), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-31: Backend-Architekt — Phase 15: Driver Push Notification bei Dispatch
  - lib/delivery/push-notify.ts: enqueueBatchPush() + enqueueTourStatusPush() → mise_push_outbox
  - dispatch-engine.ts: Push nach Dispatch/Bundle (fire-and-forget)
  - orders/[id]/cancel: Fahrer-Push bei Tour-/Bestellungs-Stornierung
  - Migration 015: 3 Indices + v_push_delivery_stats VIEW
  - GET /api/delivery/admin/push-stats: Push-Monitoring für Admin
  - Build: npm run build ✓ (169 Seiten), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-31: CEO Review #13 — 5 Frontend-Commits QA-geprüft, 2 Bugs behoben
  - Kitchen: TopUrgentOrders Priority-Queue (5-Faktor Scoring, Top-4 Chips) ✅
  - Kitchen: Kochleistungs-Gauge (avg Kochzeit vs. Schätzzeit, Balken mit Pulse) ✅
  - Kitchen: Nächste-Stunde-Prognose Chip in KitchenShiftStats ✅
  - Dispatch: TourReturnTimeline (10s-Tick, Zeitachse, Fahrer-ETA-Marker) ✅
  - Dispatch: Bestellungs-Sortierung (Wartezeit / Zone / Score) ✅
  - Statistics: CSV-Export (UTF-8 BOM, Memory-Leak-sicher) ✅
  - Statistics: Schicht-Prognose Panel (projizierte Bestellmenge + Umsatz) ✅
  - Storefront Hero: Live-ETA-Chip (Küchenlast-Indikator, 60s-Polling) ✅
  - Fahrer-App: Restdistanz-Streifen (offene Stops, Fortschrittsbalken) ✅
  - Fahrer-App: Schicht-Effizienz-Panel (Lieferungen/h, Score 0–100) ✅
  - SuccessState: Supabase Realtime Status-Timeline (5 Schritte, Flash-Feedback) ✅
  - Bug behoben: TS2339 `o.orderType` in statistics-view.tsx → `(o as any).orderType ?? (o as any).type`
  - Bug behoben: Schicht-Fortschrittsbalken zeigte immer ~0% → korrekte `elapsed / total`-Formel
  - Build: npm run build ✓ (169 Seiten), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-30: Backend-Architekt — Phase 14: Route-Polyline API + Karten-Ansicht abgeschlossen
  - lib/delivery/polyline.ts: Google Encoded Polyline Decoder (Precision 5) + Encoder
  - GET /api/delivery/tours/[id]/route: dekodierte Straßenroute für Fahrer-Map
  - Phase 5 map checkbox: ✅ (Leaflet-Map war bereits implementiert, Route-API ergänzt)
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-30: Backend-Architekt — Phase 13: Live ETA Refresh für en-route Touren
  - Migration 014: Partial-Index on_route + Covering-Index ETA-Felder + v_en_route_summary VIEW
  - lib/delivery/eta.ts: computeEnRouteEta() + refreshEnRouteEtas() (kein Zonen-Minimum für bereits abgeholte Touren)
  - Cron: refreshEnRouteEtas() jetzt parallel im 2-Min-Tick — ETAs aktualisieren sich live alle 2 Min
  - POST /api/delivery/admin/eta-refresh: manueller Admin-Trigger (nach GPS-Lücken, Tests)
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-30: CEO Review #11 — Phase 12 + StaleOrders-Alert + Tour-Optimieren + Speed-Gauge QA
  - Phase 12 Backend: Dispatch-Eskalation, `v_stale_unassigned_orders`, radius-Faktor 1.5× nach ≥3 Versuchen
  - Frontend: StaleOrdersWidget in Kitchen (polling 90s, force-dispatch), Route-Optimieren-Button in Dispatch, Speed-Arc-Gauge in Fahrer-App
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-30: Backend-Architekt — Phase 12: Dispatch-Eskalation + Stale-Order-Retry
  - Migration 013: dispatch_attempts + last_dispatch_attempt_at + dispatch_escalated_at + v_stale_unassigned_orders + reset-Trigger
  - dispatch-engine: radiusFactor 1.5× nach ≥3 Versuchen; Versuch-Counter + Eskalations-Timestamps
  - GET/POST /api/delivery/admin/stale-orders: Admin-Übersicht + manueller Re-Dispatch
  - Cron-Response enthält jetzt `escalated`-Zähler
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-30: CEO Review #10 — Post-Phase-10 visuelle Erweiterungen QA + Bug-Fix
  - 4 Commits geprüft (ScoreArcGauge, CookingAlertBar, NextStopHero, GPS-Speed, Heatmap, ShiftRevenue, Checkout-ETA)
  - Bug behoben: CookingAlertBar Mini-Progress-Bar zeigte immer 100% → korrekte Zeitindikatoren (0%=5min vorher, 100%=Kochstart)
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-29: Backend-Architekt — Phase 11: Driver-State-Bugfixes (4 Routes + 1 Migration)
  - dispatch-engine: loadActiveDrivers gibt jetzt echte Fahrer zurück (State-Bug war silent blocker!)
  - health/route: mise_drivers.location_id-Phantom-Filter entfernt (Spalte existiert nicht)
  - overview/route: driversOnline-Zählung korrekt (war immer 0)
  - eta/live: driver_status → mise_drivers (korrekte Datenquelle)
  - Migration 012: mark_stale_drivers_offline() + Indizes repariert
- 2026-05-29: Backend-Architekt — Phase 10: Produktions-Härtung
  - Migration 011: cancel_order_from_batch() + mark_stale_drivers_offline() + 3 Indizes
  - PATCH /api/delivery/orders/[orderId]/cancel — Stornierung mit Batch-Cleanup + Tour-Re-Optimierung
  - GET /api/delivery/health — Monitoring-Endpunkt (DB + Zonen + Fahrer + Backlog)
  - Cron: mark_stale_drivers_offline() jetzt parallel in jedem 2-Min-Tick
  - Build: npm run build ✓ (0 Fehler)
- 2026-05-29: Backend-Architekt — Phase 8: Multi-Tenant-Härtung + Küchen-Cron
  - Migration 010: location_id auf mise_delivery_batches + Backfill + Trigger
  - 3 API-Routes mit fehlendem location_id-Filter repariert (tours, stats, overview)
  - overview/.select()-Konkatenation auf Single-Literal umgestellt
  - Cron: syncKitchenNotifications() jetzt parallel zu smartDispatchTick()
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-28: Backend-Architekt — Phase 1 Nachbesserung: 3 kritische Bugs + Migration 008
  - **Bug 1 (KRITISCH)**: `dispatch-engine.ts → loadActiveDrivers()` selektierte `max_radius_km` aus `mise_drivers`, Spalte existierte nicht → PostgREST-Fehler → Dispatch lieferte immer "Kein Fahrer". BEHOBEN via Migration 008.
  - **Bug 2 (KRITISCH)**: `tour-optimizer.ts → optimizeTour()` schrieb `polyline`, `total_distance_km`, `total_eta_min` in `mise_delivery_batches`, Spalten fehlten → stille DB-Fehler. BEHOBEN via Migration 008.
  - **Bug 3 (Logik)**: Bei Touren-Bündelung (`outcome='bundled'`) wurde `customer_orders.mise_driver_id` nicht gesetzt (nur `mise_batch_id`). Fahrer-Tracking per Order war broken. BEHOBEN in `dispatch-engine.ts`.
  - **Performance**: N+1-Query in `loadActiveDrivers` → 1 Batch-Query für alle Fahrer (10 Fahrer = 11→2 Queries). BEHOBEN in `dispatch-engine.ts`.
  - Migration 008: `update_driver_zone()` Trigger — `mise_drivers.zone` wird jetzt automatisch via GPS gesetzt → `scoreZone()` liefert echte Werte statt immer 5.
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-28: CEO Review #6 — Bar-Kassier-Bug behoben, 4 Frontend-Commits QA-geprüft
  - `fahrer/app/page.tsx`: `bezahlt`+`zahlungsart`+`kunde_telefon` in customer_orders-Selects ergänzt
  - Geprüft: Heat-Strip, ETA-Ring, Cash-Header, Multi-Stop-Nav, Trends-Widget ✅
  - Build: npm run build ✓ (0 Fehler), npx tsc --noEmit ✓ (0 Fehler)
- 2026-05-28: CEO Review #5 — StopEtaBar Logik-Bug behoben, 4 Frontend-Commits QA-geprüft
  - `delivery-view.tsx`: StopEtaBar trackt eigene mountedAt-Zeit statt Tour-Gesamt-Elapsed
  - Build: ✅ 0 TypeScript-Fehler, kompiliert sauber
  - Alle neuen Features (Dispatch-Countdown, Kitchen-Counter, MM:SS-Timer, Refresh-Countdown) korrekt
- 2026-05-28: Backend-Architekt — Phase 3.7: Batch-Claim-Bug-Fix + Performance-API
  - Migration 007: source_system in v_open_dispatch_batches, v_driver_performance_stats,
    increment_driver_deliveries Trigger, v_delivery_batch_unified
  - fahrer/app/client.tsx: claimBatch() nutzt jetzt richtigen RPC je nach source_system
  - /api/delivery/admin/performance: neue Route für Fahrer-KPIs
  - Build: npm run build ✓ (0 Fehler)
- 2026-05-28: Backend-Architekt — Phase 3.6: Bridge-Konsolidierung
  - Migration 005: v_open_dispatch_batches VIEW + assign_to_driver RPC + claim_mise_delivery_batch RPC
  - dispatch/client.tsx: Bridge-Write via RPC, Legacy-Fallback
  - fahrer/app/page.tsx: Mise-Batch als Fallback für aktive Tour
  - fahrer/app/client.tsx: Realtime + markDelivered für beide Systeme
  - Phantom-Pfad app/Users/... entfernt (build-blocking)
  - Build: npm run build ✓ (Next.js 14.2.18, 0 Fehler)
- 2026-05-28: CEO-Review #3 — 22 TypeScript-Fehler behoben, Phases 4+5 als DONE markiert
  - Root Cause: Supabase `.select()` mit String-Konkatenation (`+`) → `GenericStringError`
  - Fix: Alle Multi-Part-Selects zu Single-Literal-Strings zusammengeführt (2 Dateien)
  - Betroffene Routes: `/api/delivery/admin/drivers` + `/api/delivery/orders/[id]/tracking`
  - Integration-Prüfung: SuccessState orderId ✅, fertig_am Kitchen ✅, GPS Driver ✅
  - Build: Compiled successfully, 0 TypeScript-Fehler
- 2026-05-28: Frontend-Ingenieur — Smart-Timing, Live-ETA, Tour-Countdown, Driver-Panel
  - Dispatch: Live-Countdown per Tour (grün/orange/rot)
  - Kitchen: "Warte seit X Min" Badge für fertige Bestellungen
  - Fahrer-App: Elapsed-Time-Timer + Distanz/ETA pro nächstem Stop
  - Storefront: Live-ETA-Polling alle 30s via `/api/delivery/eta/[orderId]`
  - statistics-view: Live-Fahrer-Status-Panel (polling alle 30s)
- 2026-05-28: Backend-Architekt — Phase 3.5: Cron, Tracking-API, Admin-APIs, Bridge-Migration
  - `/api/cron/smart-dispatch` + vercel.json Cron alle 2 Min
  - `/api/delivery/orders/[orderId]/tracking` für Kunden-Tracking
  - `/api/delivery/admin/drivers` GET+PATCH
  - `/api/delivery/admin/heatmap` + `/api/delivery/admin/overview`
  - SQL Migration 004: Bridge-Trigger mise→legacy, driver_live_positions View
  - Build: ✓ Compiled successfully, 0 TypeScript-Fehler
- 2026-05-28: CEO-Review #2 — 3 kritische Integrations-Bugs behoben
  - Auto-Dispatch API Auth-Fix (403 → akzeptiert Sessions)
  - Dispatch Board zeigt Batches aus BEIDEN Tabellen (mise + legacy)
  - Kitchen Realtime + Status-Filter Fix
  - Build: Compiled successfully, 0 TypeScript-Fehler
- 2026-05-28: Frontend-Ingenieur — Smart-Timing, Score-Anzeige, Tour-Viz, Multi-Stop-Fahrer, Dispatch-Stats
- 2026-05-28: CEO-Review #1 — 35 TypeScript-Fehler behoben, Build stabil
- 2026-05-28: Backend-Architekt — Phase 1–3 vollständig implementiert
  - 3 SQL-Migrations (zones, extend, indexes)
  - 7 lib/delivery/*.ts Module
  - 9 API-Routes unter app/api/delivery/
  - Build: Compiled successfully
- 2026-05-27: Projekt gestartet, Agenten eingerichtet
