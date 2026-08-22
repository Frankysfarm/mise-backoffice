import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import {
  ArrowRight, Bike, Book, Calculator, HelpCircle, Lightbulb,
  MessageCircle, PlayCircle, Shield, Zap,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const SECTIONS = [
  {
    href: '/help/quickstart',
    icon: <Zap className="h-6 w-6" />,
    farbe: 'from-amber-400 to-orange-500',
    title: 'Schnellstart (5 Minuten)',
    desc: 'Erste Schritte von null bis zur ersten Bestellung. Perfekt wenn du gerade registriert hast.',
    eta: '5 Min',
  },
  {
    href: '/help/pos',
    icon: <Calculator className="h-6 w-6" />,
    farbe: 'from-matcha-600 to-matcha-800',
    title: 'Kasse (POS)',
    desc: 'Kompletter Guide: Terminal einrichten, Kassen pairen, Bons drucken, Stornos, Schichten, TSE, DSFinV-K, Kassen-Nachschau.',
    eta: '20 Min Lesezeit',
  },
  {
    href: '/help/delivery',
    icon: <Bike className="h-6 w-6" />,
    farbe: 'from-blue-500 to-indigo-600',
    title: 'Lieferdienst',
    desc: 'Fahrer einladen, Liefergebiet definieren, Auto-Dispatch, Tracking, externe Plattformen.',
    eta: '15 Min Lesezeit',
  },
  {
    href: '/help/legal',
    icon: <Shield className="h-6 w-6" />,
    farbe: 'from-red-500 to-rose-600',
    title: 'Rechtskonformität (DE 2026)',
    desc: 'KassenSichV, TSE, GoBD, DSFinV-K, § 146a AO, Kassen-Nachschau, 10-Jahre-Aufbewahrung.',
    eta: '10 Min Lesezeit',
  },
  {
    href: '/help/tips',
    icon: <Lightbulb className="h-6 w-6" />,
    farbe: 'from-purple-500 to-fuchsia-600',
    title: 'Tipps & Tricks',
    desc: 'Keyboard-Shortcuts, Touch-Gesten (Long-Press), Tablet-optimierte Bedienung.',
    eta: '5 Min Lesezeit',
  },
  {
    href: '/help/faq',
    icon: <HelpCircle className="h-6 w-6" />,
    farbe: 'from-gray-600 to-gray-800',
    title: 'FAQ',
    desc: 'Häufige Fragen kurz beantwortet. Probleme schnell lösen.',
    eta: '2 Min pro Antwort',
  },
];

export default function HelpHubPage() {
  return (
    <>
      <PageHeader
        title="Hilfe & Dokumentation"
        description="Alles was du brauchst — vom Einstieg bis zum Steuerberater-Gespräch."
      />

      {/* AI-Chat Hint */}
      <Card className="p-5 mb-6 bg-gradient-to-br from-matcha-900 to-matcha-700 text-white border-0">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-accent text-matcha-900 grid place-items-center shrink-0">
            <MessageCircle className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="font-display text-xl font-black">Frag Mise-AI</div>
            <div className="text-matcha-100 text-sm mt-0.5">
              Unten rechts siehst du ein Chat-Icon. Tippe drauf — der Mise-AI beantwortet alle Fragen zur Kasse und Liefer-Modul auf Deutsch.
            </div>
          </div>
        </div>
      </Card>

      {/* Sections */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="group">
            <Card className="p-5 h-full hover:shadow-lg hover:-translate-y-0.5 transition">
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${s.farbe} text-white grid place-items-center mb-3`}>
                {s.icon}
              </div>
              <h3 className="font-display text-lg font-bold">{s.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{s.desc}</p>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <PlayCircle className="h-3 w-3" /> {s.eta}
                </span>
                <span className="font-bold text-matcha-700 inline-flex items-center gap-1 group-hover:translate-x-0.5 transition">
                  Öffnen <ArrowRight className="h-3 w-3" />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Support */}
      <Card className="p-5 mt-8 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <Book className="h-5 w-5 text-amber-800 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <div className="font-bold mb-1">Brauchst du Hilfe, die du hier nicht findest?</div>
            <div>
              Schreib an <a href="mailto:support@mise.app" className="underline">support@mise.app</a> —
              wir antworten binnen 24 h (Mo-Fr).
            </div>
          </div>
        </div>
      </Card>
    </>
  );
}
