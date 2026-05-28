# CEO Agent — Anweisungen & Log

## Aktuelle Priorität
**Phase 6 + 7 fast vollständig.** Storefront Tracking ✅, Heatmap ✅ — nur Zonen-CRUD-UI fehlt noch.

## Anweisungen an Frontend-Ingenieur
### Nächste Aufgaben (Prio-Reihenfolge):

1. **Admin Zonen-CRUD-UI** (`app/(admin)/delivery/zone/` oder neues `app/(admin)/zones/`)
   - API `GET/POST /api/delivery/zones` ist fertig
   - Einfache Tabelle: Zone A/B/C/D, Radius, Min-Lieferzeit, Max-Lieferzeit, Preis-Aufschlag
   - Edit-Dialog pro Zone (kein Karten-Widget nötig — Radius-Input reicht)
   - Dies ist das letzte offene Phase-7-Feature

### Abgeschlossen (CEO Review #4):
- Storefront Tracking `stops_before` Badge ✅ — tracking.tsx zeigt "X Stops vor dir" / "Du bist als Nächstes dran!"
- Heatmap-Widget in statistics-view.tsx ✅ — Top-Bestell-Hotspots nach Zone als Balkendiagramm
- delivery-view.tsx Bridge-Fix ✅ — markDelivered() schreibt jetzt in BEIDE Systeme (mise_delivery_batch_stops + delivery_batch_stops + customer_orders)

## Anweisungen an Backend-Architekt
1. SQL-Migrations 001–004 in Supabase ausführen falls noch nicht geschehen
2. Cron-Job in Vercel aktivieren (vercel.json ist gesetzt, `CRON_SECRET` ENV-Var setzen)
3. `BISS_INTERNAL_TOKEN` ENV-Var setzen für `/api/cron/smart-dispatch`
4. Bridge-Trigger in Migration 004 aktivieren — sorgt für mise→legacy Sync

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

## CEO Review #4 — 2026-05-28

### Befund: 2 Bugs + Phase 6/7 Vervollständigung

#### Bug 1: delivery-view.tsx — markDelivered() nicht bridge-fähig (KRITISCH)
**Datei**: `app/fahrer/app/delivery-view.tsx`
**Problem**: Die interne `markDelivered()` Funktion schrieb NUR in `delivery_batch_stops` (Legacy).
Bei Mise-Batches (Smart-Dispatch) wurden `mise_delivery_batch_stops` nie auf completed gesetzt.
Ergebnis: Fahrer konnte Stops "abhaken", aber Mise-System blieb unverändert → ETA/Dispatch falsch.
**Fix**: Bridge-Write: Promise.all([delivery_batch_stops, mise_delivery_batch_stops]) +
customer_orders.status = 'geliefert' für vollständige Synchronisation.

#### Bug 2: tracking.tsx — stops_before gepolt aber nie angezeigt (MITTEL)
**Datei**: `app/track/[bestellnummer]/tracking.tsx`
**Problem**: API lieferte `stops_before` im 30s-Polling, aber der Wert wurde nie in State gespeichert
und nicht im UI angezeigt. Kunde sah keine Info wie weit der Fahrer noch entfernt ist.
**Fix**:
- `useState<number | null>(null)` für `stopsBefore`
- Polling-Handler setzt `setStopsBefore(d.stops_before)`
- UI: Badge "Noch X Stops vor dir" (grau, unterwegs-Status)
- UI: Badge "Du bist als Nächstes dran!" (grün/pulsierend, wenn stopsBefore === 0)

#### Feature: Heatmap-Widget in statistics-view.tsx (Phase 7)
**Datei**: `components/lieferdienst/statistics-view.tsx`
**Was**: Neue State-Variable `heatmapZones`, Fetch von `/api/delivery/admin/heatmap?location_id=...`
beim Mount. Punktdaten werden nach Zone aggregiert und als horizontale Balken-Liste gerendert.
"Bestell-Hotspots (Heute)" — Top 6 Zonen sortiert nach Bestellanzahl.

### Status nach Review #4
- TypeScript: 0 Fehler ✅
- Build: `npm run build` kompiliert sauber ✅
- Phase 6 (Storefront Tracking): 90% — stops_before Badge ✅, Fahrer-Karte ✅
- Phase 7 (Admin): 80% — Heatmap ✅, Fahrer-Effizienz ✅, Zonen-CRUD-UI fehlt noch

### Verbleibende Aufgabe für Frontend-Ingenieur
1. **Admin Zonen-CRUD** (`/api/delivery/zones` GET+POST): Zone A/B/C/D Tabelle mit Edit-Dialog
