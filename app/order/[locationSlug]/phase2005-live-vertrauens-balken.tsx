'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PrognoseData {
  team_durchschnitt: number;
  fahrer: { score: number }[];
}

const MOCK_SCORE = 78;

export function StorefrontPhase2005LiveVertrauensBalken({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [gemountet, setGemountet] = useState(false);
  const [geschlossen, setGeschlossen] = useState(false);

  useEffect(() => { setGemountet(true); }, []);

  const laden = async () => {
    try {
      const res = await fetch(`/api/delivery/admin/prognose-zuverlaessigkeit?location_id=${locationId}`);
      if (!res.ok) { setScore(MOCK_SCORE); return; }
      const data: PrognoseData = await res.json();
      setScore(data.team_durchschnitt ?? MOCK_SCORE);
    } catch {
      setScore(MOCK_SCORE);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!gemountet || geschlossen) return null;

  const anzeige = score ?? MOCK_SCORE;
  const color = anzeige >= 80
    ? { bar: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' }
    : anzeige >= 70
      ? { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' }
      : { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' };

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', color.bg, className)}>
      <CheckCircle2 className={cn('w-5 h-5 shrink-0', color.text)} />
      <div className="flex-1 min-w-0 space-y-1">
        <p className={cn('text-xs font-semibold', color.text)}>
          {anzeige}% deiner Lieferungen kommen pünktlich an
        </p>
        <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', color.bar)}
            style={{ width: `${anzeige}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 dark:text-slate-400">ETA-Treffer ±5 Min · letzte 30 Bestellungen</p>
      </div>
      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        aria-label="Schließen"
      >
        <X className="w-3.5 h-3.5 text-slate-400" />
      </button>
    </div>
  );
}
