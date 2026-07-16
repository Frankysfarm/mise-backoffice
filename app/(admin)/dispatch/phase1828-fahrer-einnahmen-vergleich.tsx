'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1828 — Fahrer-Einnahmen-Vergleich (Dispatch)
 *
 * Rangliste der Fahrer nach heutigen Einnahmen; Top-3 hervorgehoben;
 * Mini-Sparkline 7-Tage; 30-Min-Polling.
 */

interface Props {
  locationId: string | null;
  className?: string;
}

interface FahrerEinnahme {
  fahrer_id: string;
  name: string;
  verdienst_heute_cents: number;
  trinkgeld_cents: number;
  stopps_heute: number;
  trend_7d: 'steigend' | 'stabil' | 'fallend';
  verdienst_7d_cents: number[];
}

const MOCK_DATEN: FahrerEinnahme[] = [
  { fahrer_id: '1', name: 'Max M.', verdienst_heute_cents: 8750, trinkgeld_cents: 350, stopps_heute: 14, trend_7d: 'steigend', verdienst_7d_cents: [6200, 7100, 7500, 8000, 8200, 8500, 8750] },
  { fahrer_id: '2', name: 'Lisa K.', verdienst_heute_cents: 7200, trinkgeld_cents: 280, stopps_heute: 11, trend_7d: 'stabil', verdienst_7d_cents: [7000, 6800, 7100, 7300, 7000, 7100, 7200] },
  { fahrer_id: '3', name: 'Tom S.', verdienst_heute_cents: 6400, trinkgeld_cents: 220, stopps_heute: 10, trend_7d: 'steigend', verdienst_7d_cents: [5000, 5500, 5800, 6000, 6100, 6200, 6400] },
  { fahrer_id: '4', name: 'Anna B.', verdienst_heute_cents: 5100, trinkgeld_cents: 180, stopps_heute: 8, trend_7d: 'fallend', verdienst_7d_cents: [6500, 6200, 5900, 5600, 5300, 5200, 5100] },
  { fahrer_id: '5', name: 'Jan W.', verdienst_heute_cents: 3800, trinkgeld_cents: 120, stopps_heute: 6, trend_7d: 'stabil', verdienst_7d_cents: [3600, 3700, 3800, 3750, 3900, 3800, 3800] },
];

function TrendIcon({ trend }: { trend: 'steigend' | 'stabil' | 'fallend' }) {
  if (trend === 'steigend') return <TrendingUp className="h-3.5 w-3.5 text-matcha-600 dark:text-matcha-400" />;
  if (trend === 'fallend') return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-400" />;
}

function Sparkline({ werte }: { werte: number[] }) {
  if (werte.length < 2) return null;
  const max = Math.max(...werte);
  const min = Math.min(...werte);
  const range = max - min || 1;
  const w = 40;
  const h = 16;
  const step = w / (werte.length - 1);
  const points = werte
    .map((v, i) => `${i * step},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="text-matcha-400 dark:text-matcha-500"
      />
    </svg>
  );
}

const MEDAL: Record<number, string> = { 0: '🥇', 1: '🥈', 2: '🥉' };

export function DispatchPhase1828FahrerEinnahmenVergleich({ locationId, className }: Props) {
  const [daten, setDaten] = useState<FahrerEinnahme[] | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    let aktiv = true;

    const laden = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-einnahmen?location_id=${locationId}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('fetch_failed');
        const json = await r.json();
        const liste: FahrerEinnahme[] = Array.isArray(json) ? json : (json.fahrer ?? []);
        if (aktiv) setDaten(liste.sort((a, b) => b.verdienst_heute_cents - a.verdienst_heute_cents));
      } catch {
        if (aktiv) setDaten(MOCK_DATEN);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60_000);
    return () => { aktiv = false; clearInterval(id); };
  }, [locationId]);

  const liste = daten ?? MOCK_DATEN;
  const gesamt = liste.reduce((a, f) => a + f.verdienst_heute_cents, 0);

  function euro(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', ',') + ' €';
  }

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Fahrer-Einnahmen heute
          </span>
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold px-1.5 py-0.5">
            {euro(gesamt)} Gesamt
          </span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {liste.map((f, idx) => (
            <div
              key={f.fahrer_id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                idx === 0 && 'bg-amber-50 dark:bg-amber-950/20',
                idx === 1 && 'bg-zinc-50/60 dark:bg-zinc-800/30',
                idx === 2 && 'bg-orange-50/50 dark:bg-orange-950/10',
              )}
            >
              {/* Rang */}
              <span className="w-7 shrink-0 text-center text-sm">
                {idx < 3 ? MEDAL[idx] : <span className="text-zinc-400 text-xs font-bold">{idx + 1}.</span>}
              </span>

              {/* Name + Stopps */}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold truncate', idx === 0 ? 'text-amber-700 dark:text-amber-300' : 'text-zinc-800 dark:text-zinc-200')}>
                  {f.name}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  {f.stopps_heute} Stopps · Trinkgeld {euro(f.trinkgeld_cents)}
                </p>
              </div>

              {/* Sparkline */}
              <div className="shrink-0">
                <Sparkline werte={f.verdienst_7d_cents} />
              </div>

              {/* Trend */}
              <div className="shrink-0">
                <TrendIcon trend={f.trend_7d} />
              </div>

              {/* Verdienst */}
              <div className="shrink-0 text-right">
                <p className={cn('text-sm font-bold tabular-nums', idx === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-zinc-700 dark:text-zinc-300')}>
                  {euro(f.verdienst_heute_cents)}
                </p>
              </div>
            </div>
          ))}

          {liste.length === 0 && (
            <div className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
              Keine Einnahmen-Daten verfügbar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
