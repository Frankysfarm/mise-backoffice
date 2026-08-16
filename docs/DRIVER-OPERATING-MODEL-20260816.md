# Mise Fahrer — belastbares Betriebsmodell

Stand: 16. August 2026

## Leitentscheidung

Der Login bleibt auf dem Gerät erhalten. Um Mitternacht wird nicht die Identität
des Fahrers abgemeldet, sondern seine **operative Dispatch-Schicht** beendet.
Das verhindert morgendliche Passwort-/OTP-Reibung und zugleich versehentliche
Zuweisungen an Fahrer vom Vortag.

- Standard-Cutoff: 00:00 Uhr Europe/Berlin
- Im Backoffice pro Standort als Uhrzeit konfigurierbar
- Zusätzliche harte Session-Grenze: standardmäßig 16 Stunden
- Eine bereits abgeholte Tour darf nach dem Cutoff sicher beendet werden
- Nach dem Cutoff gibt es keine neue Zuweisung; ohne aktive Tour schließt der Cron
  Schicht, Online-Projektion und Fahrerstatus gemeinsam

## Nicht verhandelbare Systeminvarianten

1. Eine Bestellung kann atomar nur genau einen aktiven Batch gewinnen.
2. Ein Fahrer mit Ware in seiner Obhut wird nie automatisch umdisponiert.
3. Ein abgelehnter Fahrer-Claim blockiert keinen nachrangigen freien Fahrer.
4. Eine Bar-Lieferung wird nur über die bewusste Wischbestätigung abgeschlossen.
5. Push ist ein Hinweis; die Tour im Server bleibt die einzige Wahrheit.
6. Hintergrund-GPS hält die Schicht am Leben, gilt aber nicht als sichtbarer
   Vordergrund und darf daher keinen Benachrichtigungs-Push unterdrücken.
7. GPS-Ereignisse sind idempotent, zeitlich monoton und für App-Rollen nicht
   direkt les- oder schreibbar.
8. Ein stop- und bestellungsloser Crash-Batch wird nach Schonfrist bereinigt;
   verknüpfte Kundenbestellungen werden dabei niemals blind verändert.

## Push- und Offline-Modell

- Standard-APNs mit Alert, Custom Sound, kurzer APNs-Gültigkeit und Collapse-ID
- Sichtbare Touren werden beim Versand nochmals gegen Fahrer und Batch geprüft
- Native Offer-Events lösen in der WebView ein autoritatives Server-Refresh aus
- Polling bleibt als Vordergrund-Fallback bestehen
- Native GPS-Punkte werden offline verschlüsselt gepuffert, begrenzt und in
  zeitlicher Reihenfolge erneut gesendet
- `last_active_at` beweist eine lebende App; `last_foreground_at` beweist eine
  gerade sichtbare App. Nur Letzteres darf einen sichtbaren Push überspringen.

## QR-Empfehlung

QR sollte ein optionaler **Anwesenheits- und Übergabenachweis** sein, nicht ein
zweiter Login und niemals ein unkontrollierter Zuweisungsweg.

Empfohlener Ablauf:

1. Das Backoffice zeigt am Standort einen rotierenden, signierten QR-Code mit
   30–60 Sekunden Gültigkeit.
2. Ein bereits authentifizierter Fahrer scannt ihn beim Eintreffen.
3. Der Scan startet/bestätigt die Schicht und schreibt Standort, Fahrer, Zeit,
   Token-ID und Gerät in ein unveränderliches Audit-Ereignis.
4. Ein optionaler zweiter Scan am Abholregal bestätigt nur die physische
   Übernahme des bereits zugewiesenen Batches.
5. QR allein darf weder fremde Touren übernehmen noch „geliefert“ buchen.

So ist QR schnell und verständlich, ohne die Dispatch- und Custody-Sicherheit zu
schwächen. Die Funktion sollte nach dem gehärteten Kern als eigenes Release mit
Replay-Schutz, Geräteverlust- und Offline-Tests folgen.

## Nächste Leistungshebel

1. **Kitchen-ready Dispatch:** Fahrer erst so losschicken, dass Abholzeit und
   Fertigstellung zusammenfallen; weniger Wartezeit am Restaurant.
2. **Richtungs-Bundles:** Nur Ziele entlang eines gemeinsamen Korridors bündeln;
   gemessene reale Fahrzeit nach jeder Tour zurück in das Scoring speisen.
3. **Push-ACK-SLA:** Alarm, wenn ein Angebot nach 30/60 Sekunden weder zugestellt
   noch gesehen wurde; dann kontrolliert an den nächsten Fahrer geben.
4. **Load/Fairness:** Neben Distanz auch letzte Zuweisung, Tageslast, Fahrzeug,
   Kapazität und erwartete Rückkehrzeit berücksichtigen.
5. **Fahrer-UX:** Immer genau eine nächste sichere Hauptaktion, große Touch-Ziele,
   keine versteckten Pflichtschritte und klare Offline-/GPS-/Push-Diagnose.
6. **Kunden-UX:** Enges Live-ETA-Fenster, nachvollziehbarer Status, sichere
   Kontaktoption und klarer Barzahlungs-/Übergabenachweis.

## Release-Gates

Vor jeder Freigabe müssen Delivery-Typecheck, kompletter Delivery-Testlauf,
Produktions-Build, transaktionaler SQL-Vertrag, APNs-Konfiguration, reale
Dispatch-/Pickup-/Delivery-E2E-Fälle sowie der exakt gebaute TestFlight-Build
grün sein. Der GitHub-Workflow gibt nur die eigene `CFBundleVersion` frei und
darf nie still auf einen älteren „neuesten“ Build zurückfallen.
