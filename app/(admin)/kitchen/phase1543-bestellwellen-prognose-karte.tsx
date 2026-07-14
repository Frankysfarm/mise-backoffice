'use client';

import React from 'react';

interface WellenSlot {
  uhrzeit: string;
  niveau: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  prognose: number;
}

interface Props {
  slots?: WellenSlot[];
}

const NIVEAU_STYLE: Record<string, string> = {
  niedrig:  'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
  mittel:   'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300',
  hoch:     'bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300',
  kritisch: 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300',
};

const NIVEAU_ICON: Record<string, string> = {
  niedrig: '🟢', mittel: '🟡', hoch: '🟠', kritisch: '🔴',
};

function classify(prognose: number): WellenSlot['niveau'] {
  if (prognose >= 20) return 'kritisch';
  if (prognose >= 12) return 'hoch';
  if (prognose >= 6)  return 'mittel';
  return 'niedrig';
}

function defaultSlots(): WellenSlot[] {
  const now = new Date();
  const h   = now.getHours();
  const pattern = [4, 7, 14, 9, 22, 18, 8, 5, 3, 2, 1, 0];
  return [0, 1, 2].map(offset => {
    const hour = h + offset;
    const prognose = pattern[hour % pattern.length];
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      uhrzeit: `${pad(hour % 24)}:00`,
      prognose,
      niveau: classify(prognose),
    };
  });
}

export function KitchenPhase1543BestellwellenPrognoseKarte({ slots = defaultSlots() }: Props) {
  if (slots.length === 0) return null;
  const maxProg = Math.max(...slots.map(s => s.prognose), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🌊</span>
        <h3 className="text-sm font-semibold">Bestellwellen-Prognose</h3>
        <span className="text-xs text-muted-foreground">nächste 3h</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {slots.map(s => {
          const pct = Math.round((s.prognose / maxProg) * 100);
          const { cls } = { cls: NIVEAU_STYLE[s.niveau] };
          return (
            <div key={s.uhrzeit} className={`rounded-lg border px-3 py-2 space-y-1.5 ${cls}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold font-mono">{s.uhrzeit}</span>
                <span className="text-sm">{NIVEAU_ICON[s.niveau]}</span>
              </div>
              <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-current opacity-60 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="capitalize">{s.niveau}</span>
                <span className="font-semibold font-mono">~{s.prognose}</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">Prognose basiert auf historischem Bestellmuster</p>
    </div>
  );
}
