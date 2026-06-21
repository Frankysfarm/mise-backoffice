# Handoff: Drive — Fahrer-App (Driver Delivery App)

## Overview
**Drive** is a mobile app (iPhone-first, German UI) for delivery drivers / pickers — "Uber für Lieferfahrer". A driver logs in, receives an incoming batch of orders, accepts it, picks each order item-by-item (controlling and confirming every product), starts a tour (the system computes the optimal route), and delivers each stop. At delivery the driver can mark **"Bestellung geliefert"**, report **"Kunde nicht gefunden"**, or **call the customer**.

This bundle is the **design reference** for that flow.

## About the Design Files
The files in this bundle are **design references created in HTML/React (via in-browser Babel)** — interactive prototypes that show the intended look, copy, and behavior. **They are not production code to copy directly.**

The task is to **recreate these designs in the target codebase's environment** using its established patterns, component library, navigation, and state tooling. The app is intended to ship as a **native iOS app** (or React Native / Flutter, depending on your stack). Treat the HTML as the source of truth for *visuals and interaction*, and re-implement with native components (SwiftUI/UIKit, or your cross-platform framework). If no app environment exists yet, pick the most appropriate mobile framework and build there. A real map SDK (MapKit / Google Maps / Mapbox) should replace the stylised SVG map.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions are specified. Recreate the UI to match, mapping the tokens below onto the codebase's design system. The phone bezel/status bar in the prototype is scaffolding only — use the device's real chrome.

---

## Design Tokens

The app ships **4 switchable color worlds** ("Farbwelten"). All components reference CSS-variable-style tokens; only the token *values* change per theme. Implement as a theme object.

### Theme: **Wald** (green, default, light)
| Token | Value |
|---|---|
| accent | `#0F9C50` |
| accent-press | `#0B7E40` |
| on-accent (text on accent) | `#FFFFFF` |
| accent-tint | `#E6F4EC` |
| bg (app background) | `#F2F4F2` |
| surface (cards) | `#FFFFFF` |
| surface-2 (insets) | `#F6F8F6` |
| ink (primary text) | `#0B0F0D` |
| ink-2 (secondary) | `#586460` |
| ink-3 (tertiary/muted) | `#909893` |
| line (borders) | `#E5E9E6` |
| line-2 (subtle dividers) | `#EFF2F0` |
| danger | `#E5484D` |
| danger-tint | `#FCEBEC` |
| warn | `#E07C0B` |
| warn-tint | `#FBF0DF` |
| map-bg / map-block / map-road / map-park | `#E7ECE7` / `#DBE2DC` / `#FFFFFF` / `#D5E6D8` |

### Theme: **Mitternacht** (dark)
accent `#35D67E`, accent-press `#2BBA6B`, on-accent `#062012`, accent-tint `#14271C`, bg `#0B0F0D`, surface `#161B18`, surface-2 `#1D231F`, ink `#F3F6F4`, ink-2 `#9BA7A1`, ink-3 `#6A746E`, line `#262D29`, line-2 `#1F2622`, danger `#FF6066`, danger-tint `#2A1719`, warn `#F5A623`, warn-tint `#2A2113`, map-bg `#0E1310`, map-block `#171D19`, map-road `#222A25`, map-park `#13221A`.

### Theme: **Sonne** (orange, light)
accent `#F2581B`, accent-press `#D4470F`, on-accent `#FFFFFF`, accent-tint `#FCEBE2`, bg `#F6F3F0`, surface `#FFFFFF`, surface-2 `#FAF7F4`, ink `#1A1310`, ink-2 `#6B5F58`, ink-3 `#9C8F86`, line `#ECE6E1`, line-2 `#F4EFEA`, danger `#D83A3F`, warn `#D98208`, map-bg `#EFEAE4`, map-block `#E5DDD4`, map-road `#FFFFFF`, map-park `#E2E8D4`.

### Theme: **Elektrik** (blue, light)
accent `#2563EB`, accent-press `#1D4FD0`, on-accent `#FFFFFF`, accent-tint `#E5EDFD`, bg `#F1F4F9`, surface `#FFFFFF`, surface-2 `#F6F8FC`, ink `#0C1220`, ink-2 `#566179`, ink-3 `#8A93A6`, line `#E4E8F0`, line-2 `#EDF0F6`, danger `#E5484D`, warn `#E0820B`, map-bg `#E6ECF5`, map-block `#DAE2EE`, map-road `#FFFFFF`, map-park `#D5E4DC`.

> A "Kühlware" (cold-chain) accent of `#2E7DD1` / tint `#E9F2FB` is used independently of theme on product temp badges.

### Typography
- **UI font:** `Hanken Grotesk` (weights 400/500/600/700/800). Global letter-spacing `-0.01em`; large headings tighten to `-0.02em`/`-0.03em`.
- **Numeric/mono font** (order codes, timers, percentages, quantities, phone numbers): `JetBrains Mono` (500/600/700), letter-spacing `-0.02em`.
- Type scale used (px): 30/800 (screen titles), 26/800 (overlay names, summary), 22/800 (section headers), 20/800 (sheet titles), 18/700 (primary buttons), 17.5–16.5/700–800 (card titles), 15.5/700 (list rows), 14–13.5/500–700 (secondary), 13/700 (codes), 12.5/700 uppercase (eyebrows, letter-spacing 0.04–0.05em), 11.5/700 uppercase (field labels).

### Spacing / Radius / Shadow
- **Screen horizontal padding:** 16px. **Safe-area top:** 54px, **bottom:** 30px (these clear the iOS status bar / home indicator — replace with real safe-area insets).
- **Radii:** buttons lg 17 / md-sm 13; cards 18–20; large cards / sheets 24–30 (bottom sheets 30 top corners); pills/badges 9–14; chips 7–8; full-round 9999 for avatars/status dots.
- **Card shadow:** `0 2px 10px -6px rgba(0,0,0,.14)` plus `inset 0 0 0 1px line`. Elevated bottom card: `0 -6px 34px -10px rgba(0,0,0,.24)`. Primary button glow: `0 6px 18px -8px accent`.
- **Button heights:** lg 56, md 46, sm 38. Min tap target 42–44px throughout.

### Motion
- Bottom sheet enters with a **40px** upward translate (~.34s, cubic-bezier(.2,.8,.2,1)) — deliberately small so content is never hidden if animations are paused/reduced.
- Pulsing rings on "online/waiting", active map pin, and incoming call (radial box-shadow expand, ~2s loop).
- Active route line: dashed stroke marching (`stroke-dashoffset`, ~30s loop) — toggleable.
- Summary check icon: scale pop (.5s). Cards: 14px rise-in. Honor `prefers-reduced-motion`: keep end-states visible.

---

## Screens / Views

Navigation is a single state machine (`screen`): `login → home → orders → pick → routeLoading → route → summary → (home)`. Overlays (incoming sheet, product sheet, not-found sheet, calling overlay) render on top of the current screen.

### 1. Login — "Schicht starten"
- **Purpose:** Driver authenticates and goes online.
- **Layout:** Top ~280px hero with a faint stylised map + bottom gradient fade; brand mark ("drive" wordmark + arrow glyph in an accent rounded square) top-left. Below: title "Schicht starten" (30/800), subtitle "Melde dich mit deiner Fahrer-Nummer an." Two input fields (Fahrer-Nummer w/ phone icon; PIN w/ lock icon, masked). "PIN vergessen?" accent link. Pinned bottom: primary button "Anmelden & online gehen" (power icon) + caption "Hub Prenzlauer Berg · Schicht 16:00–22:00".
- **Field component:** 60px tall, surface bg, radius 16, `inset 0 0 0 1.5px line` (→ 2px accent on focus, icon recolors to accent). Floating uppercase label (11.5/700, ink-3) above a 16.5/600 value.
- **Behavior:** Submit shows a spinner ~850ms, then → `home`.

### 2. Home / Online — "Warte auf Bestellungen"
- **Purpose:** Online idle state; incoming orders arrive here.
- **Layout:** Full-bleed stylised map background with top+bottom bg gradient masks. Top-left status pill: green dot + "Online" (surface pill, shadow). Top-right bell IconBtn. Centered: pulsing accent ring behind a white circle with a bag icon, then "Warte auf Bestellungen" (19/800) + helper text. Bottom: driver card (avatar, name "Mehmet Yıldız", ★ 4.9 · vehicle "E-Cargobike · B-DR 482", secondary "Offline" button → login).
- **Behavior:** ~1.7s after arriving online, the **Incoming sheet** auto-slides up. Declining re-arms it after ~3.2s.

### 3. Incoming order — "Neue Tour" (bottom sheet overlay)
- **Purpose:** Accept/decline a batch of orders.
- **Layout:** Non-dismissable bottom sheet. Header: bag icon (gentle ring-shake), "Neue Tour" + "{n} Bestellungen · Hub Prenzlauer Berg", and a **circular countdown ring** (SVG, mono number, starts at 15, ~52px). Three metric tiles: Artikel (sum of qty), Strecke (sum km, e.g. "5.4 km"), Dauer ("~38 min"). Scrollable stop preview list (numbered 1..n, address, "{n} Positionen · {km} km", mono "#CODE"). Footer: "Ablehnen" (secondary, ~34% width) + "Annehmen" (primary, arrow icon).
- **Behavior:** Countdown ticks each second; reaching 0 auto-declines. Accept → loads fresh orders, → `orders`.

### 4. Order overview — "Zu picken"
- **Purpose:** List accepted orders; each must be picked before the tour can start.
- **Layout:** Header "Zu picken" + "{n} Bestellungen · Hub Prenzlauer Berg", right badge "{picked}/{total}" (bag icon). Scroll list of order cards (radius 20). Each card: top row mono "#A-4821" + status badge (Offen neutral / "{done}/{total} kontrolliert" warn / Gepickt accent+check). Middle: avatar, customer name (16.5/700), pin + short address, accent "Picken ›" / "Ansehen ›". Bottom: progress bar + "{totalQty} Artikel". Footer button: disabled "Erst alle picken · {picked}/{total}" until all complete, then "Tour starten · Route berechnen" (route icon).
- **Behavior:** Tap a card → `pick`. Start button enabled only when every order is fully confirmed.

### 5. Pick one order — "#A-4821"
- **Purpose:** Control & confirm each product of one order.
- **Layout:** Header with back IconBtn, "#CODE" title, "{customer} · {address}" subtitle. Progress strip card: "{done} von {total} kontrolliert" + progress bar + big mono "%". Eyebrow "TIPPE EINEN ARTIKEL ZUM KONTROLLIEREN". Item rows (radius 18): product thumbnail (placeholder box icon; cold items get a `#2E7DD1` temp badge top-right), qty "{n}×" (mono, accent) + product name (wraps, no truncation), sub line ("1 L · Tetrapak · ≈ 1 kg"), a location chip (pin + "Kühlung · K2"), right control: chevron when open, **accent check circle** when confirmed (row bg → accent-tint). Footer: disabled "Noch {x} Artikel kontrollieren" until done, then "Bestellung fertig gepickt" (check-circle).
- **Behavior:** Tapping an unconfirmed row opens the **Product sheet**. Confirmed rows are non-interactive. Completing → back to `orders` (order now "Gepickt").

### 6. Product control (bottom sheet overlay)
- **Purpose:** Verify one product.
- **Layout:** Dismissable sheet. Header: thumbnail (64), name (18/800) + sub, close IconBtn. Two info tiles: **Lagerplatz** (pin-fill + "Kühlung · K2") and, for cold items, **Hinweis** "Kühlware" (uses the `#2E7DD1` cold palette). A tappable **Barcode scannen** panel (92px; on tap → accent-tint, "Barcode erkannt" + a mono code). **Menge bestätigen** row: label + "Soll: {qty}× {unit}" + a stepper (− / mono count / +). Primary "Artikel bestätigen" (check; disabled if count 0).
- **Behavior:** Confirm → marks `item.confirmed = true`, closes sheet, updates progress.

### 7. Route calculating — "Beste Route wird berechnet"
- **Purpose:** Loading state after "Tour starten".
- **Layout:** Centered pulsing route-icon badge, title, 3-step checklist filling sequentially (~0.62s each): "Bestellungen geladen" → "Verkehr wird geprüft" → "Beste Reihenfolge berechnet" (spinner on current, check on done).
- **Behavior:** Auto-advances to `route` after ~2.1s. The optimiser here sorts stops by ascending distance — replace with a real routing call.

### 8. Tour / Navigation — map ("Tour läuft")
- **Purpose:** Drive the optimized route; deliver each stop. **Map is the hero (full screen).**
- **Layout:** Full-bleed map (replace SVG with real map SDK): hub marker (dark dot), numbered stop pins in route order, **active stop pulses** in accent, completed stops greyed, route polyline with accent casing. Top gradient + a "Tour läuft · {current}/{total}" pill. Bottom **delivery card** (elevated, radius 26): badge "Stopp {n}" + mono "#CODE" + "{eta} min · {km} km"; pin tile + full address + floor note ("3. OG · klingeln bei „Brandt") + customer (avatar + name); optional **note banner** (warn-tint, alert icon, e.g. "Bitte nicht beim Nachbarn abgeben."); a row of "Anrufen" (phone) + "Navi" (nav) secondary buttons; primary **"Bestellung geliefert"** (check-circle); centered muted text link **"Kunde nicht gefunden?"**.
- **Behavior:** "Bestellung geliefert" sets that stop `delivered` and advances. "Anrufen" → Calling overlay. "Kunde nicht gefunden?" → Not-found sheet. After the last stop, the card becomes a single "Tour abschließen" button → `summary`.

### 9. Not-found (bottom sheet overlay) — "Kunde nicht gefunden"
- **Layout:** Title + "{customer} · {address}". Option rows: **Kunde anrufen** (accent-tinted, primary intent), **5 Minuten warten** (timer/retry), **Bei Nachbarn abgeben** (with photo proof) — each icon tile + label + sub + chevron. Bottom: danger button "Als nicht zustellbar melden".
- **Behavior:** "Kunde anrufen" → Calling overlay. "Als nicht zustellbar melden" → marks stop `failed`, advances. Others close the sheet.

### 10. Calling overlay (full screen)
- **Layout:** Dark green gradient, white text. Pulsing avatar (until connected), customer name (26/800), mono phone number, status "Klingelt …" → "Verbunden · mm:ss" (timer). Bottom: red round end-call button (phone icon rotated 135°).
- **Behavior:** Auto-"connects" after ~2.2s; timer counts up. End button closes overlay.

### 11. Tour complete — "Tour abgeschlossen"
- **Layout:** Accent check badge (pop-in), title, personalised line ("Stark gefahren, Mehmet!"). Three stat tiles: Geliefert (count, accent), Offen (failed count), Strecke (km). Primary "Zurück online gehen" → resets and returns to `home`.

---

## Interactions & Behavior (summary)
- **Timers:** login 850ms; incoming auto-appear 1700ms; decline re-arm 3200ms; incoming countdown 15s; route loading 2100ms + 3 steps × 620ms; call connect 2200ms.
- **Navigation flows:** see state machine above. Back only exists on the Pick screen (returns to overview).
- **Loading states:** login spinner, route-calculating checklist, calling "Klingelt …".
- **Empty/disabled:** "Tour starten" and "Bestellung fertig gepickt" are disabled (40% opacity, no pointer events) until their completion condition is met.
- **Validation:** product confirm disabled when count = 0.

## State Management
Top-level state (lift into your store / view models):
- `screen` — current screen enum.
- `orders` — array of orders; each item has a `confirmed` boolean toggled during picking. Reset to a fresh deep copy on accept.
- `incoming` — whether the incoming sheet is shown (gated to `home` + no orders).
- `pickId` — order currently being picked.
- `routeOrder` — array of order ids in optimized order (from the routing call).
- `currentIndex` — index of the active stop in `routeOrder`.
- `statusById` — map of order id → `pending | delivered | failed`.
- `calling` — order being called (or null). `notFound` — order in the not-found sheet (or null).
- Derived: an order is "picked/complete" when all its items are `confirmed`; "Tour starten" enabled when every order is complete.
- **Theme** (`theme` = one of `wald | mitternacht | sonne | elektrik`) and `mapAnimation` (bool) are user preferences — persist them.

## Data Requirements
Replace mock data (`app/data.jsx`) with real endpoints:
- **Driver:** name, vehicle, rating, hub.
- **Order:** code, customer, phone, full address, floor/access note, eta (min), distanceKm, free-text note, and **items** (name, sub/description, qty, unit, pick location/`loc`, `temp` cold-chain flag, optional barcode).
- **Routing:** given accepted orders, return an optimized stop order (and ideally turn-by-turn for the map SDK).
- **Actions to wire:** accept/decline batch, confirm item (idempotent), complete pick, start tour, mark delivered, mark not-deliverable, place call.

## Assets
- **No external image assets.** Product images are **placeholders** (a box icon in a tinted square) — wire real product thumbnails from your catalog.
- **Icons** are inline 24px stroke SVGs defined in `app/theme.jsx` (`Icon` component): check, check-circle, chevron(/down/back), close, phone, lock, user, box, bag, pin, pin-fill, clock, nav, route, power, bolt, scan, plus, minus, list, alert, bell, star, truck, temp, arrow, home. Map them to your icon library (SF Symbols / Lucide etc.).
- **Map** is a stylised SVG (`CityMap` in `app/ui.jsx`) — replace with a real map SDK; keep the marker styling (numbered pins, active-pulse, greyed-done) and accent route line.
- **Fonts:** Hanken Grotesk + JetBrains Mono (Google Fonts) — bundle equivalents or your brand fonts.

## Files (in this bundle, under `source/`)
- `Drive.html` — host page; mounts the app inside the iPhone frame and wires the Tweaks/theme panel.
- `app/theme.jsx` — **design tokens (all 4 themes), global CSS, and the full `Icon` set.**
- `app/data.jsx` — mock driver/orders/items + the (stub) route optimizer.
- `app/ui.jsx` — primitives: `Btn`, `IconBtn`, `Badge`, `Avatar`, `Progress`, `Spinner`, `Sheet`, `Screen`, `Header`, `CityMap`, plus safe-area constants.
- `app/screens-auth.jsx` — Login, Home/Online, Incoming sheet, brand mark, input Field.
- `app/screens-pick.jsx` — Order overview, Pick screen, Product control sheet, product thumbnail.
- `app/screens-route.jsx` — Route loader, Tour/map navigation, Calling overlay, Not-found sheet, Summary.
- `app/App.jsx` — state machine, navigation, theme wiring, device-scaling stage.
- `frames/ios-frame.jsx`, `frames/tweaks-panel.jsx` — prototype scaffolding only (device bezel + tweak panel); **not part of the product** — ignore when implementing.

> To run the prototype as-is: open `source/Drive.html` in a browser (it loads React + Babel from CDN).

## Screenshots (visual reference, under `screenshots/`)
Reference captures of every screen (iPhone, default green theme unless noted):
1. `01-login.png` — Login "Schicht starten"
2. `02-incoming.png` — Incoming "Neue Tour" sheet with countdown
3. `03-orders.png` — Order overview, nothing picked yet
4. `04-orders-ready.png` — Overview, all picked, "Tour starten" enabled
5. `05-pick.png` — Pick screen with item list
6. `06-product.png` — Product control sheet
7. `07-route.png` — Tour navigation with map + delivery card
8. `08-not-found.png` — "Kunde nicht gefunden" sheet
9. `09-calling.png` — Full-screen calling overlay
10. `10-summary.png` — "Tour abgeschlossen" summary
11. `11-dark-theme.png` — Login in the **Mitternacht** dark color world (theme example)

