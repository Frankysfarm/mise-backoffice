import Link from 'next/link';

export const metadata = { title: 'Datenschutz · Mise', description: 'Datenschutzerklärung der Mise-Gastro-Plattform' };

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-black">mise</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/datenschutz" className="font-bold text-matcha-900">Datenschutz</Link>
            <Link href="/impressum" className="text-gray-600 hover:text-matcha-900">Impressum</Link>
            <Link href="/agb" className="text-gray-600 hover:text-matcha-900">AGB</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-lg">
        <h1 className="font-display text-4xl font-black mb-2">Datenschutzerklärung</h1>
        <p className="text-sm text-gray-500 mb-8">Stand: 11. Mai 2026</p>

        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website und in der Mise-POS-App ist:<br />
          <strong>Mise Gastro</strong><br />
          Tahar Galai<br />
          Pontstraße 1<br />
          52062 Aachen<br />
          E-Mail: <a href="mailto:hallo@mise-gastro.de">hallo@mise-gastro.de</a>
        </p>

        <h2>2. Welche Daten wir verarbeiten</h2>
        <h3>2.1 Restaurant-Owner / Mitarbeiter</h3>
        <ul>
          <li>Name, E-Mail, Telefon</li>
          <li>Restaurant-Stammdaten (Adresse, USt-ID, Bankverbindung über Stripe)</li>
          <li>Schicht- und Lohndaten (für Dienstplan-Modul)</li>
          <li>Login-Daten (Supabase Auth, Passwort verschlüsselt)</li>
        </ul>

        <h3>2.2 Endkunden (Restaurant-Gäste)</h3>
        <ul>
          <li>Bestelldaten (Items, Menge, Preis, Bestellnummer)</li>
          <li>Bei Lieferung: Name, Telefon, Adresse, PLZ, Stadt</li>
          <li>Bei Tisch-Bestellung: nur Tischnummer (kein Name nötig)</li>
          <li>Zahlungsdaten via Stripe / SumUp (Mise speichert KEINE Kartendaten — nur Token-Referenz)</li>
          <li>Optional: E-Mail für Bon-Versand</li>
        </ul>

        <h2>3. Rechtsgrundlagen</h2>
        <ul>
          <li>Art. 6 Abs. 1 lit. b DSGVO — Vertragserfüllung (Bestellung, Lieferung)</li>
          <li>Art. 6 Abs. 1 lit. c DSGVO — Rechtliche Verpflichtung (Steuerrecht, KassenSichV, GoBD)</li>
          <li>Art. 6 Abs. 1 lit. f DSGVO — Berechtigte Interessen (Betrugsprävention, Server-Sicherheit)</li>
          <li>Art. 6 Abs. 1 lit. a DSGVO — Einwilligung (Newsletter, Marketing-Cookies)</li>
        </ul>

        <h2>4. Speicherdauer</h2>
        <ul>
          <li>Bestelldaten: 10 Jahre (§147 AO Aufbewahrungspflicht für Buchungsbelege)</li>
          <li>Mitarbeiterdaten: nach Austritt 10 Jahre (Lohnsteuerunterlagen)</li>
          <li>Endkunden-Adressen: bis Vertragsabschluss + 6 Jahre</li>
          <li>Marketing-Daten: bis Widerruf der Einwilligung</li>
        </ul>

        <h2>5. Empfänger / Auftragsverarbeiter</h2>
        <ul>
          <li><strong>Hetzner Online GmbH</strong> (Server-Hosting, DE) — AVV vorhanden</li>
          <li><strong>Stripe Payments Europe Ltd.</strong> (Zahlungsabwicklung Online) — Standardvertragsklauseln</li>
          <li><strong>SumUp Payments Ltd.</strong> (Karten-Reader vor Ort) — AVV vorhanden</li>
          <li><strong>Resend</strong> (E-Mail-Versand für Bestellbestätigungen) — Standardvertragsklauseln</li>
          <li><strong>Fiskaly Services GmbH</strong> (TSE für Kassen-Compliance, ab Phase 2)</li>
          <li><strong>Apple Inc.</strong> (Apple Pay über Stripe-Integration) — Standardvertragsklauseln</li>
        </ul>

        <h2>6. Deine Rechte</h2>
        <ul>
          <li>Auskunft über deine Daten (Art. 15 DSGVO)</li>
          <li>Berichtigung falscher Daten (Art. 16 DSGVO)</li>
          <li>Löschung (Art. 17 DSGVO) — soweit keine gesetzliche Aufbewahrungspflicht entgegensteht</li>
          <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Widerspruch gegen Verarbeitung (Art. 21 DSGVO)</li>
          <li>Beschwerderecht bei der Datenschutzaufsichtsbehörde NRW: <a href="https://www.ldi.nrw.de" target="_blank" rel="noopener">www.ldi.nrw.de</a></li>
        </ul>
        <p>Anfragen bitte an <a href="mailto:datenschutz@mise-gastro.de">datenschutz@mise-gastro.de</a>.</p>

        <h2>7. Technische Daten</h2>
        <h3>7.1 Server-Logs</h3>
        <p>Beim Zugriff auf unsere Server speichern wir technisch notwendige Daten (IP-Adresse, User-Agent, aufgerufene URL, Zeitstempel) für 7 Tage zur Abwehr von Angriffen.</p>

        <h3>7.2 Cookies</h3>
        <p>Wir nutzen technisch notwendige Cookies für Login-Sessions (Supabase Auth). Keine Tracking- oder Werbe-Cookies.</p>

        <h3>7.3 Mise-POS-App (iOS/Android)</h3>
        <p>Die App nutzt folgende Endgeräte-Funktionen:</p>
        <ul>
          <li><strong>Bluetooth</strong> — Verbindung zu ESC/POS-Bondruckern und Kassenschubladen</li>
          <li><strong>Kamera</strong> — QR-Code-Scan für Tisch-Lookup</li>
          <li><strong>Lokales Netzwerk</strong> — WLAN-Drucker und SumUp-Reader</li>
        </ul>
        <p>Es werden keine Standortdaten erhoben. Keine Geräte-IDs werden an Dritte weitergegeben.</p>

        <h2>8. Änderungen</h2>
        <p>Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie aktuellen rechtlichen Anforderungen anzupassen. Die jeweils aktuelle Version ist hier abrufbar.</p>
      </main>

      <footer className="border-t mt-16 py-8 text-center text-sm text-gray-500">
        © 2026 Mise · <Link href="/datenschutz" className="hover:underline">Datenschutz</Link> · <Link href="/impressum" className="hover:underline">Impressum</Link> · <Link href="/agb" className="hover:underline">AGB</Link>
      </footer>
    </div>
  );
}
