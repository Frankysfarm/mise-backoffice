'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import type { SchichtQualitaetScoreAntwort, FahrerQualitaetsScore, QualitaetsGrade } from '@/app/api/delivery/admin/schicht-qualitaet-score/route';

/**
 * Phase 1798 — Schicht-Qualität-Scorecard (Dispatch)
 *
 * Phase1796-API: Tabelle Fahrer + Gesamt-Score + Trend-Pfeil + Farb-Badge;
 * 30-Min-Polling; in dispatch/client.tsx.
 */

interface Props {
  locationId: string | null;
  className?: string;
}

const GRADE_STYLE: Record<QualitaetsGrade, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-matcha-100 dark:bg-matcha-900/40', text: 'text-matcha-700 dark:text-matcha-300', border: 'border-matcha-200 dark:border-matcha-800' },
  B: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800' },
  C: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800' },
  D: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', border: 'border-red-200 dark:border-red-800' },
};

function TrendPfeil({ trend, trend_delta: delta }: Pick<FahrerQualitaetsScore, 'trend' | 'trend_delta'>) {
  if (trend === 'steigend') {
    return (
      <span className="flex items-center gap-0.5 text-matcha-600 dark:text-matcha-400 text-[10px] font-bold">
        <TrendingUp className="h-3 w-3" />+{Math.abs(delta)}
      </span>
    );
  }
  if (trend === 'fallend') {
    return (
      <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-[10px] font-bold">
        <TrendingDown className="h-3 w-3" />-{Math.abs(delta)}
      </span>
    );
  }
  return <span className="text-[10px] text-muted-foreground">—</span>;
}

function MiniSparkline({ verlauf }: { verlauf: number[] }) {
  const min = Math.min(...verlauf);
  const max = Math.max(...verlauf);
  const range = max - min || 1;
  const w = 40;
  const h = 16;
  const pts = verlauf
    .slice()
    .reverse()
    .map((v, i) => {
      const x = (i / (verlauf.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-saffron"
      />
    </svg>
  );
}

export function DispatchPhase1798SchichtQualitaetScorecard({ locationId, className }: Props) {
  const [data, setData] = useState<SchichtQualitaetScoreAntwort | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-qualitaet-score?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(new Date());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const schlechteFahrer = (data?.fahrer ?? []).filter(f => f.grade === 'D');

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Schicht-Qualität-Scorecard</span>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {schlechteFahrer.length > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              {schlechteFahrer.length}× Grade D
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs text-muted-foreground">
              Team-Ø <span className="font-black text-foreground tabular-nums">{data.team_avg_score}</span>
            </span>
          )}
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground">
              {lastFetch.getHours().toString().padStart(2, '0')}:{lastFetch.getMinutes().toString().padStart(2, '0')} Uhr
            </span>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {schlechteFahrer.length > 0 && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
            <p className="text-xs font-bold text-red-800 dark:text-red-200">
              {schlechteFahrer.length} Fahrer mit Grade D — Qualitätsgespräch empfohlen.
            </p>
          </div>
        )}

        {data && data.fahrer.length > 0 ? (
          <div className="space-y-1.5">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-1 text-[10px] text-muted-foreground uppercase tracking-wide">
              <span>Fahrer</span>
              <span className="text-right">Score</span>
              <span className="text-right">Pünktl.</span>
              <span className="text-right">Bewert.</span>
              <span className="text-right">Trend</span>
            </div>

            {data.fahrer.map(f => {
              const gs = GRADE_STYLE[f.grade];
              return (
                <div
                  key={f.fahrer_id}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center rounded-lg px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors"
                >
                  {/* Name + Grade + Sparkline */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn(
                      'shrink-0 rounded-full w-6 h-6 flex items-center justify-center text-[11px] font-black border',
                      gs.bg, gs.text, gs.border,
                    )}>
                      {f.grade}
                    </span>
                    <span className="text-xs font-semibold truncate">{f.name}</span>
                    <MiniSparkline verlauf={f.verlauf_7_tage} />
                  </div>

                  {/* Score */}
                  <span className={cn('text-sm font-black tabular-nums', gs.text)}>{f.score}</span>

                  {/* Pünktlichkeit */}
                  <span className="text-xs tabular-nums text-muted-foreground">{f.puenktlichkeit_pct}%</span>

                  {/* Bewertung */}
                  <span className="text-xs tabular-nums text-muted-foreground">{f.bewertung_avg.toFixed(1)}★</span>

                  {/* Trend */}
                  <TrendPfeil trend={f.trend} trend_delta={f.trend_delta} />
                </div>
              );
            })}
          </div>
        ) : !loading && (
          <p className="text-sm text-muted-foreground text-center py-3">
            {locationId ? 'Keine Fahrer-Daten für heute.' : 'Bitte Filiale auswählen.'}
          </p>
        )}
      </div>
    </div>
  );
}
