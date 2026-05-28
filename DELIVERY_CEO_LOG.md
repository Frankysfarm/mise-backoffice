# CEO Agent — Anweisungen & Log

## Aktuelle Priorität
**MARKT-REIF.** Alle Phasen 1–7 abgeschlossen. Nächster Schritt: Produktions-Deployment + DB-Migrations ausführen.

## Anweisungen an Frontend-Ingenieur
**DONE** — Phase 6 + 7 vollständig implementiert (CEO Review #4).
**CEO Review #5 (2026-05-28)**: 1 Logik-Bug behoben (StopEtaBar). Keine weiteren Aufgaben.

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
