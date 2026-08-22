# Anweisung für Claude Code — Drive Fahrer-App übernehmen

> **So nutzt du dieses Paket:** Lege den gesamten Ordner in dein Repo (z.B. `design/drive-handoff/`).
> Kopiere dann den **Prompt unten** in Claude Code. Er verweist auf `README.md` (volle Spezifikation),
> `source/` (Referenz-Code) und `screenshots/` (Soll-Optik).

---

## 📋 Prompt zum Reinkopieren (an Claude Code)

```
Du baust die Fahrer-App „Drive" (Food-Delivery, iPhone-first, deutsche UI) in unser bestehendes
Projekt ein. Im Ordner design/drive-handoff/ liegt das vollständige Design-Handoff:

- README.md      → die verbindliche Spezifikation (Farben/Tokens, Typo, Spacing, alle Screens,
                   State-Machine, Datenmodell, Verhalten). LIES SIE ZUERST KOMPLETT.
- source/        → interaktiver Referenz-Prototyp (HTML/React). Das ist die Quelle der Wahrheit
                   für Optik & Verhalten — NICHT 1:1 kopieren, sondern in unserem Stack nachbauen.
- screenshots/   → die Soll-Optik jedes Screens (grüne Standard-Farbwelt „Wald").

ARBEITSWEISE
1. Lies README.md vollständig und sieh dir alle screenshots/ an, bevor du Code schreibst.
2. Nutze UNSERE bestehenden Patterns: Komponenten-Bibliothek, Navigation, State-Management,
   Theming und Icon-Set. Erfinde nichts Neues, wo wir schon etwas haben.
3. Übernimm die Design-Tokens aus der README in unser Theme-System (siehe „Einstellungen" unten).
4. Ersetze die stilisierte SVG-Karte durch unser echtes Karten-SDK (MapKit/Google Maps/Mapbox),
   aber behalte das Marker-Styling: nummerierte Pins, aktiver Pin pulsiert, erledigte ausgegraut,
   Route in Akzentfarbe.
5. Verdrahte die mit „// Actions to wire" markierten Stellen mit unseren echten Endpunkten
   (siehe „Data Requirements" in der README).

KERN-ABLAUF (wichtig, bitte exakt so umsetzen)
- Login → online gehen.
- Bestellungen kommen EINZELN rein (eine nach der anderen), nicht als Batch — und sie können
  JEDERZEIT kommen, AUCH während man schon auf Tour ist. Pro Bestellung „Annehmen"/„Ablehnen"
  mit 15-Sekunden-Countdown.
- Wenn eine Bestellung reinkommt, VIBRIERT das Handy — auch wenn die App minimiert/im
  Hintergrund ist (siehe „Benachrichtigungen" unten).
- Angenommene Bestellung landet in der Liste und muss „in die Tüte" kontrolliert werden:
  Bestellung öffnen → jedes Gericht antippen → „In die Tüte gelegt" bestätigen.
  KEIN Lagerplatz, KEIN Barcode-Scan, KEINE Kühlkette — es ist fertiges Essen.
- Erst wenn ALLE angenommenen Bestellungen vollständig in der Tüte sind UND keine weitere
  Bestellung mehr unterwegs ist, wird „Route berechnen" aktiv.
- Danach: Karte mit optimierter Route; pro Stopp „Bestellung geliefert", „Kunde nicht gefunden?"
  (mit Optionen) und „Anrufen" (Anruf-Overlay). Zum Schluss „Tour abschließen" → Zusammenfassung.
- Kommt während der Tour eine neue Bestellung rein und man nimmt sie an („Zur Route"), wird sie
  als zusätzlicher Stopp ans Ende der Route gehängt (Tour-Zähler z.B. 1/3 → 1/4).

BENACHRICHTIGUNGEN / HAPTIK (bitte echt umsetzen)
- Neue Bestellung → Handy vibriert. Im Vordergrund über die Haptik-API des Geräts.
- WICHTIG: auch bei minimierter/geschlossener App muss der Fahrer es mitbekommen — dafür
  Push-Notifications (APNs auf iOS / FCM auf Android) mit Ton + Haptik (ggf. „Critical Alert"),
  die die App wecken und die „Neue Bestellung"-Sheet öffnen. (Die Web-Vibration im Prototyp
  läuft nur im Vordergrund — sie ist nur Platzhalter für das echte Push-Verhalten.)

EINSTELLUNGEN / SETTINGS (bitte als echte App-Einstellungen umsetzen)
- Farbwelt („Theme"): 4 Optionen — Wald (grün, STANDARD), Mitternacht (dark), Sonne (orange),
  Elektrik (blau). Alle Token-Werte stehen in der README. Auswahl pro Nutzer persistieren.
  Mitternacht ist ein echtes Dark-Theme (auch Statusleiste/Karte dunkel).
- Karten-Animation: An/Aus-Schalter für die animierte Route-Linie (Standard: AN). Wenn der Nutzer
  „Bewegung reduzieren" aktiviert hat, Animation respektieren/abschalten.
- Benachrichtigung neue Bestellung: Vibration (Vordergrund) + Push (Hintergrund), Standard AN.
- (Im Prototyp sind Farbwelt & Karten-Animation als „Tweaks"-Panel umgesetzt — bei uns gehören
  diese Einstellungen in einen Einstellungen-Screen bzw. unsere Settings-Struktur.)

QUALITÄT
- Deutsche Texte exakt wie in der README/den Screenshots übernehmen.
- Mindest-Touch-Target 44px. Safe-Area-Insets des echten Geräts nutzen (im Prototyp fest 54/30px).
- Schriften: Hanken Grotesk (UI) + JetBrains Mono (Zahlen/Codes/Timer) — oder unsere Marken-Fonts.
- Reduced-Motion respektieren: Endzustände immer sichtbar.

Frag mich, wenn etwas im Datenmodell oder bei den Endpunkten unklar ist, bevor du Annahmen triffst.
```

---

## ⚙️ Einstellungen auf einen Blick (Details in README → „Design Tokens" & „State Management")

| Einstellung | Optionen | Standard | Hinweis |
|---|---|---|---|
| **Farbwelt** | Wald · Mitternacht · Sonne · Elektrik | **Wald** | komplette Token-Tabellen in der README |
| **Karten-Animation** | An / Aus | **An** | animierte Route-Linie; Reduced-Motion respektieren |
| **Benachrichtigung neue Bestellung** | Vibration + Push | **An** | Hintergrund: APNs/FCM mit Ton + Haptik |

Alle Werte sind **nutzerspezifisch zu speichern** (persistieren).

## 🔑 Kernpunkte, die oft übersehen werden
- Bestellungen kommen **einzeln** rein — nie als Batch.
- Bestellungen kommen **auch während der laufenden Tour** rein → angenommene Tour-Bestellung wird
  ein zusätzlicher Stopp.
- **Vibration/Push** bei jeder neuen Bestellung, auch bei minimierter App.
- Picken = Essen **in die Tüte kontrollieren** (kein Lager/Barcode/Kühlung).
- „Route berechnen" erst, wenn **alles** in der Tüte ist **und** nichts mehr unterwegs.

## 🗂 Paketinhalt
- `README.md` — vollständige Spezifikation
- `source/` — Referenz-Prototyp (HTML/React)
- `screenshots/` — Soll-Optik je Screen (inkl. „Bestellung während Tour")
- `CLAUDE_CODE_PROMPT.md` — diese Datei
