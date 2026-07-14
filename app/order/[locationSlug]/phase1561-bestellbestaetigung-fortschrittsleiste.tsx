'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface Props {
  orderStatus?: string | null;
  orderPlaced?: boolean;
}

const SCHRITTE = [
  { key: 'bestaetigt', label: 'Bestätigt', icon: '✓' },
  { key: 'zubereitung', label: 'Zubereitung', icon: '🍳' },
  { key: 'unterwegs', label: 'Unterwegs', icon: '🚴' },
  { key: 'geliefert', label: 'Geliefert', icon: '📦' },
];

function getCurrentStep(status: string | null | undefined): number {
  switch (status) {
    case 'neu':
    case 'angenommen':
      return 0;
    case 'in_zubereitung':
      return 1;
    case 'fertig':
    case 'abholbereit':
    case 'unterwegs':
      return 2;
    case 'geliefert':
    case 'abgeholt':
    case 'abgeschlossen':
      return 3;
    default:
      return 0;
  }
}

const STORAGE_KEY = 'mise_phase1561_dismissed';

export function StorefrontPhase1561BestellbestaetiguFortschrittsleiste({ orderStatus, orderPlaced }: Props) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ts = parseInt(raw, 10);
        if (Date.now() - ts < 30 * 60_000) setDismissed(true);
      }
    } catch {}
  }, []);

  if (!mounted || !orderPlaced || dismissed) return null;
  if (!orderStatus) return null;

  const activeStep = getCurrentStep(orderStatus);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(STORAGE_KEY, Date.now().toString()); } catch {}
  };

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4 relative">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-stone-400 hover:text-stone-600 text-xs leading-none"
        aria-label="Schließen"
      >✕</button>
      <div className="text-xs font-bold text-matcha-700 uppercase tracking-wide mb-4">Deine Bestellung</div>
      <div className="flex items-center">
        {SCHRITTE.map((schritt, idx) => {
          const done = idx < activeStep;
          const active = idx === activeStep;
          return (
            <React.Fragment key={schritt.key}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  done ? 'bg-matcha-500 text-white' : active ? 'bg-matcha-200 text-matcha-700 ring-2 ring-matcha-400' : 'bg-stone-100 text-stone-400'
                }`}>
                  {done ? <CheckCircle2 className="h-4 w-4" /> : schritt.icon}
                </div>
                <span className={`text-[10px] font-semibold text-center leading-tight ${
                  done ? 'text-matcha-600' : active ? 'text-matcha-700' : 'text-stone-400'
                }`}>{schritt.label}</span>
              </div>
              {idx < SCHRITTE.length - 1 && (
                <div className={`h-0.5 flex-1 mb-5 transition-colors ${idx < activeStep ? 'bg-matcha-400' : 'bg-stone-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
