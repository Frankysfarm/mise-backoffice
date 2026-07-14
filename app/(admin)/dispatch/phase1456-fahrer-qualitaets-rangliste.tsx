'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Medal, TrendingUp, TrendingDown, Minus, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { FahrerQualitaetsEintrag, FahrerQualitaetsScoreResponse } from '@/app/api/delivery/admin/fahrer-qualitaets-score/route';

// Phase 1456 — Fahrer-Qualitäts-Rangliste (Dispatch)
// Phase1454-API: Score-Badge je Fahrer + Trend-Pfeile + Top-3-Hervorhebung; 30-Min-Polling; nach Phase1451

interface Props {
  locationId?: string | null;
}

const POLL_MS = 30 * 60 * 1000;

const MOCK: FahrerQualitaetsScoreResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max Mustermann',  gesamt_score: 93, puenktlichkeits_score: 93, bewertungs_score: 94, streak_bonus_score: 93, rang: 1, trend: 'up',     bewertungs_avg: 4.7, streak_tage: 14, puenktlichkeits_quote: 0.93 },
    { fahrer_id: 'f2', fahrer_name: 'Anna Schmidt',    gesamt_score: 79, puenktlichkeits_score: 88, bewertungs_score: 90, streak_bonus_score: 53, rang: 2, trend: 'stable',  bewertungs_avg: 4.5, streak_tage: 8,  puenktlichkeits_quote: 0.88 },
    { fahrer_id: 'f3', fahrer_name: 'Tom Berger',      gesamt_score: 70, puenktlichkeits_score: 81, bewertungs_score: 84, streak_bonus_score: 33, rang: 3, trend: 'down',    bewertungs_avg: 4.2, streak_tage: 5,  puenktlichkeits_quote: 0.81 },
    { fahrer_id: 'f4', fahrer_name: 'Lisa Weber',      gesamt_score: 61, puenktlichkeits_score: 75, bewertungs_score: 78, streak_bonus_score: 13, rang: 4, trend: 'stable',  bewertungs_avg: 3.9, streak_tage: 2,  puenktlichkeits_quote: 0.75 },
  ],
  location_id: 'mock',
  basis_tage: 30,
  generiert_am: new Date().toISOString(),
};

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
  if (score >= 70) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
  return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up')     return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down')   return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

function RangBadge({ rang }: { rang: number }) {
  const colors =
    rang === 1 ? 'bg-amber-400 text-white' :
    rang === 2 ? 'bg-slate-400 text-white' :
    rang === 3 ? 'bg-orange-400 text-white' :
                 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  return (
    <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-black shrink-0', colors)}>
      {rang <= 3 ? <Medal className="w-3 h-3" /> : rang}
    </span>
  );
}

function ScoreBar({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] text-slate-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[9px] tabular-nums text-slate-500 w-6 text-right">{score}</span>
    </div>
  );
}

export function DispatchPhase1456FahrerQualitaetsRangliste({ locationId }: Props) {
  const [data, setData] = useState<FahrerQualitaetsScoreResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetch = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await globalThis.fetch(
        `/api/delivery/admin/fahrer-qualitaets-score?location_id=${locationId}`,
      );
      if (res.ok) {
        const json = await res.json() as FahrerQualitaetsScoreResponse;
        setData(json);
        setLastFetch(new Date());
      }
    } catch {
      /* keep previous */
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, POLL_MS);
    return () => clearInterval(id);
  }, [fetch]);

  const top3 = data.fahrer.slice(0, 3);
  const rest  = data.fahrer.slice(3);

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
        <Medal className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1">
          Fahrer-Qualitäts-Rangliste
        </span>
        <span className="text-[10px] text-slate-400">{data.basis_tage} Tage</span>
        <button
          onClick={fetch}
          className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('w-3 h-3 text-slate-400', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Top-3 */}
      <div className="px-4 py-3 space-y-2">
        {top3.map(f => (
          <div
            key={f.fahrer_id}
            className={cn('rounded-lg border px-3 py-2.5', scoreBg(f.gesamt_score))}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <RangBadge rang={f.rang} />
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 truncate">
                {f.fahrer_name}
              </span>
              <TrendIcon trend={f.trend} />
              <span className={cn('text-lg font-black tabular-nums', scoreColor(f.gesamt_score))}>
                {f.gesamt_score}
              </span>
            </div>
            <div className="space-y-1">
              <ScoreBar score={f.puenktlichkeits_score}  label="Pünktlichkeit" color="bg-emerald-400 dark:bg-emerald-500" />
              <ScoreBar score={f.bewertungs_score}       label="Bewertung"     color="bg-blue-400 dark:bg-blue-500" />
              <ScoreBar score={f.streak_bonus_score}     label="Streak"        color="bg-amber-400 dark:bg-amber-500" />
            </div>
            <div className="flex gap-3 mt-1.5">
              <span className="text-[9px] text-slate-400">⭐ {f.bewertungs_avg.toFixed(1)}</span>
              <span className="text-[9px] text-slate-400">🔥 {f.streak_tage}d</span>
              <span className="text-[9px] text-slate-400">⏱ {Math.round(f.puenktlichkeits_quote * 100)}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rest der Liste */}
      {rest.length > 0 && (
        <div className="px-4 pb-3 space-y-1">
          <p className="text-[10px] text-slate-400 mb-1.5">Weitere Fahrer</p>
          {rest.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2 py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
              <span className="text-xs tabular-nums text-slate-400 w-4">{f.rang}.</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={cn('text-sm font-bold tabular-nums', scoreColor(f.gesamt_score))}>{f.gesamt_score}</span>
            </div>
          ))}
        </div>
      )}

      {lastFetch && (
        <div className="flex items-center gap-1 px-4 pb-2">
          <Clock className="w-3 h-3 text-slate-300" />
          <span className="text-[9px] text-slate-300">
            {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      )}
    </Card>
  );
}
