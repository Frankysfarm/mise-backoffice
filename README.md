# Mise Gastro Backoffice und Lieferzentrale

Admin-Dashboard und Lieferplattform für Restaurantbetrieb, Küche, Dispatch,
Fahrer-App, Kundenbestellung und Tracking. Alle Module verwenden dieselbe
mandantenfähige Supabase-Instanz.

Root-Projekt: siehe `../README.md` für Setup der DB und der Edge Functions.

## Dev

```bash
# 1x pro Shell — Supabase lokal muss bereits laufen
cd ..
npx supabase status  # URL/Keys notieren

# Backoffice
cd backoffice
pnpm install
cp .env.example .env.local
# Keys aus `supabase status` eintragen
pnpm dev
# → http://127.0.0.1:3200
```

## Test-Zugänge

Test-Zugänge werden ausschließlich über die lokale, nicht eingecheckte Umgebung
konfiguriert. Für Fahrer-Tests sind dies `MISE_TEST_DRIVER_EMAIL` und
`MISE_TEST_DRIVER_PASSWORD`. Service-Role-Schlüssel oder Passwörter gehören
nicht in Quellcode, Dokumentation oder Commits.

## Rollen-Gate

Middleware (`middleware.ts`) erzwingt:
- Eingeloggt
- Employee-Eintrag mit `rolle` in `['manager', 'backoffice', 'admin']`

Feingranular per Seite:
- `requireManagerPlus()` — Default für die meisten Seiten
- `requireAdmin()` — für `/settings`, `/locations`, `/departments`, `/badges`, `/employees/new`

## Struktur

```
app/
  (auth)          login, /auth/callback, /auth/signout
  (admin)         alle Admin-Seiten mit Sidebar-Layout
    page.tsx      Landing-Hub mit Tiles
    dashboard     Live-KPIs, Stempel-Feed
    employees     CRUD + Detail mit 5 Tabs
    schedule      Wochenansicht, Schicht-Dialog, Tauschanfragen
    training      Module mit JSON-Editor
    checkups      Templates + heutige Sessions
    cleaning      Zonen + Completions-Feed
    shift-guides  Leitfäden mit Versioning
    inventory     Bereiche + Produkte (+ /sessions, /orders)
    recipes       CRUD mit Allergenen
    equipment     Wartung + Logs
    cash          Tagesabschlüsse
    documents     Ablauf-Ampel
    locations     GPS + Geofence
    departments   Farben + Standort
    badges        Regel-JSON
    notifications Feed
    settings      Systemübersicht + Admin-Links
  api/delivery    Lieferlogik, Dispatch, Reporting und Admin-Endpunkte
  api/driver/v1   Fahrer-Authentifizierung, Touren, Pickup und Zustellung
  fahrer          Fahrer-Einstieg, Login und operative Fahrer-App
  lieferdienst    Lieferzentrale
  order           Kundenbestellung
  track           Live-Tracking
components/
  ui/             Radix-Primitives (Button, Card, Table, Dialog, Toast, ...)
  layout/         Sidebar, Header, PageHeader
  role-badge.tsx  Einheitliche Rollen-/Status-Badges
lib/
  supabase/       {server,client,middleware}.ts
  auth/           getCurrentEmployee, requireRole
  utils.ts        cn, euro, dateDE, dateTimeDE
```

## Brand-Tokens

Matcha Noir aus `../mobile/constants/colors.ts` portiert als:
- Tailwind-Farbpalette `matcha.50–900`, `gold`, `surface`, `surface.warm`
- shadcn-CSS-Variablen in `app/globals.css` (light + dark)
- Fonts: Space Grotesk (display), DM Sans (body), JetBrains Mono (mono) via `next/font/google`

## Bekannte Einschränkungen

- **Drag-and-Drop im Schedule** fehlt — aktuell Dialog-basiert. dnd-kit-Integration in separater Session.
- **WYSIWYG-Editor** fehlt für Training/Shift-Guides/Recipes — JSON-Textarea reicht für Backoffice-Pflege, für späte Phase TipTap-Upgrade geplant.
- **Foto-Galerien** für Check-up- und Cleaning-Completions fehlen (Storage-URLs werden noch nicht gerendert).
- **PDF-Export** (Schichtplan, HACCP-Logs) fehlt — `@react-pdf/renderer` integrieren.
- **ArbZG-Validator** im Schicht-Dialog fehlt (11h Ruhezeit, Max-Stunden). Datenbasis ist da.
- **Realtime**: Seiten aktualisieren sich nur per Refresh, nicht live.
- **Notification Rules Editor**: `/notifications` ist nur Feed, kein Rules-Editor. Rules sind aktuell in Edge-Functions hardcoded.

## Production Build

```bash
pnpm build
pnpm start   # Port 3200
```

Der geprüfte Release-Stand erzeugt 212 Seiten. Middleware und Handler erzwingen
Rollen-, Mandanten- und Standortgrenzen; standortbezogene Health-Daten sind
nicht öffentlich.

## Qualitäts-Gates

```bash
pnpm test                    # Vitest: Logik, Security und Storefront
pnpm typecheck:delivery      # fokussierter Delivery-Typecheck
pnpm exec playwright test    # Desktop- und Mobile-Smoke-Tests
pnpm build                   # vollständiger Release-Gate inkl. Typecheck
```

Der kritische Lieferstatus folgt einer serverseitig geprüften Zustandsmaschine:
`neu → bestätigt → in_zubereitung → fertig → unterwegs → geliefert`.
Abholung und Stornierung besitzen eigene erlaubte Übergänge; ungültige Sprünge
werden mit HTTP 409 abgewiesen.

## Edge Functions nutzen

Die Backoffice-App ruft Supabase Edge Functions via fetch auf (z. B. `order-list-mail` im Orders-Flow). Für lokale Tests braucht der Supabase-Functions-Server zusätzlich:

```bash
cd ..
npx supabase functions serve --env-file supabase/functions/.env
```

## Release-Ablauf

1. Unit-, Security-, Browser-Tests und Produktions-Build grün ausführen.
2. Einen markierten Testauftrag authentifiziert durch Küche, Dispatch, Fahrer
   und Zustellung führen; anschließend ausschließlich soft stornieren/archivieren.
3. Erst danach über den vorgesehenen Zero-Downtime-Prozess deployen und den
   Health-/Login-Smoke-Test gegen die Zielumgebung wiederholen.

## Troubleshooting

**500 bei Seitenaufruf** — meistens PostgREST-FK-Ambiguity. Im Terminal der `pnpm dev` suchen nach `more than one relationship was found`. Fix: explizit `employee:employees!<fk_name>(...)` in der Query.

**Middleware-Redirect-Loop** — `employees.auth_user_id` ist nicht gesetzt oder `rolle` ist nicht in `manager/backoffice/admin`. Via psql prüfen.

**Cookies werden nicht gesetzt** — `.env.local` prüfen, muss Anon-Key enthalten.
