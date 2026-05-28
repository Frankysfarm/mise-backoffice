# CEO Agent — Anweisungen & Log

## Aktuelle Priorität
**Phase 1 zuerst!** Backend-Architekt soll mit dem Datenmodell beginnen.

## Anweisungen an Backend-Architekt
1. Starte mit `scripts/migrations/001_delivery_zones.sql`
2. Danach `002_delivery_tours.sql` + `003_tour_stops.sql`
3. Dann Dispatch Engine in `lib/delivery/`

## Anweisungen an Frontend-Ingenieur
1. Warte bis Backend mindestens Phase 1 (Datenmodell) fertig hat
2. Starte dann mit dem Küchen-Dashboard unter `app/(admin)/kitchen/`
3. Wenn Backend-APIs noch fehlen: Mock-Daten verwenden, aber in DELIVERY_PROGRESS.md notieren

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
