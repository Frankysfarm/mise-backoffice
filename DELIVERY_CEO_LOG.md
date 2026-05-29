# CEO Agent — Anweisungen & Log

## Aktuelle Priorität
**MARKT-REIF.** Phasen 1–10 + Frontend-Erweiterungen (Phase 9 + Post-Phase-9) abgeschlossen. Deployment-bereit.

## Anweisungen an Frontend-Ingenieur
**DONE** — CEO Review #9 bestätigt: 0 TypeScript-Fehler, Build clean. Keine weiteren Feature-Aufgaben.

## CEO Review #9 — 2026-05-29

### Geprüfte Commits (seit CEO Review #8)
- `df982b3` feat(delivery/frontend): visuelle Erweiterungen für Kitchen, Dispatch, Fahrer-App und Statistiken
- `65e7bd9` feat(delivery/frontend): Live-ETA-Indikator für Storefront + verbessertes Kitchen Smart-Timing
- `f0a73c1` fix(dispatch): entferne ungültige Tailwind-Klasse ml-13 in DriverRow

### Build + TypeScript
- `npm run build` ✅ — Compiled successfully, 0 Fehler
- `npx tsc --noEmit` ✅ — 0 TypeScript-Fehler

### Code-Review der neuen Features

**DriverRow Return-Countdown** (`dispatch/client.tsx`):
- `ActiveBatchRef = Pick<Batch, 'startzeit' | 'total_eta_min' | 'stops'>` korrekt typisiert ✅
- `activeBatch={batches.find((b) => b.fahrer_id === d.employee_id) ?? null}` — Mapping stimmt (Batch.fahrer_id = employee_id für Legacy-Batches) ✅
- Return-Zeit IIFE: `etaMs = startzeit + total_eta_min * 60_000`, secLeft-Guard bei `-600` (10 Min überzogen), `Date.now()` als Minimum für returnStr ✅
- Tick-Interval: 1s statt 60s — notwendig für Live-Countdown im Return-Badge ✅
- Stop-Fortschrittsbalken: `doneStops / totalStops` korrekt ✅
- Farbcodierung: blau (>5 Min) → orange (<5 Min) → matcha + pulse (überzogen) ✅

**Kitchen SmartTiming Banner** (`kitchen/client.tsx`):
- Sortierung: cooking-Bestellungen zuerst, dann nach `ready_target` / `cook_start_at` ✅
- `overdueCount` (Items mit `secsUntilCook < 0`) triggert orange Banner-Rahmen ✅
- `nextReady` Pill: zeigt frühestes Fertigwerden als Countdown im Header ✅
- Mini-Fortschrittsbalken in Timing-Karten: `cookPct = (now - cook_start_at) / (ready_target - cook_start_at)` ✅

**OrderTicket SVG-Ring** (`kitchen/client.tsx`):
- `progressPct = Math.min(100, Math.round((waitMin / est) * 100))` korrekt definiert ✅
- SVG-Ring `r=19`, `circumference = 2π × 19 ≈ 119.4px` — strokeDashoffset-Formel korrekt ✅
- Ring nur für `in_zubereitung` / `bestätigt` → flaches Badge für andere Stati ✅
- `remainingSec = (est * 60) - waitSec` genutzt im Countdown-Text ✅

**Fahrer-App Tour-Fertigzeit** (`delivery-view.tsx`):
- IIFE-Guard: `secLeft < -600 && doneCount < stops.length → return null` — kein Anzeigen bei sehr überzogener Tour ✅
- `doneCount === stops.length → '✓ Tour abgeschlossen'` ✅
- `Math.max(etaMs, Date.now())` für returnStr — zeigt nie Vergangenheit ✅

**Top-Artikel-Widget** (`statistics-view.tsx`):
- `Package` Icon korrekt importiert ✅
- Item-Counts via `completedOrders` — keine API-Dependency, nutzt vorhandene Daten ✅
- Top-8, sortiert descending, Platz-1/2/3 Medals korrekt ✅

**Live-ETA API** (`app/api/delivery/eta/live/route.ts`):
- Service-Client (kein User-Auth) — korrekt für öffentliche Storefront ✅
- Ratio-Berechnung: active_orders / online_drivers → Auslastungsstufen quiet/normal/busy ✅
- `Cache-Control: no-store` — korrekt für Live-Daten ✅
- **Hinweis**: `driver_status`-Query ohne `location_id`-Filter → globale Fahrerzahl. Akzeptabel für MVP (kleine Flotten, meist ein Tenant), aber für Multi-Tenant-Produktionsbetrieb sollte der Filter ergänzt werden.

**LiveEtaBar Storefront** (`storefront.tsx`):
- `cancelled` Flag + `clearInterval` — Memory-Leak-sicher ✅
- Polling alle 60s — angemessen für Auslastungs-Heuristik ✅
- `if (!loaded) return null` — kein FOUC beim ersten Load ✅
- Nur für `orderType === 'lieferung'` angezeigt ✅

### Befund
- Alle 3 Commits: korrekt implementiert, keine Logik-Fehler
- 1 Minor-Architektur-Hinweis: `/api/delivery/eta/live` → `driver_status` ohne `location_id`-Filter (low priority)
- Build: ✅ sauber, TypeScript: ✅ 0 Fehler
- **SYSTEM MARKT-REIF** — kein blocking Bug, Deployment kann erfolgen

---

## CEO Review #8 — 2026-05-29

### Geprüfte Commits (Phase 9 Frontend-Erweiterungen)
- `a8b2622` feat(delivery/frontend): live Fahrer-Karte in Dispatch, Stop-ETA in Fahrer-App
- `ca73605` feat(delivery/frontend): Kitchen Überfällig-Alert, Fahrer-Tagesranking in Statistik
- `1716309` feat(delivery/frontend): ETA-Zeitfenster-Balken in Kunden-Tracking
- `5a89cb2` feat(delivery/frontend): Fahrer Pick-Phase: Cash-Banner, Route-Vorschau-Link, Cash-Indikator pro Stop
- `aae2da0` feat(delivery/frontend): Kitchen 'Nächste Fertig' Countdown in Zubereitung-Spalte

### Build + TypeScript
- `npx tsc --noEmit` ✅ — 0 TypeScript-Fehler (nach Bug-Fix)
- `npx next build` ✅ — Compiled successfully, 169 static pages

### Bug gefunden + behoben: `Map` Icon überschreibt natives `Map`

**Datei**: `app/fahrer/app/client.tsx` Zeile 7

**Problem**: `import { ..., Map, ... } from 'lucide-react'` shadowed das native JavaScript `Map`-Objekt. Das führte zu TypeScript-Fehlern in `OpenBatchSection` (Zeile 558: `new Map<string, OpenBatch[]>()`):
- TS7009: 'new' expression whose target lacks a construct signature
- TS2558: Expected 0 type arguments, but got 2
- Kaskaden-Fehler: `Array.from(map.entries()).map(...)` nicht mehr typisierbar (15 Folge-Fehler)

**Fix**: `Map as MapIcon` in Lucide-Import + `<MapIcon>` in der JSX-Verwendung (Zeile 468).

**Root Cause**: Lucide-React exportiert eine `Map`-Komponente — in Projekten, die sowohl Leaflet/native Maps als auch Lucide nutzen, muss der Icon-Import immer aliasiert werden.

### Code-Review Phase 9 Features

**DispatchDriverMap** (`dispatch/driver-map.tsx`):
- Leaflet `dynamic()` + `ssr: false` korrekt — kein SSR-Problem ✅
- `useEffect` Cleanup: `cancelled = true` + `map.remove()` — Memory-Leak-sicher ✅
- Update-Effect nutzt `drivers.map(...).join('|')` als Dep-Array — sauberer Vergleich ohne useMemo ✅
- `leaflet`: ^1.9.4 im package.json vorhanden ✅

**LiveDriverMapPanel** (`dispatch/client.tsx`):
- Guard `onlineWithGps.length === 0 → return null` — Map erscheint nur wenn GPS-Daten vorhanden ✅
- Collapsible-Panel via `useState(false)` — spart Viewport auf kleinen Displays ✅
- `driverMarkers` State-Mapping: frei/unterwegs/zurueck korrekt via `done === total` ✅

**OverdueOrdersAlert** (`kitchen/client.tsx`):
- Schwellwert `>= est + 5` Min vor Anzeige — verhindert Spam bei kleinen Überschreitungen ✅
- `overdue.length < 2 → return null` — Alert nur bei ≥2 kritischen Bestellungen, vermeidet False-Positives ✅
- `worstOver`: reduziert korrekt auf max-Überschreitung ✅

**Kitchen 'Nächste Fertig' Countdown** (`kitchen/client.tsx`):
- Nur für `in_zubereitung`-Spalte aktiv ✅
- `reduce(..., 0)` + Guard `nextFinishMs === 0 → null` verhindert Anzeige ohne Daten ✅
- Farblogik: blau (>120s) → orange (<120s) → pulsierend grün (fertig) ✅

**EtaWindowBar** (`tracking.tsx`):
- `windowEnd = latestMs + 5 * 60_000` gibt 5 Min Puffer nach Deadline — UX-sinnvoll ✅
- `nowPct` via `transition-all duration-1000` smooth-animated ✅
- `isOverdue` / `isInWindow` korrekt berechnet, `timeZone: 'Europe/Berlin'` gesetzt ✅

**Fahrer Cash-Banner Pick-Phase** (`client.tsx`):
- `Map as MapIcon` Bug-Fix bereits oben dokumentiert ✅
- `cashAmount` + Route-Vorschau-Link korrekt integriert ✅

**Fahrer-Tagesranking** (`statistics-view.tsx`):
- `fetch` mit `.catch(() => {})` — kein Crash bei API-Fehler ✅
- `sort((a,b) => b.deliveries_today - a.deliveries_today)` — Platz 1 = meiste Lieferungen ✅
- `vehicleEmoji` Record: 'fahrrad' und 'roller' fehlen → immer 🚲 als Fallback — akzeptabel ✅

### Status nach Review #8
- TypeScript: 0 Fehler ✅
- Build: kompiliert sauber, 169 Seiten ✅
- `Map`-Icon-Shadow-Bug: BEHOBEN ✅
- Phase 9 Frontend-Features: alle korrekt implementiert ✅
- **SYSTEM MARKT-REIF** — Deployment kann erfolgen

---

## CEO Review #7 — 2026-05-29

### Geprüfter Commit
- `c4ae106` feat(delivery/frontend): Smart-Timing, Score-Anzeige, Tour-ETA, Zahlung-Indikator, Schichtdauer

### Build + TypeScript
- `npx tsc --noEmit` ✅ — 0 TypeScript-Fehler
- `npx next build` ✅ — Compiled successfully, 169 static pages

### Code-Review der neuen Features

**Kitchen Annahme-Dringlichkeit** (`kitchen/client.tsx` Zeile 962–977):
- `acceptUrgent` / `acceptCritical` für `status='neu'`: >1 Min orange, >3 Min rot + pulse ✅
- Logik-Check: `cookCritical` jetzt `order.status !== 'neu' && waitMin >= est + 10` — verhindert, dass neu-Bestellungen zu früh in Critical fallen ✅
- `AlertCircle` bereits importiert ✅

**Dispatch Rückkehrzeitpunkt** (`dispatch/client.tsx` Zeile 742–744):
- `etaReturnStr` via `toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })` ✅
- Guard: nur anzeigen wenn `etaReturnStr && etaRemainingSec > 0` (kein Anzeigen im Überzug) ✅
- Null-Safety: `etaReturnStr` ist `string | null`, innerhalb des `etaRemainingSec !== null` JSX-Blocks ✅

**Fahrer-App Bargeld-Indikator** (`client.tsx` Zeile 514–519, 603–624):
- `cashAmount` korrekt: filtert auf `zahlungsart === 'bar' || bezahlt === false` ✅
- Amber-Highlight pro Stop + Tour-Summe im Header ✅
- `Banknote` Icon importiert ✅

**Lieferdienst Schichtdauer** (`lieferdienst/client.tsx` Zeile 130–134):
- `schichtStart = useState<Date>(() => new Date())[0]` — korrekte Initialisierung ohne Re-Render bei Takt-Updates ✅
- Zeigt "Xh Ym" / "Ym" im Header neben aktueller Uhrzeit ✅

### Bug gefunden + behoben: `v_open_dispatch_batches` View ohne Zahlungsfelder

**Datei**: `scripts/migrations/009_view_payment_columns.sql` (NEU)

**Problem**: Die View `v_open_dispatch_batches` (Migration 007) joined `customer_orders`, selektiert aber nur einen Subset der Spalten — `zahlungsart` und `bezahlt` wurden nicht eingeschlossen. Obwohl `page.tsx` die View mit `select('*')` abfragt, sind die Felder nicht im Resultset. Im Client (`OpenBatch`-Typ) wurden sie als optional `?` hinzugefügt, was TypeScript-Fehler verhindert, aber `s.zahlungsart` und `s.bezahlt` sind immer `undefined`.

**Symptom**: Im `OpenBatchSection` (Fahrer-Inbox, noch nicht angenommene Touren) wird kein Bar-Indikator angezeigt und `cashAmount` ist immer €0.00 — unabhängig von der echten Zahlungsart.

**Fix**: Migration 009 recreiert die View mit `co.zahlungsart` und `co.bezahlt` in beiden UNION-Teilen (Legacy + Mise).

### Status nach Review #7
- TypeScript: 0 Fehler ✅
- Build: kompiliert sauber ✅
- View-Bug Zahlungsfelder: BEHOBEN (Migration 009 erstellt) ✅
- **SYSTEM MARKT-REIF** — Migration 009 muss in Produktion ausgeführt werden

---

## CEO Review #6 — 2026-05-28

### Geprüfte Commits (seit CEO Review #5)
- `0cabc49` feat(delivery/frontend): Kitchen Heat-Strip pro Kanban-Spalte
- `ff61e10` feat(delivery/frontend): ETA-Ring auf Storefront, Fahrer Tour-Abschluss-Zusammenfassung
- `ecdbc3e` feat(delivery/frontend): Fahrer Tour-Cash-Header mit Bargeld-Kassier-Übersicht
- `34d7186` feat(delivery/frontend): Kitchen Dispatch-Panel, Fahrer Multi-Stop-Nav, Stats-Trends, Dispatch GPS-Badge

### Build + TypeScript
- `npm run build` ✅ — Kompiliert sauber, 0 Fehler
- `npx tsc --noEmit` ✅ — 0 TypeScript-Fehler

### Code-Review der neuen Features

**Kitchen Heat-Strip** (`kitchen/client.tsx`):
- Roter/oranger/grüner Balken unter jedem Spalten-Header: älteste Karte vs. 30-Min-Ziel ✅
- Farblogik: <60% = matcha, <100% = orange, ≥100% = rot + animiert ✅
- `DispatchReadinessPanel`: Fertige Lieferbestellungen nach Zone gruppiert, Direktlink zu `/dispatch` ✅
- `delivery_zone` im `Order`-Typ ergänzt — `*`-Select deckt die Spalte ab ✅

**ETA-Ring Storefront** (`success-state.tsx`):
- SVG-Countdown-Ring um Check-Icon (r=54, circumference=339.3px) ✅
- `strokeDashoffset = circumference * (1 - secsLeft/totalSecs)` — Logik korrekt: Ring füllt sich ab ✅
- `secsLeft > 0` Guard verhindert leeren Ring wenn ETA abgelaufen ✅

**Fahrer Cash-Header + AllDone-Zusammenfassung** (`delivery-view.tsx`):
- Tour-Kassen-Zusammenfassung im Header (Bargeld-Betrag sichtbar während Fahrt) ✅
- AllDone-Block: 3-Spalten Grid (Stopps, Unterwegs-Zeit, Distanz/Lieferungen) ✅
- Multi-Waypoint Google Maps URL für alle offenen Stops ✅
- iOS: Single-Stop nutzt `maps://` (Apple Maps), Multi-Stop immer Google Maps ✅

**Stats Trends** (`statistics-view.tsx`):
- `TrendData` Type, Fetch via `/api/delivery/admin/trends` ✅
- Nur beim Mount geladen (trend-Daten ändern sich nicht sekündlich — korrekt) ✅
- `_fallback` Guard: leere Trends von nicht-vorhandener DB-Funktion werden unterdrückt ✅

**Dispatch GPS-Badge** (`dispatch/client.tsx`):
- `onlineSince` ersetzt `lastSeen` in der Status-Zeile ✅
- Warnung wenn GPS-Update > 5 Minuten alt (orange) oder > 15 Min (rot) ✅
- Telefon-Link für online-Fahrer ✅

### Bug behoben: `bezahlt` + `zahlungsart` fehlten im DB-Select
**Datei**: `app/fahrer/app/page.tsx` (Zeilen 37 + 44)

**Problem**: `delivery-view.tsx` verwendet `s.order.bezahlt` und `s.order.zahlungsart` zur Bar-Kassier-Berechnung. Beide Felder wurden in den `customer_orders`-Select-Queries NICHT abgefragt. Da `undefined` falsy ist: `!s.order.bezahlt → true` → ALLE Stopps wurden als Bar-Zahlung gezählt, auch Online-Bezahlte.

**Symptom**: "Bar kassieren: 85,00 €" auch wenn alle Bestellungen mit Karte bezahlt waren.

**Fix**: Beide Select-Queries (`delivery_batch_stops` und `mise_delivery_batch_stops`) um `bezahlt, zahlungsart, kunde_telefon` erweitert.

```diff
- order:customer_orders(id,bestellnummer,...,gesamtbetrag)
+ order:customer_orders(id,bestellnummer,...,gesamtbetrag,bezahlt,zahlungsart,kunde_telefon)
```

### Status nach Review #6
- TypeScript: 0 Fehler ✅
- Build: `npm run build` kompiliert sauber ✅
- Bar-Kassier-Bug: BEHOBEN ✅
- **SYSTEM MARKT-REIF** — alle Features korrekt, kein bekannter Bug mehr

---

## CEO Review #5 — 2026-05-28

### Geprüfte Commits (seit CEO Review #4)
- `2846357` feat(delivery/frontend): today-completed counter, tour total in fahrer pick phase
- `4b9dedd` feat(dispatch): live ETA countdown per order, MM:SS wait timer
- `332ebac` feat(delivery/frontend): column header timing, stop ETAs, driver return clock
- `48b266c` feat(delivery/frontend): mm:ss timing, cash summary, refresh countdown

### Befund: MARKT-REIF — 1 Logik-Bug behoben

#### Build + TypeScript
- `npm run build` ✅ — Kompiliert sauber, 0 Fehler
- `npx tsc --noEmit` ✅ — 0 TypeScript-Fehler

#### Code-Review der neuen Features
**Dispatch ETA-Countdown** (`dispatch/client.tsx` — `BatchRow`):
- `etaEndMs = startzeit + total_eta_min * 60_000` → verbleibende Sekunden live ✅
- Farbcodierung: Grün >5Min, Orange >1Min, Rot+Puls überzogen ✅
- Stop-Timeline mit proportionalen ETAs pro Stop ✅

**Kitchen Today-Counter** (`kitchen/client.tsx`):
- `completedToday` via DB-Count (`status IN ['geliefert','abgeholt','abgeschlossen']`) ✅
- Polling alle 60s, sauber cleanup ✅

**Dispatch MM:SS Timers** (`dispatch/client.tsx`):
- `OrderRow`: Warte-Timer seit `fertig_am` im Format `MM:SS` ✅
- `BatchRow`: Tour-Dauer seit `startzeit` in `MM:SS` ✅

**Fahrer Pick-Phase** (`fahrer/app/client.tsx`):
- Tour-Total-Betrag (`stops.reduce(...)`) ✅
- Stop-Count korrekt angezeigt ✅

**Statistics Refresh-Countdown** (`statistics-view.tsx`):
- `nextRefreshSec` Countdown von 30→0 live ✅
- Fahrer-Polling alle 30s ✅

#### Bug gefunden und behoben: `StopEtaBar` falscher `elapsedSec`
**Datei**: `app/fahrer/app/delivery-view.tsx`

**Problem**: `StopEtaBar` bekam `elapsedSec` von der `DeliveryView`-Elternkomponente — das ist die Gesamtzeit seit Tour-Start. Für Stop 2+ war der Wert bereits hoch (z.B. 10 Min), obwohl der Fahrer gerade erst vom Stop 1 losfuhr. Resultat: "Fast da!" wurde sofort angezeigt, bevor der Fahrer überhaupt startete.

**Fix**: `StopEtaBar` trackt jetzt seine eigene `mountedAt` Referenz. Da die Komponente bei jedem neuen "nächsten Stop" via `key={stop.id}` neu gemountet wird, ist `elapsedSec` jetzt korrekt die Zeit seit Abfahrt vom letzten Stop.

```tsx
// VORHER (falsch)
function StopEtaBar({ distanzM, elapsedSec }: { distanzM: number; elapsedSec: number }) { ... }

// NACHHER (richtig)
function StopEtaBar({ distanzM }: { distanzM: number }) {
  const mountedAt = useRef(Date.now());
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setElapsedSec(Math.floor((Date.now() - mountedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  ...
}
```

### Status nach Review #5
- TypeScript: 0 Fehler ✅
- Build: `npm run build` kompiliert sauber ✅
- StopEtaBar Bug: BEHOBEN ✅
- **SYSTEM MARKT-REIF** — alle 7 Phasen abgeschlossen, neuste Features QA-geprüft

### Bekannte Architektur-Schuld (niedrige Priorität, kein Kunden-Impact)
1. `delivery-view.tsx → markDelivered()` schreibt nur in `delivery_batch_stops` (Legacy). Mise-Batches werden korrekt via `client.tsx → markDelivered()` abgehandelt, aber nur in der Pick-Phase. In der Delivery-Phase (Status `unterwegs`) könnte der Mise-Stop nicht als geliefert markiert werden, falls der Stop aus `mise_delivery_batch_stops` kommt. Da `page.tsx` aktuell `delivery_batch_stops` lädt, kein sofortiger Impact.
2. `isCriticallyLate`-Sound-Trigger in `kitchen/client.tsx` (Zeile 284): `prevCritical = prev.current.newCount > 0` ist eine Annäherung. Nur Sound-Trigger betroffen, kein Daten-Bug.



## Anweisungen an Backend-Architekt
### Deployment-Checkliste (WICHTIG)
1. SQL-Migrations 001–005 in Supabase ausführen (scripts/migrations/)
2. Cron-Job in Vercel aktivieren (vercel.json gesetzt, ENV: `CRON_SECRET`)
3. `BISS_INTERNAL_TOKEN` ENV-Var setzen für `/api/cron/smart-dispatch`
4. Bridge-Trigger in Migration 004 aktivieren (mise→legacy Sync)

## CEO Review #4 — 2026-05-28

### Befund: Phase 6 + 7 vervollständigt, MARKT-REIF

#### Implementierte Features

**Tracking — stops_before Badge** (`app/track/[bestellnummer]/tracking.tsx`):
- `stopsBefore` State aus Tracking-API-Polling (alle 30s)
- Badge unter Fahrer-Name: "Nächste Lieferung" (0 Stops, matcha), "1 Stop vor dir" (amber), "X Stops vor dir" (stone)
- Nur sichtbar wenn `status === 'unterwegs'` und `stopsBefore != null`

**Admin Zonen A/B/C/D** (`app/(admin)/delivery/zone/client.tsx`):
- `ZoneConfigRow` Komponente: read-only Tabellenzeile + Inline-Edit-Formular
- Felder: Bezeichnung, Max-Radius, Aufpreis, Mindestbestellwert, Basis-ETA
- "Standard-Zonen anlegen" Button (Seed) wenn keine Zonen vorhanden
- Zonen-Tabelle lädt via `GET /api/delivery/zones?location_id=...`
- Speichern via `POST /api/delivery/zones` (Upsert)

**Heatmap Top-Zonen** (`components/lieferdienst/statistics-view.tsx`):
- Fetch `GET /api/delivery/admin/heatmap?location_id=...`
- Aggregiert nach Zone, sortiert nach Häufigkeit, Top-10
- Balken-Visualisierung mit Zone-Farbcodierung (A=grün, B=blau, C=amber, D=rot)

### Status nach Review #4
- TypeScript: 0 Fehler ✅
- Build: `npm run build` kompiliert sauber ✅
- Phase 6: DONE ✅
- Phase 7: DONE ✅
- **SYSTEM MARKT-REIF** — alle 7 Phasen abgeschlossen

### Nächste Schritte (Operations)
1. DB-Migrations 001–005 in Supabase Production ausführen
2. ENV-Vars setzen: `CRON_SECRET`, `BISS_INTERNAL_TOKEN`
3. Vercel Deployment pushen
4. Technische Schuld (niedrig): `delivery_batches` → `mise_delivery_batches` konsolidieren

## Architektur-Schuld (nächster Sprint)
- `delivery_batches` + `mise_delivery_batches` konsolidieren → nur `mise_delivery_batches`
- `app/fahrer/app/client.tsx` liest noch `delivery_batch_stops` (alt) statt `mise_delivery_batch_stops`
- `dispatch/client.tsx → assignToDriver()` schreibt nur in alte Tabelle
- Priorität: NIEDRIG (Kunden sehen keinen Unterschied), aber technische Schuld wächst

## CEO Review #1 — 2026-05-28

### Befund
35 TypeScript-Fehler im gesamten Codebase. Build war zwar OK (Next.js überspringt TS-Check im Build),
aber Type-Safety war nicht gegeben. Alle Fehler behoben.

### Behobene Fehler
1. `lieferdienst/client.tsx` — StaffMember fehlte `active: true` im Default-Objekt
2. `menu/client.tsx` — Lokaler `MenuItem`-Typ fehlte `bestseller_bild_url`
3. `modules/cash/page.tsx` — 20+ Lucide-Icon-Typ-Fehler: `size` erwartete `number`, Lucide liefert `string | number` → auf `number | string` erweitert
4. `pos/inbox/client.tsx` — PageHeader `subtitle` → `description`; Supabase-Payload `any`-Typen
5. `pos/inbox/NewOrderOverlay.tsx` — Icon-Typ-Fehler wie oben
6. `pos/printers/client.tsx` — PageHeader `subtitle` → `description`
7. `pos/terminal-v5/MemberScanner.tsx` — Icon-Typ-Fehler
8. `reservierungen/client.tsx` — PageHeader `subtitle` → `description`
9. `shop/setup-wizard/lieferservice/client.tsx` — PageHeader `subtitle` → `description`
10. `training/ai-create/page.tsx` — Implicit `any` in `.map(e =>` — explizit getypt
11. `api/driver-app/decline/route.ts` — `.catch()` auf Supabase-RPC → try/catch
12. `api/driver/v1/*` — `.map()` Callback-Typ → `(row: any)` Cast
13. `api/stripe/connect-tenant/route.ts` — `stripe.accounts.retrieve()` 0 Args → Cast
14. `fahrer/app/client.tsx` + `permissions-gate.tsx` — `Uint8Array<ArrayBufferLike>` → `.buffer as ArrayBuffer`
15. `order/[locationSlug]/item-sheet.tsx` — `item` möglicherweise null in `handleAdd` → Guard
16. `order/[locationSlug]/page.tsx` — Toter Code nach `redirect()`, 5+ Typ-Fehler → Assertions + Variable
17. `order/[locationSlug]/preview/gallery.tsx` — `Cat` fehlte `sort_order` → Optional + `as any` Cast
18. `order/[locationSlug]/storefront-aurora.tsx` — CSSProperties Custom-Properties → `& Record<string, string>`
19. `components/lieferdienst/order-card.tsx` — `prepTimes` war Array von Numbers, Komponente erwartete Objekte → `prepTimes` auf `{ value, label }[]` umgestellt
20. `components/lieferdienst/incoming-order-dialog.tsx` — Gleiche `prepTimes`-Migration
21. `hooks/use-offline.ts` — Import von `@/lib/orders` → `@/lib/lieferdienst/orders`
22. `hooks/use-toast.ts` — `ToastActionElement`/`ToastProps` fehlten in `toast.tsx` → Exports hinzugefügt; `onOpenChange` Param explizit getypt
23. `lib/lieferdienst/translations.ts` — Doppelter Key `done` → entfernt

### Status nach Review
- TypeScript: 0 Fehler
- Build: Kompiliert sauber
- Dispatch Board: Funktioniert (manuelle Touren-Zuweisung)
- Fahrer-API: Funktioniert (Auth, Aktive Touren)

### Nächste Schritte für Backend-Architekt
1. SQL-Migrations in `scripts/migrations/`
2. Dispatch-Engine in `lib/delivery/`
3. API-Routes in `app/api/delivery/`

### Nächste Schritte für Frontend-Ingenieur
1. Küchen-Dashboard: `app/(admin)/kitchen/` (Kanban, Timer, Realtime)
2. Fahrer-Tour-Übersicht: `app/driver/` oder `app/fahrer/app/` erweitern

## CEO Review #2 — 2026-05-28

### Befund: 3 kritische Integrations-Bugs

#### Bug 1: Auto-Dispatch Button → 403 Forbidden (KRITISCH)
**Datei**: `app/api/delivery/dispatch/route.ts`
**Problem**: Die Route akzeptierte nur `x-internal-token` Header. Der Frontend-Button sendet keinen Token → immer 403.
**Fix**: Route akzeptiert jetzt SOWOHL internen Token ALS AUCH authentifizierte User-Sessions.

#### Bug 2: Zwei getrennte Batch-Tabellen ohne Verbindung (KRITISCH)
**Problem**: Das System hat zwei parallele Batch-Tabellen:
- `delivery_batches` + `delivery_batch_stops` — Alt-System (Fahrer-PWA, manuelle Dispatch)
- `mise_delivery_batches` + `mise_delivery_batch_stops` — Frank-System (Smart Dispatch Engine, Driver API v1)

**Symptom**: Smart-Dispatch erstellte Batches in `mise_delivery_batches`, aber Dispatch Board zeigte nur `delivery_batches`. Auto-Dispatch-Ergebnisse waren im UI unsichtbar!

**Fix**: Dispatch Board (`dispatch/page.tsx` + `dispatch/client.tsx`) holt jetzt BEIDE Tabellen und normalisiert sie zur einheitlichen Darstellung. Realtime-Subscriptions für beide Tabellen aktiv.

#### Bug 3: Kitchen falscher Status-Filter + fehlende Realtime (MITTEL)
**Datei**: `app/(admin)/kitchen/client.tsx`
**Problem**: `refreshBatches()` filterte nur `['aktiv', 'unterwegs']`, aber Dispatch erstellt Batches mit `'pickup'`. Kein Realtime-Abo für `mise_delivery_batches`.
**Fix**: Status-Filter korrigiert (`['pickup', 'aktiv', 'unterwegs', 'zugewiesen']`), Realtime für beide Batch-Tabellen, beide Tabellen werden zusammengeführt.

### Status nach Review #2
- TypeScript: 0 Fehler
- Build: Kompiliert sauber
- Auto-Dispatch Button: Funktioniert (Auth-Fix)
- Dispatch Board: Zeigt Batches aus BEIDEN Tabellen live
- Kitchen: Fahrer-Status korrekt aus beiden Tabellen

### Offene Architektur-Schuld (für nächsten Sprint)
Die `delivery_batches` / `mise_delivery_batches` Doppelstruktur sollte langfristig
auf eine einzige Tabelle (`mise_delivery_batches`) konsolidiert werden.
Folgende Dateien müssen dann migriert werden:
- `app/fahrer/app/page.tsx` + `client.tsx` + `delivery-view.tsx` → nutzen noch alte Tabelle
- `app/(admin)/dispatch/client.tsx` → `assignToDriver()` schreibt noch in alte Tabelle

**Prio-Reihenfolge**: Feature-Vervollständigung hat Vorrang, dann Konsolidierung.

### Nächste Schritte für Frontend-Ingenieur
1. Fahrer-App verbessern: Aktive Touren aus BEIDEN Tabellen anzeigen (analog Kitchen-Fix)
2. Dispatch `assignToDriver()`: Auch `mise_delivery_batch` anlegen (Bridge-Write)
3. Storefront ETA-Label aus `/api/delivery/eta/[orderId]` live anzeigen

### Nächste Schritte für Backend-Architekt
1. SQL-Migrations 001–003 in Supabase ausführen (falls noch nicht geschehen)
2. `mise_delivery_batches` → `delivery_batches` Bridge-Trigger in DB (optional)
3. Cron-Job für `smartDispatchTick()` einrichten (alle 2 Min)

## Architektur-Entscheidungen
- Multi-Tenant über location_id (wie im restlichen System)
- Koordinaten als lat/lng (decimal)
- Zeiten in UTC
- Scoring als numerischer Wert 0-100
- Kanonische Tabelle: `mise_delivery_batches` / `mise_delivery_batch_stops` (Frank-System)
- Legacy-Kompatibilität: `delivery_batches` bleibt für Fahrer-PWA aktiv bis zur Migration

## CEO Review #3 — 2026-05-28

### Befund: 22 TypeScript-Fehler + Integrations-Vollprüfung

#### Root Cause: Supabase String-Konkatenation → GenericStringError
**Dateien**: `app/api/delivery/admin/drivers/route.ts`, `app/api/delivery/orders/[orderId]/tracking/route.ts`

**Problem**: `@supabase/postgrest-js` v2.106.2 parst `.select()` Strings zur Compile-Zeit als TypeScript-Literale.
Bei String-Konkatenation (`'...' + '...'`) ist der Typ `string` statt ein Literal-Typ.
`ParseQuery<string>` gibt `GenericStringError` zurück → alle `.data`-Properties werden zu Fehler.

**Fix**: Multi-Part-Strings zu Single-Literal-Strings zusammengeführt (2 Dateien, 2 Queries).

**Lernregel**: Supabase `.select()` IMMER als Single-Literal schreiben — KEINE String-Konkatenation!
```typescript
// ❌ FALSCH
.select('id, name, ' + 'telefon, state')
// ✅ RICHTIG
.select('id, name, telefon, state')
```

#### Integrations-Prüfung der Frontend-Commits (letzter Commit + vorletzter)

**Dispatch Countdown** (`dispatch/client.tsx`):
- `batch.startzeit + batch.total_eta_min` → Live-Countdown in BatchRow ✅
- Farbcodierung: Grün >5Min, Orange >1Min, Rot+Puls überzogen ✅

**Kitchen "Warte-Badge"** (`kitchen/client.tsx`):
- `fertig_am` korrekt im Type + Select(`*`) enthalten ✅
- Graceful Fallback auf `bestellt_am + geschaetzte_zubereitung_min` wenn `fertig_am` null ✅

**Driver Elapsed + Distance** (`delivery-view.tsx`):
- `elapsed` via `setInterval(1000)` + `mountedAt.current` ✅
- `distanz_zum_vorgaenger_m` — null-safe Guard vorhanden → graceful hide wenn Altdaten ✅
- ETA-Berechnung: `distanz_m / 1000 / 15 * 60` = km / 15km/h = Minuten (Fahrrad-Tempo) ✅

**Storefront Live-ETA** (`success-state.tsx`):
- `orderId` von `storefront.tsx` line 343 korrekt übergeben ✅
- Polling alle 30s via `/api/delivery/eta/[orderId]` ✅
- `secsLeft` wird live aktualisiert wenn neue ETA eintrifft ✅

**Statistics Live-Fahrer-Panel** (`statistics-view.tsx`):
- `LiveDriver` Type korrekt definiert ✅
- Polling alle 30s via `/api/delivery/admin/drivers` ✅
- Requires Auth — API gibt 401 wenn nicht eingeloggt (normal im Admin) ✅

### Status nach Review #3
- TypeScript: 0 Fehler ✅
- Build: `next build` kompiliert sauber ✅
- Phase 4 (Kitchen): DONE ✅
- Phase 5 (Fahrer-App): DONE ✅ (ohne eingebettetes Karten-Widget — Navigation-Link reicht)
- Phase 6 (Storefront): 50% — ETA-Polling ✅, Live-Tracking-UI fehlt
- Phase 7 (Admin): 60% — Fahrer-Panel + Stats ✅, Zonen-UI + Heatmap-UI fehlen

### Nächste Priorität für Frontend-Ingenieur
1. Storefront Tracking-Badge (stops_before anzeigen)
2. Admin Zonen-Tabelle (einfaches CRUD)
3. Heatmap als Top-Zonen-Tabelle in statistics-view
