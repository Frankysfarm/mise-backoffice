import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutz · Mise Driver',
  description:
    'Datenschutzerklärung für die Mise Driver App — Standort, Profil, Lieferungen und wie wir damit umgehen.',
  robots: { index: true, follow: true },
};

export default function DriverPrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F5F1E8] text-[#141414]">
      <div className="mx-auto max-w-[720px] px-6 py-16 md:py-24">
        <header className="mb-10">
          <div className="font-mono text-[11px] tracking-[0.25em] text-[#E8B105] uppercase mb-3">
            Mise · Driver
          </div>
          <h1 className="font-serif italic text-4xl md:text-5xl leading-tight tracking-tight">
            Datenschutz
            <span className="text-[#E8B105]">.</span>
          </h1>
          <p className="text-sm text-[#6B6B6B] mt-3">
            Stand: 4. Mai 2026 · Verantwortlich: Mise Gastro, Aachen, Deutschland
          </p>
        </header>

        <div className="space-y-10 text-[15px] leading-[1.7]">
          <section>
            <h2 className="text-xl font-semibold mb-3">Kurz und ehrlich</h2>
            <p>
              Mise Driver ist die Schicht-App für Lieferfahrer der Mise-Plattform.
              Wir verarbeiten nur die Daten, die wir wirklich brauchen, um dir Bestellungen
              zuzuweisen und Kunden den Lieferstatus zu zeigen — nichts mehr. Wir verkaufen
              keine Daten, wir tracken dich nicht App-übergreifend, und wir geben deine
              Position nur weiter wenn du aktiv im Dienst bist.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Welche Daten wir verarbeiten</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Telefonnummer</strong> — für den Login per Einmal-Code (OTP).
              </li>
              <li>
                <strong>Name + optional E-Mail</strong> — für dein Fahrer-Profil und
                damit Kunden wissen wer liefert.
              </li>
              <li>
                <strong>Standort (GPS)</strong> — nur wenn du <em>aktiv im Dienst</em> bist.
                Wir nutzen die Position für: 1. Frank weist dir die nächstgelegenen
                Bestellungen zu. 2. Restaurants koordinieren die Übergabe.
                3. Kunden sehen während ihrer aktiven Lieferung wo du gerade bist.
              </li>
              <li>
                <strong>Fahrzeug-Typ + Liefer-Radius</strong> — von dir selbst eingestellt.
              </li>
              <li>
                <strong>Bestell-Historie</strong> — abgeschlossene Lieferungen, Verdienst,
                Statistiken zu deiner Schicht.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Wann wir tracken — und wann nicht</h2>
            <div className="rounded-2xl bg-white border border-[#ECE5D3] p-5">
              <ul className="space-y-3">
                <li className="flex gap-3">
                  <span className="text-[#5C8A5C] font-bold mt-0.5">●</span>
                  <span>
                    <strong>Aktiv im Dienst:</strong> dein Standort wird alle 7-25
                    Sekunden aufgezeichnet (je nach Status: auf Tour oder bereit).
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="text-[#E8542A] font-bold mt-0.5">●</span>
                  <span>
                    <strong>Außer Dienst:</strong> kein Tracking. Sobald du den Toggle
                    auf „Außer Dienst" setzt oder dich ausloggst, stoppt das Tracking
                    sofort.
                  </span>
                </li>
              </ul>
            </div>
            <p className="mt-4 text-sm text-[#6B6B6B]">
              Du kannst die Standort-Berechtigungen jederzeit in den iOS-Einstellungen
              widerrufen (Einstellungen → Mise Driver → Standort).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Wer Zugriff hat</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Frank (unser Dispatch-Algorithmus):</strong> sieht alle aktiven
                Fahrer-Positionen, um Bestellungen zu verteilen.
              </li>
              <li>
                <strong>Restaurants:</strong> sehen den eingehenden Fahrer für die
                Übergabe-Koordination.
              </li>
              <li>
                <strong>Kunden:</strong> sehen während ihrer eigenen aktiven Lieferung
                deinen Vor­namen, dein Fahrzeug und (im Lieferzeitraum) deine Position
                auf der Karte. Nicht vorher, nicht nachher.
              </li>
              <li>
                <strong>Mise-Operations-Team:</strong> Zugriff auf alle Daten zu
                Support-Zwecken (Bug-Tracking, Konflikt-Lösung).
              </li>
              <li>
                <strong>Externe Dritte:</strong> wir geben keine Daten an Werbenetzwerke
                oder Datenhändler weiter.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Wie lange wir Daten speichern</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>GPS-Historie</strong> — automatisch nach <strong>30 Tagen</strong>{' '}
                gelöscht.
              </li>
              <li>
                <strong>Login-Sessions</strong> — 90 Tage gültig, danach erneuter Login
                nötig.
              </li>
              <li>
                <strong>Bestell-Historie</strong> — solange dein Account aktiv ist plus
                gesetzliche Aufbewahrungsfristen (Buchhaltung, 10 Jahre).
              </li>
              <li>
                <strong>Profil-Daten</strong> — bis zur Löschung deines Accounts.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Deine Rechte (DSGVO)</h2>
            <p>Du kannst jederzeit:</p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Auskunft verlangen, welche Daten wir über dich gespeichert haben</li>
              <li>Berichtigung falscher Daten verlangen</li>
              <li>Löschung deines Accounts verlangen (alle Daten weg, gesetzliche Fristen ausgenommen)</li>
              <li>Datenübertragbarkeit (Export) verlangen</li>
              <li>Einwilligungen widerrufen</li>
              <li>Beim Datenschutz-Beauftragten der Aufsichtsbehörde Beschwerde einlegen</li>
            </ul>
            <p className="mt-3">
              Schreib uns dafür einfach an{' '}
              <a
                href="mailto:datenschutz@mise-gastro.de"
                className="text-[#E8B105] underline decoration-2 underline-offset-2"
              >
                datenschutz@mise-gastro.de
              </a>
              . Wir antworten innerhalb von 30 Tagen.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Sicherheit</h2>
            <p>
              Daten werden verschlüsselt übertragen (TLS 1.3) und in einer
              EU-gehosteten Datenbank (Hetzner, Deutschland) gespeichert. Login-Tokens
              liegen verschlüsselt im iOS-Keychain bzw. Android-Keystore — niemals im
              Klartext.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Drittanbieter</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Apple Maps / Google Maps</strong> — wenn du auf „Navigieren"
                tippst, öffnet sich die Standard-Navigations-App deines Systems.
                Deren Datenschutz gilt dann separat.
              </li>
              <li>
                <strong>Apple/Google App Store</strong> — App-Auslieferung und Updates.
              </li>
              <li>
                <strong>Hetzner</strong> — unser Server-Hoster (Deutschland).
              </li>
              <li>
                <strong>Supabase</strong> — Datenbank-Infrastruktur (selbst gehostet auf Hetzner).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">Änderungen</h2>
            <p>
              Wir aktualisieren diese Erklärung wenn sich was Wichtiges ändert. Bei
              wesentlichen Änderungen informieren wir dich in der App.
            </p>
          </section>

          <section className="border-t border-[#ECE5D3] pt-8">
            <h2 className="text-xl font-semibold mb-3">Kontakt</h2>
            <p>
              Mise Gastro<br />
              Aachen, Deutschland<br />
              <a
                href="mailto:datenschutz@mise-gastro.de"
                className="text-[#E8B105] underline decoration-2 underline-offset-2"
              >
                datenschutz@mise-gastro.de
              </a>
            </p>
          </section>
        </div>

        <footer className="mt-16 pt-8 border-t border-[#ECE5D3] text-xs text-[#6B6B6B]">
          <p>
            © 2026 Mise. — alles an seinem Platz.
          </p>
        </footer>
      </div>
    </main>
  );
}
