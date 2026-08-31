# Packet C-E (Codex): Lagerplan, Lagerplätze, QR-Codes, Inventur, Bestellvorschläge

Read `2026-08-31-coordination.md`, `2026-08-31-owner-order-verbatim.md`
(point 6) and `2026-08-31-vollausbau-master.md` first.

## Audit first

UI: `app/(neo)/neo/app/lager/*` (page, products, suppliers, shelves,
movements, sessions, assign, receiving, orders, waste). API:
`app/api/inventory/*` (auto-reorder, orders), any storage-location / shelf
tables, movement + count/inventory-session tables, existing QR generation
(`app/api/qr`, `app/api/print`). List what exists, what is hidden, what is
missing. Much of the data model likely exists — the owner's complaint is
overview and mobile usability.

## Required end state

### Lagerplan (visual)

- Hierarchy the owner can create and name without technical knowledge:
  Standort → Raum → Regal/Kühlschrank/Gefrierschrank/… (type with icon) →
  Lagerplatz. Reuse existing shelves/locations tables; add parent/type columns
  additively if needed.
- Visual overview page: rooms as cards/sections, units inside, places inside
  units, each place showing product count and status chips (ok / nachbestellen
  / Inventur fällig / leer). Works on desktop and phone (no canvas requirement;
  a clean structured layout is fine).

### QR-Codes

- Per Lagerplatz: generate QR (PNG/SVG) and a printable label sheet (reuse the
  existing print/QR routes). QR encodes a tenant-scoped URL to a mobile page.
- Scan page (mobile-first, authenticated staff): shows for that place — stored
  products, Soll-Menge, Ist-Menge, Nachbestellen-Hinweis, letzte Kontrolle/
  Inventur (wer, wann). Actions: Einbuchen, Entnehmen, Umlagern (to another
  place via search or scan), Zählen (Inventur).

### Buchungen + Inventur

- All actions create movement rows (reuse the movements table). Umlagern =
  one atomic RPC (out + in). Inventur count writes the count and computes the
  Abweichung vs. expected; deviations are listed for management.
- Bestellvorschläge: reuse/extend `api/inventory/auto-reorder` so that places
  under Soll produce a proposal line grouped by supplier; owner can turn a
  proposal into an order with the existing orders flow.

## Tests

Unit: hierarchy validation (no cycles, tenant scope), movement math,
inventory deviation, reorder proposal grouping. Playwright: create room → unit
→ place → QR page renders; mobile scan page book/withdraw/count flow with
mocked API.
