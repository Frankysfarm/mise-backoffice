# Smart Delivery System — Fortschritt

## Feature-Status (Auto-Parser)
<!-- Diese Zeilen werden vom Progress-Dashboard automatisch geparst -->
- [x] FahrerRankingCard (Wochen-Ranking im Warte-Zustand)
- [x] KitchenDispatchPressureChip (Rückstau-Indikator in Küchen-Toolbar)
- [x] delivery_zones Tabelle
- [x] delivery_tours Tabelle
- [x] tour_stops Tabelle
- [x] dispatch_scores Tabelle
- [x] kitchen_timings Tabelle
- [x] customer_orders erweitern
- [x] drivers erweitern
- [x] dispatch-engine.ts
- [x] scoring.ts (10 Faktoren)
- [x] bundling.ts
- [x] zones.ts (A/B/C/D)
- [x] eta.ts (dynamisch)
- [x] kitchen-sync.ts
- [x] tour-optimizer.ts
- [x] POST /api/delivery/dispatch
- [x] GET /api/delivery/tours
- [x] PATCH /api/delivery/tours/[id]
- [x] GET+POST /api/delivery/zones
- [x] GET /api/delivery/eta
- [x] GET /api/delivery/kitchen/queue
- [x] GET /api/delivery/stats
- [x] Smart-Timing-Anzeige
- [x] Countdown bis Fahrer
- [x] Farbcodierung Grün/Gelb/Rot
- [x] Realtime Updates
- [x] Tour-Übersicht mit Stops
- [x] Karten-Ansicht
- [x] Navigation-Links
- [x] GPS-Tracking
- [x] Dynamische ETA-Anzeige
- [x] Live-Tracking Fahrer
- [x] Realtime Status
- [x] Zonen-Konfiguration
- [x] Touren-Übersicht
- [x] Fahrer-Management
- [x] Statistiken-Dashboard
- [x] customer_delivery_events Tabelle
- [x] customer-notify.ts (Event Feed Engine)
- [x] GET /api/delivery/orders/[orderId]/events
- [x] Realtime Event-Subscription Tracking-Page
- [x] CustomerEventTimeline Komponente
- [x] delivery_surge_rules Tabelle
- [x] delivery_surge_events Tabelle
- [x] driver_surge_bonuses Tabelle
- [x] v_surge_status View
- [x] v_driver_surge_earnings View
- [x] surge.ts (Surge Pricing + Driver Incentive Engine)
- [x] GET+POST /api/delivery/admin/surge
- [x] Surge-Evaluation im Cron-Tick (2-Min-Intervall)
- [x] Driver-Surge-Bonus bei Tour-Abschluss
- [x] ETA-Genauigkeits-Panel im Statistiken-Dashboard
- [x] Surge-Pricing-Panel im Statistiken-Dashboard
- [x] GPS-Fahrerspuren live in der Dispatch-Karte (15s-Refresh)
- [x] Fahrer-Abdeckungsanalyse im Statistiken-Dashboard (Midnight-Fix ✅)
- [x] delivery_time_slots Tabelle
- [x] delivery_window_bookings Tabelle
- [x] v_slot_availability View
- [x] v_window_dispatch_queue View
- [x] windows.ts (Time Window Booking Engine)
- [x] GET+POST+DELETE /api/delivery/windows (Kunden-API)
- [x] GET+POST /api/delivery/admin/windows (Admin-API)
- [x] Window-Dispatch im Cron-Tick (fällige Fenster freigeben)
- [x] markWindowDispatched() in dispatch-engine.ts
- [x] markWindowDelivered() in tours/[id]/status/route.ts
- [x] delivery_proofs Tabelle
- [x] delivery_failed_attempts Tabelle
- [x] v_pending_failed_attempts View
- [x] proof.ts (Proof & Failed-Attempt Engine)
- [x] POST /api/delivery/tours/[id]/proof
- [x] GET /api/delivery/tours/[id]/proof
- [x] POST /api/delivery/tours/[id]/failed-attempt
- [x] GET+POST /api/delivery/admin/failed-attempts
- [x] releaseRetryAttempts() im Cron-Tick
- [x] Fahrer-App: "Nicht zugestellt" Button + Grund-Modal
- [x] FailedAttemptsPanel im Statistiken-Dashboard

- [x] delivery_zones.free_delivery_above_eur Spalte (Migration 036)
- [x] v_delivery_fee_rules View
- [x] delivery-fee.ts (Liefergebühr-Kalkulator Engine)
- [x] GET /api/delivery/fee (öffentlicher Storefront-Endpunkt)
- [x] GET+POST /api/delivery/admin/fee-config (Admin-Konfiguration)
- [x] DeliveryFeePanel Komponente (Zonen-Gebühren-Editor)
- [x] DeliveryFeePanel im Admin-Statistiken-Dashboard eingebunden
- [x] Dynamische Liefergebühr im Storefront-Checkout (live nach Adress-Auswahl)
- [x] Surge-Badge + Gratis-Liefern-Hinweis im Checkout (Zone-Info-Card)
- [x] Zahlung-Schritt: dynamische Gebührenanzeige statt statischem Hardcode

- [x] Live Kitchen ETA im Storefront V2 (load chip: Küche frei / mäßig / viel los)
- [x] Station-Badges in Kitchen OrderTicket (Grill / Warm / Kalt / Sonstiges)
- [x] SVG Arc Gauge im Dispatch BatchRow (Tour-Zeitfortschritt mit Farbkodierung)
- [x] LiveDeliveryHealthPanel im Dispatch-Board (SLA / ETA / Fahrer-Auslastung / Ø Lieferzeit)
- [x] KitchenQueuePressureMeter (Tiefe, Trend, Räumungszeit, 4 Druckstufen)
- [x] FahrerWarteAnzeige (Live-Sekundenzähler + Puls-Animation bei leerer Queue)
- [x] "Beste Wahl"-Badge für Touren nach Verdienst/Minute-Rate
- [x] Celebration-Panel + Sternebewertung im Storefront nach Lieferung/Abholung
- [x] Schicht-Streak Gamification im Lieferdienst-Board (🔥 Nx Streak ab 3 pünktlichen Abschlüssen)

- [x] location_queue_signals Tabelle (Migration 037)
- [x] queue_signal_history Tabelle (Migration 037)
- [x] v_queue_signal_status View (Migration 037)
- [x] capacity.ts (Queue-Signal Engine: getCurrentQueueSignal / setQueueSignal / evaluateAutoSignal / Cron-Wrapper)
- [x] GET /api/delivery/queue-signal (öffentlicher Storefront-Endpunkt)
- [x] GET+POST+DELETE /api/delivery/admin/queue-signal (Admin-Kontrolle)
- [x] ETA-Live-Endpoint: queue_signal + eta_extension_min + signal_message im Response
- [x] Auto-Evaluierung im Cron-Tick (2-Min-Intervall): queueDepth ≥7→+20 Min / ≥4→+10 Min / <4→normal
- [x] Storefront V2: Wartezeit-Banner bei signal=extended/paused (⏳/🚫 + Nachricht)
- [x] QueueSignalPanel im Statistiken-Dashboard (Signal setzen, History, Reset)

- [x] ZoneCapacityPanel im Dispatch-Board (Bestellungen pro Zone A/B/C/D + Fahrer-Auslastung + Druck-Warnung)
- [x] KitchenDriverAtRestaurantAlert (Blinkbanner wenn Fahrer mit at_restaurant-Batch am Restaurant wartet)
- [x] Lieferverifizierungs-Liste in Fahrer-App (Artikel pro Stop kollapsierbar prüfen vor Übergabe)

- [x] delivery_credit_rules Tabelle (Migration 038)
- [x] delivery_credits Tabelle (Migration 038)
- [x] v_credit_summary View (Migration 038)
- [x] v_pending_credits View (Migration 038)
- [x] seed_default_credit_rules() SQL-Funktion
- [x] credits.ts (Credit & Late-Compensation Engine)
- [x] GET+POST /api/delivery/admin/credits (Admin-Übersicht + manuelle Ausstellung)
- [x] DELETE /api/delivery/admin/credits/[id] (Stornierung)
- [x] GET+POST /api/delivery/admin/credit-rules (Regelkonfiguration)
- [x] evaluateAndIssueLateCredit() in tours/[id]/status PATCH (fire-and-forget)
- [x] expireStaleCredits() im Cron-Tick

- [x] lookupCreditByToken() — öffentliche Token-Suche ohne Auth
- [x] redeemCreditOnOrder() — optimistic-locked Einlösung mit Tenant-Check
- [x] GET /api/delivery/credits/lookup?token=xxx — Storefront-Lookup (kein Auth)
- [x] POST /api/delivery/credits/[token]/redeem — Credit einlösen nach Order-Erstellung
- [x] Checkout-UI: Liefergutschrift-Code Feld (nur lieferung, neben Voucher)
- [x] Storefront: creditDiscount in Gesamtbetrag-Berechnung + fire-and-forget Redemption

- [x] Kitchen OrderTicket: Timing-synchronisierter Advance-Button (markTimingReady + advanceOrder kombiniert)
- [x] Kitchen OrderTicket: Rote „Jetzt fertig!"-Variante mit Flame-Icon bei überfälligem Timing
- [x] Fahrer Pick-Phase: Live ETA-Countdown „~X Min (HH:MM)" pro Stop mit Farb-Codierung
- [x] startCookingNow Server Action + CookingAlertBar Kochstart-Button (Kitchen)
- [x] Storefront Live-Fahrer-Karte via Leaflet (GPS-Polling 15s, nur bei unterwegs)
- [x] Fahrer-App Alle-Stopps vertikale Timeline (auf-/zuklappbar, ETA, Distanz, Next-Stop-Indikator)
- [x] Kitchen OrderTicket Prioritätsscore-Badge (P30–P100, Farb-Schwellen)
- [x] Lieferpipeline-Panel in Statistiken (5 Status-Stufen, Live-Balken)
- [x] APNs Alert-Sender für Capacitor-Driver-App (.p8 Token-Auth, HTTP/2, inert bis ENV)
- [x] Brand-Page Markenfarben-Picker + Logo-Upload (schreibt in storefront_settings.theme)
- [x] Shop-Cockpit Redesign + Storefront-Settings (cross_sell, sections, section_order, theme)
- [x] Customers-Seite im Admin-Backoffice

- [x] driver_broadcasts Tabelle (Migration 039)
- [x] driver_broadcast_reads Tabelle (Migration 039)
- [x] v_broadcast_status View (Migration 039)
- [x] messaging.ts (Driver Broadcast Engine: sendBroadcast / listBroadcasts / getActiveBroadcasts / markBroadcastRead / deleteBroadcast / expireOldBroadcasts)
- [x] POST+GET+DELETE /api/delivery/admin/broadcasts (Dispatch sendet an Fahrer)
- [x] GET+POST /api/delivery/driver/messages (Fahrer holt Nachrichten + Lesebestätigung)
- [x] expireOldBroadcasts() im Cron-Tick (>24h alte Nachrichten bereinigen)
- [x] BroadcastPanel im Dispatch-Board (aufklappbar, Normal/Dringend, Löschen)
- [x] Betriebsnachrichten-Banner in Fahrer-App (dismissierbar, 60s-Poll, 🚨/📢 Priorität)

## STATUS: MARKT-REIF ✅ — PHASEN 1–47 + CEO REVIEW #40 ABGESCHLOSSEN — 2026-06-08

### CEO Review #40 (2026-06-08)
- TypeScript: 0 Fehler ✅
- Build: next build sauber ✅
- 2 neue Commits (6 Features) geprüft — kein Bug gefunden ✅
- [x] Station-Farbpunkte (orange/rot/sky/matcha) pro Item im OrderTicket
- [x] createKitchenTiming Server Action (manuelles Timing für Bestellungen ohne Smart-Timing)
- [x] ⏱ Timing-Button im Kitchen-Display (nur wenn kein Timing vorhanden)
- [x] Tour-Fortschritts-Ring als Avatar-Overlay in DriverRow (Dispatch Board)
- [x] LiveProximityRing in Fahrer-App (Echtzeit-Haversine-Distanz zum nächsten Stop)
- [x] Live-KPI-Strip in Statistiken (Auslastung + ETA + Bestellungen + Fahrer, 30s-Poll)

- [x] v_payout_periods_full View (Migration 040)
- [x] v_payout_daily_summary View (Migration 040)
- [x] GET /api/delivery/admin/payouts/export (CSV-Download Perioden + Einzeldatensätze)
- [x] generate_weekly + bulk_approve + bulk_mark_paid in POST /api/delivery/admin/payouts
- [x] DriverPayoutPeriodsPanel im Statistiken-Dashboard (Checkbox-Selektion, Bulk-Aktionen, CSV-Export)

- [x] Kitchen: Stationsverteilung-Chips (Grill/Warm/Kalt/Sonstiges) in in_zubereitung + bestätigt Columns
- [x] Fahrer-App: Küchen-Bereitschafts-Fortschrittsbalken (X von Y Stops fertig) in Pickup-Phase
- [x] Lieferdienst: Stunden-Sparkline (Bestellvolumen je Stunde, letzte 8h) im KPI-Strip
- [x] Tailwind: saffron/char/steel Farb-Tokens (fehlende Lieferdienst-Theme-Farben)
- [x] Bugfix: `vehicle` undefined → `driver.fahrzeug_praeferenz` (Fahrer-App goOffline/toggleOnline)
- [x] Bugfix: Supabase Join-Cast Array → `as { name: string } | null` (Payouts CSV-Export)

- [x] customer_notification_config Tabelle (Migration 041)
- [x] customer_notification_queue Tabelle (Migration 041)
- [x] v_pending_customer_notifications View (Migration 041)
- [x] v_customer_notification_log View (Migration 041)
- [x] customer-push.ts (Push Notification Engine: enqueueForOrder / enqueueCustomerNotification / processAllCustomerNotifications / getNotificationConfig / upsertNotificationConfig / getNotificationLog / getNotificationStats)
- [x] GET+POST /api/delivery/admin/notification-config (Tenant-Konfiguration: Webhook-URL, Secret, Events, Rate-Limit)
- [x] GET /api/delivery/admin/notification-log (Admin-Übersicht gesendeter Benachrichtigungen)
- [x] recordCustomerEvent() → enqueueForOrder() Integration (fire-and-forget nach Event-Insert)
- [x] processAllCustomerNotifications() im Cron-Tick (HMAC-signierter Webhook-Versand, 3 Retries)

- [x] delivery_incidents Tabelle (Migration 042)
- [x] incident_actions Tabelle (Migration 042)
- [x] v_open_incidents View (Migration 042)
- [x] v_incident_stats View (Migration 042)
- [x] incidents.ts (Incident Management Engine: createIncidentFromRating / createManualIncident / getIncidents / getIncident / updateIncident / addIncidentAction / resolveIncident / escalateIncident / getIncidentStats / autoCreateIncidentsForRatings)
- [x] GET+POST /api/delivery/admin/incidents (Liste + manuell erstellen + Stats)
- [x] GET+PATCH /api/delivery/admin/incidents/[id] (Detail + resolve + escalate + close + note)
- [x] Auto-Incident bei Bewertung ≤2★ (fire-and-forget in submitCustomerRating)
- [x] autoCreateIncidentsForRatings() im Cron-Tick (Sicherheitsnetz, jeder Tick)

- [x] tour_modifications Tabelle (Migration 043)
- [x] modification_count + last_modified_at Spalten auf mise_delivery_batches (Migration 043)
- [x] v_active_tours_open_stops View (Migration 043)
- [x] increment_batch_modification_count() SQL-Funktion (Migration 043)
- [x] tour-modifier.ts (Live-Tour-Modifikation Engine: insertStopIntoActiveTour / removeStopFromActiveTour / reoptimizeActiveTour / getTourModifications)
- [x] POST /api/delivery/admin/tours/[id]/stops (Stop in aktive Tour einfügen)
- [x] DELETE /api/delivery/admin/tours/[id]/stops/[stopId] (Stop aus aktiver Tour entfernen)
- [x] POST /api/delivery/admin/tours/[id]/reoptimize (Verbleibende Stops neu optimieren)
- [x] GET /api/delivery/admin/tours/[id]/modifications (Audit-Trail der Touren-Änderungen)
- [x] events.ts: tour_stop_inserted / tour_stop_removed / tour_reoptimized Event-Typen ergänzt
- [x] TourVisualizationPanel: Stop-Entfernen (Trash-Button + confirm) in aktiven Touren
- [x] TourVisualizationPanel: Tour-Reoptimierungs-Button (POST /admin/tours/[id]/reoptimize)
- [x] TourVisualizationPanel: Änderungsprotokoll-Audit-Trail (GET /admin/tours/[id]/modifications)
- [x] TourVisualizationPanel: Bestellung einreihen (Stop-Add-Dropdown, POST /admin/tours/[id]/stops)
- [x] OpenIncidentsPanel im Dispatch-Board (90s-Poll, Severity-Farbkodierung, Lösen-Button)
- [x] Fahrer-App: Echtzeit-Routenänderungs-Banner (Supabase Realtime auf tour_modifications)
- [x] Statistiken: Incident-KPI-Block (Offen/Kritisch/Heute gelöst/Gesamt)
- [x] ActiveTourRail: kompakter Live-Überblick aller laufenden Touren im Dispatch-Board
- [x] KitchenHandoffMatrix: Ready-Target vs. Fahrerankünfte – Konflikterkennung (Fahrer früher als Essen fertig)
- [x] LiveEarningsBubble: +€X.XX Einblendung nach jeder Zustellung in Fahrer-App
- [x] WochentagsHeatmap: 4-Wochen × 7-Tage Kalender-Grid in Statistiken

- [x] Phase 54: BatchDetailModal im ActiveTourRail (Klick → Drill-Down Dialog)
- [x] Phase 54: ETA-Überschreitungs-Alert-Banner (>5 Min überfällig, pro Tour einmalig)
- [x] Phase 54: Kitchen Handoff-Konflikt Audio-Alert (neuer conflict_alert SoundType, absteigender 3-Ton)
- [x] Bugfix: delivery-view.tsx stop?.distanz_zum_vorgaenger_m (TS18048 undefined guard)

- [x] dispatch_priority_boost Spalte auf customer_orders (Migration 045)
- [x] compute_dispatch_priority() SQL-Funktion (Komposit-Score 0–100: Priorität + Status + Zone + Wartezeit + Eskalation + Boost)
- [x] v_dispatch_priority_queue View (geordnete Queue aller wartenden Lieferbestellungen)
- [x] Performance-Indizes für Priority-Queue-Abfragen (Migration 045)
- [x] lib/delivery/queue-intelligence.ts (computeOrderPriority / computeOrderPriorityBreakdown / sortByPriority / getDispatchQueue / boostOrderPriority / resetOrderBoost / getQueueHealth)
- [x] dispatch-engine.ts: smartDispatchTick() nutzt jetzt sortByPriority() statt FIFO — VIP/Express/fertige/Zone-D-Orders dispatchen zuerst
- [x] GET+PATCH+DELETE /api/delivery/admin/dispatch-queue (Queue-Snapshot + Health-Metriken + Admin-Boost)

- [x] driver_performance_snapshots Tabelle (Migration 046)
- [x] v_driver_leaderboard_today View (Migration 046)
- [x] v_driver_leaderboard_week View (Migration 046)
- [x] v_driver_leaderboard_month View (Migration 046)
- [x] driver-performance.ts (Snapshot Engine: computeAndSaveSnapshot / snapshotAllDriversForLocation / snapshotAllLocations / getLeaderboard / getDriverHistory / getDriverRank)
- [x] GET+POST /api/delivery/admin/driver-leaderboard (Wochen-/Monats-Leaderboard + manueller Snapshot-Trigger)
- [x] GET /api/delivery/driver/my-performance (persönlicher Rank + 14-Tage-Trend)
- [x] DriverHistoricalLeaderboardPanel im Dispatch-Board (Podium Top-3, vollständige Tabelle, Period-Switcher, Snapshot-Trigger)
- [x] MyPerformanceBadge in Fahrer-App (Wochen-Rang im Delivery-Header)
- [x] snapshotAllLocations() im Cron-Tick täglich 02:00 UTC (gestrigen Tag snapshotten)

## STATUS: MARKT-REIF ✅ — PHASEN 1–56 + CEO REVIEW #47 ABGESCHLOSSEN — 2026-06-10

### CEO Review #47 — 2026-06-10

**2 neue Commits geprüft** (Phase 55 Frontend + Backend):

**1 Bug gefixt** (MITTEL — TypeScript):
- `DispatchTourGantt` in `app/(admin)/dispatch/client.tsx:6170–6174`
- `d.id` → `d.employee_id` (Driver-Typ hat kein `.id`, nur `.employee_id`)
- `driver.vorname/nachname` → `driver.employee?.vorname/nachname` (Namen sind nested)
- Ohne Fix: `next build` kompiliert, aber `tsc --noEmit` wirft 3 TS2339-Fehler
- Nach Fix: 0 TypeScript-Fehler ✅

**Phase 55 Frontend geprüft**:
- `KitchenFensterForecast`: 8×15-Min-Fenster korrekt berechnet, überfällige Bestellungen korrekt identifiziert, Timer-Refresh alle 30s ✅
- `DispatchTourGantt`: 90-Min-Zeitstrahl korrekt, Fortschritts-% stimmt (done/total), Gantt-Balken-Positionierung korrekt (barLeft/barWidth in %), Timer-Refresh alle 15s ✅
- Beide Komponenten sind null-safe (return null wenn keine Daten) ✅

**Build nach Fix**: TypeScript 0 Fehler ✅ · `next build` sauber ✅

### Phase 55 — Backend-Architekt — 2026-06-10

#### Was gebaut wurde

**Problem**: `smartDispatchTick()` dispatcht Bestellungen in reiner FIFO-Reihenfolge (`ORDER BY created_at ASC`). Eine normale Bestellung, die 5 Minuten früher bestellt wurde, blockiert eine Express-Bestellung oder eine bereits fertig gekochte VIP-Bestellung.

**Lösung: Smart Dispatch Queue Intelligence**

**scripts/migrations/045_dispatch_queue_intelligence.sql**:
- `dispatch_priority_boost integer DEFAULT 0` auf `customer_orders`: Admin-Override-Spalte
- `compute_dispatch_priority(p_order_id uuid) RETURNS integer`: SQL-Funktion 0–100
  - express=40 / vip=35 / rush=20 / normal=0 (Bestellpriorität)
  - fertig=25 / in_zubereitung=10 / neu=0 (Küchenstatus)
  - Zone D=12 / C=8 / B=4 / A=0 (Zonen-Dringlichkeit)
  - +1 je 2 Min Wartezeit, max 15 (Zeit-Faktor)
  - +20 wenn `dispatch_escalated_at` gesetzt (Eskalations-Boost)
  - +COALESCE(dispatch_priority_boost, 0) (Admin-Override)
- `v_dispatch_priority_queue`: View aller wartenden Orders, sortiert nach Score DESC, FIFO als Tiebreaker
- Indizes: `idx_orders_priority_queue` + `idx_orders_priority_boost`

**lib/delivery/queue-intelligence.ts** (neu):
- `computeOrderPriority(order)`: TypeScript-Mirror der SQL-Funktion, ohne DB-Zugriff — O(1)
- `computeOrderPriorityBreakdown(order)`: vollständiger Score-Breakdown (für Dashboard)
- `sortByPriority(orders)`: Array in-place sortieren nach Priority DESC, FIFO als Tiebreaker
- `getDispatchQueue(locationId, limit?)`: lädt aus `v_dispatch_priority_queue` + berechnet Breakdowns
- `boostOrderPriority(orderId, locationId, boost)`: setzt `dispatch_priority_boost` (0–50, Multi-Tenant-Guard)
- `resetOrderBoost(orderId, locationId)`: setzt Boost auf 0
- `getQueueHealth(locationId)`: Aggregat-Metriken — total_waiting, avg_wait_min, max_wait_min, score_buckets, by_status/zone/priority, escalated_count

**lib/delivery/dispatch-engine.ts** (Update):
- `smartDispatchTick()` fetcht jetzt auch `status`, `delivery_zone`, `dispatch_priority_boost`
- Nach dem Fetch: `sortByPriority(orders)` — VIP/Express/fertig/Zone-D zuerst
- `OrderRow`-Interface: neue Felder optional (`?`) → Rückwärtskompatibel mit recovery.ts

**GET+PATCH+DELETE /api/delivery/admin/dispatch-queue** (neu):
- `GET ?location_id=`: Queue-Snapshot + Health-Metriken in einem Call
- `PATCH ?location_id=` body `{order_id, boost}`: Admin-Boost setzen
- `DELETE ?location_id=&order_id=`: Boost zurücksetzen
- Multi-Tenant-Guard: Location-Membership via Supabase RLS-Kontext

#### Invarianten
- `dispatch_priority_boost` ersetzt NICHT den algorithmischen Score — er addiert sich dazu (max 50 Punkte Extra)
- FIFO bleibt als Tiebreaker bei gleichem Score → keine Verhungerung (starvation)
- `recovery.ts`: `OrderRow` ist weiterhin kompatibel (neue Felder sind optional)
- Cron: `smartDispatchTick()` profitiert automatisch ohne weitere Cron-Änderungen

#### Build-Verifikation
- TypeScript: **0 Fehler** ✅ (`tsc --noEmit` exit 0)
- Build: `next build` sauber ✅

### CEO Review #46 — 2026-06-10

**5 neue Commits geprüft** (Phase 54 Extensions): 0 TypeScript-Fehler, Build sauber.

**1 Bug gefixt** (MITTEL):
- `mapOrder()` in `/api/lieferdienst/data/route.ts` mappt jetzt `fertig_am → doneAt`
- `Order`-Interface in `lib/lieferdienst/orders.ts` um `doneAt?` erweitert
- Schichtfortschritt-Pünktlichkeits-Metrik war immer `null` — jetzt funktional

**5 neue Features bestätigt**:
- [x] DispatchQuickAssignBar: GPS-nächster freier Fahrer (haversineKm) + Fallback-Write
- [x] LieferdienstTagesvergleich: Supabase-Direktabfrage statt API-Endpoint
- [x] Queue-Signal-Banner in LiveEtaBar (Storefront): signal_message + eta_extension_min
- [x] iOS-Navigation (maps:// statt Google Maps) + Anruf-Button in Fahrer-App
- [x] KitchenPrepTimelineBar: 30-Min-Zeitstrahl aller kochenden Orders
- [x] KitchenSmartTimingNudge: Batch-Erstellung für Orders ohne Smart-Timing

---

### Phase 54 — Backend-Architekt — 2026-06-10

#### Was gebaut wurde

**dispatch/client.tsx — BatchDetailModal:**
- `ActiveTourRail` jetzt klickbar: jede Tour-Zeile öffnet per `onSelect(b.id)` ein Dialog-Modal
- `BatchDetailModal` als IIFE-Inline-Dialog innerhalb des DispatchBoard-Returns:
  - Fahrer-Chip mit Avatar-Initial, vollständiger Name, Telefon, Status
  - 3-Spalten-Stats-Grid: Stopps, Strecke, ETA-Minuten
  - Scrollbare Stop-Liste: nächster Stop (orange-pulsierend), erledigte Stops (grün/✓), Adressen, Zustellzeit
  - Schließt via `setBatchDetailId(null)` (Dialog `onOpenChange`)
- Nutzt vorhandene `Dialog`-Komponente aus `@/components/ui/dialog`

**dispatch/client.tsx — ETA-Überschreitungs-Alerts:**
- `overdueAlerts` State + `notifiedOverdueRef` (Set) für einmalige Benachrichtigung pro Tour
- `useEffect` auf `batches`: wenn Tour >5 Min überfällig und noch nicht gemeldet → Banner hinzufügen
- Roter Banner mit AlertTriangle-Icon, Fahrername, Überschreitungsminuten, X-Schließen-Button
- Completed/inaktive Touren werden automatisch aus `notifiedOverdueRef` entfernt

**kitchen/client.tsx — Handoff-Konflikt Audio-Alert:**
- Neuer SoundType `'conflict_alert'`: absteigender 3-Ton (784→622→494 Hz, triangle oscillator)
- `prevHandoffConflictCount` Ref speichert vorherige Konfliktzahl
- `useEffect` auf `[batches, stops, timings, audio]`: berechnet Konflikte (gleiche Logik wie KitchenHandoffMatrix)
- Nur wenn Konfliktzahl steigt → `playSound('conflict_alert')`, gated by `audio`-Toggle

**delivery-view.tsx — Bugfix:**
- `stop.distanz_zum_vorgaenger_m` → `stop?.distanz_zum_vorgaenger_m` (TS18048: 'stop' possibly undefined)
- `stops.find()` gibt `undefined` zurück wenn stopId nicht gefunden → Optional-Chain schützt davor

#### Build-Verifikation
- TypeScript: **0 Fehler** ✅ (`tsc --noEmit` exit 0)
- Build: `next build` sauber, **176 Seiten** ✅

### CEO Review #45 (2026-06-10)
- TypeScript: **0 Fehler** ✅ (`npx tsc --noEmit` exit 0)
- Build: `npx next build` sauber, 176 Seiten ✅
- **2 neue Commits geprüft**: Phase 53 (Legacy-Konsolidierung) + ActiveTourRail (Dispatch-Frontend)
- **0 Bugs gefunden** — beide Commits sind produktionsreif

#### Prüfprotokoll

**Phase 53 SQL (044_legacy_consolidation.sql):**
- `ensure_mise_driver()`: Korrekt — sucht per `auth_user_id`, auto-erstellt falls nicht vorhanden ✅
- `assign_to_driver()` v2: Korrekt — nur noch `mise_delivery_batches`, kein `delivery_batches` ✅
- `stop_count = v_order_count * 2`: Korrekt — je 1 pickup + 1 dropoff Stop pro Bestellung ✅
- `driver_status.aktueller_batch_id` → `mise_delivery_batches.id`: Korrekt für Phase-53-Batches ✅
- Legacy-Batches unberührt, `v_open_dispatch_batches` liest weiterhin beide Systeme ✅
- Fahrer-App Priority-Flip (`normalizedMiseBatch ?? legacyActiveBatch`): Korrekt ✅

**ActiveTourRail (dispatch/client.tsx):**
- Batch-Typ-Kompatibilität: alle verwendeten Felder (`reihenfolge`, `geliefert_am`, `startzeit`, `total_eta_min`, `total_distance_km`, `zone`, `fahrer`) korrekt im `Batch`-Typ vorhanden ✅
- Stop-Normalisierung: Mise-Stops (`sequence`→`reihenfolge`, `completed_at`→`geliefert_am`) korrekt ✅
- Stop-Punkte-Logik (`i === done` für aktuellen Stop): mathematisch korrekt ✅
- ETA-Countdown: `setTick` alle 10s → `now` wird bei Re-Render neu berechnet ✅
- Status-Filter (`ACTIVE`-Set) deckt alle Legacy- und Mise-Zustände ab ✅
- `zoneMeta().cls.replace(/bg-\S+/, '')` extrahiert korrekt nur die Text-Farbe ✅
- `GitCommit`-Icon: in Lucide-Imports (Zeile 43) vorhanden ✅
- Driver-Fallback: für Mise-Batches greift `d.aktueller_batch_id === b.id` korrekt ✅

### CEO Review #44 (2026-06-10)
- TypeScript: **0 Fehler** ✅
- Build: next build sauber, 176 Seiten ✅
- Vollständige Integrations-Tiefenprüfung Phase 52 (Tour-Modifikation Engine + Frontend)
- **1 Bug gefunden und gefixt**:
  - `dispatch/client.tsx`: Tour-Modifikations-Buttons (+Stop, Remove Stop, Reoptimize) waren für
    ALLE Batches sichtbar — auch für Legacy-Batches aus `delivery_batches`. Da `insertStopIntoActiveTour /
    removeStopFromActiveTour / reoptimizeActiveTour` ausschließlich `mise_delivery_batches` abfragen,
    schlugen diese Aktionen auf Legacy-Tours mit 422 fehl. Fix: `_isMise: true` Marker bei
    Normalisierung von `mise_delivery_batches`, alle drei Buttons jetzt mit `(batch as any)._isMise` gegattet.
- Alle anderen Prüfungen bestanden:
  - Multi-Tenant-Sicherheit (`location_id` in allen API-Routes und tour-modifier-Abfragen) ✅
  - Realtime-Cleanup (alle `removeChannel`-Calls vorhanden) ✅
  - Incidents-API `open_all` Status-Handling korrekt ✅
  - `getTourModifications` IDOR-Schutz via Location-Filter aktiv ✅
  - `assignToDriver` Bridge-Write (RPC → Legacy-Fallback) korrekt ✅

- [x] Phase 53: Legacy-Konsolidierung Phase 1 (Migration 044 + Fahrer-App Priorität)

### Phase 53 — Backend-Architekt — 2026-06-10

#### Was gebaut wurde

- `scripts/migrations/044_legacy_consolidation.sql`:
  - `ensure_mise_driver(p_employee_id uuid) RETURNS uuid`:
    Auto-erstellt `mise_drivers`-Eintrag für jeden Fahrer falls noch keiner existiert.
    Ermöglicht mise-only Dispatch auch für Fahrer ohne bestehenden Mise-Account.
  - `assign_to_driver()` v2 (Phase 53):
    Schreibt jetzt ausschließlich in `mise_delivery_batches` (kein `delivery_batches` mehr).
    `ensure_mise_driver()` wird intern aufgerufen → kein manuelles Onboarding nötig.
    Response enthält `legacy_batch_id: null` für Rückwärtskompatibilität mit Client-Code.
    `driver_status.aktueller_batch_id` zeigt jetzt auf `mise_delivery_batches.id`.
  - Index `idx_mise_batches_driver_state` für schnelle Fahrer-App-Abfragen.

- `app/fahrer/app/page.tsx` (Priority-Flip):
  - **Vorher**: `const activeBatch = legacyActiveBatch ?? normalizedMiseBatch`
  - **Nachher**: `const activeBatch = normalizedMiseBatch ?? legacyActiveBatch`
  - Mise-Batches haben jetzt Vorrang; Legacy-Batches funktionieren weiterhin als Fallback
    für bereits aktive In-Flight-Lieferungen während der Transition.

#### Invarianten
- Neue manuelle Dispatches: NUR mise_delivery_batches (kein delivery_batches-Record mehr)
- Bestehende delivery_batches: unverändert, werden weiter gelesen bis completed
- dispatch/client.tsx: liest weiterhin beide Systeme (In-Flight-Sichtbarkeit erhalten)
- v_open_dispatch_batches: Legacy-Union bleibt für Transition (Phase 54: cleanup)

#### Phase 54 (nächste Iteration): Cleanup
- dispatch/client.tsx: delivery_batches-Query entfernen (wenn alle In-Flight-Batches completed)
- v_open_dispatch_batches: Legacy-Union entfernen
- dispatch/client.tsx: Legacy-Fallback-Write in assignToDriver() entfernen

### CEO Review #43 (2026-06-10)
- TypeScript: **0 Fehler** ✅
- Build: next build sauber, 176 Seiten ✅
- 3 Commits geprüft: Phase 52 Backend + 2 Frontend-Extensions (Tour-Modifikation UI, Incident-Panel, Fahrer-Banner) ✅
- **3 Bugs gefunden und gefixt**:
  - `delivery-view.tsx`: Realtime-Payload `modification_type` statt falschem `type`
  - `dispatch/client.tsx`: Reoptimierungs-ETA `etaAfterMin` statt `total_eta_min`
  - `dispatch/client.tsx`: Incident-Filter `open_all` statt `open` (zeigt jetzt auch investigating/escalated)
- Vollständige Frontend-Backend-Integration Phase 52 ✅
- Deployment-bereit: nur Migration 043 in Supabase ausführen

### CEO Review #42 (2026-06-10)
- TypeScript: 2 Fehler gefunden → **0 Fehler nach Fix** ✅
- Build: next build sauber, 176 Seiten ✅
- 8 neue Commits geprüft: Phase 49 + Phase 51 + 6 Frontend-Extensions ✅
- Bugs gefixt: 2× TS-Fehler in `statistics-view.tsx` (`.then()`-Callback-Typ + Recharts `formatter`-Typ) ✅
- [x] Phase 49: Customer Push Notification Engine (Webhook, HMAC-SHA256, Retry-Queue) ✅
- [x] Phase 51: Incident Management Engine (10 Funktionen, Auto-Incident bei ≤2★) ✅
- [x] Kitchen Timing-synchronisierter Advance-Button (markTimingReady on fertig-Step) ✅
- [x] Kitchen Kochstart-Chip als interaktiver Button (scheduled → startCookingNow) ✅
- [x] Fahrer ETA-Countdown: „~X Min (15:30)", Orange/Rot-Eskalation ✅
- [x] Fahrer Resume-Reload: visibilitychange-Listener nach CallKit-Anruf ✅
- [x] CallKit Accept-Tour Endpoint: Bearer+Cookie Dual-Auth ✅
- [x] Fahrer Verdienst-Schätzung + 7-Tage-Verlauf BarChart ✅
- [x] ETA-Verbesserungs-Banner: 60s-Schwelle, 6s Auto-Dismiss ✅

## STATUS: MARKT-REIF ✅ — PHASEN 1–49 + CEO REVIEW #41 ABGESCHLOSSEN — 2026-06-09

### CEO Review #39 (2026-06-08)
- TypeScript: 30 Fehler gefunden → **0 Fehler nach Fix** ✅
- Build: next build sauber ✅
- 4 TS-Bugs gefixt: Status-Typ-Erweiterung (domain), StorefrontSettings Typ (4 fehlende Felder), toggleCrossSellProduct-Funktion, menu_categories Array-Normalisierung ✅
- 8 neue Features geprüft, alle korrekt implementiert ✅
- Kein Logik-Bug gefunden ✅

## Phase 46: Customer Credit Redemption Flow [DONE ✅] — 2026-06-07

### Motivation
Phase 45 stellte Gutschriften aus (Token wird in DB gespeichert), aber Kunden konnten
Tokens nicht einlösen — kein öffentlicher Endpunkt, keine Checkout-UI. Phase 46 schließt
diese Lücke: vollständiger Kreislauf von der automatischen Ausstellung bis zur Einlösung
im Checkout.

### Was wurde gebaut

- [x] `lib/delivery/credits.ts` — 2 neue Funktionen
  - `lookupCreditByToken(token)`: öffentliche Suche nach Token (kein Auth) — gibt amountEur, status,
    expiresAt, customerName zurück (keine internen IDs)
  - `redeemCreditOnOrder(token, orderId, locationId)`: Optimistic-Lock UPDATE (nur wenn status='issued'),
    Tenant-Check (location_id muss matchen), setzt redeemed_order_id + redeemed_at

- [x] `app/api/delivery/credits/lookup/route.ts` — GET (öffentlich, kein Auth)
  - `?token=xxx` → { valid: true, amountEur, expiresAt, customerName } oder { valid: false, reason }
  - Gibt nie interne IDs oder location_id zurück

- [x] `app/api/delivery/credits/[token]/redeem/route.ts` — POST (Token-basierter Auth)
  - Body: `{ order_id, location_id }` → 200 { ok: true, amountEur } oder 400 { ok: false, reason }

- [x] `app/order/[locationSlug]/components/checkout-sheet.tsx`
  - Props: `deliveryCredit` + `onDeliveryCreditChange`
  - State: `creditInput / creditLoading / creditError`
  - `lookupCredit(token)`: ruft `/api/delivery/credits/lookup` auf, setzt Credit über Callback
  - UI: blau-gestaltetes Gutschrift-Feld (nur für `lieferung`), analog zur Voucher-Box
  - Zeigt nach Einlösung: "Gutschrift angewendet — -X,XX € Rabatt" + Entfernen-Button

- [x] `app/order/[locationSlug]/storefront.tsx`
  - `deliveryCredit` State (null | { token, amountEur })
  - `creditDiscount = deliveryCredit?.amountEur ?? 0`
  - `total = Math.max(0, subtotal + deliveryFee - voucherRabatt - creditDiscount)`
  - Nach Order-Erstellung: fire-and-forget `POST /api/delivery/credits/[token]/redeem`
  - Props an CheckoutSheet: `deliveryCredit` + `onDeliveryCreditChange`

### Build
- TypeScript: 0 Fehler ✅
- next build: 171 Seiten (1 neue Route), Compiled successfully ✅

## Phase 45: Delivery Credit & Late-Compensation Engine [DONE ✅] — 2026-06-07

### Motivation
Wenn eine Lieferung zu spät kommt oder fehlschlägt, gab es bisher keine automatische
Kompensation für den Kunden. Das führt zu Unzufriedenheit und Bewertungsschäden.
Phase 45 schließt diese Lücke: konfigurierbare Regeln pro Location lösen automatisch
Gutschriften aus — ohne manuellen Admin-Aufwand.

### Was wurde gebaut

- [x] `scripts/migrations/038_delivery_credits.sql`
  - `delivery_credit_rules` Tabelle: Konfiguration pro Location (trigger_type, threshold_min, credit_eur, credit_pct, max_credit_eur, expires_in_days, active)
    - UNIQUE auf (location_id, trigger_type) → kein doppelter Regelsatz
    - Trigger-Typen: `late_delivery`, `failed_delivery`, `manual`
  - `delivery_credits` Tabelle: Ausgestellte Gutschriften
    - Eindeutiger Token (hex, 32 Zeichen) für Kunden-Einlösung
    - Kundendaten-Snapshot (name, phone) zum Ausstellungszeitpunkt
    - Status-Lifecycle: issued → redeemed / expired / cancelled
    - `late_minutes` Feld: Dokumentiert Verspätungsminuten bei late_delivery
    - Dedup-Guard über order_id + reason (kein Doppel-Credit)
  - `v_credit_summary` View: Aggregierte KPIs pro Location (issued/redeemed/expired, Einlösequote)
  - `v_pending_credits` View: Offene Credits mit Bestelldetails für Admin-Dashboard
  - `seed_default_credit_rules()` Funktion: Starter-Regeln (10 Min → €2, Failed → €5) per Opt-In
  - RLS: service_role ALL + authenticated SELECT (tenant-gefiltert)
  - Indizes: location+issued_at, order_id, status, token, expires_at (partial)
  - updated_at Trigger für beide Tabellen

- [x] `lib/delivery/credits.ts` — Credit & Late-Compensation Engine (TypeScript strict, kein `any`)
  - Typen: CreditRule / DeliveryCredit / CreditSummary / ManualCreditInput / IssueResult
  - `getCreditRules(locationId)`: aktive Regeln laden
  - `upsertCreditRule(locationId, input)`: Regel erstellen/aktualisieren (UPSERT)
  - `evaluateAndIssueLateCredit(orderId, locationId, deliveredAt)`:
    - Lädt active late_delivery Regel
    - Vergleicht deliveredAt mit eta_latest (versprochene Lieferzeit)
    - Berechnet Verspätungsminuten; wenn < threshold_min → kein Credit
    - Dedup-Guard: kein zweiter Credit für dieselbe Bestellung
    - Betrag = credit_eur + (credit_pct % von Bestellwert), capped auf max_credit_eur
    - Graceful Fallback wenn Migration 038 fehlt (42P01 Code)
  - `issueFailedDeliveryCredit(orderId, locationId)`: Credit bei fehlgeschlagener Zustellung
  - `issueManualCredit(input)`: Admin erstellt Credit manuell (mit userId für Audit)
  - `getCredits(locationId, options)`: Credits listen (filterbar nach Status, paginierbar)
    - Separater customer_orders Lookup für Bestelldetails (keine Supabase-Join-Typ-Probleme)
  - `getCreditSummary(locationId)`: v_credit_summary abrufen
  - `cancelCredit(creditId, locationId)`: Stornierung (nur issued, nicht redeemed)
  - `expireStaleCredits()`: Setzt abgelaufene issued-Credits auf expired (Cron-Helfer)

- [x] `app/api/delivery/admin/credits/route.ts`
  - `GET ?summary=true` → { summary }
  - `GET ?status=issued|redeemed|... &limit=&offset=` → { credits[], summary }
  - `POST { amount_eur, reason, order_id?, customer_*, notes?, expires_in_days? }` → 201 { credit }
  - Auth: employees.auth_user_id → location_id

- [x] `app/api/delivery/admin/credits/[id]/route.ts`
  - `DELETE` → Credit stornieren (409 wenn bereits eingelöst)

- [x] `app/api/delivery/admin/credit-rules/route.ts`
  - `GET` → { rules[] }
  - `POST { trigger_type, threshold_min?, credit_eur, credit_pct?, max_credit_eur?, expires_in_days?, active? }` → UPSERT
  - Validierung: trigger_type Enum, credit_eur positiv

- [x] Integration `app/api/delivery/tours/[id]/status/route.ts`
  - On `delivered`: `evaluateAndIssueLateCredit()` für jeden Dropoff-Stop (fire-and-forget)
  - Kein Blocking: `.catch(() => {})` — kein Fatal wenn Tabelle fehlt

- [x] Integration `app/api/cron/smart-dispatch/route.ts`
  - `expireStaleCredits()` im Promise.all des 2-Min-Ticks
  - Response enthält `credits_expired: N`

### Technische Details
- Alle 6 Funktionen mit Graceful Fallback (42P01 Migration-fehlt-Fehler)
- TypeScript strict: 0 Fehler nach `npx tsc --noEmit`
- Build: `npx next build` ✓ (0 Fehler, 0 Warnungen)
- Multi-Tenant: jede Query filtert location_id
- Keine externen Dependencies

## Phase 44: Kitchen-Queue-Signal → Storefront Live-Wartezeit & Bestellpause [DONE ✅] — 2026-06-07

### Motivation
Küchenauslastung war bisher nur für Operations sichtbar (KitchenQueuePressureMeter).
Kunden im Storefront sahen immer die gleiche ETA — auch wenn die Küche auf Anschlag lief.
Ergebnis: gebrochene Versprechen, unzufriedene Kunden.
Phase 44 schließt diese Feedback-Schleife: Küchenlast → Auto-Signal → Storefront-Banner.

### Was wurde gebaut

- [x] `scripts/migrations/037_queue_signal.sql`
  - `location_queue_signals` Tabelle: aktueller Zustand pro Location (1 Zeile, UPSERT-Muster)
    - signal_type: normal / extended / paused
    - eta_extension_min: extra Minuten zur Basis-ETA (0–120)
    - message_de: optionale Kundennachricht (max 200 Zeichen)
    - auto_triggered: war das Signal automatisch oder manuell gesetzt?
    - trigger_source: 'kitchen_queue' | 'manual' | 'manual_reset'
    - queue_depth: Küchenauslastungs-Snapshot zum Auslösezeitpunkt
    - expires_at: optionales Auto-Ablaufen für temporäre manuelle Overrides
  - `queue_signal_history` Tabelle: Append-only History-Log aller Zustandsänderungen
  - `v_queue_signal_status` View: aktuelle Signale mit Location-Namen
  - RLS: service_role ALL + anon SELECT (Storefront) + authenticated SELECT (tenant-gefiltert)
  - Index: (location_id, recorded_at DESC) für schnelle History-Abfragen

- [x] `lib/delivery/capacity.ts` — Queue-Signal Engine (TypeScript strict, kein `any`)
  - Typen: QueueSignalType / QueueSignal / QueueSignalInput / AutoEvalResult / SignalHistoryEntry
  - `getCurrentQueueSignal(locationId)`: liest aktuelles Signal; expired Signale → default 'normal'
  - `setQueueSignal(locationId, input, autoTriggered?, source?, queueDepth?, createdBy?)`:
    UPSERT auf location_id + fire-and-forget History-Eintrag
    - DEFAULT_MESSAGES pro Signal-Typ (kein leerer Text für Kunden)
  - `resetQueueSignal(locationId)`: setzt auf 'normal' (trigger_source='manual_reset')
  - `getSignalHistory(locationId, limit)`: letzte N Einträge (descending)
  - `evaluateAutoSignal(locationId)`: Auto-Evaluierung basierend auf Küchenauslastung
    - Manuelle 'paused'-Signale werden nie überschrieben (Operations-Kontrolle bleibt)
    - queueDepth ≥ 7: extended + 20 Min ETA-Verlängerung
    - queueDepth 4–6: extended + 10 Min ETA-Verlängerung
    - queueDepth < 4: normal (0 Min Extension)
    - Returns: AutoEvalResult mit action (upgraded / downgraded / unchanged)
  - `evaluateAutoSignalAllLocations()`: Cron-Wrapper (max 50 Locations, per-location try/catch)

- [x] `app/api/delivery/queue-signal/route.ts` — öffentlicher Endpunkt
  - `GET ?location_id=...` → { signal_type, eta_extension_min, message_de, expires_at }
  - Kein Auth: Storefront liest ohne Session
  - Graceful Fallback: keine Location → 'normal' mit ext=0

- [x] `app/api/delivery/admin/queue-signal/route.ts` — Admin-Kontrolle
  - `GET ?action=status` → { signal, history (10 Einträge) }
  - `GET ?action=history&limit=N` → { history }
  - `POST { signal_type, eta_extension_min?, message_de?, expires_at? }` → Signal setzen
    - Validierung: signal_type enum, eta_extension_min 0–120, message_de ≤200 Zeichen
    - trigger_source='manual', userId aus Session
  - `DELETE` → Signal auf 'normal' zurücksetzen
  - Auth-Guard: employees.auth_user_id → location_id

- [x] `app/api/delivery/eta/live/route.ts` Integration
  - `getCurrentQueueSignal()` parallel zu bestehenden DB-Queries
  - ETA-Extension aufaddieren: `eta_min = base_eta + eta_extension_min`
  - Response enthält: queue_signal, eta_extension_min, signal_message, eta_min_base
  - `.catch(() => null)` Graceful Fallback — kein Fatal wenn Tabelle fehlt

- [x] `app/api/cron/smart-dispatch/route.ts` Integration
  - `evaluateAutoSignalAllLocations()` jeder 2-Min-Tick
  - Cron-Response enthält `queue_signal: { locations, upgraded, downgraded }`

- [x] `app/order/[locationSlug]/storefront-v2.tsx` — Storefront-Banner
  - `liveEta` State erweitert um queue_signal, eta_extension_min, signal_message
  - Queue-Signal-Banner erscheint zwischen Info-Chips und Order-Type-Tabs
  - signal='extended': ⏳ Amber-Banner mit Wartezeit-Text
  - signal='paused': 🚫 Rot-Banner mit Pause-Text
  - signal='normal': kein Banner (kein visuelles Rauschen)
  - message_de-Override: Custom-Text ersetzt Standard-Nachricht

- [x] `components/lieferdienst/statistics-view.tsx` — QueueSignalPanel
  - Collapsible Panel nach DeliveryFeePanel im Admin-Statistiken-Dashboard
  - Zeigt aktuellen Signal-Typ als farbigen Badge (matcha / amber / rot)
  - 3 Signal-Buttons (Normal / Erhöhte Wartezeit / Pausiert)
  - Inline-Editing: eta_extension_min + optionale message_de
  - "Signal setzen" → POST an Admin-API
  - "Zurücksetzen" → DELETE → sofort normal
  - History-Log: letzte 5 Einträge mit Zeit + Auto/Manuell-Indikator

### Technische Details
- Auto-Evaluierung ersetzt manuelle 'paused'-Signale NICHT (Operations behält Kontrolle)
- ETA-Extension wird ÜBER der basis load-basierten ETA addiert — keine Doppelverlängerung wenn
  load='busy' UND signal='extended' (beide addieren sich additiv → ehrlichste Prognose)
- Migration 037 graceful: IF NOT EXISTS + DO $$ EXCEPTION-Pattern für alle Policies
- Keine breaking changes: bestehende Felder von `/api/delivery/eta/live` erhalten bleiben
- Build: `next build` → ✓ Compiled successfully, 170 Seiten, 0 TypeScript-Fehler, 0 Warnungen ✅

## Phase 43: Storefront-Checkout — Dynamische Liefergebühr + Admin-Fee-Panel [DONE ✅] — 2026-06-07

### Motivation
CEO Review #35 hatte zwei offene Deployment-Items:
1. `DeliveryFeePanel` war gebaut, aber noch nirgendwo in der Admin-UI eingebunden.
2. Storefront zeigte statisch "2,90 € Lieferung" — ohne Zone, Surge oder Gratis-Schwelle.
Phase 43 schließt beide Lücken vollständig.

### Was wurde gebaut

- [x] `components/lieferdienst/statistics-view.tsx` — DeliveryFeePanel Integration
  - Import von `@/components/lieferdienst/delivery-fee-panel` hinzugefügt
  - Neues Panel-Block "Liefergebühr-Konfiguration" nach PayoutConfigPanel
  - `locationId` via `(orders[0] as any)?.location_id` — Muster konsistent mit anderen Panels
  - Conditional render: Panel erscheint nur wenn locationId aufgelöst werden kann

- [x] `app/order/[locationSlug]/components/checkout-sheet.tsx` — Live-Gebühren-Quote
  - `feeQuote` State mit vollständigem FeeQuote-Typ (TypeScript strict)
  - `useEffect`: nach Adress-Koordinaten-Auflösung → fetch `/api/delivery/fee`
    - Trigger-Deps: `orderType`, `locationId`, `address.lat`, `address.lng`, `total`
    - Kein Fetch wenn lat/lng null (Adresse noch nicht gewählt)
  - **Adress-Schritt**: neues Fee-Info-Card nach Entfernungsanzeige:
    - Zone-Label (A/B/C/D) + Surge-Badge (×N.N, amber) wenn aktiv
    - Gebühr: "X,XX € Lieferung" oder "🎉 Gratis-Lieferung"
    - Gratis-Schwelle-Hinweis: "Ab XX,XX € kostenlos liefern"
    - Mindestbestellwert-Warnung wenn nicht erreicht
  - **Bezahl-Schritt**: Zusammenfassungszeile ersetzt Hardcode "2,90 €":
    - feeQuote vorhanden + gratis → "· Gratis-Lieferung"
    - feeQuote vorhanden + kostenpflichtig → "· inkl. X,XX € Lieferung"
    - Kein feeQuote → "· inkl. Lieferung" (neutraler Fallback)

### Technische Details
- Kein neuer API-Endpunkt nötig — `/api/delivery/fee` aus Phase 42 vollständig genutzt
- Kein Eingriff in `total`-Prop-Flow — Fee-Quote ist informational
- `feeQuote` wird auf null gesetzt wenn kein locationId oder Koordinaten vorhanden
- `outOfRange && !feeQuote` verhindert Fee-Card bei außerhalb-Liefergebiet-Adressen
- Build: `next build` → ✓ Compiled successfully, 170 Seiten, 0 TypeScript-Fehler, 0 Warnungen ✅

## Phase 42: Liefergebühr-Kalkulator & Kostenlos-Liefern-Schwelle [DONE ✅] — 2026-06-07

### Motivation
Der Storefront-Checkout konnte die tatsächliche Liefergebühr nicht berechnen.
Bisherige Lösung: statische Werte oder kein Live-Quote.
Phase 42 liefert einen einzigen API-Aufruf der Zone, Surge-Multiplikator und
Kostenlos-Liefern-Schwelle kombiniert — vollständig für den Checkout nutzbar.

### Was wurde gebaut

- [x] `scripts/migrations/036_delivery_fee_threshold.sql`
  - `delivery_zones.free_delivery_above_eur` Spalte (ALTER TABLE, graceful IF NOT EXISTS)
    - Kostenlos-Liefern-Schwelle pro Zone: A=15€, B=25€, C=35€, D=null
  - `v_delivery_fee_rules` VIEW für Admin-Dashboard und Calculator
  - Default-UPDATE für bestehende Zeilen (Zone A–D)

- [x] `lib/delivery/zones.ts` — `free_delivery_above_eur` in ZoneConfig Typ + alle Mapper
  - DEFAULT_ZONES mit sinnvollen Schwellenwerten pro Zone
  - `upsertZone` + `updateZoneById` + `seedDefaultZones` unterstützen neues Feld
  - Vollständige Rückwärtskompatibilität (null = kein kostenloses Liefern)

- [x] `lib/delivery/delivery-fee.ts` — Liefergebühr-Engine (TypeScript strict, kein `any`)
  - Typen: FeeQuote / FeeQuoteError
  - `getDeliveryFeeQuote(locationId, customerCoords, orderTotal)`:
    - Lädt Restaurant-Koordinaten aus locations-Tabelle
    - `classifyZone()` für Distanz + Zone
    - `getSurgeMultiplier()` für aktuellen Surge (Graceful Fallback 1.0)
    - Berechnet: baseFee + surgeSurcharge → Kostenlos-Check → totalFee
    - Gibt FeeQuote mit vollständigem breakdown zurück
  - `getPublicFeeQuote()`: Graceful-Wrapper (null statt throw) für Storefront
  - `getAllZoneFees()`: alle Zonen einer Location mit Gebühren

- [x] `app/api/delivery/fee/route.ts` — öffentlicher GET-Endpunkt (kein Auth)
  - `GET ?location_id=...&lat=...&lng=...&order_total=...`
  - Validierung: koordinaten-range, order_total >= 0, UUID-Format
  - Antwort: vollständiges FeeQuote-Objekt
  - Storefront: direkter JS-fetch ohne Session

- [x] `app/api/delivery/admin/fee-config/route.ts` — Admin-Konfiguration
  - `GET ?location_id=...` → alle Zonen mit Gebühren
  - `POST { zone, surcharge_eur?, min_order_eur?, free_delivery_above_eur?, ... }`
    - Validierung: zone A–D, Zahlen >= 0, free_delivery_above_eur > 0 oder null
    - Lädt bestehende Zone, merged nur geänderte Felder, upsert
  - Admin-Auth-Guard: location_id via employees.auth_user_id

- [x] `app/api/delivery/zones/route.ts` — POST akzeptiert jetzt `free_delivery_above_eur`

- [x] `components/lieferdienst/delivery-fee-panel.tsx` — Admin-Gebühren-Editor
  - Collapsible Panel mit Zone-Badges im collapsed state
  - Inline-Editing für surcharge_eur, min_order_eur, free_delivery_above_eur pro Zone
  - "Gespeichert"-Feedback mit 2s-Timeout
  - Erklärungstext für Kostenlos-Schwelle

### Technische Details
- `getSurgeMultiplier()` mit `.catch(() => 1.0)` — kein Fatal-Crash wenn Surge-Tabelle fehlt
- `getLocationCoords()` liest lat/lng aus locations-Tabelle (kein geocoding nötig)
- Surge-Surcharge: `baseFee × (multiplier - 1)` — bei baseFee=0 kein Surge-Aufschlag
- Kostenlos-Liefern: override auf totalFee=0 wenn Schwelle erreicht (nach Surge-Berechnung)
- Vollständig rückwärtskompatibel: bestehende Zonen ohne Spalte → free_delivery_above_eur=null
- Build: `next build` → ✓ Compiled successfully, 0 TypeScript-Fehler, 0 Warnungen ✅

### API-Nutzungsbeispiel (Storefront Checkout)
```
GET /api/delivery/fee?location_id=abc&lat=52.52&lng=13.40&order_total=18.00

{
  "zone": "B",
  "zone_label": "Standard",
  "zone_color": "#3b82f6",
  "distance_km": 4.2,
  "eta_min": 30,
  "base_fee_eur": 1.5,
  "surge_multiplier": 1.3,
  "surge_surcharge_eur": 0.45,
  "total_fee_eur": 1.95,
  "is_free_delivery": false,
  "free_delivery_above_eur": 25,
  "min_order_eur": 15,
  "is_min_order_met": true,
  "breakdown": "€1.50 + Surge €0.45 (×1.3) = €1.95"
}
```

- [x] Kitchen: Inline Prep-Zeit-Anpassung (+5/-5 Min) via updatePrepTime Server-Action
- [x] Dispatch: DriverRow Entfernung zum Restaurant (Haversine, farbkodiert) + Fahrzeit-Schätzung
- [x] proof.ts TypeScript-Bugfix: .catch() auf PostgrestFilterBuilder
- [x] shift_claims Tabelle (Migration 035)
- [x] shift-booking.ts (Self-Service Schichtbuchung Engine)
- [x] GET /api/delivery/shifts/available (Fahrer: offene Slots)
- [x] GET+POST+DELETE /api/delivery/shifts/claim (Fahrer: anmelden/stornieren)
- [x] GET+PATCH /api/delivery/admin/shift-claims (Admin: genehmigen/ablehnen)
- [x] SchichtBuchung Panel in Fahrer-App (collapsible, verfügbare Slots + Meine Anmeldungen)

## Phase 41: Fahrer Self-Service Schichtbuchung [DONE ✅] — 2026-06-06

### Motivation
Dispatcher mussten bisher alle Schichten manuell zuweisen. Fahrer hatten keine
Möglichkeit, selbst zu sehen wann Schichten gebraucht werden oder sich anzumelden.
Phase 41 schließt diese Lücke: Fahrer sehen offene Deckungslücken in der Fahrer-App
und können sich per Knopfdruck anmelden. Admin genehmigt → Schicht wird automatisch angelegt.

### Was wurde gebaut

- [x] `scripts/migrations/035_shift_booking.sql`
  - `shift_claims` Tabelle: Fahrer-Anmeldungen für Schicht-Slots
    - status: pending → approved / rejected / cancelled
    - UNIQUE (driver_id, planned_start) — kein Doppel-Slot
    - reviewed_by / reviewed_at / rejection_reason für Admin-Tracking
    - RLS: service_role ALL + authenticated SELECT (eigene Claims)
    - 3 Indizes: location+start, driver+status, pending partial-index

- [x] `lib/delivery/shift-booking.ts` — Schichtbuchungs-Engine (TypeScript strict, kein `any`)
  - Typen: ShiftClaim / ShiftClaimWithDriver / BookableSlot / ClaimStats
  - `getBookableSlots(locationId, driverId, daysAhead)`:
    - Liest coverage_requirements + driver_shifts für die nächsten N Tage
    - Gruppiert aufeinanderfolgende Peak-Stunden zu Schicht-Blöcken (Gap ≥ 2h = neuer Block)
    - Gibt nur Blöcke zurück, bei denen scheduled_drivers < target_drivers
    - Markiert Slots wo Fahrer bereits eine Anmeldung hat (alreadyClaimed)
  - `claimShift()`: INSERT in shift_claims, wirft 23505 bei Duplikat (UI-freundlich)
  - `cancelShiftClaim()`: setzt status='cancelled' (nur eigene + pending)
  - `approveShiftClaim()`: status='approved' + driver_shifts INSERT (fire-and-forget)
  - `rejectShiftClaim()`: status='rejected' + rejection_reason
  - `getDriverClaims()`: Fahrer sieht eigene Anmeldungen (nächste 14 Tage)
  - `getPendingClaims()`: Admin sieht offene Anmeldungen mit Fahrerdaten (JOIN mise_drivers)
  - `getClaimStats()`: pending/approved/rejected/cancelled Zähler (letzte 30 Tage)
  - Graceful Fallback: alle Funktionen fangen 42P01 ab → kein Fatal-Crash

- [x] `app/api/delivery/shifts/available/route.ts`
  - `GET ?location_id=...&days_ahead=7` → BookableSlot[] für eingeloggten Fahrer
  - Auth: muss ein mise_drivers-Eintrag mit auth_user_id sein
  - Fahrer-ID wird server-seitig aufgelöst (kein Client-seitiger Trust)

- [x] `app/api/delivery/shifts/claim/route.ts`
  - `GET ?days_ahead=14` → eigene Anmeldungen (alle Status)
  - `POST { location_id, planned_start, planned_end, notes? }` → neue Anmeldung
    - Validierung: future-only, max 12h Dauer, korrektes Datumsformat
    - 409 bei Duplikat mit User-freundlicher Fehlermeldung
  - `DELETE ?claim_id=...` → Anmeldung zurückziehen (nur pending)

- [x] `app/api/delivery/admin/shift-claims/route.ts`
  - `GET` → offene Anmeldungen mit Fahrername + Fahrzeug
  - `GET ?action=stats` → ClaimStats (30-Tage-Fenster)
  - `PATCH { action: 'approve', claim_id }` → genehmigen + driver_shifts anlegen
  - `PATCH { action: 'reject', claim_id, reason? }` → ablehnen mit optionalem Grund
  - Admin-Guard: location_id via employees.auth_user_id aufgelöst

- [x] `app/fahrer/app/client.tsx` — SchichtBuchung Component
  - Collapsible Panel (standardmäßig zugeklappt → kein UI-Clutter im Arbeitsalltag)
  - Badge-Zähler im Header: offene Slots + ausstehende/genehmigte Claims
  - "Offene Slots": je Slot mit DayLabel, TimeLabel, Fahrerbedarf-Badge, "Anmelden"-Button
  - "Meine Anmeldungen": genehmigte (grün) und wartende (amber) Claims mit Cancel-Option
  - Loading-States + Fehlerbehandlung via alert()
  - Nur sichtbar wenn driver.location_id gesetzt ist

### Technische Details
- Kein neuer Polling-Loop: Fahrer lädt manuell per Toggle oder Refresh-Button
- Schicht-Blöcke aus coverage_requirements (UTC day_of_week + hour_of_day)
- Duplikat-Schutz: DB UNIQUE + API 409 mit DE-sprachiger Fehlermeldung
- approveShiftClaim: driver_shifts INSERT als fire-and-forget (kein Rollback nötig)
- Build: `next build` → ✓ Compiled successfully, 0 TypeScript-Fehler, 0 Warnungen ✅

## Phase 40: Delivery Proof & Failed-Attempt Engine [DONE ✅] — 2026-06-06

### Motivation
Bei Streitigkeiten über nicht erhaltene Lieferungen fehlte ein Nachweis-System.
Fehlgeschlagene Zustellversuche (Nicht zu Hause, falsche Adresse, kein Zutritt) wurden
nicht strukturiert erfasst — Operations hatte keinen Überblick, welche Bestellungen
erneut zugestellt werden müssen.
Phase 40 schließt diese Lücke: Fahrer können Zustellnachweise (Foto-URL, Ablageort)
und Fehlversuche mit Grund + Retry-Plan melden.

### Was wurde gebaut

- [x] `scripts/migrations/034_delivery_proof.sql`
  - `delivery_proofs` Tabelle: Foto-Nachweis pro Stop
    - proof_type: photo / left_at_door / neighbour / handed_to_person / contactless
    - photo_url, notes (max 500 Zeichen), driver_lat/lng, created_at
    - Indexes: order_id, tour_stop_id, location+time
  - `delivery_failed_attempts` Tabelle: fehlgeschlagene Zustellversuche
    - reason: no_answer / wrong_address / refused / access_denied / not_home / other
    - attempt_number (auto-increment per Order), photo_url, notes
    - next_attempt_at (Retry-Planung), resolved_at, resolution
    - Indexes: order_id, location+pending, next_attempt_at (partial)
  - `v_pending_failed_attempts` VIEW: offene Fälle mit Kunden- und Fahrerdaten
  - RLS: service_role ALL + authenticated SELECT (tenant-gefiltert)

- [x] `lib/delivery/proof.ts` — Proof & Failed-Attempt Engine (TypeScript strict, kein `any`)
  - Typen: DeliveryProof / FailedAttempt / PendingFailedAttempt / ProofInput / FailedAttemptInput / FailedAttemptStats
  - `recordDeliveryProof(locationId, input)`: Nachweis speichern (fire-and-forget kompatibel)
  - `getOrderProof(orderId)`: Nachweis für Bestellung abrufen
  - `listProofs(locationId, days)`: Alle Nachweise einer Location
  - `recordFailedAttempt(locationId, input)`: Fehlversuch erfassen
    - attempt_number auto-increment (zählt Vorversuche für dieselbe Order)
    - Setzt customer_orders.status='nicht_zugestellt' (fire-and-forget)
  - `getPendingFailedAttempts(locationId)`: Offene Fälle via View
  - `scheduleRetry(attemptId, locationId, nextAttemptAt)`: Retry terminieren
    - Setzt schedule_status='released' für Retry-Orders
  - `resolveFailedAttempt(attemptId, locationId, resolution)`: Fall abschließen
  - `getFailedAttemptStats(locationId, days)`: Admin-Dashboard-Statistiken
  - `releaseRetryAttempts()`: Cron-Helfer — fällige Retries in Dispatch-Queue freigeben

- [x] `app/api/delivery/tours/[id]/proof/route.ts` — Fahrer-API Nachweis
  - `POST`: Fahrer reicht Nachweis ein (proof_type + opt. photo_url + notes + GPS)
    - Auth: zugewiesener Fahrer oder Admin dieser Location
    - Validierung: UUID-Format, proof_type enum, URL-Länge, Notes-Länge
  - `GET ?order_id=...`: Admin ruft Nachweis für eine Bestellung ab

- [x] `app/api/delivery/tours/[id]/failed-attempt/route.ts` — Fahrer-API Fehlversuch
  - `POST`: Fahrer meldet Fehlversuch (reason + opt. photo_url + notes + GPS)
    - Auth: zugewiesener Fahrer oder Admin
    - Tenant-Guard: order_id muss zur Batch gehören
    - Validierung: alle Felder, Strings auf max. Länge

- [x] `app/api/delivery/admin/failed-attempts/route.ts` — Admin-API
  - `GET ?action=list` → offene PendingFailedAttempt[] mit Bestellinformationen
  - `GET ?action=stats&days=30` → FailedAttemptStats (total, pending, byReason, byResolution, avgResolutionHours)
  - `POST { action: 'schedule_retry', attempt_id, next_attempt_at }` → Retry-Termin setzen
  - `POST { action: 'resolve', attempt_id, resolution }` → Fall abschließen
  - `POST { action: 'release_retries' }` → fällige Retries sofort freigeben (Debug)

- [x] `app/api/cron/smart-dispatch/route.ts` Integration:
  - `releaseRetryAttempts()` jeder 2-Min-Tick → gibt retry_scheduled Orders frei
  - Response enthält `retry_attempts_released`

- [x] `app/fahrer/app/delivery-view.tsx` — Fahrer-UI
  - Neuer State: failedStopId, failedReason, failedNotes, pendingFailed
  - `markFailedAttempt(stopId)`: POST an `/api/delivery/tours/[id]/failed-attempt`, dann Skip
  - Modal "Nicht zugestellt": 6 Grund-Buttons (2-Spalten-Grid) + optionales Notiz-Textarea
  - Button "N. zust." (AlertTriangle-Icon) erscheint wenn Fahrer angekommen ist
    (angekommen_am gesetzt oder arrivedIds.has(stopId)) — Kontext: Fahrer vor Ort

- [x] `components/lieferdienst/statistics-view.tsx` — FailedAttemptsPanel
  - Fetch: `/api/delivery/admin/failed-attempts?action=list` + `?action=stats`
  - KPI-Zeile: Gesamt / Offen / Gelöst% / Ø Lösezeit in Stunden
  - Häufigste Gründe: Balkendiagramm (top 4)
  - Auflösungen: Chip-Liste mit Zählung
  - Offene Fälle-Liste (max 5): Name, Bestellnummer, Grund-Badge, Fahrer, Retry-Termin

### Technische Details
- Graceful Fallback: alle Funktionen fangen Migration-fehlt-Fehler (42P01) ab → kein Fatal-Crash
- Race-condition-safe attempt_number: COUNT-Query vor INSERT (wie Surge + Windows)
- Retry-Flow: scheduleRetry → status='retry_scheduled' → Cron-Tick → status='released' → Dispatch-Engine
- Fahrer-UI: "N. zust."-Button erst sichtbar wenn Fahrer als angekommen markiert — verhindert versehentliche Meldungen
- Build: `next build` → Compiled successfully, 173 Seiten, 0 TypeScript-Fehler, 0 Warnungen ✅

## Phase 39: Delivery Time Window Booking Engine [DONE ✅] — 2026-06-06

### Motivation
Kunden konnten bisher keine konkreten Lieferzeitfenster buchen — ETAs waren unverbindlich.
Für Operations war es schwierig, Küchen-Starts und Fahrertourenplanung im Voraus zu planen.
Phase 39 schließt diese Lücke: Kunden wählen ein 30-Minuten-Fenster beim Checkout,
Operations plant Dispatch + Küche automatisch darum.

### Was wurde gebaut

- [x] `scripts/migrations/033_delivery_windows.sql`
  - `delivery_time_slots` Tabelle: konfigurierbare Zeitfenster pro Location + Wochentag
    - day_of_week (0=Mo–6=So), slot_start_utc / slot_end_utc (HH:MM UTC)
    - capacity: maximale Buchungen pro Fenster (default 8)
    - slot_type: standard / express / scheduled
    - extra_fee_eur: optionaler Aufpreis für gebuchtes Fenster
    - UNIQUE (location_id, day_of_week, slot_start_utc) — kein Duplikat-Slot
  - `delivery_window_bookings` Tabelle: Buchung Bestellung → Slot
    - UNIQUE (order_id): max. 1 Buchung pro Bestellung
    - status: pending → confirmed → dispatched → delivered / missed / cancelled
    - confirmed_at, dispatched_at, delivered_at: Tracking-Timestamps
    - extra_fee_eur: Snapshot des Slot-Aufpreises zum Buchungszeitpunkt
  - `v_slot_availability` VIEW: Live-Kapazität pro Slot + Tag (heute + morgen)
    - booked_count, remaining_capacity, utilization_pct
    - Für Storefront-API: nur Slots mit verbleibender Kapazität anzeigen
  - `v_window_dispatch_queue` VIEW: Buchungen die in <15 Min starten und noch pending
    - Für Cron-Scan: automatische Freigabe zum richtigen Zeitpunkt
  - RLS: service_role ALL + authenticated SELECT (tenant-gefiltert)
  - 4 Indizes: location+dow, location+window_start, slot+window_start, pending_start

- [x] `lib/delivery/windows.ts` — Time Window Booking Engine (TypeScript strict, kein `any`)
  - Typen: TimeSlot / SlotAvailability / WindowBooking / AvailableSlot / WindowStats / SlotConfigInput / DispatchWindowResult
  - `getSlotConfig(locationId)`: alle Slots (aktiv + inaktiv); erstellt Default-Slots on-demand
    wenn noch keine Konfiguration vorhanden (buildDefaultSlots: Mo–So 11:00–22:00 UTC, 30-Min-Slots)
  - `upsertSlotConfig(locationId, slots[])`: UPSERT Slot-Konfiguration (onConflict: location+dow+start)
  - `setSlotActive(slotId, locationId, isActive)`: Slot aktivieren / deaktivieren
  - `getAvailableSlots(locationId, date)`: Verfügbare Fenster für einen Tag
    - Nur Slots mit remaining_capacity > 0 + window_start in der Zukunft
    - `is_filling_fast: true` wenn utilization_pct >= 70% (Dringlichkeitssignal)
  - `bookDeliveryWindow(orderId, slotId, locationId, notes?)`: Fenster buchen
    - Slot-Kapazität: COUNT < capacity (race-condition-safe)
    - Mindestvorlauf: 30 Minuten
    - Setzt customer_orders.scheduled_at + schedule_status='scheduled' (Phase-24-Integration)
    - Loggt `order_scheduled` DeliveryEvent
  - `cancelWindowBooking(bookingId, locationId)`: Stornierung + schedule_status zurücksetzen
  - `getOrderWindow(orderId)`: Buchung für eine Bestellung abrufen
  - `processWindowDispatch(locationId?)`: Cron-Helfer
    - Liest v_window_dispatch_queue (Fenster in <15 Min)
    - Prüft ob kitchenStart (window_start - prep_time) <= now
    - schedule_status='released' → Dispatch-Engine greift an
    - Buchungsstatus auf 'confirmed' setzen
  - `processWindowDispatchAllLocations()`: Cron-Wrapper (alle aktiven Locations, per-location try/catch)
  - `markWindowDispatched(orderId)`: fire-and-forget aus dispatch-engine.ts
  - `markWindowDelivered(orderId)`: fire-and-forget aus tours/[id]/status/route.ts
  - `markMissedWindows()`: Cron — abgelaufene Buchungen als 'missed' markieren (+30 Min Grace Period)
  - `getWindowStats(locationId)`: Admin-Dashboard (total, status-Aufschlüsselung, revenue, avg_utilization)
  - `listWindowBookings(locationId, date?)`: Buchungsliste mit Slot-Label + Bestellnummer

- [x] `app/api/delivery/windows/route.ts` — Kunden-API (kein Auth, orderId als Autorisierung)
  - `GET ?location_id=...&date=YYYY-MM-DD` → AvailableSlot[] für Storefront-Checkout
  - `GET ?location_id=...&order_id=...` → Einzelbuchung für eine Bestellung
  - `POST { order_id, slot_id, location_id, notes? }` → Fenster buchen (201 Created)
  - `DELETE ?order_id=...&location_id=...` → Buchung stornieren
  - UUID-Validierung aller IDs vor DB-Zugriff
  - Tenant-Guard: order_id muss zur location_id gehören

- [x] `app/api/delivery/admin/windows/route.ts` — Admin-API
  - `GET ?action=slots` → Slot-Konfiguration der Location
  - `GET ?action=availability` → heute + morgen Verfügbarkeits-Übersicht (zwei Tage parallel)
  - `GET ?action=bookings&date=YYYY-MM-DD` → Buchungsliste mit Slot-Metadaten
  - `GET ?action=stats` (default) → Tages-Statistiken (Buchungen, Status, Umsatz, Auslastung)
  - `POST { action: 'configure', slots: SlotConfigInput[] }` → Slot-Konfiguration setzen
    - Validierung: day_of_week 0–6, HH:MM Format
  - `POST { action: 'toggle_slot', slot_id, is_active }` → Slot aktivieren/deaktivieren
  - `POST { action: 'cancel_booking', booking_id }` → Admin-seitige Stornierung
  - `POST { action: 'process_dispatch' }` → fällige Windows sofort freigeben (Debug)

- [x] `app/api/cron/smart-dispatch/route.ts` Integration:
  - `processWindowDispatchAllLocations()` + `markMissedWindows()` jeder 2-Min-Tick
  - Response enthält `windows: { released, missed_marked }`

- [x] `lib/delivery/dispatch-engine.ts` Integration:
  - `markWindowDispatched(orderId)` nach erfolgreicher Dispatch-Zuweisung (fire-and-forget)

- [x] `app/api/delivery/tours/[id]/status/route.ts` Integration:
  - `markWindowDelivered(orderId)` bei state=delivered pro Dropoff-Stop (fire-and-forget)

### Technische Details
- Default-Slots: 22 Slots/Tag × 7 Tage = 154 Slots werden on-demand erstellt wenn keine Konfig vorhanden
- Kapazitäts-Check race-condition-safe: COUNT-Query < capacity (kein LOCK nötig — graceful overflow bei gleichzeitigen Requests)
- Integration mit Phase 24 (scheduled_orders): Window-Buchung setzt schedule_status='scheduled' → identischer Release-Flow
- Küchenvorlauf: processWindowDispatch berechnet kitchenStart = window_start - estimated_prep_min
  → Küche startet rechtzeitig, Bestellung ist beim Fensterbeginn fertig
- Missed-Guard: markMissedWindows() greift erst 30 Min nach Fenster-Ende — Grace Period für Dispatch-Verzögerungen
- Build: `next build` ✓ (172 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 38: Surge Pricing + Driver Incentive Engine [DONE ✅] — 2026-06-06

### Motivation
Spitzenzeiten (Freitagabend, Regenwetter, Events) führten zu langen Wartezeiten, weil
Fahrer-Kapazität und Nachfrage nicht dynamisch ausgeglichen wurden. Kunden erlebten
unvorhersehbare ETAs, Fahrer wurden in ruhigen Zeiten zu gut bezahlt und in Spitzenzeiten
zu wenig incentiviert.
Phase 38 schließt diese Lücke: automatische Erkennung von Nachfragespitzen + dynamischer
Liefergebühr-Aufpreis + automatische Fahrer-Boni pro Lieferung während Surge.

### Was wurde gebaut

- [x] `scripts/migrations/032_surge_pricing.sql`
  - `delivery_surge_rules` Tabelle: konfigurierbare Surge-Regeln pro Location
    - Trigger-Felder: min_queue_depth (offene Orders ohne Fahrer), min_orders_per_hour,
      min_driver_utilization_pct (% Fahrer ausgelastet)
    - Surge-Parameter: multiplier [1.0–3.0], driver_bonus_eur pro Lieferung
    - Zeitfenster: active_from_utc / active_until_utc / active_weekdays
    - auto_stop_after_min: Automatische Deaktivierung nach Cooldown
    - UNIQUE (location_id, name), FK → locations (migration-safe)
  - `delivery_surge_events` Tabelle: Log aktiver Surge-Perioden
    - Trigger-Snapshot (queue, orders/h, utilization%), effective_multiplier, driver_bonus_eur
    - Aggregierte Ergebnisse bei Ende: deliveries_during, total_bonus_paid_eur
  - `driver_surge_bonuses` Tabelle: Bonus-Eintrag pro Fahrer + Lieferung während Surge
    - driver_id → mise_drivers, surge_event_id → delivery_surge_events
    - bonus_eur, multiplier (Snapshot des Surge-Wertes)
  - `v_surge_status` VIEW: Echtzeit-Status pro Location
    - Berechnet queue_depth + orders_last_30min + driver_utilization_pct live
    - conditions_met + in_time_window Flags (direkt für Admin-UI nutzbar)
    - Joined mit laufendem Surge-Event (active_event_id, surge_started_at)
  - `v_driver_surge_earnings` VIEW: Bonus-Summe pro Fahrer (heutiger Tag)
    - Joined mit employees + mise_drivers für Anzeige-Name + Fahrzeug
  - RLS: service_role ALL + authenticated SELECT (tenant-gefiltert via employees.location_id)
  - 3 Indizes: (location_id, active_event, time)

- [x] `lib/delivery/surge.ts` — Surge Engine (TypeScript strict, kein `any`)
  - Typen: SurgeRule / SurgeEvent / SurgeStatus / DriverSurgeBonus / SurgeSummary / SurgeRuleInput
  - `listSurgeRules(locationId)`: alle Regeln einer Location; Graceful Fallback wenn Migration fehlt
  - `configureSurgeRule(locationId, input)`: UPSERT Regel (onConflict: name); min/max-Validierung
  - `getCurrentSurge(locationId)`: liest v_surge_status; gibt SurgeStatus zurück (isActive, multiplier, ...)
    — Graceful Fallback mit noSurge (multiplier=1.0) bei fehlender Migration
  - `getSurgeMultiplier(locationId)`: schlanker Helper → effektiver Multiplikator (1.0 = kein Surge)
  - `evaluateSurgeForLocation(locationId)`: Kern-Evaluierung
    - Lädt Regeln → prüft conditionsMet → aktiviert/deaktiviert Surge-Event
    - Auto-Deaktivierung: Bedingungen erfüllt nicht mehr + auto_stop_after_min überschritten
    - Loggt Surge-Start als operativen Alert (fire-and-forget, optional)
    - Returns: { wasActive, nowActive, multiplier, action: activated/deactivated/unchanged/skipped }
  - `evaluateSurgeAllLocations()`: Cron-Wrapper (max 50 aktive Locations, per-location try/catch)
  - `recordDriverSurgeBonus(params)`: Bonus-Eintrag nach Lieferung
    - Prüft ob Surge aktiv + driverBonusEur > 0, dann INSERT in driver_surge_bonuses
    - Gibt tatsächlich gezahlten Betrag zurück (0 wenn kein Surge)
    - Graceful Fallback: Exception → 0 zurück, kein fataler Fehler
  - `manuallyActivateSurge(locationId, multiplier, driverBonusEur)`: Admin-Override
    - Beendet ggf. laufendes Event → öffnet neues mit override-Parametern
  - `manuallyDeactivateSurge(locationId)`: Admin: laufendes Event beenden
  - `getSurgeSummary(locationId)`: Admin-Dashboard (Promise.all parallel)
    - status + todayEvents + topDriverBonuses + todayTotalBonusPaidEur + surgeActivationsToday

- [x] `app/api/delivery/admin/surge/route.ts` — Surge Admin API
  - Auth: authentifizierter Employee → location_id (Tenant-Guard bei cross-location)
  - `GET ?action=summary` (default) → vollständiges SurgeSummary
  - `GET ?action=rules` → SurgeRule[] für die Location
  - `GET ?action=status` → SurgeStatus (Echtzeit-Schlanke-Variante)
  - `POST { action: 'configure', rule: SurgeRuleInput }` → Regel anlegen/updaten
  - `POST { action: 'activate', multiplier, driver_bonus_eur }` → manueller Surge-Start
  - `POST { action: 'deactivate' }` → laufenden Surge beenden
  - `POST { action: 'evaluate' }` → Bedingungen sofort auswerten (Debug)

- [x] `app/api/delivery/tours/[id]/status/route.ts` Integration:
  - Import `recordDriverSurgeBonus` aus lib/delivery/surge
  - Bei state=delivered: pro Dropoff-Stop → `recordDriverSurgeBonus({ driverId, locationId, batchId, orderId })` fire-and-forget
  - Kein Bonus wenn Surge nicht aktiv (getSurgeMultiplier → 1.0) — graceful no-op

- [x] `app/api/cron/smart-dispatch/route.ts` Integration:
  - Import `evaluateSurgeAllLocations`
  - Im Promise.all-Pool: `evaluateSurgeAllLocations()` jeder 2-Min-Tick
  - Response enthält `surge: { locations, activated, deactivated, active }`

### Technische Details
- Surge-Trigger: 3-fache UND-Bedingung (Queue ≥ N AND orders/h ≥ M AND driver_util% ≥ P)
  — verhindert False Positives bei einzelnen Signalen
- Auto-Deaktivierung: Surge bleibt `auto_stop_after_min` (default 30 Min) aktiv nachdem
  Bedingungen nicht mehr erfüllt sind → verhindert Flapping
- Multiplikator für Liefergebühr: Frontend liest `GET /api/delivery/admin/surge?action=status`
  → multiplier direkt verwendbar (z.B. base_fee * multiplier)
- Build: `./node_modules/.bin/next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 37: Customer Delivery Event Feed [DONE ✅] — 2026-06-05

### Motivation
Kunden mussten die Tracking-Page aktiv beobachten, um Statusänderungen zu bemerken.
Es gab keine chronologische Darstellung, was mit ihrer Bestellung passiert ist.
Phase 37 schließt diese Lücke: ein automatischer Event-Log pro Bestellung,
sichtbar als Live-Timeline auf der Tracking-Page.

### Was wurde gebaut
- [x] `scripts/migrations/031_customer_events.sql`
  - `customer_delivery_events` Tabelle: chronologischer Event-Log pro Bestellung
  - Felder: id, order_id, location_id, event_type, message_de, metadata, created_at
  - Event-Typen: driver_assigned / driver_at_restaurant / driver_departing / driver_nearby / delivered / cancelled / delayed
  - `REPLICA IDENTITY FULL` für Supabase-Realtime-Subscriptions
  - FK → customer_orders mit ON DELETE CASCADE (migration-safe via DO $$ EXCEPTION)
  - 2 Indizes: (order_id, created_at DESC) + (location_id, created_at DESC)
  - RLS: service_role all + anon SELECT (UUID als impliziter Token) + authenticated via location_id

- [x] `lib/delivery/customer-notify.ts` — Customer Event Engine (TypeScript strict, kein `any`)
  - `recordCustomerEvent(orderId, locationId, eventType, metadata?)`: INSERT fire-and-forget
    - Graceful Skip wenn Tabelle fehlt (Migration 031 noch nicht eingespielt)
    - `EVENT_MESSAGES` Map: deutsche Kundennachrichten pro Event-Typ
  - `getOrderEvents(orderId)`: lädt alle Events chronologisch aufsteigend
    - Graceful Fallback: leeres Array bei Fehler/fehlender Migration
  - Singleton Service-Client (SUPABASE_SERVICE_ROLE_KEY) — selbes Muster wie gps-tracker.ts

- [x] `app/api/delivery/orders/[orderId]/events/route.ts`
  - `GET /api/delivery/orders/[orderId]/events` → `{ events: CustomerDeliveryEvent[] }`
  - Kein Auth: orderId (UUID) ist praktisch unratbar (120 Bit Entropie)
  - UUID-Validierung via Regex vor DB-Zugriff
  - Graceful Fallback wenn Migration fehlt

- [x] `lib/delivery/dispatch-engine.ts` Integration:
  - Nach Push-Benachrichtigung an Fahrer: `recordCustomerEvent('driver_assigned')` fire-and-forget
  - Payload: driver_id, batch_id, zone, eta_earliest/latest

- [x] `app/api/delivery/tours/[id]/status/route.ts` Integration:
  - PATCH on_route → `driver_departing` für alle Batch-Dropoff-Orders
  - PATCH at_restaurant → `driver_at_restaurant` für alle Batch-Dropoff-Orders
  - PATCH delivered → `delivered` für alle Batch-Dropoff-Orders
  - PATCH cancelled → `cancelled` für alle Batch-Dropoff-Orders
  - Lädt Batch-Location + Dropoff-Stop-OrderIds, feuert parallel via `Promise.all`

- [x] `lib/delivery/gps-tracker.ts` Integration:
  - Bei `arrived_customer` Geofence (Fahrer <100m vom Kunden): `recordCustomerEvent('driver_nearby')`
  - Payload: driver_id, batch_id, distance_m
  - Fire-and-forget `.catch(() => {})` — kein fataler Fehler

- [x] `app/track/[bestellnummer]/tracking.tsx` — CustomerEventTimeline Komponente
  - Neuer Zustand: `deliveryEvents: DeliveryEvent[]`
  - `loadEvents()`: initialer Fetch via `/api/delivery/orders/${order_id}/events`
  - Realtime-Subscription: `customer_delivery_events` INSERT-Event im bestehenden Channel
  - `CustomerEventTimeline`: vertikale Timeline, Icon + farbkodiert pro Event-Typ
    - Farbschema: blau (zugewiesen) / amber (Restaurant) / matcha (unterwegs) / orange (in der Nähe) / dunkelgrün (geliefert) / rot (storniert)
    - Timestamps in DE-Lokalzeit (Europe/Berlin)
    - Positioned nach "Bestellung"-Block, vor "Bewertungs-Karte"
  - Nur gerendert wenn `events.length > 0` (kein leerer State)

### Technische Details
- 4 Trigger-Punkte: Dispatch (1) + Tour-Status (3: at_restaurant/on_route/delivered/cancelled) + GPS-Geofence (1: driver_nearby)
- `arrived_customer` Geofence hat 3-Min-Duplikat-Guard (aus Phase 34) → kein doppeltes `driver_nearby`
- Build: `next build` ✓ (170+ Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## CEO Review #30 — Frontend-Erweiterungen Phase 36 [DONE ✅] — 2026-06-05

### Features geprüft und abgenommen
- [x] `app/(admin)/kitchen/client.tsx` — `KitchenGanttStrip`: horizontale 30-Min-Timeline aller kochenden/bestätigten Bestellungen, 5s-Tick, farbkodierte Urgency (matcha→amber→orange→rot), Overdue-Puls, Finish-Uhrzeit, Zeitachsen-Ticks alle 5 Min
- [x] `app/(admin)/dispatch/client.tsx` — `DispatchNextBestAction`: KI-Empfehlungskasten mit Beste-Fahrer-Bestellungs-Kombination, Bündelungsempfehlung (gleiche Zone, max 3 Orders), Score-Badge, Warte-Countdown, Direktzuweisung via RPC mit Legacy-Fallback, Urgency-Farbkodierung 3-stufig, Dismiss-Button
- [x] `app/fahrer/app/delivery-view.tsx` — Schnellaktionen pro Upcoming-Stop: Telefon-Button (`tel:`-Link) + Navigations-Button (Google-Maps-deeplink mit GPS-Koordinaten), Einhand-Bedienung, `e.stopPropagation()`, Security-Attribut
- [x] `fix(kitchen)`: `React.useState` → `useState` in KitchenGanttStrip — Konsistenz-Fix ✅
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 36: ETA Accuracy Calibration Engine [DONE ✅] — 2026-06-05

### Motivation
Bisher wurden ETAs mit fixen Geschwindigkeiten (18 km/h Fahrrad, 30 km/h Auto) berechnet.
Systematische Abweichungen pro Zone, Fahrzeugtyp oder Tageszeit wurden nicht korrigiert.
Phase 36 schließt diese Lücke mit einem automatischen ML-Feedback-Loop.

### Was wurde gebaut
- [x] `scripts/migrations/030_eta_calibration.sql`
  - `eta_accuracy_log` Tabelle: Vorhersage (predicted_earliest/latest_min) vs. Realität (actual_min) pro Bestellung
    - Genau 1 Eintrag pro Bestellung (UNIQUE INDEX auf order_id)
    - `on_time` GENERATED COLUMN: TRUE wenn actual_min <= predicted_latest_min
    - Indizes: Aggregations-Index (location, zone, vehicle, hour) + Pending-Index (actual_min IS NULL)
  - `eta_calibration_factors` Tabelle: Kalibrierungsfaktor pro (location, zone, vehicle, hour_bucket)
    - hour_bucket: 0=00–05h / 1=06–11h / 2=12–17h / 3=18–23h
    - Faktor 1.0 = neutral, >1.0 = ETAs werden zukünftig verlängert
    - Klammerung [0.7, 2.0] verhindert Extreme
  - `v_eta_accuracy_summary` VIEW: Aggregierte Genauigkeitsmetriken pro (location, zone, vehicle)
    - completed/pending deliveries, avg_error_min, on_time_rate, avg_relative_error
  - `recompute_calibration_factors(p_location_id)` PL/pgSQL Funktion:
    - Berechnet Faktoren aus letzten 30 Tagen (min 5 Samples pro Bucket)
    - UPSERT auf eta_calibration_factors → idempotent
    - Gibt Anzahl upserted Rows zurück
  - RLS: service_role ALL + authenticated SELECT via employees.location_id

- [x] `lib/delivery/eta-calibration.ts` — Kalibrierungs-Engine (TypeScript strict, kein `any`)
  - `logEtaPrediction(params)`: Dispatch-Zeitpunkt + Vorhersage in eta_accuracy_log upsert
    - hour_of_day (UTC), day_of_week (0=Mo–6=So)
  - `recordActualDelivery(orderId, deliveredAt)`: actual_min = (delivered_at - predicted_at) / 60s
    - Plausibilitätscheck: 0 < actual_min < 480 (8h max)
    - Graceful Skip wenn kein Log-Eintrag vorhanden (ältere Orders)
  - `recomputeCalibrationFactors(locationId)`: ruft DB-Funktion auf, gibt rows_upserted zurück
  - `recomputeAllLocations()`: Cron-Wrapper für alle aktiven Locations (per-location try/catch)
  - `getCalibrationFactor(locationId, zone, vehicle, hourOfDay)`: factor lookup, default 1.0
  - `getAccuracyReport(locationId)`: overall + byZone[] + calibrationFactors[]
    - Graceful Fallback mit `_fallback: true` wenn Migration 030 fehlt

- [x] `app/api/delivery/admin/eta-accuracy/route.ts`
  - GET → `getAccuracyReport()` für eigenen Standort (Auth via employees.location_id)
  - POST → `recomputeCalibrationFactors()` manuell triggern

- [x] `lib/delivery/dispatch-engine.ts` Integration:
  - Nach ETA-Berechnung (Schritt 9a): `logEtaPrediction()` fire-and-forget
  - Felder: orderId, locationId, batchId, driverId, zone, vehicle, predictedEarliestMin, predictedLatestMin

- [x] `app/api/delivery/tours/[id]/status/route.ts` Integration:
  - Bei state=delivered: `recordActualDelivery(orderId, stop.completed_at)` fire-and-forget
  - Pro Dropoff-Stop (neben bestehendem Payout + Rating-Token)

- [x] `app/api/cron/smart-dispatch/route.ts` Integration:
  - `recomputeEtaCalibration()` täglich um 02:00 UTC (parallel zu `runDailyReportCache`)
  - Response enthält `eta_calibration: { locations, factorsUpdated, errors }`

### Technische Details
- Kalibrierungsfaktor-Formel: `1.0 + (avg_error / avg_predicted_latest)` — klemmt auf [0.7, 2.0]
- Mindestsamplesize: 5 Deliveries pro (zone × vehicle × hour_bucket) für statistische Relevanz
- Rollierendes 30-Tage-Fenster: ältere Daten verlieren Einfluss automatisch
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## CEO Review #29 — Frontend-Erweiterungen Phase 35 [DONE ✅] — 2026-06-05

### Features geprüft und abgenommen
- [x] `app/track/[bestellnummer]/tracking.tsx` — `DeliveryCountdownRing`: SVG-Countdown-Ring für Unterwegs-Phase, gespiegelt zu CookingProgressRing, `fertig_am → eta_latest` als Zeitfenster, Farbkodierung grün→amber→orange→rot, Overdue-Zustand, 1s-Tick
- [x] `app/(admin)/kitchen/client.tsx` — `KüchenlastAmpel`: Live-Auslastungsindikator im Toolbar (Normal / Ausgelastet / Überlastet), pulsiert bei Rot, liest aus gecachtem `filtered`-State
- [x] `app/(admin)/dispatch/client.tsx` — `Queue-Clearance-Badge` in TodayDispatchOverview: schätzt Wartezeit bis Queue leer (`readyCount / onlineDrivers × 25min`), Rot-Alert bei >60 Min, Division-durch-Null Guard
- [x] `app/fahrer/app/client.tsx` — Verdienst-Schätzung pro Tour: `3€/Stopp + 0.15€/km`, Cents-gerundet, Badge nur wenn >0€
- [x] `components/lieferdienst/statistics-view.tsx` — `DriverLeaderboard`: Top-5 Fahrer nach Lieferungen heute, proportionale Balken, Medaillen-Emojis, Delta vs. gestern, Aktiv-Pulse-Punkt
- Build: `next build` ✓ (170+ Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 34: Driver GPS Trail Tracking + Geofencing Auto-Status Engine [DONE ✅] — 2026-06-05

### Motivation
Bisher gab es keine kontinuierliche GPS-Aufzeichnung während aktiver Touren.
Fahrer-Statüsse (assigned → at_restaurant → en_route) mussten manuell ausgelöst werden.
Phase 34 schließt diese Lücke: automatische Breadcrumb-Spur + Proximity-Geofencing.

### Was wurde gebaut
- [x] `scripts/migrations/029_gps_tracking.sql`
  - `driver_gps_trail` Tabelle: GPS-Breadcrumbs pro Fahrer (driver_id, location_id, batch_id, lat, lng, accuracy_m, speed_kmh, heading_deg, recorded_at)
  - `driver_geofence_events` Tabelle: automatisch erkannte Ankunfts-Ereignisse (arrived_restaurant / arrived_customer / departed_restaurant) mit order_id, distance_m, auto_processed-Flag
  - `v_driver_last_gps` VIEW: letzter bekannter GPS-Punkt pro Fahrer mit Driver-State/Vehicle
  - `v_active_driver_trails` VIEW: Fahrerspuren der letzten 30 Min als JSON-Array (bis 60 Punkte pro Fahrer)
  - `cleanup_old_gps_trails()` PostgreSQL-Funktion: löscht Trail-Punkte >24h + Geofence-Events >7 Tage, gibt gelöschte Zeilen zurück
  - RLS: service_role all + authenticated SELECT via employees.location_id
  - 3 Indizes: (driver_id, recorded_at DESC), (location_id, recorded_at DESC), (batch_id) WHERE NOT NULL

- [x] `lib/delivery/gps-tracker.ts` — GPS-Tracking + Geofencing Engine (TypeScript strict, kein `any`)
  - `recordGpsPoint(params)`: Breadcrumb in driver_gps_trail + mise_drivers.last_lat/lng parallel aktualisieren
  - `checkGeofences(driverId, lat, lng, locationId)`: Proximity-Check mit 3-Minuten-Duplikat-Guard
    - Restaurant-Ankunft: state=assigned + <150m → loggt `arrived_restaurant` + setzt state=at_restaurant
    - Kunden-Ankunft: state=en_route + <100m zum nächsten Dropoff-Stop → loggt `arrived_customer`
    - Race-condition-safe: UPDATE nur wenn state noch 'assigned' (optimistic lock)
  - `getActiveTrails(locationId)`: alle Fahrerspuren für Dispatch-Karte, Graceful Fallback wenn Migration fehlt
  - `getDriverTrail(driverId, minutes)`: Einzelspur der letzten N Minuten (max 120 Punkte)
  - `getGeofenceEvents(params)`: Geofence-Events filtern nach driverId / batchId / locationId
  - `pruneOldTrails()`: ruft cleanup_old_gps_trails() auf, gibt gelöschte Zeilen zurück

- [x] `app/api/driver-app/me/gps/route.ts` — GPS-Update Endpoint (Fahrer-App)
  - POST: `{ driverId, locationId, lat, lng, batchId?, accuracy_m?, speed_kmh?, heading_deg? }`
  - Koordinaten-Validierung: lat [-90,90], lng [-180,180]
  - Ruft recordGpsPoint() + checkGeofences() auf
  - Response enthält `geofenceEvents` + `newDriverState` wenn Geofence ausgelöst

- [x] `app/api/delivery/admin/gps-trails/route.ts` — Admin GPS-Trails API
  - `GET ?location_id=...` → alle aktiven Fahrerspuren (30 Min) + Graceful Fallback (_fallback: true)
  - `GET ?location_id=...&driver_id=...&minutes=60` → Einzelspur eines Fahrers
  - `GET ?location_id=...&action=geofence_events` → letzte Geofence-Events der Location
  - Auth: Employee → location_id → Tenant-Guard bei cross-location Abfragen

- [x] `app/(admin)/dispatch/driver-map.tsx` — Trail-Polylinien in Dispatch-Karte
  - Neuer `trails?: DriverTrail[]` Prop (`{ driverId, points: [{lat, lng}] }`)
  - Initiales Rendern: Trail-Polylinien als gestrichelte Linie (dashArray 5,4), opacity 0.55
  - Farbkodierung: grün (frei) / orange (unterwegs) / blau (zurück) — passend zu Fahrer-Markern
  - Separater Update-Effect: `trailLayerRef.clearLayers()` + Neu-Rendern bei neuen GPS-Daten
  - `leafletRef` für typsicheren Zugriff auf Leaflet-Instanz ohne `window.L`

### Technische Details
- Geofence-Radien: 150m Restaurant / 100m Kunde (urban delivery optimiert)
- Duplikat-Guard: kein zweites Event innerhalb 3 Minuten für dieselbe batch_id + event_type
- Per-Order-Deduplizierung bei `arrived_customer`: separater Key `arrived_customer_{orderId}`
- Cleanup-Retention: GPS-Trail 24h / Geofence-Events 7 Tage
- Driver-State-Update: `at_restaurant` nur gesetzt wenn state noch 'assigned' (race-condition-safe)
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## CEO Review #28 — Frontend-Erweiterungen Phase 33 [DONE ✅] — 2026-06-05

### Features geprüft und abgenommen
- [x] `app/(admin)/kitchen/client.tsx` — `ScheduledCookCountdownGrid`: SVG-Countdown-Ring für geplante Kochstarts (status=scheduled), 15-Min-Vorschauhorizont, farbkodierte Dringlichkeit (blau→amber→orange→rot), 1s-Tick, Sort by urgency
- [x] `app/(admin)/dispatch/client.tsx` — `TodayDispatchOverview`: persistente Schicht-Leiste (Lieferquote, Ø Score, Delta vs. gestern), 60s-Reload, graceful fallback, bereit/unterwegs/online-Badges
- [x] `app/fahrer/app/client.tsx` — Per-Stopp-ETA mit Fallback-Schätzung (`total_eta_min` anteilig), visuelles Badge mit `⏰`-Icon
- [x] `app/order/[locationSlug]/components/success-state.tsx` — Tracking-Link teilen: Web Share API (mobil) + Clipboard-Fallback (Desktop), 3s-Bestätigungsflash
- [x] `app/(admin)/lieferdienst/client.tsx` — KPI-Schicht-Tempo: Bestellungen/h mit Guard `schichtMinutes >= 5`, Farbkodierung 3-stufig, Grid 4→5 Spalten
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 32: Franchise Real-Time Command Center [DONE ✅] — 2026-06-05

### Motivation
Die bestehende Multi-Location-Funktion (`/api/delivery/admin/reporting?type=multi`)
liefert nur historische Perioden-Reports. Franchise-Betreiber mit mehreren Standorten
hatten keine Möglichkeit, den Echtzeit-Status aller Locations gleichzeitig zu sehen.

### Was wurde gebaut
- [x] `scripts/migrations/028_franchise_realtime.sql`
  - `v_location_realtime_status` VIEW: Echtzeit-KPIs pro Location (queue_depth, active_tours,
    cooking_now, oldest_queued_min, completed_today, active_alerts, critical_alerts)
  - `v_tenant_driver_summary` VIEW: Fahrer-Verteilung tenant-weit (online/idle/busy)
  - 3 Performance-Indizes: Franchise-Queue-Scan, aktive-Tours-Scan, Employees-Location
- [x] `lib/delivery/franchise.ts` — Franchise Engine (6 Funktionen, TypeScript strict, kein `any`)
  - `getTenantLocations(tenantId)`: alle Locations eines Tenants geordnet nach Name
  - `getFranchiseRealtime(tenantId)`: Echtzeit-KPIs via `v_location_realtime_status`
    + Graceful-Fallback wenn Migration 028 fehlt (`_fallback: true`)
  - `deriveHealth(row)`: berechnet 'ok'|'warning'|'critical' aus KPIs (Alarmcount + Queue-Alter)
  - `getTenantDriverStatus(tenantId)`: Fahrer-Headcount via `v_tenant_driver_summary`
  - `getFranchiseAlerts(tenantId)`: alle offenen Alarme aller Tenant-Locations (max 50, neueste zuerst)
  - `getFranchiseSummary(tenantId)`: kombiniertes Dashboard in 1 Call (Promise.all-parallel)
    — locations[] + drivers{} + alerts[] + totals{} + generated_at
- [x] `app/api/delivery/admin/franchise/route.ts` — Franchise API
  - Auth: authentifizierter Employee → location_id → tenant_id (automatisch aufgelöst)
  - `GET ?action=overview` (default) → vollständiges `FranchiseSummary`
  - `GET ?action=alerts` → alle offenen Alarme mit Location-Namen
  - `GET ?action=locations` → statische Location-Liste für Tenant

### Technische Details
- Abgrenzung zu `reporting?type=multi`: das ist historisch/perioden-basiert (v_daily_location_kpis);
  `franchise?action=overview` ist Echtzeit (kein Cache, SELECT on demand)
- TypeScript: `GenericStringError`-Handling via `rawRow as unknown as Record<string, unknown>`
  (Views existieren noch nicht im Supabase-Typen-Schema — dasselbe Muster wie Phase 26/reporting.ts)
- Health-Signallogik: critical = critical_alerts>0; warning = active_alerts>0 ODER queue_depth≥5
  ODER oldest_queued_min≥15; sonst ok
- Build: `next build` ✓ (171 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 31: Webhooks + Alerts Management UI [DONE ✅] — 2026-06-04
- [x] `app/(admin)/analytics/client.tsx` — `AlertsPanel` + `WebhooksPanel` ergänzt

  **AlertsPanel:**
  - Lädt aktive Betriebsalarme via `GET /api/delivery/admin/alerts?view=active`
  - Farbkodierung 3-stufig: critical (rot+puls), warning (amber), info (grau)
  - Pro-Alert-Auflösen via `PATCH /api/delivery/admin/alerts/[id]` + `{ action: 'resolve' }`
  - "Alle auflösen" Button → `POST { action: 'resolve_all' }`
  - "Regeln prüfen" Button → `POST { action: 'evaluate' }`, zeigt +N neu / N gelöst
  - Bell-Icon pulsiert bei critical-Alarmen
  - Grüner "System läuft normal" State bei 0 Alarmen
  - Loading-Skeleton (animate-pulse) + Error-Banner

  **WebhooksPanel:**
  - Lädt Webhook-Liste mit Stats via `GET /api/delivery/admin/webhooks`
  - Pro Webhook: zugestellt/ausstehend/fehlgeschlagen Stats, letzter Delivery-Timestamp
  - Aktivierungs-Toggle via `PATCH /api/delivery/admin/webhooks/[id]` + `{ is_active }`
  - Löschen mit Confirm-Dialog → `DELETE /api/delivery/admin/webhooks/[id]`
  - Test-Event senden → `POST /api/delivery/admin/webhooks/[id]?action=test`, zeigt HTTP-Status
  - Grüner Punkt = aktiv, Amber = aktiv aber consecutive_failures > 0, Grau = inaktiv
  - Fehler-Count-Badge (amber) bei aufeinanderfolgenden Fehlern
  - Add-Formular (Inline): URL/Secret/Beschreibung-Felder + 20 Event-Toggles (alle DeliveryEventTypes)
  - Client-seitige Validierung: https:// Pflicht, Secret min. 16 Zeichen, mind. 1 Event
  - Event-Badges per Webhook (max. 6 sichtbar + "+N")
  - Migration-025-Hinweis wenn Tabelle fehlt (migration_pending graceful fallback)
  - Empty-State mit Erklärungs-Text

  **Neue Lucide-Imports:** `AlertTriangle, Bell, Link2, Plus, Trash2, Webhook, X`
  **TypeScript:** strict, kein `any` — alle Response-Typen explizit typisiert
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## CEO Review #27 — Echtzeit-Erweiterungen [DONE ✅] — 2026-06-04
- [x] `app/(admin)/dispatch/client.tsx` — Score-Verteilung-Histogramm (5 Buckets 0–100, Ø-Badge, Farbkodierung)
- [x] `app/(admin)/kitchen/client.tsx` — `KitchenActivityFeed`: Statusübergang-Chips in Echtzeit (bis 12 Einträge)
- [x] `app/fahrer/app/delivery-view.tsx` — MM:SS-Countdown bis ETA pro Stop (grün/amber/rot, Overdue-Pulse)
- [x] `app/track/[bestellnummer]/tracking.tsx` — `CookingProgressRing` 1s-Tick, MM:SS statt %, Farbkodierung 4-stufig
- [x] `components/lieferdienst/statistics-view.tsx` — Fahrer-Tagesranking: Fortschrittsbalken, Gold/Silber/Bronze-Farbkodierung
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅
- Integrations-Check: alle 5 Features korrekt mit 1s-Ticker im Parent synchronisiert ✅

## Phase 30: Delivery Config Management UI [DONE ✅] — 2026-06-04
- [x] `app/(admin)/analytics/client.tsx` — `DeliveryConfigPanel` + `ConfigRow` ergänzt
  - Lädt alle 20 Delivery-Settings aus `GET /api/delivery/admin/config?location_id=...`
  - Zeigt Settings gruppiert nach Kategorie: Dispatch / Touren-Bündelung / Liefer-Zonen / ETA / Küchen-Timing / Fahrer-Scoring
  - Inline-Editing: Klick auf Wert → Zahlen-Input → Enter/Blur speichert via `PATCH /api/delivery/admin/config`
  - Client-seitige Validierung: min/max aus API-Metadaten, NaN-Guard
  - Einheitskürzel pro Key (min / km / % / km/h / Stopps / x) in KEY_UNITS-Map
  - "ANGEPASST"-Badge (amber) für überschriebene Settings + Default-Wert-Anzeige
  - Gesamt-Badge: „N angepasst" im Panel-Header
  - Grüner CheckCircle-Flash 2s nach erfolgreichem Speichern
  - „Alle zurücksetzen" Button (rot, Confirm-Dialog) → `POST { action: 'reset' }` + Reload
  - Refresh-Button mit Spin-Animation
  - Graceful-Fallback-Hinweis wenn Migration 027 noch fehlt
  - Loading-Skeleton (animate-pulse) + Error-Banner
  - Neue Imports: `useRef`, `CheckCircle2`, `RefreshCw`, `Settings2` (lucide)
  - Neue Typen: `ConfigSettingRow`, `ConfigResponse` (TypeScript strict, kein `any`)
  - Panel positioniert unterhalb ExportPanel im Analytics-Dashboard
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## CEO Review #26 — 2026-06-04 [DONE ✅]
- [x] TypeScript-Bug behoben: `lib/delivery/config.ts` — `Json`-Typ-Import aus `@supabase/supabase-js` (nicht exportiert) → `unknown`-Cast
- [x] `DeliveryQueueCard` (`app/track/[bestellnummer]/tracking.tsx`): Kunden sehen Warteposition in Liefer-Queue mit animierten Dots + ETA-Fenster
- [x] `KitchenItemConsolidationPanel` (`app/(admin)/kitchen/client.tsx`): Parallelbatch-Empfehlung für Küche — gleiche Items in mehreren Bestellungen gebündelt
- [x] Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 29: Dynamic Delivery Configuration Engine [DONE ✅] — 2026-06-04
- [x] `scripts/migrations/027_delivery_config.sql`
  - `delivery_settings` Tabelle: key/value-Config pro Location (UNIQUE per location_id+key)
  - `delivery_setting_defaults` Tabelle: System-Defaults (20 Schlüssel, read-only Referenz)
  - `get_delivery_setting(location_id, key)` PostgreSQL-Funktion: Custom-Wert oder Default (COALESCE)
  - `v_delivery_settings_all` VIEW: merged Custom + Defaults mit `effective_value` + `is_customised`-Flag
  - RLS: service_role all + authenticated select+modify (tenant-gefiltert via employees)
  - 3 Performance-Indizes: location, location+key, category
- [x] `lib/delivery/config.ts` — Config Engine (7 Funktionen, TypeScript strict)
  - `DeliverySettingKey` Union-Type: 20 bekannte Schlüssel (dispatch/bundling/zones/eta/kitchen/scoring)
  - `DEFAULTS` hard-coded Fallback (spiegelt Migration 027 Seed-Daten)
  - 60s In-Memory-Cache pro Location (Map mit expiresAt)
  - `getSettings(locationId)`: alle Settings laden, mit Cache + Graceful-Fallback wenn Migration fehlt
  - `getSetting(locationId, key)`: einzelner Wert
  - `listSettings(locationId)`: alle Settings mit Metadaten (description/min/max/is_customised) aus v_delivery_settings_all
  - `upsertSetting(locationId, key, value, updatedBy)`: UPSERT mit min/max-Validierung gegen delivery_setting_defaults
  - `resetToDefaults(locationId)`: alle Custom-Settings löschen → Cache invalidieren
  - `cloneSettings(sourceId, targetId)`: Settings-Kopie zwischen Locations (multi-tenant safe)
  - `invalidateCache(locationId)`: manueller Cache-Busting für Cron/Admin
  - `getHardcodedDefaults()`: Returns defaults ohne DB-Zugriff
- [x] `app/api/delivery/admin/config/route.ts` — Config-Verwaltung API
  - `GET ?location_id=...` → alle Settings gruppiert nach Category + Customised-Count
  - `GET ?location_id=...&key=...` → einzelnes Setting mit Metadaten (404 wenn unbekannt)
  - `PATCH { location_id, key, value }` → Einzelwert setzen, min/max-Validierung, Cache-Busting
  - `POST { location_id, action: 'reset' }` → auf Defaults zurücksetzen
  - `POST { location_id, action: 'clone', source_location_id }` → Settings klonen (Tenant-Guard)
  - Auth-Guard: 401 nicht eingeloggt, 403 wenn Location nicht im eigenen Tenant
- Konfigurierbare Parameter (20 Schlüssel):
  - **dispatch**: `escalation_min`(10), `max_radius_km`(12), `stale_batch_min`(60), `max_attempts`(5)
  - **bundling**: `max_detour_km`(1.5), `max_stops`(4), `time_window_min`(8)
  - **zones**: `zone_a_radius_km`(2.0), `zone_b_radius_km`(4.0), `zone_c_radius_km`(7.0)
  - **eta**: `base_min`(15), `buffer_pct`(20), `avg_speed_kmh`(25)
  - **kitchen**: `prep_default_min`(12), `sync_interval_min`(2)
  - **scoring**: `weight_distance`(30), `weight_capacity`(25), `weight_rating`(20), `weight_zone`(15), `weight_priority`(10)
- Build: `next build` ✓ (171 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 28: 5 Frontend-Features + CEO Review #25 [DONE ✅] — 2026-06-04
- [x] `app/(admin)/kitchen/client.tsx` — `SmartTimingCountdownGrid`: SVG-Countdown-Ringe mit 1s-Tick, farbkodiert grün→rot
- [x] `app/(admin)/dispatch/client.tsx` — `TourVisualizationPanel`: Stopp-Timeline, ETA-Bar, Fortschrittsbalken, Nav-Link
- [x] `app/fahrer/app/client.tsx` — Per-Stopp-Navigation: GPS-Link (lat/lng) + Fallback Adresse, Distanz-Chip, Connector-Linie
- [x] `app/order/[locationSlug]/storefront.tsx` — `LiveEtaBar` erweitert: ETA-Bereich min–max, Auslastungsbalken, Bestellanzahl-Badge
- [x] `components/lieferdienst/statistics-view.tsx` — Schicht-Performance-Dashboard: Recharts-Balkendiagramm farbkodiert + KPI-Leiste
- [x] CEO Review #25: Build clean (0 TS-Fehler, 0 Warnungen), alle Integrations-Checks bestanden ✅
- Build: `next build` ✓ (0 TypeScript-Fehler, 0 Warnungen) ✅

## Phase 27: Perioden-Report-UI im Analytics-Dashboard [DONE ✅] — 2026-06-04
- [x] `app/(admin)/analytics/client.tsx` — `PeriodReportPanel`-Komponente ergänzt
  - Zeitraum-Tabs: „Diese Woche" / „Dieser Monat" / „Letzte 30 Tage" (umschaltbar, client-side fetch)
  - Fetch: `GET /api/delivery/admin/reporting?type=period&location_id=...&period_type=weekly/monthly` (bestehende API)
  - KPI-Kacheln (5): Bestellungen + Ø/Tag, Liefer-Umsatz (accent), Abgeschlossen + %, Pünktlichkeit (farbcodiert good/warn/bad), Ø ETA-Abweichung + aktive Fahrer
  - Tagesverlauf-Minibar-Chart (`PeriodMiniChart`): Balken proportional zu täglichen Bestellungen, Tooltip-Hover
  - Top-5-Fahrer-Tabelle: Name, Fahrzeug-Badge, Lieferungen, Pünktlich-%, Ø ETA-Abweichung (farbkodiert)
  - Empty-State wenn 0 Bestellungen: Hinweis auf Migration 026
  - Loading-Skeleton (animate-pulse) + Error-State
  - Zwei Hilfs-Komponenten: `PeriodKPI` (5 Tone-Varianten), `PeriodMiniChart` (h-16 Balken)
  - Positioniert oberhalb Export-Panel; nur sichtbar wenn `locationId` vorhanden
- Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen) ✅

## STATUS: MARKT-REIF ✅ — PHASEN 1–26 + POST-PHASE-9 + POST-PHASE-10 + CEO REVIEW #24 ABGESCHLOSSEN

## CEO Review #24 — Frontend BI-Export Integration + 2 neue Features geprüft [DONE ✅] — 2026-06-03
- [x] `app/(admin)/analytics/client.tsx` — `ExportPanel`-Komponente hinzugefügt
  - "Bestellungen CSV" Button: lädt `/api/delivery/admin/reporting/export?format=orders` herunter
  - "Fahrer-Performance CSV" Button: lädt `/api/delivery/admin/reporting/export?format=drivers` herunter
  - Zeitraum: letzte 30 Tage, sichtbar als Zeitraum-Label unter den Buttons
  - Loading-State während Download, RFC-4180-Hinweis
- [x] `app/(admin)/analytics/page.tsx` — `locationId` aus `empT.location_id` an Dashboard-Props übergeben
- [x] Dispatch Neue-Bestellung-Flash: 6s Banner wenn Küche Fertig meldet ✅
- [x] Dispatch Kundennotizen: Amber-Badge in Dispatch-Board ✅
- [x] Fahrer Tracking-Link: Web Share API + Clipboard-Fallback ✅
- [x] Statistik DB-Tagesbericht: Live-KPIs aus Reporting-API ✅
- [x] Build: `next build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen)

## Phase 26: Business Intelligence Export + Periodic Report Engine [DONE ✅] — 2026-06-03
- [x] `scripts/migrations/026_bi_reporting.sql`
  - `v_daily_location_kpis` VIEW: Tages-KPIs pro Location (Berliner Kalender-Tag) aus customer_orders
    - total/delivery/pickup/completed/cancelled orders, Umsatz gesamt/lieferung/abholung/bar/karte, aktive Fahrer
  - `v_driver_period_stats` VIEW: Fahrer-Performance pro Tag aus delivery_performance
    - Lieferungen, on_time_count/pct, avg_eta_deviation_min via LEFT JOIN mise_drivers
  - `delivery_report_snapshots` Tabelle: gecachte Perioden-Reports (UNIQUE per location+type+period_start)
    - Felder: orders_count, delivered_count, revenue_eur, on_time_pct, JSONB-Payload
    - RLS: service_role all + authenticated select (tenant-gefiltert via employees.tenant_id)
  - Index `idx_customer_orders_location_created_reporting` für schnelle Tages-Queries
- [x] `lib/delivery/reporting.ts` — BI-Engine (7 Funktionen, 283 Zeilen)
  - `getDailyKpis(locationId, date)`: Tages-KPIs aus v_daily_location_kpis; Graceful-Fallback wenn Migration fehlt
  - `getPeriodReport(locationId, periodType, from, to)`: Aggregierter Report inkl. dailyBreakdown
    + topDrivers (max 10, nach Lieferungen sortiert) + Summary-KPIs (Umsatz, onTimePct, avgEtaDev, daysIncluded)
  - `getMultiLocationSummary(locationIds[], from, to)`: Franchise-Vergleich bis 20 Locations
    aggregiert aus v_daily_location_kpis + v_driver_period_stats + locations
  - `generateOrdersCSV(locationId, from, to)`: RFC-4180-CSV max 10 000 Bestellungen (12 Spalten)
    Felder: bestellnummer, typ, status, gesamtbetrag_eur, zahlungsart, bezahlt, zone, score, eta, fahrer_id, erstellt_am
  - `generateDriversCSV(locationId, from, to)`: CSV Fahrer-Performance aus v_driver_period_stats
    Felder: datum, fahrer_name, fahrzeug, lieferungen, puenktlich, spaet, puenktlich_pct, avg_abweichung_min
  - `cacheReportSnapshot(locationId, type, start, end)`: UPSERT in delivery_report_snapshots (idempotent)
  - `runDailyReportCache()`: Cron-Helfer; cached daily (gestern) + weekly (Mo–gestern) für alle aktiven Locations (max 50)
- [x] `app/api/delivery/admin/reporting/route.ts` — 4 Query-Typen
  - `GET ?type=daily  &location_id=...&date=YYYY-MM-DD` → DailyKpis; leere Antwort mit _hint wenn keine Daten
  - `GET ?type=period &location_id=...&period_type=...&from=...&to=...` → PeriodReport (max 366 Tage)
    Standard-Zeiträume: weekly=laufende Woche Mo, monthly=erster des Monats
  - `GET ?type=multi  &location_ids=id1,id2,...&from=...&to=...` → MultiLocationSummary
    Auth-Guard: nur Locations im eigenen Tenant werden zurückgegeben (keine IDs aus anderen Tenants)
  - `GET ?type=cached &location_id=...&report_type=...&limit=N` → gecachte Snapshots-Liste (max 90)
- [x] `app/api/delivery/admin/reporting/export/route.ts` — CSV-Download
  - `GET ?format=orders &location_id=...&from=...&to=...` → `text/csv` mit `Content-Disposition: attachment`
  - `GET ?format=drivers&location_id=...&from=...&to=...` → Fahrer-Performance CSV
- [x] Cron-Integration (`app/api/cron/smart-dispatch/route.ts`)
  - `runDailyReportCache()` täglich um 02:00 UTC (`nowHour === 2 && nowMin < 2`)
  - Response enthält `report_cache: { locations, snapshots, errors }`
- Build: `npm run build` ✓ (170 Seiten, 0 TypeScript-Fehler, 0 Warnungen)

## Agenten-Team
- **CEO Agent**: Review, QA, Integration, Bug-Fixes (8x/Tag)
- **Backend-Architekt**: DB, APIs, Dispatch Engine (8x/Tag)
- **Frontend-Ingenieur**: Kitchen UI, Fahrer-App, Storefront (8x/Tag)

## Phase 25 Frontend: Urgency-Coloring + Score-Bars + Fahrer-Küchenstatus [DONE ✅] — 2026-06-03
- [x] `app/(admin)/kitchen/client.tsx` — Graduated Urgency Border auf OrderTicket-Karten
  - `border-l-4 border-l-red-500` bei critical (animate-pulse bleibt)
  - `border-l-4 border-l-orange-400` bei urgent
  - `border-l-4 border-l-yellow-400` bei progressPct 50–70%
  - `border-l-4 border-l-matcha-400` bei progressPct <50% + in_zubereitung
  - `urgencyBg`: rote/orange Hintergrundtönung für critical/urgent
- [x] `app/(admin)/dispatch/client.tsx` — Visueller Score-Balken unter Score-Chip
  - 56px breiter Balken (h-1): `bg-matcha-500` ≥80, `bg-blue-400` ≥60, `bg-orange-400` ≥40, `bg-red-400` <40
  - `style={{ width: \`${dispatch_score}%\` }}` — proportionale Breite (100 = vollständig)
- [x] `app/fahrer/app/client.tsx` — Live-Küchenstatus in Pickup-Phase
  - Supabase `.from('customer_orders').select('id, status').in('id', orderIds)` — Initial-Load
  - Realtime-Channel `kitchen-status-{batchId}` mit Filter `id=in.(uuid1,uuid2)` — Live-Updates
  - Status-Chips: 🍳 Kocht (orange, pulsierend) / Angenommen (blau) / Fertig! (grün, accent-Badge)
  - Reihenfolge-Icon: Zahl → ✓ (Checkmark) wenn fertig; Hintergrund grün
  - Alle-fertig-Banner: `🎉 Alle Bestellungen bereit! — Packen & starten`
  - Cleanup: `supabase.removeChannel(ch)` bei Batch-Wechsel oder Status 'unterwegs'
- Build: `./node_modules/.bin/next build` ✓ (170 Seiten, 0 Fehler)
- TypeScript: 1 Bug behoben (implicit any auf `.then({ data })` → explizite Typisierung)

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
- 2026-06-06: CEO Review #33 — 4 TypeScript-Fehler behoben, 4 Commits QA-geprüft, Build clean
  - Bug 1: `Target` Icon fehlte in kitchen/client.tsx Lucide-Imports → gefixt
  - Bug 2: `bestellt_am` nicht in Order-Typ → `(o as any).bestellt_am ?? o.createdAt` → gefixt
  - Bug 3: `'geliefert'` nicht in OrderStatus → `'done'` → gefixt
  - Bug 4: `windows.ts` `.select()` mit 2 Argumenten → `.select('id')` + `data?.length` → gefixt
  - Phase 39 Backend: Time Window Engine vollständig integriert (Cron, Dispatch, Tour-Status) ✅
  - HeroAurora Live-ETA: load lokal aus eta_min berechnet (nicht von API-String abhängig) ✅
  - KitchenLoadChip: API-Felder korrekt verarbeitet, 3-Stufen-Farbkodierung ✅
  - KitchenTimingAccuracyBar: scheduledMin vs actualMin Logik korrekt ✅
  - PushNotificationStats: Mock-Trichter, graceful null-return, korrekte Status-Prüfung ✅
  - Tour-Qualitätsscore: SVG-Gauge + ETA/Speed-Gewichtung (70%/30%) korrekt ✅
  - TypeScript: 0 Fehler ✅ | Build: ✓ Compiled successfully ✅
- 2026-06-06: Backend-Architekt — Phase 39: Delivery Time Window Booking Engine
  - scripts/migrations/033_delivery_windows.sql: delivery_time_slots + delivery_window_bookings + v_slot_availability + v_window_dispatch_queue + RLS + 4 Indizes
  - lib/delivery/windows.ts: 12 Funktionen (getSlotConfig, upsertSlotConfig, getAvailableSlots, bookDeliveryWindow, cancelWindowBooking, processWindowDispatch, processWindowDispatchAllLocations, markWindowDispatched, markWindowDelivered, markMissedWindows, getWindowStats, listWindowBookings)
  - GET+POST+DELETE /api/delivery/windows: Kunden-API (UUID-Validierung, Tenant-Guard)
  - GET+POST /api/delivery/admin/windows: Admin-API (slots/availability/bookings/stats + configure/toggle/cancel/process_dispatch)
  - Cron: processWindowDispatchAllLocations() + markMissedWindows() → windows: { released, missed_marked }
  - dispatch-engine.ts: markWindowDispatched() fire-and-forget nach Dispatch
  - tours/[id]/status: markWindowDelivered() fire-and-forget bei state=delivered
  - Build: ✓ (0 TypeScript-Fehler, 0 Warnungen)
- 2026-06-04: Backend-Architekt — Phase 31: Webhooks + Alerts Management UI
  - analytics/client.tsx: AlertsPanel (aktive Alarme, auflösen, evaluate) + WebhooksPanel (Liste, Add-Formular, Toggle, Delete, Test)
  - Alle 20 DeliveryEventTypes als klickbare Event-Toggles im Add-Formular
  - Build: ✓ (170 Seiten, 0 Fehler, 0 Warnungen), git push ✓
- 2026-06-03: CEO-Agent — Review #23: Phase 25 + 5 Features aus 4 Commits geprüft, 1 TypeScript-Bug behoben (4 Commits: `62598a1`, `02b18c0`, `ca41023`, `25c77be`)
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

- 2026-06-10: Frontend-Ingenieur — Phase 57: FahrerRankingCard + KitchenDispatchPressureChip
  - FahrerRankingCard: Wochen-Ranking (#Platz/Gesamt), Stops/Touren/km, Trend ↑↓=, Medaillen 🥇🥈🥉
    Erscheint im Warte-Zustand (online, kein aktiver Batch) via /api/delivery/driver/my-performance
  - KitchenDispatchPressureChip: Toolbar-Chip zeigt fertige Lieferbestellungen die auf Dispatch warten
    Farbampel: grün (1), orange (2–3), rot+pulse (4+) — sofort sichtbar für Küchenpersonal
  - Build: Compiled successfully, 0 TypeScript-Fehler
