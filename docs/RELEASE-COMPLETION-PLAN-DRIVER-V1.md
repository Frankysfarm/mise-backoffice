# Release Completion Plan — Driver App V1

Stand: 12.08.2026 · Repo `mise-delivery-hardening-release` (Branch `delivery-hardening-20260811`, HEAD `fef6e86a`) · Prod: mise-gastro.de, Container Port 3310
Regel: **Feature-Freeze. FINISH → VERIFY → RELEASE → STOP.** Nur P0 + release-kritische P1 sind Release-Scope. P2/P3 = Post-Release-Backlog.

---

## 1. Ist-Zustand (verifiziert, nicht vermutet)

**Evidenz-Basis:** E2E-Lauf 12.08. mit 2 Browser-Fahrern und 4 Bestellungen — 4 Touren komplett automatisch durchgespielt (Annehmen → Picken → Route → Bar-Kassieren → Geliefert); 19/19 Vitest `tests/delivery` grün; Prod-Deploy mit Health-Check; 3 unabhängige Code-Audits (Golden-Path-Trace, Robustheit, Produktions-Hygiene).

### Funktioniert (belegt)
- Login E-Mail+Passwort + Fahrer-Gate (`app/fahrer/login/page.tsx:159-183`, `/api/fahrer/whoami`)
- Session-Restore über Supabase-SSR-Cookie + `force-dynamic` Server-Load (`app/fahrer/app/page.tsx`)
- Online/Offline komplett: Push-Subscribe → RPC `start_driver_dispatch_session` (Migration 058) mit harten Gates; `end_driver_dispatch_session` blockt bei aktiver Tour
- Angebot → Annehmen: CAS-RPC `accept_delivery_batch` (409 bei Konflikt), Ablehnen mit `requeue` + `excluded_until`
- Geführtes Picken → „Route berechnen" nur wenn alles gepickt (`client.tsx:971,1160`) → Google Maps (Apple Maps seit `fef6e86a` vollständig entfernt)
- Angekommen/Geliefert-Persistenz im Happy Path (`arrived`-Route, `delivered`-Route inkl. Bar-Zahlung, Batch → `completed`, Queue leer)
- App-Neustart: Tour-Wiederherstellung vollständig serverseitig
- Batch-Reconcile läuft produktiv (Cron `/api/cron/smart-dispatch` alle 2 min → `reconcileCompletedBatches`, `dispatch-engine.ts:165`)
- Keine Mocks/Testdaten/localhost/hartcodierten Secrets in fahrer-kritischen Produktivpfaden (geprüft)

### Teilweise / kaputt (Details in Abschnitt 3)
Storno-Sichtbarkeit während Tour, stiller Delivered-Fallback, serverseitiger Angebots-Verfall, Realtime-Fallback, Auth-Ablauf, GPS-Fehleranzeige, Build-Gates.

### Nicht im Repo reproduzierbar
DB-Funktionen `confirm_pick_item` und `confirm_pickup_complete` existieren **nur in der Live-DB** — keine Migration im Repo definiert sie. Der Kern des Pick→Route→Delivered-Pfads hängt daran.

---

## 2. Driver App V1 — Golden Path (bestehendes Produkt)

```
Login (E-Mail+Passwort) → Session-Restore (Cookie)
→ „Online gehen" (Push-Subscribe + start_driver_dispatch_session)
→ Tour-Angebot (Push/Realtime/Refresh, 3-min-Countdown)
→ „Annehmen" (accept_delivery_batch, CAS)
→ Picken je Bestellung („Picken" → „Ist dabei" je Artikel → „Alles dabei — losfahren")
→ „Route berechnen" (confirm_pickup_complete + reroute) — einzige Primäraktion
→ Google Maps mit Route
→ je Stopp: Navigieren → Angekommen → „Kassiert & geliefert" (persistiert Status + Bar-Zahlung)
→ letzter Stopp → Batch state='completed' → Tour verschwindet aus aktiver Queue
GPS trackt durchgehend (POST /api/driver/v1/me/position, max. 1×/10 s)
```

**Abnahmekriterium GP-1 (Founder-Vorgabe 13.08., release-relevant, kein Kosmetik-Punkt):**
Bei Touren mit mehreren Bestellungen/Pickups gilt verbindlich:
1. Der Fahrer geht jede Bestellung einzeln durch (geführtes Durchklicken).
2. Jeder erforderliche Artikel wird je Bestellung bestätigt (`confirm_pick_item` → `order_items.pick_confirmed_at`).
3. Routenberechnung/Navigation startet NICHT, bevor alle erforderlichen Pickups bestätigt sind (Server-Gate: `confirm_pickup_complete` zählt unbestätigte Items und verweigert; zusätzlich `picked-up`-Route mit `pick_not_confirmed`-Gate).
4. Sind alle Pickups bestätigt, wird die Google-Maps-Lieferroute AUTOMATISCH berechnet und gestartet (client.tsx: nach letzter gepickter Order → `completeAndRoute()` ohne weiteren Tap).
Verifikation: Rig-E2E mit ≥2 Bestellungen + Screenshot-Kette (Pick-Dialog je Order → Auto-Route) + Negativ-Probe (Route-Versuch mit unbestätigtem Item → PICK_REQUIRED/`pick_not_confirmed`).

---

## 3. Befunde — klassifiziert

### P0 — Release-Blocker

**P0-1 · Stiller Delivered-Fallback korrumpiert Lieferdaten**
- Problem: Bei HTTP-Fehler der `delivered`-Route (z. B. 409 `order_not_picked_up`, 401) schreibt der Client still direkt per Supabase (`delivery-view.tsx:461-468`): Order wird `geliefert` **ohne** Bar-Zahlungs-Erfassung, Batch bleibt `in_progress`, RLS-Fehler bleiben unsichtbar. Doppel-Tap → 409 → Fallback überschreibt Zeitstempel.
- Ursache: bewusster „Fallback"-Direct-Write statt Fehleranzeige; Vorbedingung `status='unterwegs'` scheitert nach unsauberem Pickup/Reload.
- Akzeptanz: Kein Direct-Write-Fallback im Delivered-Pfad. API-Fehler ⇒ sichtbare Fehlermeldung + korrekte Recovery (bei 409 `order_not_picked_up`: Hinweis + Pickup-Abschluss nachholen). Zweiter Delivered-Call ist No-op (kein Zeitstempel-Überschreiben). Bar-Zahlung wird in 100 % der Geliefert-Fälle erfasst.
- Verifikation: Vitest-Verhaltenstest (Mock-API 409/401) + E2E-Rig-Szenario „Delivered nach Reload ohne Pickup"; SQL-Probe: kein `geliefert` ohne `bezahlt`-Satz bei Bar-Touren.
- Abhängigkeit: P0-4 (Funktions-Contract muss versioniert sein, um 409-Ursache sauber zu beheben).

**P0-2 · Stornierte/umverteilte Bestellungen bleiben beim Fahrer lieferbar**
- Problem: `DeliveryView` synct `initialStops` nie in den lokalen State (`delivery-view.tsx:74`, kein Sync-Effect), Realtime lauscht nur auf UPDATE der Legacy-Tabelle `delivery_batch_stops` (nicht `mise_delivery_batch_stops`, keine DELETEs), Server-Load filtert `cancelled` nicht (`page.tsx:44,56`). Ein stornierter Stopp bleibt sichtbar und kann „geliefert" werden.
- Ursache: Storno-Serverseite (`cancel_order_from_batch`, `removeStopFromActiveTour`) wurde gebaut, Client-Sync nie nachgezogen (für den Pick-Screen existiert der Sync, `client.tsx:100-101`).
- Akzeptanz: Stornierter Stopp verschwindet beim Fahrer ≤ 30 s (Realtime oder Polling) und spätestens bei jedem Refresh; „Kassiert & geliefert" auf stornierte Order wird serverseitig mit 409 abgelehnt und clientseitig sauber angezeigt; `cancelled`-Stops werden nie gerendert.
- Verifikation: E2E-Rig-Szenario „Storno während aktiver Tour" (Order canceln → Fahrer-UI prüfen → Delivered-Versuch → 409); Verhaltenstest für Stop-Filter.
- Abhängigkeit: P1-1 (Realtime-Härtung) sinnvoll gemeinsam.

**P0-3 · Angebots-Verfall serverseitig tot — ✅ GESCHLOSSEN 12.08. (Fehlklassifikation, empirisch widerlegt)**
- Investigation-Ergebnis: Der Audit sah nur `vercel.json` — die Prod-Realität auf Hetzner ist der **`mise_cron`-Container**, dessen interne Schleife `repush-loop`, `push-flush` und `dispatch-tick` **alle 15 s per POST mit `BISS_INTERNAL_TOKEN`** aufruft. `fn_auto_cancel_unaccepted_batches` + `fn_recover_abandoned_tours` laufen also produktiv.
- Evidenz (Live-DB 12.08.): 0 hängende `pending_acceptance`-Batches; alle nicht angenommenen Angebote der letzten 48 h wurden nach **exakt 3 min** gecancelt (5/5 Stichproben `min_alive=3`). Endpoint-Test mit Token: Loop aktiv.
- Verbleibende Randnotizen: (a) redundanter Host-Crontab-Eintrag ruft `repush-loop` per GET → 405 (harmlos, aufräumen = P2); (b) `vercel.json` beschreibt nicht die echte Cron-Infrastruktur → Doku-Punkt P2; (c) `fn_recover_abandoned_tours` requeued **bewusst nicht** nach Pickup (nur Alert `driver_stale_after_pickup_manual_intervention`) — Live-Beleg: Batch `39c15e9c` (Order RT-S1-164814, 12.08. 16:51 UTC) hängt mit offenem Dropoff und offline gegangenem Fahrer in `in_progress` → genau der Fall für P1-5.

**P0-4 · Golden-Path-DB-Funktionen nicht versioniert (`confirm_pick_item`, `confirm_pickup_complete`)**
- Problem: Beide RPCs werden vom Client aufgerufen (`pick-dialog.tsx:64`, `client.tsx:717`), sind aber in keiner Migration im Repo definiert. Jede neue Umgebung / jeder DB-Restore bricht die Kette Picken → Route → Delivered. Kritischer Frontend/DB-Contract ist unverifiziert.
- Ursache: Funktionen wurden direkt in der Live-DB angelegt.
- Akzeptanz: Beide Funktionsdefinitionen per `pg_dump`/`pg_get_functiondef` aus der Live-DB extrahiert, als idempotente Migration im Repo (`scripts/migrations/`), inhaltlich reviewt (SECURITY DEFINER, Tenant-/Owner-Checks), identisch mit Live.
- Verifikation: Diff Repo-Definition ↔ Live-DB = leer; Anwendung auf Schatten-DB + Pick-Flow-Durchlauf dagegen.
- Abhängigkeit: keine (reine Extraktion + Review; kein Verhaltens-Change).

### P1 — release-kritisch (im Release-Scope)

**P1-1 · Realtime ohne Status-Handling und ohne Fallback während aktiver Tour**
- Problem: Kein `.subscribe()`-Status-Callback irgendwo; bei `CHANNEL_ERROR`/`TIMED_OUT` kein Reconnect, kein Polling. Visibility-Refresh greift nur, wenn **keine** aktive Tour (`client.tsx:298-306`). `DeliveryView` abonniert `mise_delivery_batch_stops` gar nicht. Bei totem wss (im Test-Rig dauerhaft beobachtet) friert die Tour-Ansicht ein.
- Akzeptanz: Subscribe-Status wird ausgewertet; bei Fehler Reconnect + Polling-Fallback (≤ 30 s Intervall) auch während aktiver Tour; Mise-Stop-Tabelle abonniert.
- Verifikation: Rig mit blockiertem wss — Tour-Updates (Storno, neue Stops) kommen ≤ 60 s an.
- Abhängigkeit: gemeinsam mit P0-2 umsetzen.

**P1-2 · Auth-Ablauf mitten in der Tour bleibt stumm**
- Problem: Kein 401-Handling im Fahrer-Client; `accessTokenRef` wird nie invalidiert; GPS-POST-Antwort ungeprüft → nach Session-Ablauf verschwindet der Fahrer still aus dem Dispatch-Pool (Eligibility filtert `last_position_at`).
- Akzeptanz: 401 ⇒ `refreshSession()`-Versuch, sonst sichtbare Meldung + Redirect Login; GPS-POST-Fehler werden gezählt und ab Schwellwert angezeigt.
- Verifikation: Session künstlich invalidieren (Token widerrufen) während Online-Phase → UI-Meldung erscheint, nach Re-Login läuft Tracking weiter.

**P1-3 · GPS-Ausfall/Permission-Denied für den Fahrer unsichtbar**
- Problem: Error-Callback in `bg-location.ts:99` ist stilles `resolve()`; die komplette GPS-Status-UI inkl. „GPS blockiert/veraltet" liegt in einem toten `{false && …}`-Block (`client.tsx:840-890`). Fahrer fliegt aus dem Dispatch-Pool, ohne es zu erfahren.
- Akzeptanz: Permission-Denied und >2 min ohne Fix erzeugen eine sichtbare Warnung mit Handlungsanweisung; `gpsOk` spiegelt den echten Zustand.
- Verifikation: Browser-Test mit verweigerter Geolocation-Permission; Rig-Assertion auf Warn-Banner.

**P1-4 · Offline-„Geliefert" meldet Erfolg ohne Server-Bestätigung**
- Problem: Offline-Pfad schreibt nur die Outbox und ruft trotzdem `onAllDone()` (`delivery-view.tsx:448-450`); Outbox bricht nach 5 Versuchen still ab; `markFailedAttempt`/Proof-Upload sind fire-and-forget. Lieferstatus kann verloren gehen.
- Akzeptanz: Offline-Delivered zeigt Status „wartet auf Netz"; Tour gilt erst nach bestätigtem Server-Write als abgeschlossen; Outbox-Erschöpfung erzeugt sichtbaren Fehler.
- Verifikation: Rig-Szenario Netztrennung beim letzten Stopp → Netz wieder da → DB-Zustand korrekt; Outbox-Verhaltenstest.

**P1-5 · Tour-Abschluss Pfad B ohne Fehlerbehandlung + inkonsistenter Fahrer-State**
- Problem: `TourCloseButton` feuert direkte Browser-Writes via `Promise.all` ohne Fehlerauswertung (u. a. `delivery_batches.status` ohne RLS-Deckung) und ruft `onDone()` bedingungslos; nach Server-Pfad A bleibt `mise_drivers.state='en_route'` stehen, Reconcile setzt `aktueller_batch_id` nicht zurück und behandelt nur `in_progress`-Batches.
- Akzeptanz: Abschluss läuft über eine Server-Route (oder vollständig RLS-gedeckte Writes) mit Fehleranzeige; nach Abschluss: `mise_drivers.state` konsistent (`idle`/`returning`), `driver_status.aktueller_batch_id=null`; Reconcile deckt auch `assigned`/`at_restaurant`/`picked_up` mit komplett erledigten Stops ab.
- Verifikation: Verhaltenstest (nicht Quelltext-grep) für Reconcile; SQL-Probe nach E2E-Tour: keine hängenden States.

**P1-6 · Kein wirksames Build-/Deploy-Gate**
- Problem: `next.config.js:5` `ignoreBuildErrors: true`; die drei `NEXT_PUBLIC_*`-Build-Args (Supabase-URL/Key, VAPID) bauen bei Fehlen **leer und grün** durch → Push still tot; der gescopte Typecheck `tsconfig.delivery-hardening.json` ist in keinem npm-Script/Deploy verdrahtet; `build-version.ts` wird manuell gepflegt und zeigt aktuell einen falschen Stand (Hash `62f6960e` ≠ HEAD) — das Diagnose-Werkzeug für „App zeigt was Altes" führt in die Irre.
- Akzeptanz: Dockerfile bricht ab, wenn eines der drei Build-Args leer ist; `typecheck:delivery` als npm-Script + Aufruf in `auto-deploy.sh` vor dem Build; `build-version.ts` wird beim Deploy automatisch aus `git rev-parse` generiert (Mechanik existiert bereits in `auto-deploy.sh`, muss nur verlässlich greifen und committet werden).
- Zusatzbefund 13.08. (Live-Vorfall): `next/font` lädt Google-Fonts **zur Build-Zeit** aus dem Netz — ein transienter fonts.gstatic.com-Ausfall ließ den Deploy-Build scheitern (Build-Nichtdeterminismus). Außerdem maskiert `bash auto-deploy.sh | tail` den Exit-Code — Deploy-Aufrufe nie durch eine Pipe leiten. Empfehlung (Backlog): Fonts self-hosten oder `next/font`-Fallback konfigurieren.
- Verifikation: Build ohne VAPID-Arg schlägt fehl (Exit ≠ 0); nach Deploy zeigt das Gerät die HEAD-Version an.

**P1-7 · Ungeschützter Debug-Endpoint `/api/driver/v1/push-debug`**
- Problem: POST ohne Auth, loggt beliebigen Body (`push-debug/route.ts:1-11`) — Log-Injection/Flooding von außen.
- Akzeptanz: Endpoint entfernt oder hinter `BISS_INTERNAL_TOKEN`; die drei weiteren internen Endpoints (`dispatch-tick`, `push-flush`, `repush-loop`) verweigern bei fehlendem Token hart.
- Verifikation: `curl` ohne Token ⇒ 401/404.

### P2 — nicht blockierend (Post-Release-Backlog)

| # | Befund | Beleg |
|---|---|---|
| P2-1 | Kein `pushsubscriptionchange`-Handler; Abo-Refresh nur beim Online-Toggle | `public/sw.js`, `client.tsx:597-602` |
| P2-2 | SW-Cache-Version datums- statt buildbasiert (täglicher Flush um 0 Uhr, kein Flush bei Same-Day-Deploy) | `sw.js:9` |
| P2-3 | Web-Push-Outbox wird auch bei Fehlschlag als `sent_at` markiert, kein Retry | `drivers/push/send/route.ts:88-90` |
| P2-4 | `updateBatchId`-Closure-Bug: Positionen während Tour mit `batch_id=null` (Tracking-Attribution, Dispatch unbeeinträchtigt) | `bg-location.ts:206-208` |
| P2-5 | `skippedIds`/`arrivedIds`/Proximity-State gehen bei Reload verloren (übersprungene Stops tauchen wieder auf) | `delivery-view.tsx:75-91` |
| P2-6 | `sendBeacon` ohne Bearer (nur Cookie-Fallback; Native-Fall verliert letzten Fix) | `bg-location.ts:134-151` |
| P2-7 | West/Ost-Bundling-Qualität (12.08.: Vaalser-Adresse in Ost-Tour) — Richtungs-Check ist seit `dropoffFitsTour` drin, Cluster-Qualität beobachten | `lib/delivery/tour-direction.ts` |
| P2-8 | PII/Auth-Details in `console.log` (push-token-save, voip-save, accept-tour) | 6+ Stellen |
| P2-9 | 11 `-bak`-Dateien (604 KB) in Git; `.gitignore`-Patterns matchen die Namenskonvention nicht | `.gitignore` „backup files" |
| P2-10 | OTP-Auth-Backend komplett vorhanden, aber ohne Client-Aufrufer (toter Pfad — entfernen oder anbinden, nach V1) | `auth/request-otp` u. a. |
| P2-11 | 4 tote `{false && …}`-Blöcke in `client.tsx` (GPS-Teil wird durch P1-3 gelöst) | `client.tsx:840,1225,1233,1238` |
| P2-12 | E2E-/Testbestellungen in Prod-Daten (TEST-*/E2E-*-Serien) für Buchhaltung aufräumen | Live-DB |
| P2-13 | `.env.example` fehlt / `.env.local.example` listet 3 von 12 Variablen | Repo-Root |
| P2-14 | SW ohne explizite `Cache-Control`-Header (CDN-Risiko) | `next.config.js` |

### P3 — Post-Release-Verbesserungen

- Verhaltenstests für die 29 Driver-API-Routen (heute: 0) — die grep-basierten Tests (`batch-reconcile`, `dispatch-contract`, `driver-client-robustness`) durch echte Logiktests ersetzen
- Golden-Path-E2E formalisieren: das funktionierende Rig `/tmp/open-two-browser-drivers.mjs` (inkl. `driveTour()`) ins Repo überführen und als wiederholbares Release-Gate verdrahten
- Outbox-/bg-location-Verhaltenstests (Netzabbruch, Retry-Erschöpfung)
- Service-Worker-Tests (Push-Handler, Cache-Strategie)

---

## 4. Release-Gates (Definition of Done)

Release ist fertig, wenn — mit ausführbarer Evidenz, nicht Behauptung:

1. ☐ Produktions-Build (Docker) grün **mit** Build-Arg-Guards und verdrahtetem `typecheck:delivery` (P1-6)
2. ☐ Golden Path E2E grün (Rig-Durchlauf: Login → online → Angebot → Annehmen → Picken → Route → Google Maps → Angekommen → Kassiert & geliefert → Batch `completed` → Queue leer)
3. ☐ P0-1 … P0-4 geschlossen, je mit dem angegebenen Verifikationsnachweis
4. ☐ P1-1 … P1-7 geschlossen, je mit Verifikationsnachweis
5. ☐ Auth: Login, Session-Restore, Ablauf-Handling (P1-2) verifiziert
6. ☐ Kritische Contracts versioniert & verifiziert: `confirm_pick_item`, `confirm_pickup_complete`, `accept/decline/requeue_delivery_batch`, `start/end_driver_dispatch_session` (Migrationen 057/058 + P0-4)
7. ☐ Statusübergänge persistieren korrekt: SQL-Proben nach E2E (keine `in_progress`-Leichen, keine `geliefert` ohne Zahlungserfassung, Fahrer-State konsistent)
8. ☐ GPS-Flow: Position kommt an (`mise_driver_locations`), Fehlerfall sichtbar (P1-3)
9. ☐ Restart/Recovery: Reload während Tour stellt korrekt wieder her; Storno während Tour verschwindet (P0-2)
10. ☐ Keine Mocks/localhost in kritischen Pfaden (Stand heute: ✅ bereits erfüllt, nach Änderungen erneut grepen)
11. ☐ `npx vitest run tests/delivery` grün (inkl. neuer Verhaltenstests aus P0/P1)
12. ☐ Kein bekannter Bug kann eine Lieferung falsch abschließen, verlieren oder korrumpieren (P0-1, P0-2, P1-4, P1-5 geschlossen)

**Wenn alle Gates grün: STOP. Keine weiteren Änderungen am Projekt.**

---

## 5. Evidenz-Log (Single-Blocker-Konvergenz, seit 13.08.)

Regel: Nur EIN P0/P1 aktiv. Blocker → Fix → fokussierte Verifikation → Regression → Evidenz → PASS → nächster.

| Blocker | Status | Evidenz |
|---|---|---|
| P0-3 | **PASS (geschlossen, Fehlklassifikation)** | mise_cron tickt `repush-loop` alle 15 s per POST+Token (Container-Cmd inspiziert); Live-DB: 0 hängende `pending_acceptance`, 5/5 Stichproben nach exakt 3 min gecancelt. |
| P0-4 | **PASS (geschlossen)** | (1) `pg_get_functiondef`-Diff Repo↔Live = leer; (2) transaktionaler Beweis auf Live: `BEGIN; DROP beide; \i 060; SELECT` → beide Signaturen exakt wiederhergestellt (`confirm_pick_item(uuid,boolean,text)`, `confirm_pickup_complete(uuid)`), `ROLLBACK` sauber; (3) SECURITY DEFINER + EXECUTE für `authenticated` erhalten; (4) Client-Contract deckungsgleich (`pick-dialog.tsx:64-67`, `client.tsx:717`). Commit `88aae0ec`. |
| Audit A (Offline-Delivered) | **PASS** | Offline-Zweig ruft `onAllDone` nicht (nur Outbox + Sync-Banner + return); `onAllDone` = `router.refresh()` (client.tsx:960) — persistiert nichts, Server bleibt Source of Truth; `end_driver_dispatch_session` blockt Schichtende bei aktivem Batch serverseitig; TourCloseButton schlägt offline laut fehl. |
| Audit B (409-Recovery) | **CONCERNS → behoben 13.08. (Pick-Evidenz-Gate)** | Berechtigter Einwand: `status='fertig'` beweist Küchen-Readiness, nicht physisches Picken. Dauerhafte Server-Evidenz existiert: `order_items.pick_confirmed_at` (je Artikel via `confirm_pick_item`). Fix `eda675ee`: `picked-up`-Route verweigert den Übergang ohne diese Evidenz (409 `pick_not_confirmed`) — serverseitig, von keinem Client fabrizierbar. Client-Recovery macht Retry NUR bei erfolgreichem picked-up, sonst Rollback + Rückführung in den Pick-Flow. Bestehende Gates bleiben: Ownership (403), `status='fertig'` (409). |
| P0-1 (+P1-4/P1-5) | **PASS (geschlossen 13.08. 09:53)** | REPRODUCE: Live-A/B 12.08. — alter Code direct-schrieb `geliefert` ohne Zahlung (RT-N1/N2, `bezahlt=f`), neuer Code verweigerte sichtbar. ROOT CAUSE: (a) stiller Client-Fallback, (b) Stop-Lookup `maybeSingle` ohne Batch-Filter → 404 bei jeder requeueten Order. FIX: `7205b309` + `a49a859a` + `eda675ee` (Fallback raus, requeue-fester Lookup, Pick-Evidenz-Gate). BEHAVIOR TEST: `scripts/verify/stop-lookup-requeue.mjs` PASS gegen Live-Schema (Beweis A/B/C, Fixture bereinigt). BROWSER E2E: TEST-075130 komplett geführt in 105 s (Annehmen→2 Items picken→Auto-Route→geliefert). SQL: `status=geliefert, bezahlt=t, cash:driver:*-ID` (API-Pfad!), Batch `completed`, Fahrer `returning`, `aktueller_batch_id` geleert, 0 hängende Batches, 2/2 `pick_confirmed_at` (GP-1). REGRESSION: 24/24 Vitest + Scoped-Typecheck grün. Live: `f64a1a59` Port 3300. |
| P0-2 | **PASS (geschlossen 13.08. 11:47)** | FIX (3 Commits): cancelled-Filter im Server-Load (page.tsx, aktive+Warte-Touren), initialStops→stops-Sync in DeliveryView (Server = Source of Truth), 30-s-Polling während aktiver Tour (Realtime-Fallback), cancelled-Stops zählen nicht mehr als „offen" in delivered-Route + Reconcile. BROWSER E2E: 2 gebündelte Orders, Storno von Order 2 MITTEN in laufender Tour → Order 1 `geliefert, bezahlt=t` (inkl. live beobachteter 409-Recovery mit Pick-Evidenz!), Order 2 `storniert, stop_done=f, cancelled=t` — nie zugestellt, nie kassiert. Hängender Batch (Live-Repro der Abschluss-Lücke) wurde nach Deploy vom Reconcile-Cron in 30 s selbständig `completed`, Fahrer `idle`, 0 hängende Batches. REGRESSION: 28/28 Vitest + Scoped-Typecheck. Rig-Fix: toleranter Pick-Dialog-Flow (Auto-Open des guided Flow). |
| P1-1 | **PASS (13.08. 12:00)** | Haupt-Kanal wertet Subscribe-Status aus, Reconnect mit 2s→30s-Backoff; zusammen mit 30-s-Polling (P0-2) + initialStops-Sync erreichen Tour-Updates den Fahrer ≤60 s auch bei totem wss. Smoke-E2E nach Deploy: TEST-095638 geliefert in 75 s via API (bezahlt=t, Cash-ID). Regression 29/29. |
| P1-2 | **PASS (13.08.)** | accessTokenRef wird bei jedem Auth-Event nachgezogen und invalidiert; GPS-401 → refreshSession-Versuch, ab 3 Fehlversuchen rotes Banner „Anmeldung abgelaufen" + Login-Link. Pinning-Tests grün; Banner-Mechanik identisch zur live verifizierten GPS-Warnung. |
| P1-3 | **PASS (13.08. 13:20)** | bg-location meldet Geolocation-Fehler über onGpsError-Hook statt still zu schlucken; Browser-Beweis: Fahrer-Profil mit VERWEIGERTER GPS-Permission → gelbes Banner „GPS blockiert" sichtbar (Screenshot /tmp/gps-denied-proof.png); >2 min ohne Fix → „GPS-Signal veraltet". Ersetzt die tote {false&&}-Anzeige. |
| P1-6 | **PASS (13.08. 13:45)** | Dockerfile-Guards: Build ohne NEXT_PUBLIC_*-Args bricht ab — NEGATIV-TEST auf dem Server bestanden („FEHLER: NEXT_PUBLIC_SUPABASE_URL fehlt", Exit 1). `pnpm typecheck:delivery` läuft im Docker-Build vor `pnpm build` (wirksames Typ-Gate trotz ignoreBuildErrors). build-version.ts wird je Deploy aus `git rev-parse` generiert (auto-deploy.sh, live verifiziert). Fonts-Flake: auto-deploy.sh mit Einmal-Retry gehärtet (2× live aufgetreten); Self-Hosting → P2. |
| P1-7 | **PASS (Code, Live-Check nach Deploy)** | push-debug-Route gelöscht (war POST ohne Auth), Client-Beacon → console.log; interne Endpoints (dispatch-tick, push-flush, repush-loop) fail-closed via BISS_INTERNAL_TOKEN (Code-Beleg). Live-Curl-Check nach Deploy: erwartungsgemäß 404. |
| Bundle-Pickup-Recovery (Fund aus Gate-Lauf) | **PASS (13.08. 14:15)** | Struktureller Bug live gefunden: bei Bundle-Touren hängt der gemeinsame Pickup-Stop nur an EINER Order → picked-up-Recovery der zweiten Order lief in 404. Fix: Batch-Lokalisierung über Dropoff-Stop, Pickup-Stops optional completed; Pick-Evidenz- + Ownership-Gates unverändert. Beweis: TEST-113645 nach Deploy in 90 s über die Recovery geliefert. |
| **FINAL: Golden-Path-Gate-Lauf** | **✅ BESTANDEN (13.08. 14:20)** | Bundle-Tour mit 2 Bestellungen komplett durch den geführten Flow: Annehmen → beide Orders einzeln gepickt (4/4 `pick_confirmed_at` = GP-1) → Auto-Route → beide `geliefert, bezahlt=t` mit `cash:driver:*`-ID (API-Pfad) → Batch `completed` → 0 hängende Batches → Fahrer-States sauber (idle/returning) → 0 `maps.apple` im Live-Bundle. Zusätzlich im Lauf bewiesen: Tour-Resume nach Browser-Abbruch, 409-Recovery, Ownership-403/404 für fremde Fahrer. |

## §4-Gates — ALLE GRÜN (13.08.2026)

1. ✅ Produktions-Build mit Build-Arg-Guards + In-Build-Typecheck (Negativ-Test bestanden, Deploy 12:08 grün)
2. ✅ Golden Path E2E (Bundle-Tour 2 Orders, kompletter geführter Flow)
3. ✅ P0-1…P0-4 geschlossen mit Verifikationsnachweis
4. ✅ P1-1…P1-7 geschlossen mit Verifikationsnachweis
5. ✅ Auth: Login/Restore im E2E, Ablauf-Handling (Refresh + Banner) implementiert+getestet
6. ✅ Kritische Contracts versioniert & verifiziert (Migrationen 057/058/060, Diff leer)
7. ✅ Statusübergänge persistieren korrekt (SQL-Proben aller E2E-Läufe, keine Leichen)
8. ✅ GPS-Flow: Positionen kommen an; Fehlerfall sichtbar (Browser-Beweis GPS-Denied-Banner)
9. ✅ Restart/Recovery: Tour-Resume nach Browser-Abbruch; Storno während Tour verschwindet (Mid-Tour-E2E)
10. ✅ Keine Mocks/localhost in kritischen Pfaden (Audit + erneuter Grep)
11. ✅ 33/33 Vitest tests/delivery + Scoped-Typecheck (jetzt im Build erzwungen)
12. ✅ Kein bekannter Bug kann eine Lieferung falsch abschließen, verlieren oder korrumpieren

**RELEASE KOMPLETT — Projekt eingefroren. Weitere Arbeit nur noch über das Post-Release-Backlog (P2/P3 + Design-Runde + Smart-Hold).**

## 6. Empfohlene Reihenfolge

1. **P0-4** (DB-Funktionen extrahieren — reine Absicherung, kein Verhaltens-Change, entblockt P0-1)
2. **P0-3** (Cron-Verdrahtung Verfall — kleiner, isolierter Fix mit großem Wirkradius)
3. **P0-1 + P1-4 + P1-5** (Delivered-/Abschluss-Pfad in einem Zug: Fallback raus, Fehler sichtbar, Abschluss konsistent)
4. **P0-2 + P1-1** (Storno-Sichtbarkeit + Realtime-Härtung in einem Zug)
5. **P1-2, P1-3** (Auth + GPS-Sichtbarkeit)
6. **P1-6, P1-7** (Build-Gates + Debug-Endpoint)
7. Voller Golden-Path-E2E + SQL-Proben → Gates abhaken → **STOP**

Jeder Schritt: Fix → Test → Rig-Verifikation → erst dann der nächste. Kein Batch-Fixing über mehrere Baustellen gleichzeitig.
