'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1754 — Fahrer-Pünktlichkeits-Ranking (Dispatch)
 *
 * Tabelle Fahrer + Pünktlichkeits-Quote + Grade + Trend-Pfeil + Alert-Badge.
 * GET /api/delivery/admin/fahrer-puenktlichkeit?location_id=<id>
 * 30-Min-Polling.
 */

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_stopps: number;
  puenktlich: number;
  zu_spaet: number;
  quote_pct: number;
  grade: 'A' | 'B' | 'C' | 'D';
  trend: 'besser' | 'gleich' | 'schlechter';
}

interface Props {
  locationId: string | null;
  className?: string;
}

const MOCK: FahrerPuenktlichkeit[] = [
  { fahrer_id: 'm1', fahrer_name: 'Max M.',  gesamt_stopps: 42, puenktlich: 39, zu_spaet:  3, quote_pct: 92.9, grade: 'A', trend: 'besser' },
  { fahrer_id: 'm2', fahrer_name: 'Sara K.', gesamt_stopps: 38, puenktlich: 31, zu_spaet:  7, quote_pct: 81.6, grade: 'B', trend: 'gleich' },
  { fahrer_id: 'm3', fahrer_name: 'Tim B.',  gesamt_stopps: 29, puenktlich: 20, zu_spaet:  9, quote_pct: 69.0, grade: 'C', trend: 'schlechter' },
  { fahrer_id: 'm4', fahrer_name: 'Lisa F.', gesamt_stopps: 19, puenktlich: 10, zu_spaet:  9, quote_pct: 52.6, grade: 'D', trend: 'gleich' },
];

const gradeColor: Record<string, string> = {
  A: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30',
  B: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30',
  C: 'text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30',
  D: 'text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30',
};

const trendIcon = {
  besser: TrendingUp,
  gleich: Minus,
  schlechter: TrendingDown,
};
const trendColor = {
  besser: 'text-green-500',
  gleich: 'text-muted-foreground',
  schlechter: 'text-red-500',
};

export function DispatchPhase1754FahrerPuenktlichkeitsRanking({ locationId, className }: Props) {
  const [open, setOpen] = useState(true);
  const [rangliste, setRangliste] = useState<FahrerPuenktlichkeit[]>(MOCK);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          if (j.rangliste?.length) setRangliste(j.rangliste);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  const schlechteFahrer = rangliste.filter(f => f.grade === 'D').length;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-500" />
          <span className="text-sm font-bold">Pünktlichkeits-Ranking</span>
          {schlechteFahrer > 0 && (
            <span className="text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
              {schlechteFahrer}× Grade D
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="space-y-1.5">
            {rangliste.map((f, i) => {
              const TrendIcon = trendIcon[f.trend];
              return (
                <div
                  key={f.fahrer_id}
                  className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                  <span className="flex-1 text-xs font-medium truncate">{f.fahrer_name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{f.gesamt_stopps} Stopps</span>
                  <span className={cn('text-xs font-black tabular-nums', f.quote_pct >= 80 ? 'text-green-600 dark:text-green-400' : f.quote_pct >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400')}>
                    {f.quote_pct.toFixed(1)}%
                  </span>
                  <TrendIcon className={cn('h-3 w-3', trendColor[f.trend])} />
                  <span className={cn('text-[10px] font-black px-1.5 py-0.5 rounded', gradeColor[f.grade])}>
                    {f.grade}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">Letzte 7 Tage • 30-Min-Update</p>
        </div>
      )}
    </div>
  );
}
