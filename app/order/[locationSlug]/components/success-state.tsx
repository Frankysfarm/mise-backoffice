'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Check } from 'lucide-react';

type Props = {
  bestellnummer: string;
  name?: string;
  etaMinutes: number;
  isDelivery: boolean;
  onNewOrder: () => void;
};

export function SuccessState({ bestellnummer, name, etaMinutes, isDelivery, onNewOrder }: Props) {
  const firstName = name?.split(' ')[0];

  const [secsLeft, setSecsLeft] = React.useState(etaMinutes * 60);
  React.useEffect(() => {
    if (secsLeft <= 0) return;
    const t = setTimeout(() => setSecsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secsLeft]);
  const minsLeft = Math.floor(secsLeft / 60);
  const secsPart = secsLeft % 60;
  const countdownStr = secsLeft > 0
    ? `${minsLeft}:${String(secsPart).padStart(2, '0')}`
    : '0:00';

  return (
    <main
      className={cn(
        'flex min-h-screen items-center justify-center bg-matcha-900 p-6 text-matcha-50',
      )}
    >
      {/* Background bleeds */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute -right-32 bottom-10 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Check circle */}
        <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center rounded-full bg-accent/20">
          <div className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-accent shadow-[0_0_40px_rgba(74,230,138,0.4)] motion-safe:animate-[scaleIn_400ms_ease-out]">
            <Check className="h-10 w-10 text-matcha-900" strokeWidth={3} />
          </div>
        </div>

        <h1 className="mt-8 font-display text-5xl font-bold leading-tight tracking-[-0.03em] md:text-6xl">
          {firstName ? `Danke, ${firstName}!` : 'Bestellt!'}
        </h1>

        <p className="mt-4 text-base leading-relaxed text-matcha-200">
          Wir haben deine Bestellung erhalten.
          {isDelivery
            ? ` In etwa ${etaMinutes} Minuten klingeln wir.`
            : ` In etwa ${etaMinutes} Minuten kannst du abholen.`}
        </p>
        {secsLeft > 0 && (
          <div className="mt-3 inline-flex items-center gap-3 rounded-2xl bg-white/5 px-5 py-3 ring-1 ring-white/10">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-matcha-300">
              {isDelivery ? 'Ankunft in' : 'Abholung in'}
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums text-accent">{countdownStr}</div>
          </div>
        )}

        <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-matcha-800/60 px-4 py-2 ring-1 ring-white/5 backdrop-blur">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-300">Bestellnr.</span>
          <span className="font-mono text-sm font-bold text-accent">{bestellnummer}</span>
        </div>

        <a
          href={`/track/${bestellnummer}`}
          className={cn(
            'mt-10 inline-flex w-full items-center justify-between rounded-2xl bg-accent px-6 py-4 font-display text-lg font-bold text-matcha-900 shadow-[0_0_30px_rgba(74,230,138,0.25)] transition hover:brightness-105',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-matcha-900',
          )}
        >
          Live verfolgen
          <ArrowRight className="h-5 w-5" />
        </a>

        <button
          type="button"
          onClick={onNewOrder}
          className="mt-4 text-sm text-matcha-300 underline-offset-4 transition hover:text-matcha-50 hover:underline"
        >
          Neue Bestellung starten
        </button>
      </div>

      <style jsx>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </main>
  );
}
