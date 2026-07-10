'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Users, X } from 'lucide-react';

// Phase 1092 — Gruppen-Bestellungs-Banner (Storefront)
// Hinweis wenn ≥3 Artikel vom selben Tisch/Raum bestellt werden + Rabattcode-Hinweis

interface CartItem {
  item: { id: string; name: string; preis: number };
  qty: number;
}

interface Props {
  cart: CartItem[];
  minItems?: number; // default: 3
  rabattCode?: string | null;
}

const GRUPPEN_MIN = 3;

const MESSAGES = [
  'Gemeinsam genießen ist am schönsten! 🎉',
  'Gruppe trifft guten Geschmack! 👥',
  'Perfekt für euer Team oder die Familie!',
];

export function Phase1092GruppenBestellungsBanner({ cart, minItems = GRUPPEN_MIN, rabattCode = null }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [msgIdx, setMsgIdx] = useState(0);

  const totalQty = cart.reduce((s, c) => s + c.qty, 0);
  const isGruppe = totalQty >= minItems;

  // Rotate message every 5s
  useEffect(() => {
    if (!isGruppe) return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % MESSAGES.length), 5000);
    return () => clearInterval(id);
  }, [isGruppe]);

  // Reset dismissed when cart drops below threshold
  useEffect(() => {
    if (!isGruppe) setDismissed(false);
  }, [isGruppe]);

  if (!isGruppe || dismissed) return null;

  return (
    <div className="animate-in slide-in-from-bottom-4 duration-300 rounded-xl border border-violet-300 bg-violet-50 dark:bg-violet-900/20 px-4 py-3 flex items-start gap-3 shadow-sm">
      <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-800/40">
        <Users className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-bold text-violet-800 dark:text-violet-200">Gruppenbestellung erkannt!</span>
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        </div>
        <p className="text-xs text-violet-700 dark:text-violet-300 mb-1">
          {MESSAGES[msgIdx]}
        </p>
        {rabattCode ? (
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-violet-700 dark:text-violet-300">Dein Gruppen-Rabattcode:</span>
            <span className="inline-flex items-center rounded-md border border-violet-400 bg-white dark:bg-violet-950 px-2 py-0.5 text-[11px] font-mono font-bold text-violet-700 dark:text-violet-200 tracking-widest select-all">
              {rabattCode}
            </span>
          </div>
        ) : (
          <p className="text-[11px] text-violet-600 dark:text-violet-400 mt-1">
            Tipp: Bei {totalQty} Artikeln lohnt sich unser <span className="font-semibold">Gruppen-Rabattcode</span> — frag beim Bestellen nach!
          </p>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Schließen"
        className="shrink-0 text-violet-400 hover:text-violet-600 transition"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
