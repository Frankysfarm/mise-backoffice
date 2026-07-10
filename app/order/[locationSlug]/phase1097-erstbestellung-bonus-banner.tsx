'use client';

import { useEffect, useState } from 'react';
import { Gift, Sparkles, Timer, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1097 — Erst-Bestellung-Bonus-Banner (Storefront)
// Sonderangebot für Neukunden (erste Bestellung) mit Countdown + Code

interface Props {
  locationId: string;
  rabattCode?: string;
  rabattBetrag?: number; // €
  className?: string;
}

const STORAGE_KEY = 'mise_erstbestellung_dismissed';
const COUNTDOWN_MINUTES = 15;

function isFirstTimeUser(): boolean {
  if (typeof window === 'undefined') return false;
  // Check if user has any prior order data in localStorage
  const hasPrior =
    localStorage.getItem('mise_order_success') ||
    localStorage.getItem('mise_has_ordered') ||
    localStorage.getItem(STORAGE_KEY);
  return !hasPrior;
}

function useCountdown(minutes: number) {
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return { secondsLeft, label: `${m}:${s.toString().padStart(2, '0')}` };
}

export function Phase1097ErstbestellungBonusBanner({
  locationId,
  rabattCode = 'WILLKOMMEN5',
  rabattBetrag = 5,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const { secondsLeft, label: countdownLabel } = useCountdown(COUNTDOWN_MINUTES);

  useEffect(() => {
    if (isFirstTimeUser()) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  function copyCode() {
    navigator.clipboard.writeText(rabattCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!visible) return null;
  if (secondsLeft <= 0) {
    // Offer expired — hide silently
    return null;
  }

  return (
    <div className={cn(
      'fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm',
      'animate-in slide-in-from-bottom-4 duration-500',
    )}>
      <div className="rounded-2xl border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-violet-50 shadow-xl overflow-hidden">
        {/* Dismiss */}
        <button
          onClick={dismiss}
          className="absolute top-2 right-2 rounded-full p-1 text-purple-400 hover:bg-purple-100 transition"
          aria-label="Schließen"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="p-4">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Willkommens-Bonus
              </div>
              <div className="text-[10px] text-purple-600">Nur für Ihre erste Bestellung</div>
            </div>
          </div>

          {/* Offer text */}
          <p className="text-sm font-bold text-foreground mb-3">
            <span className="text-purple-600">{rabattBetrag.toFixed(0)} € Rabatt</span> auf Ihre erste Bestellung!
          </p>

          {/* Code + copy */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 rounded-lg border-2 border-dashed border-purple-300 bg-white px-3 py-2 text-center">
              <span className="font-mono text-sm font-black text-purple-700 tracking-widest">{rabattCode}</span>
            </div>
            <button
              onClick={copyCode}
              className={cn(
                'rounded-lg px-3 py-2 text-xs font-bold transition',
                copied
                  ? 'bg-matcha-500 text-white'
                  : 'bg-purple-500 text-white hover:bg-purple-600',
              )}
            >
              {copied ? '✓ Kopiert' : 'Kopieren'}
            </button>
          </div>

          {/* Countdown */}
          <div className="flex items-center justify-center gap-1.5 rounded-xl bg-purple-100 border border-purple-200 px-3 py-1.5">
            <Timer className="h-3.5 w-3.5 text-purple-500" />
            <span className="text-xs text-purple-600 font-medium">
              Angebot läuft ab in
            </span>
            <span className="font-mono text-sm font-black text-purple-700">{countdownLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
