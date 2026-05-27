import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { PRESETS } from '@/lib/setup-presets';
import { UseCasePicker } from './client';

export const metadata = {
  title: 'Use-Case wählen · Mise',
  description: 'Wähle dein Szenario — wir zeigen dir nur die Setup-Steps, die du brauchst.',
};

export default function UseCasePage() {
  return (
    <div className="min-h-screen bg-matcha-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="container flex items-center justify-between h-16">
          <Link href="/welcome" className="flex items-center gap-2 text-white/80 hover:text-white text-sm">
            <ArrowLeft size={14} /> Zurück
          </Link>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 40 40" className="h-6 w-6">
              <circle cx="20" cy="20" r="19" fill="none" stroke="#fff" strokeWidth="2" />
              <path d="M 11 26 L 11 14 L 16 22 L 20 16 L 24 22 L 29 14 L 29 26" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="font-display text-xl font-bold">mise</span>
          </div>
          <Link href="/login" className="text-sm text-matcha-100 hover:text-white">Anmelden</Link>
        </div>
      </header>

      <main className="container py-16 max-w-5xl">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-accent/20 border border-accent/30 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={12} /> 14 Tage gratis · Keine Kreditkarte
          </div>
          <h1 className="mt-6 font-display text-4xl md:text-6xl font-bold tracking-[-0.02em] leading-[0.95]">
            Was hast du <span className="text-accent italic">vor</span>?
          </h1>
          <p className="mt-4 text-lg text-matcha-100">
            Wähle dein Szenario — wir führen dich nur durch die Schritte, die du wirklich brauchst. Kein Feature-Chaos.
          </p>
        </div>

        <UseCasePicker presets={PRESETS} />
      </main>
    </div>
  );
}
