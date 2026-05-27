import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';

export default function LegalDocsPage() {
  return (
    <>
      <PageHeader title="Rechtskonformität (DE 2026)" description="KassenSichV, GoBD, DSFinV-K, § 146a AO — alles erklärt." backHref="/help" />

      <div className="max-w-3xl prose prose-sm prose-headings:font-display prose-headings:font-black prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-h3:mt-6">

<h2>1. Was das Finanzamt von dir verlangt</h2>

<p>Als Restaurant-Betreiber in Deutschland musst du:</p>
<ol>
<li>Eine <strong>TSE</strong> nutzen (Technische Sicherheitseinrichtung, BSI-zertifiziert)</li>
<li>Deine Kasse beim <strong>Finanzamt melden</strong> innerhalb 1 Monats (§ 146a Abs. 4 AO)</li>
<li>Für <strong>jede Bestellung einen Beleg</strong> ausgeben (digital oder Papier)</li>
<li>Alle Buchungen <strong>unveränderbar 10 Jahre</strong> aufbewahren (§ 147 AO)</li>
<li>Bei Kassen-Nachschau sofort einen <strong>DSFinV-K-Export</strong> liefern können</li>
</ol>

<p>Mise deckt das alles ab — aber du musst einmalig einrichten.</p>

<h2>2. TSE einrichten (fiskaly)</h2>

<h3>2.1 fiskaly-Account</h3>
<ol>
<li>Auf <a href="https://dashboard.fiskaly.com/" target="_blank" rel="noreferrer">dashboard.fiskaly.com</a> registrieren</li>
<li>API-Key + Secret erzeugen</li>
<li>Bei Mise: <Link href="/settings/tse">/settings/tse</Link> → Keys eintragen</li>
<li>„TSS einrichten" klicken → TSS + Client werden automatisch angelegt</li>
<li>Kosten: ~12 €/Monat pro Kasse</li>
</ol>

<p>Ab jetzt wird jede Bestellung automatisch TSE-signiert. Du musst nichts mehr tun.</p>

<h3>2.2 Sandbox vs. Live</h3>
<p>In <Link href="/settings/tse">/settings/tse</Link> kannst du zwischen „Sandbox" (kostenlos, zum Testen) und „Live" umschalten. Live braucht bezahlten fiskaly-Vertrag.</p>

<h2>3. Kasse beim Finanzamt melden (§ 146a Abs. 4)</h2>

<p>Seit 2025 musst du jede neue Kasse innerhalb 1 Monats beim Finanzamt melden (über ELSTER).</p>

<h3>3.1 Meldepaket holen</h3>
<ol>
<li><Link href="/settings/legal">/settings/legal</Link> → „Meldepaket-XML holen"</li>
<li>XML-Datei wird heruntergeladen</li>
<li>Auf <a href="https://www.elster.de/" target="_blank" rel="noreferrer">elster.de</a> → „Mitteilung nach § 146a Abs. 4 AO" → XML hochladen</li>
<li>Absenden</li>
</ol>

<p><em>Wichtig: Bei jeder neuen Kasse + bei Außerbetriebnahme einer Kasse erneut melden. Bruttomethode: immer ALLE Geräte der Betriebsstätte mitschicken.</em></p>

<h2>4. Bon / Belegausgabepflicht</h2>

<p>Jede Bestellung muss einen Beleg produzieren. Mise generiert den automatisch:</p>
<ul>
<li>Sofort nach Zahlung: QR-Code auf dem Kassen-Display</li>
<li>Kunde scannt mit Handy-Kamera → Bon-Seite öffnet sich → Download als PDF</li>
<li>Alternativ: Bon per E-Mail verschicken</li>
<li>Oder: Thermodrucker anschließen (ESC/POS-kompatibel)</li>
</ul>

<h3>4.1 Pflichtangaben auf dem Bon</h3>
<p>Mise füllt alle Pflichtfelder nach § 14 UStG / KassenSichV automatisch:</p>
<ul>
<li>Name, Adresse, Steuernummer / USt-ID</li>
<li>Datum + Uhrzeit</li>
<li>Art und Menge der Leistung</li>
<li>Entgelt aufgeschlüsselt nach Steuersatz (7% / 19%)</li>
<li>TSE-Daten: Seriennummer, Transaktions-Nr, Signaturzähler, Start+Ende-Zeit, Signatur</li>
<li>QR-Code mit DSFinV-K-konformem Inhalt</li>
</ul>

<h3>4.2 Bewirtungsbeleg</h3>
<p>Wenn Kunde den Bon für seine Steuer braucht (§ 4 Abs. 5 EStG): Auf der Bon-Seite „Bewirtungsbeleg"-Button → Anlass + Teilnehmer eingeben → Bon wird um Bewirtungs-Abschnitt ergänzt.</p>

<h2>5. Storno — GoBD-konform</h2>

<p>In Mise kannst du einen Beleg nicht löschen, nur <strong>stornieren</strong> (= neue Gegenbuchung).</p>

<h3>5.1 Storno-Flow</h3>
<ol>
<li>POS-Terminal → „📜 Historie · Storno"</li>
<li>Beleg auswählen → „Stornieren"</li>
<li>Grund wählen (Fehlbuchung, Reklamation, etc.) — <strong>Pflicht</strong></li>
<li>Ab 20 € Betrag: Manager-PIN eingeben</li>
<li>Mise erzeugt eine TSE-signierte Gegenbuchung</li>
</ol>

<h3>5.2 Teilstorno</h3>
<p>Nur einzelne Positionen stornieren: Dialog-Toggle „Einzelne Positionen" → mit Mengen-Stepper.</p>

<h2>6. DSFinV-K-Export (bei Kassen-Nachschau)</h2>

<p>Wenn ein Finanzbeamter vor der Tür steht:</p>

<h3>6.1 ZIP-Export holen</h3>
<ol>
<li><Link href="/settings/legal">/settings/legal</Link> → „DSFinV-K Export"</li>
<li>Zeitraum wählen (z. B. laufendes Jahr)</li>
<li>„ZIP erstellen" → Download mit 20 CSVs + index.xml + DTD</li>
<li>Auf USB-Stick kopieren → Beamten geben</li>
</ol>

<h3>6.2 Kassen-Nachschau-Modus</h3>
<p>Alternativ: dem Beamten einen Read-Only-Zugang geben:</p>
<ol>
<li><Link href="/settings/kassenpruefung">/settings/kassenpruefung</Link> → „Neuer Nachschau-Zugang"</li>
<li>Prüfer-Name + Gültigkeit (1–24 h) → Token-Link erscheint</li>
<li>Link zeigen / auf Prüfer-Gerät öffnen</li>
<li>Beamter sieht Read-Only: Transaktionen, Z-Berichte, TSE-Status, Ausfall-Log, kann exportieren</li>
</ol>

<h2>7. 10-Jahre-Aufbewahrung (§ 147 AO)</h2>

<p>Mise macht 3 Schichten Backup:</p>

<ol>
<li><strong>Append-only-DB</strong>: Buchungen können nie überschrieben werden (DB-Trigger blockiert UPDATE/DELETE)</li>
<li><strong>Supabase PITR</strong>: 7 Tage Point-in-Time-Recovery</li>
<li><strong>WORM-Backup auf S3</strong>: monatliche Voll-Sicherung mit Object Lock (Compliance-Mode, 10 Jahre unveränderbar)</li>
</ol>

<p>Setup: <Link href="/settings/legal">/settings/legal</Link> → Anleitung in <code>WORM_BACKUP_SETUP.md</code> im Projekt.</p>

<h2>8. Verfahrensdokumentation</h2>

<p>GoBD verlangt eine Verfahrensdokumentation. Mise generiert den System-Teil automatisch:</p>
<ol>
<li><Link href="/settings/legal">/settings/legal</Link> → „Verfahrensdokumentation ansehen + drucken"</li>
<li>Drucken / PDF speichern</li>
<li>Manuell ergänzen: wer darf was, Öffnungszeiten, Personal-Zuordnung</li>
<li>Im Ordner beim Steuerberater ablegen</li>
</ol>

<h2>9. Training-Buchungen</h2>

<p>Wichtig: Trainingsbons <strong>nie</strong> mit Echtbuchungen vermischen!</p>

<p>Im Terminal oben: 🎓-Button aktivieren → alle Buchungen werden als „Trainingsbon" markiert.
Im DSFinV-K-Export werden sie mit <code>BON_NAME=Trainingsbon</code> ausgegeben.</p>

<h2>10. Was kostet dich der ganze Spaß?</h2>

<table>
<thead><tr><th>Posten</th><th>Kosten</th></tr></thead>
<tbody>
<tr><td>fiskaly TSE (pro Kasse)</td><td>~12 €/Monat</td></tr>
<tr><td>AWS S3 (WORM-Backup)</td><td>~0,30 €/Monat (kleines Restaurant)</td></tr>
<tr><td>Mise POS-Modul</td><td>siehe <Link href="/modules">/modules</Link></td></tr>
<tr><td>Stripe-Gebühren (Apple/Google Pay)</td><td>1,4% + 0,25 € pro Transaktion</td></tr>
<tr><td>SumUp Kartenlesegerät</td><td>~50 € einmalig + 1,49% pro Zahlung</td></tr>
<tr><td>Steuerberater (einmalig für Verfahrensdoku-Check)</td><td>~100 € einmalig</td></tr>
</tbody>
</table>

<h2>11. Häufige Fallen</h2>

<ul>
<li><strong>Trainingsbons im Echtbetrieb:</strong> Führt zur Verwerfung der Kassenführung</li>
<li><strong>Kein täglicher Z-Bericht:</strong> Mise macht das automatisch nachts — aber dein Kellner muss zumindest bei Schichtende abschließen</li>
<li><strong>Fehlende Verfahrensdoku:</strong> Pflicht, bei Prüfung unbedingt vorzeigen können</li>
<li><strong>Stornos ohne Grund:</strong> Verboten — Mise macht Grund immer zur Pflicht</li>
<li><strong>Nicht gemeldete Kasse:</strong> 25.000 € Bußgeld! § 146a Meldung nicht vergessen</li>
</ul>

<h2>12. Im Ernstfall: Betriebsprüfung</h2>

<ol>
<li>Ruhe bewahren — dein System ist konform</li>
<li>DSFinV-K-Export für Prüfzeitraum → USB-Stick</li>
<li>Verfahrensdokumentation ausdrucken</li>
<li>Falls gewünscht: Kassen-Nachschau-Modus aktivieren</li>
<li>Steuerberater dabei haben</li>
</ol>

<p><em>Mise ist so gebaut, dass du bei einer Prüfung nichts improvisieren musst — alles ist einen Klick entfernt.</em></p>

      </div>
    </>
  );
}
