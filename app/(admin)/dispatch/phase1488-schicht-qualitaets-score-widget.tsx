'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { SchichtQualitaetsScoreResponse } from '@/app/api/delivery/admin/schicht-qualitaets-score/route';

// Phase 1488 — Schicht-Qualitäts-Score-Widget (Dispatch)
// Phase1486-API: Score-Gauge + Einzel-KPIs + Vergleich Vorwoche; 10-Min-Polling.
// Nach Phase1483.

interface Props {
  locationId: string | null;
}

const POLL_MS = 10 * 60_000;

const MOCK: SchichtQualitaetsScoreResponse = {
  gesamt_score: 82.4,
  vorwoche_score: 79.5,
  delta: 2.9,
  trend: 'besser',
  status: 'gut',
  komponenten: [
    { name: 'Pünktlichkeit', wert: 84, gewicht: 40, beitrag: 33.6, status: 'gut' },
    { name: 'Kundenbewertung', wert: 78, gewicht: 30, beitrag: 23.4, status: 'gut' },
    { name: 'Storno-Quote (inv.)', wert: 91, gewicht: 20, beitrag: 18.2, status: 'gut' },
    { name: 'Fahrer-Verfügbarkeit', wert: 82, gewicht: 10, beitrag: 8.2, status: 'gut' },
  ],
  location_id: 'mock',
  datum: new Date().toISOString().slice(0, 10),
  generiert_am: new Date().toISOString(),
};

const STATUS_CONFIG = {
  gut: { label: 'Gut', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-800', ring: 'stroke-emerald-400' },
  mittel: { label: 'Mittel', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', ring: 'stroke-amber-400' },
  schlecht: { label: 'Schwach', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', border: 'border-rose-200 dark:border-rose-800', ring: 'stroke-rose-400' },
};

const KOMP_STATUS = {
  gut: 'text-emerald-600 dark:text-emerald-400',
  mittel: 'text-amber-600 dark:text-amber-400',
  schlecht: 'text-rose-600 dark:text-rose-400',
};

const GAUGE_SIZE = 80;
const GAUGE_STROKE = 7;
const GAUGE_R = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

function TrendIcon({ trend }: { trend: SchichtQualitaetsScoreResponse['trend'] }) {
  if (trend === 'besser') return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'schlechter') return <TrendingDown className="h-3.5 w-3.5 text-rose-500" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function DispatchPhase1488SchichtQualitaetsScoreWidget({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<SchichtQualitaetsScoreResponse>(MOCK);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-qualitaets-score?location_id=${locationId}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          if (typeof json?.gesamt_score === 'number') setData(json as SchichtQualitaetsScoreResponse);
        }
      } catch {}
    }

    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  const cfg = STATUS_CONFIG[data.status];
  const dashOffset = GAUGE_CIRC * (1 - data.gesamt_score / 100);

  return (
    <Card className={cn('overflow-hidden border', cfg.border)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 border-b text-left', cfg.bg, cfg.border)}
      >
        <Star className={cn('h-4 w-4 shrink-0', cfg.color)} />
        <span className={cn('text-xs font-bold uppercase tracking-wider flex-1', cfg.color)}>
          Schicht-Qualitäts-Score
        </span>
        <span className={cn('text-[10px] font-bold tabular-nums', cfg.color)}>
          {data.gesamt_score.toFixed(1)} / 100
        </span>
        <span className="ml-2 text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Gauge + delta */}
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <svg width={GAUGE_SIZE} height={GAUGE_SIZE} className="-rotate-90">
                <circle cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={GAUGE_R} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={GAUGE_STROKE} />
                <circle
                  cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={GAUGE_R}
                  fill="none" strokeWidth={GAUGE_STROKE} strokeLinecap="round"
                  strokeDasharray={GAUGE_CIRC} strokeDashoffset={dashOffset}
                  className={cfg.ring}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-base font-black tabular-nums leading-tight', cfg.color)}>
                  {data.gesamt_score.toFixed(0)}
                </span>
                <span className="text-[8px] text-muted-foreground uppercase tracking-wide">Score</span>
              </div>
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <TrendIcon trend={data.trend} />
                <span className={cn('text-sm font-black tabular-nums', cfg.color)}>
                  {data.delta > 0 ? '+' : ''}{data.delta.toFixed(1)} Punkte
                </span>
                <span className="text-[10px] text-muted-foreground">vs. Vorwoche</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Vorwoche: <span className="font-semibold text-foreground">{data.vorwoche_score.toFixed(1)}</span>
              </div>
              <div className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold', cfg.bg, cfg.color)}>
                {cfg.label}
              </div>
            </div>
          </div>

          {/* Komponenten */}
          <div className="space-y-1.5 border-t pt-3">
            {data.komponenten.map((k) => (
              <div key={k.name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-semibold text-foreground">{k.name}</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', KOMP_STATUS[k.status])}>
                      {k.wert.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', KOMP_STATUS[k.status] === 'text-emerald-600 dark:text-emerald-400' ? 'bg-emerald-400' : KOMP_STATUS[k.status] === 'text-amber-600 dark:text-amber-400' ? 'bg-amber-400' : 'bg-rose-400')}
                      style={{ width: `${k.wert}%` }}
                    />
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0 w-8 text-right">
                  {k.gewicht}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
