# Neo + Mise OS: verbindliche Fusion

## Zielbild

Neo ist der einzige Einstieg für die Betriebsleitung. Die fertigen operativen
Module bleiben fachlich in Mise OS und werden aus Neo ohne zweiten Login
geöffnet. Es gibt keine parallelen, unfertigen Kopien dieser Module mehr.

## Modulverantwortung

| Neo-Navigation | Mise-OS-Screen | Verantwortliches System |
| --- | --- | --- |
| Mitarbeiter & Bereiche | `bereiche` | Mise OS |
| Dienstplan | `dienstplan` | Mise OS |
| Lager | `lager` | Mise OS |
| Listen & Abläufe | `builder` | Mise OS |
| Schulungen | `schulung` | Mise OS |
| Team & Compliance | `compliance` | Mise OS |
| Rezeptbuch | `rezeptbuch` | Mise OS |
| Mise-OS-Dashboard | `dashboard` | Mise OS |

Lieferzentrale, Tischbestellung, POS und die übrige Geschäftsverwaltung
bleiben in Neo. Ihre alten Mise-OS-Varianten werden im integrierten Modus nicht
angezeigt.

## Anmeldung und Mandantentrennung

1. Neo prüft die Supabase-Sitzung serverseitig und erlaubt den Betriebsbereich
   nur für `manager`, `backoffice` und `admin`.
2. Neo liest Betrieb und Mitarbeiter ausschließlich aus der verifizierten
   Sitzung. Browserwerte können diese IDs nicht überschreiben.
3. Neo sendet Betriebs-ID, Betriebs-Slug, Mitarbeiter-ID, Name, E-Mail und Rolle
   serverseitig an Mise OS.
4. Mise OS verknüpft den Betrieb dauerhaft über `neoTenantId`. Beim ersten
   Aufruf kann ein bereits vorhandener Mise-OS-Tenant mit demselben Slug
   übernommen werden, damit seine operativen Daten erhalten bleiben.
5. Mitarbeiter werden innerhalb dieses Betriebs zuerst über `neoEmployeeId`
   und erst danach über ihre E-Mail gefunden. Identische E-Mails in zwei
   Betrieben bleiben dadurch strikt getrennt.
6. Das kurzlebige Mise-OS-JWT wird im URL-Fragment übergeben; URL-Fragmente
   werden nicht an Webserver oder externe Ziele gesendet.

## Produktionskonfiguration

Neo:

```dotenv
MISE_OS_SSO_SECRET=<gemeinsames-zufaelliges-secret-mindestens-16-zeichen>
MISE_OS_APP_URL=https://mise-os-theta.vercel.app
MISE_OS_API_URL=https://mise-os-theta.vercel.app/api/v1
```

Mise-OS-Backend:

```dotenv
SSO_SECRET=<identisch-zu-MISE_OS_SSO_SECRET>
CORS_ORIGINS=https://mise-os-theta.vercel.app,https://mise-gastro.de
```

Das gemeinsame Secret darf nie als `NEXT_PUBLIC_*` oder `VITE_*` konfiguriert
werden. In Produktion verweigert das Mise-OS-Backend den Start, wenn es fehlt
oder zu kurz ist.

## Abnahmekriterien

- Ein Manager öffnet jedes oben genannte Modul aus Neo ohne zweiten Login.
- Der angeforderte Mise-OS-Screen ist nach dem SSO direkt aktiv.
- Der Zurück-Link führt wieder zu `/neo`.
- Ein Mitarbeiter ohne Leitungsrolle erhält keinen SSO-Token.
- Gleiche E-Mail-Adressen in unterschiedlichen Betrieben sehen nie dieselben
  Mise-OS-Daten.
- Bestehende URLs unter `/neo/app/mitarbeiter`, `/dienstplan` und `/lager`
  leiten auf die jeweilige Mise-OS-Integration weiter.
