'use client';

import React from 'react';

interface KategorieEffizienz {
  kategorie: string;
  avg_min: number;
  ziel_min: number;
}

interface Props {
  kategorien?: KategorieEffizienz[];
}

function ampel(avg: number, ziel: number): { cls: string; label: string } {
  const ratio = avg / ziel;
  if (ratio <= 1) return { cls: 'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300', label: '✓ Ziel erreicht' };
  if (ratio <= 1.25) return { cls: 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300', label: '~ Leicht über Ziel' };
  return { cls: 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300', label: '⚠ Über Ziel' };
}

const DEFAULT: KategorieEffizienz[] = [
  { kategorie: 'Burger', avg_min: 8, ziel_min: 10 },
  { kategorie: 'Pizza', avg_min: 14, ziel_min: 12 },
  { kategorie: 'Salat', avg_min: 5, ziel_min: 6 },
  { kategorie: 'Pasta', avg_min: 11, ziel_min: 10 },
];

export function KitchenPhase1538ZubereitungsEffizienzBoard({ kategorien = DEFAULT }: Props) {
  if (kategorien.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">⏱</span>
        <h3 className="text-sm font-semibold">Zubereitungs-Effizienz</h3>
      </div>
      <div className="grid gap-2">
        {kategorien.map(k => {
          const { cls, label } = ampel(k.avg_min, k.ziel_min);
          const pct = Math.min(100, Math.round((k.avg_min / k.ziel_min) * 100));
          return (
            <div key={k.kategorie} className={`rounded-lg border px-3 py-2 ${cls}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{k.kategorie}</span>
                <span className="text-xs">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-current opacity-50"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-mono whitespace-nowrap">
                  {k.avg_min} / {k.ziel_min} Min
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
