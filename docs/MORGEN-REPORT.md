# Mise Fahrer-App — Morgen-Report (Stand 10.06.2026, nach Runde 2)

**CEO-Verdikt Runde 2: GO.** Der Kern-Fahrer-Flow und alle vier Risiko-Punkte wurden gegen PROD (mise-gastro.de, Container `mise_backoffice_3310`) mit echtem Browser + Backend-Inspektion verifiziert. Site liefert 200. Disk wieder bei 64% (vorher 100% → der Crash-Blocker ist vorerst entschärft).

---

## 1. FERTIG + CEO-GO (verifiziert)

### Auth-Fix — „Ablehnen/Melden warf 401" → behoben
- Zentrale Lösung in `getDriverFromBearer()` (`app/api/driver/v1/_lib/driver-auth.ts`): neuer Fallback `driverFromCookieSession()`. Wenn kein gültiger Bearer da ist (genau der /fahrer-Browser-Fall), wird die Supabase-Session aus dem httpOnly-Cookie gelesen, `auth.getUser()` geholt und über `mise_drivers.auth_user_id` gemappt. Service-Role-Lookup (RLS umgangen), `select('*')` statt `DRIVER_SELECT` (letzteres referenziert die nicht existierende Spalte `employee_id`).
- Deckt automatisch BEIDE Endpoints ab (Issue + Decline), da beide `getDriverFromBearer` nutzen. Endpoints selbst unverändert.
- VERIFIZIERT echt eingeloggt (tahar.galai@gmail.com → Adib Galai):
  - ABLEHNEN: `POST /api/driver/v1/orders/decline` = 200 `{ok:true,redispatched:true}` (vorher 401).
  - MELDEN: `POST /api/driver/v1/orders/[id]/issue` (cant_find_customer) = 200 `{ok:true}`.
- Deployt im laufenden Container, Cookie-Fallback im Compiled-Build bestätigt.

### Delivery-View — an Drive-Route-Optik angeglichen + Anzeigebug behoben
- `app/fahrer/app/delivery-view.tsx`: Karte ist jetzt Hero (300px), saubere Drive-Stopp-Karte (Avatar-Initialen, Kunde, Adresse, `#code` mono, BAR-Badge). Aktionslayout neu: Anrufen/Navigieren-Reihe + Full-Width-Primary „Bestellung geliefert" („Kassiert & geliefert" bei BAR) + gedämpfte Utility-Chips. Alle Fremdfarben (Waze, WhatsApp) getoken-t.
- BUG behoben: „ONLINE BEZAHLT" erschien fälschlich bei BAR-Orders nach Zustellung (Bedingung war `isBar && !done` → Else-Zweig). Jetzt: BAR vor Zustellung „BAR kassieren", danach „BAR kassiert ✓". Zahllogik unangetastet, nur Darstellung.
- Kompletter Flow Incoming → Annehmen → Packen → Losfahren → Liefern per Screenshot durchgeklickt.

### F4 — Einzelannahme (Uber-Style), Backend fertig
- `lib/frank.ts`: `pending_acceptance` aus dem Bundling-Filter entfernt → neue Orders mergen nur noch in BEREITS angenommene Batches. Jede neue Order klingelt einzeln.
- Neue RPC `merge_mise_order_into_active_batch` (SECURITY DEFINER, service_role-only): hängt Stops eines Ein-Order-Batches in den aktiven Batch, Pickup-Dedup via Haversine <0,1 km, Quell-Batch wird soft-cancelled (KEIN Hard-Delete), idempotent.
- Dispatch-Kernpfad nachweislich intakt: Direkt-Zuweisung 1+1-Stop ok, 2. Order in akzeptierte Tour korrekt gebündelt (3 Stops), Merge-RPC getestet (stops_moved, Pickup dedupliziert, Re-Call=noop).
- Migration + DB-Backup unter `/opt/mise/backoffice/docs/db-backups/`.

**Multi-Tenant/Fiskal-Check:** Alle Tests tenant-scoped (Frankys Pasta). Testdaten durchgehend SOFT aufgeräumt (storniert/cancelled/Training-Flag, kein Hard-Delete) — DB-Integritäts-Guard greift korrekt (blockiert geliefert→storniert).

---

## 2. OFFEN / TEILWEISE

- **F4 Punkt 3 — UI-Karte „+ dazunehmen"** (ruft Merge-RPC bei aktiver Tour): bewusst weggelassen, weil `/fahrer`-Files mit fremden uncommitteten Änderungen belegt sind. Backend ist fertig + getestet, Frontend-Hook-up nachziehbar.
- **D4 Incoming als echtes Bottom-Sheet** (rounded-t, Grabber, dim Backdrop): Incoming liegt noch als Inline-Karte in `client.tsx`.
- **D3 Countdown-Ring** (52px SVG, ~60s, rein visuell) im Incoming-Popup: fehlt. Beide betreffen `client.tsx`, klar abgrenzbarer nächster Schritt.
- **VoIP/CallKit Hintergrund-Anruf** (Uber-Style „klingelt wenn nicht in App"): Server-Basis + nativer AppDelegate da, ABER VoIP-Token kam zuletzt nicht an (`voip-no-token`). Diagnose-Beacons im letzten Build. Noch nicht gelöst.
- **Uncommitted Working-Tree:** driver-auth, client.tsx, delivery-view, pick-dialog, login, frank.ts sind alle `M` aber NICHT committed. Deployt via auto-deploy ist der Stand zwar — aber NICHT in git gesichert. Risiko bei nächstem Deploy/Rollback.

---

## 3. WAS TAHAR ENTSCHEIDEN / MACHEN MUSS

1. **Working-Tree committen** (PRIO 1). Der gesamte Runde-2-Fix lebt aktuell nur als uncommittete Änderung. Erst committen, dann können die Spezialisten die offenen `/fahrer`-UI-Punkte (F4-Punkt-3, D3, D4) ohne Kollisionsangst angehen. Auch die `.darkbak`-Dateien aufräumen.
2. **Nativen App-Build + acceptTour-Pfad** finalisieren: accept-tour (669b0dd) + Resume-Reload (cee030d) sind committed; neuer TestFlight-Build nötig damit CallKit-Anruf = Tour-Annehmen sauber durchläuft. VoIP-Token-Problem dabei klären.
3. **Disk dauerhaft lösen:** aktuell 64%, aber jeder Full-Rebuild füllt /dev/sda1. Hetzner-Disk vergrößern (Rescale oder +Volume), sonst droht der DB-Crash beim nächsten Deploy-Marathon wieder. Bis dahin: gesammelt EIN Deploy, nicht viele hintereinander.
4. **Design-Feinheiten** (D3/D4) freigeben/priorisieren — sind UX-Polish, kein Funktions-Blocker.
5. **admin@frankys-pasta.de Passwort resetten** (versehentlich auf MiseFahrer2026! gesetzt, Altlast aus 08.06.).

---

## Integration-Status
- Auth-Fix (zentral in getDriverFromBearer) + F4-Backend (frank.ts/RPC) + Delivery-View greifen sauber ineinander, weil isoliert. Decline triggert serverseitig den dokumentierten `dispatchTick()` → freigegebene Order wird sofort neu gebündelt (erwartetes Verhalten bei nur einem Fahrer).
- Open Loop: F4-Backend ↔ fehlende „+ dazunehmen"-UI. Der Merge-Pfad ist da, aber für den Fahrer noch nicht klickbar.
- Open Loop: VoIP-Token ↔ CallKit-Vollbild-Anruf — die letzte Meile des Uber-Erlebnisses hängt noch.
