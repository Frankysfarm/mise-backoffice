import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';

export default function POSDocsPage() {
  return (
    <>
      <PageHeader title="Kasse (POS) · Handbuch" description="Alles zum POS-Terminal, von Setup bis Finanzamt-Export." backHref="/help" />

      <div className="max-w-3xl prose prose-sm prose-headings:font-display prose-headings:font-black prose-h2:text-2xl prose-h2:mt-10 prose-h3:text-lg prose-h3:mt-6">

<h2>1. Kasse einrichten</h2>

<p>Jedes Tablet, das als Kasse dient, muss einmal <strong>gepairt</strong> werden. So geht's:</p>

<h3>1.1 Kasse im Backoffice anlegen</h3>
<ol>
<li>Im Backoffice auf <Link href="/pos/registers">Kassen / Terminals</Link></li>
<li>Klick <strong>„Erste Kasse anlegen"</strong> → Name eingeben („Theke", „Bar", etc.)</li>
<li>Klick <strong>„Tablet hinzufügen"</strong> → ein 6-stelliger Code erscheint</li>
</ol>

<h3>1.2 Auf dem Tablet einloggen</h3>
<ol>
<li>Browser öffnen → <code>https://deine-domain/pos/pair</code></li>
<li>Den 6-stelligen Code eingeben</li>
<li>Tablet leitet automatisch zum Terminal weiter und speichert den Zugang dauerhaft</li>
</ol>

<h2>2. Schicht starten & beenden</h2>
<p>Jede Kasse läuft in <strong>Schichten</strong> (mit Wechselgeld-Start und Z-Bericht-Ende).</p>

<h3>2.1 Start</h3>
<p>Beim Öffnen des Terminals: Wechselgeld-Betrag eingeben (z. B. 100 €) → „Schicht starten".</p>

<h3>2.2 Ausverkauft-Check</h3>
<p>Direkt danach fragt die Kasse: „Welche gestern ausverkauften Produkte sind heute wieder da?"
Je Produkt: ✓ Verfügbar + optional Stückzahl (zählt runter bei jeder Bestellung, Auto-Deaktivierung bei 0).</p>

<h3>2.3 Ende mit Z-Bericht</h3>
<ol>
<li>„🔚 Schicht beenden" oben</li>
<li>Kassenlade mit Stückel-Zähler zählen (500 € → 1 ct)</li>
<li>Live-Differenz wird angezeigt (grün/gelb/rot)</li>
<li>„Schließen + Z-Bericht erstellen" → GoBD-Snapshot, Daten nicht mehr änderbar</li>
</ol>

<h2>3. Bestellung aufnehmen</h2>

<h3>3.1 Tisch- oder Take-Away-Modus</h3>
<p>Nach Schicht-Start zeigt Mode-Selector:</p>
<ul>
<li><strong>Take-Away</strong> (7% MwSt, Abholung)</li>
<li><strong>Tisch wählen</strong> (Floor-Plan oder Liste, 19% MwSt Dine-In)</li>
<li><strong>„Zu kassieren"-Kacheln</strong> (rot) — QR-Bestellungen der Gäste die zum Zahlen an die Kasse kommen</li>
</ul>

<h3>3.2 Produkte tippen</h3>
<ul>
<li>Produkt antippen → landet direkt im Bon (wenn keine Optionen)</li>
<li>Bei Produkten mit <strong>„Optionen"-Badge</strong>: Modal mit Größe, Milch, Sirup, etc.</li>
<li><strong>Long-Press (lange drücken)</strong> auf Produkt → Dialog „Ausverkauft"</li>
</ul>

<h3>3.3 Rabatt</h3>
<p>Unten im Cart: Quick-Buttons 10% / 20% / Custom (% oder €). Kein Rabatt-Limit, aber Storno über 20 € braucht Manager-PIN.</p>

<h2>4. Zahlung</h2>

<h3>4.1 Bar</h3>
<p>Input „gegeben" — Rückgeld wird live berechnet. „Bar kassieren" → Bon mit QR erscheint.</p>

<h3>4.2 Karte (SumUp)</h3>
<p>Wenn SumUp eingerichtet: Reader bekommt Betrag automatisch. Kunde tappt Karte. Ergebnis kommt zurück.</p>

<h3>4.3 Apple Pay / Google Pay</h3>
<p>Über Stripe (Setup: <Link href="/shop/payments">/shop/payments</Link>). Kunde scannt QR auf Bestellseite.</p>

<h2>5. Bon</h2>

<h3>5.1 Was auf dem Bon steht</h3>
<ul>
<li>Name, Adresse, Steuer-Nr / USt-ID (Pflicht nach § 146a Abs. 3 AO)</li>
<li>Bestellnummer + Datum</li>
<li>Alle Positionen mit Preisen + Notizen</li>
<li>Netto / MwSt / Summe</li>
<li>Zahlungsart</li>
<li>TSE-Signatur + Serial + Transaktions-ID</li>
<li>QR-Code</li>
</ul>

<h3>5.2 Bon-QR scannen</h3>
<p>Kunde scannt QR auf Kassen-Display mit Handy-Kamera → öffnet Bon zum Download. Kann als PDF gedruckt oder als Bewirtungsbeleg umgewandelt werden.</p>

<h3>5.3 Bon per E-Mail</h3>
<p>Alternativ auf Kassen-Display E-Mail eingeben → direkt per Resend verschickt.</p>

<h2>6. Storno</h2>

<h3>6.1 Komplettstorno</h3>
<p>„📜 Historie · Storno" → Beleg wählen → „Stornieren" → Grund wählen (Fehlbuchung, Reklamation, …)
→ Manager-PIN (ab 20 €) → TSE-signierte Gegenbuchung wird angelegt.</p>

<h3>6.2 Teilstorno (einzelne Positionen)</h3>
<p>Gleicher Dialog → Toggle <strong>„Einzelne Positionen"</strong> → nur betroffene Items anhaken + Menge setzen → Storno nur für diese Positionen.
Rest bleibt aktiv.</p>

<p><em>Originalbeleg bleibt immer unverändert. Stornos sind separate Buchungen (GoBD).</em></p>

<h2>7. Training-Modus</h2>
<p>Im Mode-Selector oben: 🎓-Button → alle Buchungen werden als <code>trainingsbon=true</code> markiert
und separat im DSFinV-K-Export ausgewiesen. Nicht mit Echtbuchungen verwechselbar.</p>

<h2>8. Tische verwalten</h2>

<h3>8.1 Anlegen</h3>
<p><Link href="/pos/tables">/pos/tables</Link> → „10 Tische auf einmal" oder einzeln. Bereiche (Innen, Terrasse, Bar) frei wählbar.</p>

<h3>8.2 Floor-Plan</h3>
<p><Link href="/pos/tables/layout">/pos/tables/layout</Link> → Drag & Drop Tische im Raum anordnen. 3 Formen (rund, eckig, lang). Snap auf 20-px-Raster.</p>

<h3>8.3 Tisch-Transfer / Merge</h3>
<p>Im Terminal: Long-Press auf Tisch → „Transferieren" (Gast wechselt) oder „Zusammenlegen" (2 Tische → 1 Rechnung).</p>

<h2>9. Küchen-Display (KDS)</h2>

<h3>9.1 Station anlegen</h3>
<p><Link href="/pos/stations">/pos/stations</Link> → Preset wählen (Küche 👨‍🍳, Bar 🍹, Grill 🔥, …) →
Kategorien zuweisen (z. B. Pasta → Küche, Getränke → Bar).</p>

<h3>9.2 Tablet pairen</h3>
<ol>
<li>Auf Küchen-Tablet öffnen: <code>https://deine-domain/kitchen/pair</code></li>
<li>Station auswählen → 6-stelliger Code erscheint</li>
<li>Im Backoffice <Link href="/pos/stations/devices">/pos/stations/devices</Link> → Code eingeben</li>
<li>Tablet lädt automatisch das Display-Interface</li>
</ol>

<h3>9.3 Bedienung</h3>
<ul>
<li>Pro Item: „Start" → „✓ Fertig" (zweistufig)</li>
<li>Tisch-Nummer groß angezeigt</li>
<li>Sound-Ping bei neuer Bestellung (toggelbar)</li>
<li>Rot blinkend nach 25 Min Wartezeit</li>
</ul>

<h2>10. Rechtskonformität</h2>

<p>Siehe separate Doku: <Link href="/help/legal">Rechtskonformität (DE 2026)</Link></p>

      </div>
    </>
  );
}
