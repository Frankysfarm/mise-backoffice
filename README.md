# Backoffice

Admin-Dashboard für die Restaurant-Operations-Platform. Läuft neben `mobile/` (Mitarbeiter-App) und `app/` (Auth-Landing) auf derselben Supabase-Instanz.

Root-Projekt: siehe `../README.md` für Setup der DB und der Edge Functions.

## Dev

```bash
# 1x pro Shell — Supabase lokal muss bereits laufen
cd ..
npx supabase status  # URL/Keys notieren

# Backoffice
cd backoffice
pnpm install
cp .env.local.example .env.local
# Keys aus `supabase status` eintragen
pnpm dev
# → http://127.0.0.1:3200
```

## Test-Login

Ein Admin-Account ist für die lokale DB verdrahtet:

| E-Mail | Passwort |
|---|---|
| `admin@matcha.test` | `matcha123` |

Verknüpft mit Employee `P100 Alex Admin` (Rolle: `admin`).

Weitere Test-Accounts anlegen:
```bash
# Service-Role-Key aus supabase status
curl -X POST http://127.0.0.1:54321/auth/v1/admin/users \
  -H "Authorization: Bearer <service-role-key>" \
  -H "apikey: <service-role-key>" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@matcha.test","password":"matcha123","email_confirm":true}'

# Dann Employee verknüpfen via psql:
docker exec supabase_db_projekt-frankys-backend psql -U postgres -c \
  "update employees set auth_user_id='<user-id>' where email='mira.m@frankys.test';"
```

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

Build erzeugt alle 28 Routes als dynamisch-gerendert (außer `/login` als statisch). Middleware läuft edge-mode für Auth-Gate.

## Edge Functions nutzen

Die Backoffice-App ruft Supabase Edge Functions via fetch auf (z. B. `order-list-mail` im Orders-Flow). Für lokale Tests braucht der Supabase-Functions-Server zusätzlich:

```bash
cd ..
npx supabase functions serve --env-file supabase/functions/.env
```

## Nächste Schritte (Priorisierung)

1. **Schedule DnD** (dnd-kit + ArbZG-Validator) — größter UX-Gewinn
2. **Photo-Gallerien** für Check-ups/Cleaning (Storage-URLs signieren)
3. **Notification Rules Editor** + DB-Tabelle `notification_rules`
4. **PDF-Schichtplan** für Aushang
5. **Realtime Channels** für Dashboard + Schedule

## Troubleshooting

**500 bei Seitenaufruf** — meistens PostgREST-FK-Ambiguity. Im Terminal der `pnpm dev` suchen nach `more than one relationship was found`. Fix: explizit `employee:employees!<fk_name>(...)` in der Query.

**Middleware-Redirect-Loop** — `employees.auth_user_id` ist nicht gesetzt oder `rolle` ist nicht in `manager/backoffice/admin`. Via psql prüfen.

**Cookies werden nicht gesetzt** — `.env.local` prüfen, muss Anon-Key enthalten.
