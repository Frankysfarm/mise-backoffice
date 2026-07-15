'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, TrendingDown, TrendingUp } from 'lucide-react';
import type { SchichtQualitaetScoreAntwort, FahrerQualitaetsScore, QualitaetsGrade } from '@/app/api/delivery/admin/schicht-qualitaet-score/route';

/**
 * Phase 1799 — Mein Qualitäts-Score-Verlauf (Fahrer-App)
 *
 * Eigener Score letzte 7 Tage als Miniaturdiagramm + Vergleich Team-Ø;
 * isOnline-Guard; 30-Min-Polling; in fahrer/app/client.tsx.
 */

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const GRADE_FARBE: Record<QualitaetsGrade, string> = {
  A: 'text-matcha-600 dark:text-matcha-400',
  B: 'text-blue-600 dark:text-blue-400',
  C: 'text-amber-600 dark:text-amber-400',
  D: 'text-red-600 dark:text-red-400',
};

function ScoreChart({ verlauf }: { verlauf: number[] }) {
  const values = [...verlauf].reverse();
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const range = max - min || 1;
  const W = 160;
  const H = 48;
  const pad = 4;

  const pts = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (W - 2 * pad);
      const y = H - pad - ((v - min) / range) * (H - 2 * pad);
      return `${x},${y}`;
    })
    .join(' ');

  const dotX = pad + ((values.length - 1) / Math.max(values.length - 1, 1)) * (W - 2 * pad);
  const dotY = H - pad - ((values[values.length - 1] - min) / range) * (H - 2 * pad);

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-12">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
        className="text-saffron"
      />
      <circle cx={dotX} cy={dotY} r="3" className="fill-saffron" />
    </svg>
  );
}

export function FahrerPhase1799MeinQualitaetsScoreVerlauf({ driverId, locationId, isOnline, className }: Props) {
  const [data, setData] = useState<FahrerQualitaetsScore | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-qualitaet-score?location_id=${locationId}`);
      if (res.ok) {
        const json: SchichtQualitaetScoreAntwort = await res.json();
        setTeamAvg(json.team_avg_score);
        const mein = json.fahrer.find(f => f.fahrer_id === driverId);
        if (mein) {
          setData(mein);
        } else if (json.fahrer.length > 0) {
          // Fallback: erster Fahrer (Demo)
          setData(json.fahrer[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isOnline || !locationId) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId, driverId]);

  if (!isOnline) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 mb-3', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-4 w-4 text-saffron" />
        <span className="text-sm font-bold">Mein Qualitäts-Score</span>
        {loading && <span className="text-[10px] text-muted-foreground animate-pulse">Laden…</span>}
      </div>

      {data ? (
        <div className="space-y-3">
          {/* Score-Hauptanzeige */}
          <div className="flex items-center justify-between">
            <div>
              <p className={cn('text-4xl font-black tabular-nums', GRADE_FARBE[data.grade])}>
                {data.score}
              </p>
              <p className="text-[10px] text-muted-foreground">Qualitäts-Score (0–100)</p>
            </div>
            <div className="text-right">
              <div className={cn(
                'text-2xl font-black',
                GRADE_FARBE[data.grade],
              )}>
                Grade {data.grade}
              </div>
              {teamAvg !== null && (
                <p className="text-[10px] text-muted-foreground">
                  Team-Ø {teamAvg} Punkte
                </p>
              )}
            </div>
          </div>

          {/* Trend */}
          <div className="flex items-center gap-1.5">
            {data.trend === 'steigend' ? (
              <TrendingUp className="h-4 w-4 text-matcha-500" />
            ) : data.trend === 'fallend' ? (
              <TrendingDown className="h-4 w-4 text-red-500" />
            ) : null}
            <span className={cn(
              'text-xs font-semibold',
              data.trend === 'steigend' ? 'text-matcha-600 dark:text-matcha-400'
                : data.trend === 'fallend' ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}>
              {data.trend === 'steigend'
                ? `↑ +${Math.abs(data.trend_delta)} Punkte (7 Tage)`
                : data.trend === 'fallend'
                ? `↓ −${Math.abs(data.trend_delta)} Punkte (7 Tage)`
                : 'Stabil (7 Tage)'}
            </span>
          </div>

          {/* 7-Tage-Chart */}
          <div>
            <p className="text-[10px] text-muted-foreground mb-1">Verlauf letzte 7 Tage</p>
            <div className="rounded-lg bg-muted/40 px-2 py-1">
              <ScoreChart verlauf={data.verlauf_7_tage} />
            </div>
            <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
              <span>vor 7 Tagen</span>
              <span>heute</span>
            </div>
          </div>

          {/* Detail-Breakdown */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
              <p className="text-sm font-black tabular-nums text-foreground">{data.puenktlichkeit_pct}%</p>
              <p className="text-[9px] text-muted-foreground">Pünktlich</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
              <p className="text-sm font-black tabular-nums text-foreground">{data.bewertung_avg.toFixed(1)}★</p>
              <p className="text-[9px] text-muted-foreground">Bewertung</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-2 py-2 text-center">
              <p className="text-sm font-black tabular-nums text-foreground">{data.vollstaendigkeit_pct}%</p>
              <p className="text-[9px] text-muted-foreground">Vollständig</p>
            </div>
          </div>

          {/* Vergleich Team */}
          {teamAvg !== null && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="text-xs text-muted-foreground">vs. Team-Ø</span>
              <span className={cn(
                'text-sm font-black tabular-nums',
                data.score >= teamAvg ? 'text-matcha-600 dark:text-matcha-400' : 'text-red-600 dark:text-red-400',
              )}>
                {data.score >= teamAvg ? '+' : ''}{data.score - teamAvg} Punkte
              </span>
            </div>
          )}
        </div>
      ) : !loading && (
        <p className="text-sm text-muted-foreground text-center py-3">
          {locationId ? 'Keine Score-Daten verfügbar.' : 'Bitte Filiale auswählen.'}
        </p>
      )}
    </div>
  );
}
