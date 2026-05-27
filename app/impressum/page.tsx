import Link from 'next/link';

export const metadata = { title: 'Impressum · Mise', description: 'Impressum der Mise-Gastro-Plattform' };

export default function ImpressumPage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-2xl font-black">mise</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/datenschutz" className="text-gray-600 hover:text-matcha-900">Datenschutz</Link>
            <Link href="/impressum" className="font-bold text-matcha-900">Impressum</Link>
            <Link href="/agb" className="text-gray-600 hover:text-matcha-900">AGB</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 prose prose-lg">
        <h1 className="font-display text-4xl font-black mb-8">Impressum</h1>

        <h2>Anbieter / Betreiber</h2>
        <p>
          <strong>Mise Gastro</strong><br />
          Tahar Galai<br />
          Pontstraße 1<br />
          52062 Aachen<br />
          Deutschland
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:hallo@mise-gastro.de">hallo@mise-gastro.de</a><br />
          Telefon: auf Anfrage<br />
          Web: <a href="https://mise-gastro.de">mise-gastro.de</a>
        </p>

        <h2>Vertretungsberechtigt</h2>
        <p>Tahar Galai (Inhaber)</p>

        <h2>Umsatzsteuer-Identifikationsnummer</h2>
        <p>USt-ID gemäß § 27a UStG: wird auf Anfrage mitgeteilt</p>

        <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p>Tahar Galai (Adresse wie oben)</p>

        <h2>Streitschlichtung</h2>
        <p>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:<br />
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">https://ec.europa.eu/consumers/odr</a>
        </p>
        <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>

        <h2>Haftungsausschluss</h2>
        <p>
          Trotz sorgfältiger Prüfung übernehmen wir keine Haftung für die Inhalte externer Links. Für den Inhalt der verlinkten Seiten sind ausschließlich deren Betreiber verantwortlich.
        </p>

        <h2>Urheberrecht</h2>
        <p>
          Die Inhalte und Werke auf dieser Plattform unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung, Verbreitung jeder Art bedürfen der schriftlichen Zustimmung.
        </p>
      </main>

      <footer className="border-t mt-16 py-8 text-center text-sm text-gray-500">
        © 2026 Mise · <Link href="/datenschutz" className="hover:underline">Datenschutz</Link> · <Link href="/impressum" className="hover:underline">Impressum</Link> · <Link href="/agb" className="hover:underline">AGB</Link>
      </footer>
    </div>
  );
}
