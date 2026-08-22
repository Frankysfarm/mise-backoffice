import Link from 'next/link';

export const metadata = { title: 'AGB · Mise', description: 'Allgemeine Geschäftsbedingungen der Mise-Gastro-Plattform' };

export default function AgbPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-black">mise</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/datenschutz" className="text-gray-600 hover:text-matcha-900">Datenschutz</Link>
            <Link href="/impressum" className="text-gray-600 hover:text-matcha-900">Impressum</Link>
            <Link href="/agb" className="font-bold text-matcha-900">AGB</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-lg">
        <h1 className="font-display text-4xl font-black mb-2">Allgemeine Geschäftsbedingungen</h1>
        <p className="text-sm text-gray-500 mb-8">Stand: 11. Mai 2026</p>

        <h2>§ 1 Geltungsbereich</h2>
        <p>
          Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen der Mise Gastro (Tahar Galai, Pontstraße 1, 52062 Aachen) und Restaurant-Betreibern („Owner") über die Nutzung der Mise-Plattform (mise-gastro.de).
        </p>

        <h2>§ 2 Vertragsgegenstand</h2>
        <p>
          Die Mise-Plattform stellt Restaurant-Owner eine Multi-Tenant-SaaS-Lösung zur Verfügung mit folgenden Modulen (je nach Buchung):
        </p>
        <ul>
          <li>Kasse & Finanzen (POS-Terminal, Z-Bericht, DSFinV-K-Export)</li>
          <li>Online-Bestellsystem (Lieferung, Abholung)</li>
          <li>QR-Tisch-Bestellsystem (vor-Ort-Bestellung am Tisch)</li>
          <li>Küchen-Display (KDS)</li>
          <li>Lieferdienst-Operations (Fahrer, Touren)</li>
          <li>Mitarbeiter-Verwaltung & Dienstplan</li>
          <li>weitere Module nach Modul-Galerie</li>
        </ul>

        <h2>§ 3 Vertragsabschluss</h2>
        <p>
          Der Owner registriert sich über die Signup-Funktion und schließt mit Bestätigung einen Nutzungsvertrag. Es gilt eine kostenfreie Testphase von 14 Tagen pro Modul. Danach beginnt die kostenpflichtige Nutzung mit den unter „/modules" angegebenen Preisen.
        </p>

        <h2>§ 4 Preise und Zahlung</h2>
        <p>
          Die Preise werden monatlich in Rechnung gestellt. Zahlung erfolgt im Voraus per SEPA-Lastschrift oder Kreditkarte über Stripe. Alle Preise verstehen sich zzgl. gesetzlicher Mehrwertsteuer.
        </p>

        <h2>§ 5 Kündigung</h2>
        <p>
          Beide Parteien können den Vertrag mit einer Frist von 30 Tagen zum Monatsende kündigen. Außerordentliche Kündigung aus wichtigem Grund bleibt unberührt.
        </p>

        <h2>§ 6 Verfügbarkeit</h2>
        <p>
          Wir bemühen uns um eine Verfügbarkeit der Plattform von 99,5 % im Jahresmittel, ausgenommen geplante Wartungsarbeiten. Eine darüber hinausgehende Verfügbarkeitsgarantie wird nicht zugesagt. Bei Ausfall haftet der Anbieter nur bei Vorsatz oder grober Fahrlässigkeit.
        </p>

        <h2>§ 7 Pflichten des Owners</h2>
        <ul>
          <li>Korrekte Stammdaten und Steuersätze pflegen</li>
          <li>Eigene Datenschutzerklärung gegenüber den Endkunden bereitstellen</li>
          <li>Einhaltung aller deutschen Steuer- und Kassengesetze (KassenSichV, GoBD, §146a AO)</li>
          <li>Bei Live-Betrieb: TSE-Aktivierung pro Kasse</li>
          <li>Regelmäßige Sicherung von Z-Berichten und DSFinV-K-Exporten</li>
        </ul>

        <h2>§ 8 Haftung</h2>
        <p>
          Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit. Bei einfacher Fahrlässigkeit haften wir nur bei Verletzung wesentlicher Vertragspflichten und begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Eine Haftung für entgangenen Gewinn ist ausgeschlossen.
        </p>

        <h2>§ 9 Datenschutz</h2>
        <p>
          Es gilt unsere <Link href="/datenschutz" className="text-matcha-900 underline">Datenschutzerklärung</Link>. Mise verarbeitet Restaurant- und Endkunden-Daten ausschließlich zur Erfüllung der vertraglichen Pflichten.
        </p>

        <h2>§ 10 Schlussbestimmungen</h2>
        <p>
          Es gilt deutsches Recht. Gerichtsstand ist Aachen, sofern der Owner Kaufmann ist. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
        </p>
      </main>

      <footer className="border-t mt-16 py-8 text-center text-sm text-gray-500">
        © 2026 Mise · <Link href="/datenschutz" className="hover:underline">Datenschutz</Link> · <Link href="/impressum" className="hover:underline">Impressum</Link> · <Link href="/agb" className="hover:underline">AGB</Link>
      </footer>
    </div>
  );
}
