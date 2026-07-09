'use client';

/**
 * Phase 950 — Allergen-Schnellfilter (Storefront)
 *
 * Schaltflächen für häufige Allergene (Gluten, Laktose, Nüsse, Soja, Ei) zum Filtern der Speisekarte.
 * Props: activeAllergen (aktuell ausgewähltes Allergen oder null), onAllergenChange (Callback).
 */

import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface Props {
  activeAllergen: string | null;
  onAllergenChange: (allergen: string | null) => void;
}

const ALLERGEN_FILTERS = [
  { key: 'gluten',   label: 'Kein Gluten',   emoji: '🌾' },
  { key: 'laktose',  label: 'Kein Laktose',  emoji: '🥛' },
  { key: 'nuss',     label: 'Keine Nüsse',   emoji: '🥜' },
  { key: 'soja',     label: 'Kein Soja',     emoji: '🫘' },
  { key: 'ei',       label: 'Kein Ei',       emoji: '🥚' },
] as const;

export function Phase950AllergenSchnellfilter({ activeAllergen, onAllergenChange }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {ALLERGEN_FILTERS.map((f) => {
        const isActive = activeAllergen === f.key;
        return (
          <button
            key={f.key}
            onClick={() => onAllergenChange(isActive ? null : f.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95',
              isActive
                ? 'bg-matcha-900 text-accent shadow-sm ring-2 ring-matcha-400'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="text-[11px]">{f.emoji}</span>
            {f.label}
          </button>
        );
      })}
      {activeAllergen && (
        <button
          onClick={() => onAllergenChange(null)}
          className="ml-1 shrink-0 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-1.5 text-[10px] font-bold text-red-600 dark:text-red-400 hover:bg-red-200 transition"
        >
          ✕ Filter
        </button>
      )}
    </div>
  );
}
