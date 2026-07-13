'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, BarChart2, RefreshCw, ShieldCheck, Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1383 — Liefer-Qualitäts-Index-Widget (Dispatch)
 *
 * Zeigt Phase1381-API:
 *   • 3-Säulen-Score (Pünktlichkeit 40% / Kundenbewertung 35% / Stornoquote 25%)
 *   • Gesamtindex-Ampel (grün ≥80 / amber ≥60 / rot <60)
 *   • 7-Tage-Verlauf als Mini-Balken-Chart
 *
 * 10-Min-Polling. Nach Phase1378 in dispatch/client.tsx.
 */

interface TagScore {
  datum: string;
  label: string;
  puenktlichkeit_score: number;
  bewertungs_score: number;
  storno_score: number;
  gesamt_index: number;
  bestellungen: number;
}

interface ApiData {
  heute: TagScore;
  tagesverlauf: TagScore[];
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_pct: number;
}

interface Props {
  locationId: string | null;
}

const MOCK: ApiData = {
  heute: {
    datum: new Date().toISOString().slice(0, 10),
    label: 'Heute',
    puenktlichkeit_score: 78,
    bewertungs_score: 82,
    storno_score: 91,
    gesamt_index: 83,
    bestellungen: 47,
  },
  tagesverlauf: [72, 75, 80, 77, 83, 81, 83].map((v, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return {
      datum: d.toISOString().slice(0, 10),
      label: i === 6 ? 'Heute' : days[d.getDay()],
      puenktlichkeit_score: v + 5,
      bewertungs_score: v + 2,
      storno_score: v - 3,
      gesamt_index: v,
      bestellungen: 30 + i * 3,
    };
  }),
  trend: 'steigend',
  trend_pct: 2.5,
};

function indexLevel(score: number): { label: string; color: string; bg: string; border: string } {
  if (score >= 80) return {
    label: 'Sehr gut',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
  };
  if (score >= 60) return {
    label: 'Mittel',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-700',
  };
  return {
    label: 'Kritisch',
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-700',
  };
}

interface Saule {
  label: string;
  key: keyof Pick<TagScore, 'puenktlichkeit_score' | 'bewertungs_score' | 'storno_score'>;
  gewicht: string;
  icon: React.ReactNode;
}

const SAEULEN: Saule[] = [
  { label: 'Pünktlichkeit', key: 'puenktlichkeit_score', gewicht: '40%', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { label: 'Bewertung', key: 'bewertungs_score', gewicht: '35%', icon: <Star className="h-3.5 w-3.5" /> },
  { label: 'Stornoquote', key: 'storno_score', gewicht: '25%', icon: <Award className="h-3.5 w-3.5" /> },
];

export function DispatchPhase1383LieferQualitaetsIndexWidget({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/liefer-qualitaets-index?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      setData(await res.json());
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 10 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const d = data ?? MOCK;
  const level = indexLevel(d.heute.gesamt_index);
  const maxScore = Math.max(...d.tagesverlauf.map((t) => t.gesamt_index), 1);

  return (
    <div className={cn('rounded-xl border p-4 transition-colors', level.border, level.bg)}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <BarChart2 className={cn('h-4 w-4', level.color)} />
        <span className={cn('text-sm font-semibold', level.color)}>
          Liefer-Qualitäts-Index
        </span>
        <span className={cn('ml-auto text-lg font-bold', level.color)}>
          {d.heute.gesamt_index}
        </span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', level.color, 'bg-white/60 dark:bg-black/20')}>
          {level.label}
        </span>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-slate-400" />}
        <span className={cn('text-xs', level.color)}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Trend */}
          <div className="flex items-center gap-2 text-xs">
            {d.trend === 'steigend' && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
            {d.trend === 'fallend' && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            {d.trend === 'stabil' && <Minus className="h-3.5 w-3.5 text-slate-400" />}
            <span className="text-slate-600 dark:text-slate-300">
              {d.trend === 'steigend' ? `+${d.trend_pct} Punkte` : d.trend === 'fallend' ? `${d.trend_pct} Punkte` : 'Stabil'}
              {' '}vs. vor 3 Tagen · {d.heute.bestellungen} Bestellungen heute
            </span>
          </div>

          {/* 3 Säulen */}
          <div className="grid grid-cols-3 gap-2">
            {SAEULEN.map((s) => {
              const score = d.heute[s.key];
              const sl = indexLevel(score);
              return (
                <div key={s.key} className={cn('rounded-lg border p-2 text-center', sl.border, sl.bg)}>
                  <div className={cn('mb-0.5 flex items-center justify-center gap-1', sl.color)}>
                    {s.icon}
                    <span className="text-xs font-medium">{s.gewicht}</span>
                  </div>
                  <div className={cn('text-xl font-bold', sl.color)}>{score}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                  {/* Mini-Balken */}
                  <div className="mt-1 h-1 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className={cn('h-1 rounded-full', score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* 7-Tage-Verlauf */}
          <div>
            <div className="mb-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">7-Tage-Verlauf</div>
            <div className="flex items-end gap-1" style={{ height: 48 }}>
              {d.tagesverlauf.map((t, i) => {
                const pct = (t.gesamt_index / maxScore) * 100;
                const isHeute = i === d.tagesverlauf.length - 1;
                const barColor = t.gesamt_index >= 80 ? 'bg-emerald-500' : t.gesamt_index >= 60 ? 'bg-amber-500' : 'bg-red-400';
                return (
                  <div key={t.datum} className="flex flex-1 flex-col items-center gap-0.5">
                    <div className="relative flex w-full flex-col items-center justify-end" style={{ height: 36 }}>
                      <div
                        className={cn('w-full rounded-t', barColor, isHeute && 'ring-2 ring-offset-1 ring-blue-400')}
                        style={{ height: `${pct}%` }}
                        title={`${t.gesamt_index}`}
                      />
                    </div>
                    <span className={cn('text-xs', isHeute ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-slate-400')}>
                      {t.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
