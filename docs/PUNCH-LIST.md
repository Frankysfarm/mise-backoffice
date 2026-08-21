# Historische Fahrer-Designliste (Stand 10.06.2026)

> Diese Datei dokumentiert den damaligen Design-Handoff und ist keine aktuelle
> Release-Freigabe. Verifizierter Stand, Tests und verbleibende Live-Gates stehen
> in `docs/MORGEN-REPORT.md`.

# ⭐ KONTEXT — UBER-STYLE FOOD-DELIVERY, VERKNÜPFT MIT MISE-PLATFORM
Wir sind ein RESTAURANT und liefern FOOD (fertige Gerichte). Das Tool ist wie die UBER-DRIVER-APP:
- VERKNÜPFT mit unserer Mise-Platform — echte Bestellungen aus customer_orders, echtes Dispatch via Frank (lib/frank.ts), echte Fahrer (mise_drivers). KEINE Mock-Daten. Das ist schon so verdrahtet — beim Design-Umbau NICHT die Dat/Logik-Verbindungen kappen.
- Übernimm das Drive-Design TREU (Look, Layout, Wald-Farben, Hanken+Mono-Fonts, Karten, Avatare, Countdown-Ring, Bottom-Sheets, Progress, Pick-Item-Karten inkl. Detail-Chips/„Lagerplatz"-Stil — Founder: „mit Lagerplatz kannste machen").
- Domäne anpassen: Pick-Items = die GERICHTE der Bestellung (z.B. 2× Burger, 1× Pommes), nicht Supermarkt-Produkte. „Hub Prenzlauer Berg" -> RESTAURANT-Name. Detail-Chips dürfen bleiben (z.B. Sonderwunsch/Allergen/„warm halten" statt Supermarkt-Lagergang) — wo echte Daten fehlen, weglassen statt erfinden.
Kurz: Optik = Drive-Design 1:1, Inhalt = Restaurant-Food, Anbindung = echte Mise-Platform (Uber-Prinzip).

---

# Fahrer-App Punch-Liste (für Spezialisten + CEO-Kontrolle)

## Design (Drive-Handoff, Wald-Theme). Referenz: /opt/mise/backoffice/docs/drive-design/ (README.md, screens/, source/)
Theme-Tokens in app/fahrer/layout.tsx: --accent #0F9C50, --bg #F2F4F2, --surface #fff, --ink/-2/-3, --line, --warn, --danger, .mono (JetBrains Mono).
Dateien: app/fahrer/app/client.tsx, delivery-view.tsx, pick-dialog.tsx, login/page.tsx

D1 Mono-Font: ALLE Zahlen (Preise, Codes #A-xxxx, Timer, %, Mengen, km, €) -> class "mono". Aktuell tabular-nums/font-display. ~26 tabular-nums Stellen.
D2 Avatare: Order-/Stop-Karten brauchen Initialen-Kreis (accent-tint BG, accent Text) statt nur Nummer. Siehe source/ui.jsx Avatar.
D3 Countdown-Ring: Incoming-Popup braucht 52px SVG-Ring (15s countdown, mono-Zahl mittig, accent-Stroke). Fehlt komplett.
D4 Bottom-Sheet: Incoming-Popup als echtes Bottom-Sheet (von unten, rounded-t-[30px], Grabber-Handle, dim backdrop) statt Inline-Overlay.
D5 Ablehnen-Button: Incoming-Popup-Footer braucht "Ablehnen" (secondary) + "Annehmen" (primary). Aktuell nur Annehmen.
D6 Button-Politur: Primary-Buttons rounded-[17px] + shadow-[0_6px_18px_-8px_var(--accent)], font-display raus (Hanken erbt). Login-Felder h-[60px].
D7 Reste-Farben: letzte amber-400/200/100, red-500 etc. -> --warn/--danger Tokens.

## Funktion. Dateien: lib/frank.ts, app/fahrer/app/client.tsx, delivery-view.tsx, app/api/driver/v1/
F1 Route-Popup: nach komplettem Pickup Bottom-Sheet "Alles abgeholt. Beste Route fertig · N Stopps · km" -> "Losfahren". Backend-Reroute (picked-up/route.ts) ist OK, nur UI-Sheet fehlt.
F2 Kunde-nicht-gefunden: Anrufen -> Warte-Timer -> eskalieren. Endpoint /api/driver/v1/orders/[id]/issue (cant_find_customer) existiert, UI fehlt.
F3 Ablehnen (Decline): Incoming -> Ablehnen -> Re-Dispatch an naechsten. Fehlt im /fahrer-Flow.
F4 (RISKANT, nur mit CEO-Freigabe) Frank-Einzelannahme: frank.ts:191-212 buendelt VOR Annahme. Soll: jede Order einzeln als pending_acceptance, beim Annehmen in aktiven Batch mergen (neues RPC merge_mise_order_into_active_batch).

## Deploy: bash /opt/mise/auto-deploy.sh (Zero-Downtime Blue-Green 3300<->3310, Healthcheck, Auto-Rollback). NIE docker rm direkt.
## Test-Login: Zugang ausschließlich über `MISE_TEST_DRIVER_EMAIL` und `MISE_TEST_DRIVER_PASSWORD` aus der lokalen, nicht eingecheckten Umgebung auf https://mise-gastro.de/fahrer/login
## Test-Order anlegen: siehe frühere Muster (customer_orders typ=lieferung status=fertig tenant 0318b8f1 location 3e00a63f), dann dispatch-tick. Adib mise_drivers.id=aa00482a auf state=idle setzen.
