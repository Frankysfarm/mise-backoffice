'use client';

import React, { useEffect, useState } from 'react';

interface Props {
  etaMinutes?: number;
  locationSlug?: string;
  onFensterSelected?: (offsetMinutes: number) => void;
}

const FENSTER = [
  { offset: 30,  label: '+30 Min',  desc: 'So schnell wie möglich' },
  { offset: 60,  label: '+60 Min',  desc: 'In ca. 1 Stunde' },
  { offset: 90,  label: '+90 Min',  desc: 'In ca. 1,5 Stunden' },
];

const STORAGE_KEY_PREFIX = 'mise_lieferfenster_';

export function StorefrontPhase1546LieferfensterAuswahl({
  etaMinutes = 25,
  locationSlug = '',
  onFensterSelected,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${locationSlug}`);
    if (stored) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed)) setSelected(parsed);
    }
  }, [locationSlug]);

  if (!mounted) return null;
  if (etaMinutes <= 30) return null;

  const handleSelect = (offset: number) => {
    setSelected(offset);
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${locationSlug}`, String(offset));
    onFensterSelected?.(offset);
  };

  return (
    <div className="rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🕐</span>
        <div>
          <h3 className="text-sm font-semibold text-purple-800 dark:text-purple-300">Lieferfenster wählen</h3>
          <p className="text-[11px] text-purple-600 dark:text-purple-400">
            Aktuelle ETA: ~{etaMinutes} Min — Wann soll geliefert werden?
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {FENSTER.map(f => (
          <button
            key={f.offset}
            onClick={() => handleSelect(f.offset)}
            className={`rounded-lg border text-left px-3 py-2 transition-all ${
              selected === f.offset
                ? 'border-purple-500 bg-purple-500 text-white'
                : 'border-purple-300 dark:border-purple-700 bg-white/70 dark:bg-black/20 hover:border-purple-400 text-purple-800 dark:text-purple-300'
            }`}
          >
            <div className="text-sm font-bold">{f.label}</div>
            <div className={`text-[10px] mt-0.5 ${selected === f.offset ? 'text-purple-100' : 'text-muted-foreground'}`}>
              {f.desc}
            </div>
          </button>
        ))}
      </div>
      {selected && (
        <p className="text-[11px] text-purple-600 dark:text-purple-400 text-center">
          ✓ Lieferfenster {FENSTER.find(f => f.offset === selected)?.label} ausgewählt
        </p>
      )}
    </div>
  );
}
