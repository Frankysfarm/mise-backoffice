import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react';

export default function QuickstartPage() {
  return (
    <>
      <PageHeader
        title="Schnellstart"
        description="Von null zur ersten Bestellung in 5 Minuten."
        backHref="/help"
      />

      <div className="max-w-3xl space-y-4">
        {STEPS.map((s, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-matcha-900 text-matcha-50 grid place-items-center font-display text-xl font-black shrink-0">
                {i + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold">{s.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
                {s.link && (
                  <Link href={s.link} className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-matcha-900 text-matcha-50 px-3 py-1.5 text-xs font-bold hover:bg-matcha-800">
                    {s.linkLabel} <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 shrink-0">
                {s.time}
              </div>
            </div>
          </Card>
        ))}

        <Card className="p-5 bg-matcha-50 border-matcha-200 text-center">
          <CheckCircle2 className="h-10 w-10 mx-auto text-matcha-700 mb-2" />
          <h3 className="font-display text-xl font-black">Fertig!</h3>
          <p className="text-sm text-matcha-900 mt-1">
            Du hast jetzt ein laufendes Restaurant-System. Bei Fragen → unten rechts Mise-AI-Chat oder <Link href="/help" className="underline">Hilfe-Hub</Link>.
          </p>
        </Card>
      </div>
    </>
  );
}

const STEPS = [
  {
    title: 'Kasse-Modul aktivieren',
    body: 'Oben links auf „Alle Module" → bei „Kasse" auf „14 Tage testen" klicken. Sofort erscheint die Sidebar mit allen POS-Funktionen.',
    link: '/modules',
    linkLabel: 'Zu den Modulen',
    time: '1 Min',
  },
  {
    title: 'Stammdaten eingeben',
    body: 'Restaurant-Name, Adresse, Steuernummer und USt-ID. Das ist Pflicht für Belege und Kassenmeldung.',
    link: '/settings/restaurant',
    linkLabel: 'Stammdaten',
    time: '2 Min',
  },
  {
    title: 'Demo-Menü laden',
    body: 'Klick „Beispiel-Menü laden" — 14 Produkte mit Bildern, Optionen und Cross-Sells werden angelegt. Kannst du später anpassen.',
    link: '/menu',
    linkLabel: 'Menü',
    time: '1 Min',
  },
  {
    title: 'Tische anlegen + QR drucken',
    body: 'Tische erstellen (bulk „10 Stück auf einmal"), dann Universal-QR-Aufsteller drucken. Gäste scannen → bestellen → zahlen.',
    link: '/pos/tables',
    linkLabel: 'Tische',
    time: '2 Min',
  },
  {
    title: 'Küchen-Station anlegen',
    body: 'Mindestens eine Station (z. B. „Hauptküche"), Kategorien zuordnen. Ohne Station kommt keine Bestellung in der Küche an.',
    link: '/pos/stations',
    linkLabel: 'Stationen',
    time: '1 Min',
  },
  {
    title: 'Kasse starten',
    body: 'Öffne das Terminal, starte deine Schicht mit Wechselgeld. Tippe auf eine Tisch-Kachel und nimm die erste Bestellung auf.',
    link: '/pos/terminal',
    linkLabel: 'Terminal öffnen',
    time: '30 Sek',
  },
];
