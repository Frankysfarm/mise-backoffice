'use client';

/**
 * DispatchQualityScoreWidget — Kompakter Quality-Score-Überblick im Dispatch-Board.
 *
 * Zeigt den heutigen Gesamt-Qualitäts-Score (A–F) mit den 5 Dimensionen als
 * Mini-Balken. Dispatcher sehen sofort wie gut die Schicht läuft.
 *
 * Datenquelle: GET /api/delivery/admin/quality-score?action=dashboard
 * Aktualisierung: alle 5 Minuten.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Award, ChevronDown, ChevronUp, Loader2, RefreshCw } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface QualityScoreToday {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  onTimeScore: number;
  driverScore: number;
  kitchenScore: number;
  customerScore: number;
  slaScore: number;
}

interface QualityDashboard {
  today: QualityScoreToday | null;
  yesterday: QualityScoreToday | null;
  weeklyAvg: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300' },
  B: { bg: 'bg-lime-50',     text: 'text-lime-700',    border: 'border-lime-300'    },
  C: { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300'   },
  D: { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300'  },
  F: { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300'     },
};

const DIMENSIONS: { key: keyof QualityScoreToday; label: string }[] = [
  { key: 'onTimeScore',    label: 'Pünktlichkeit' },
  { key: 'driverScore',    label: 'Fahrer'        },
  { key: 'kitchenScore',   label: 'Küche'         },
  { key: 'customerScore',  label: 'Bewertungen'   },
  { key: 'slaScore',       label: 'SLA'           },
];

function bar(value: number): string {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-lime-500';
  if (value >= 40) return 'bg-amber-400';
  return 'bg-red-500';
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DispatchQualityScoreWidget({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<QualityDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (!locationId) return;
    if (showRefresh) setRefreshing(true);
    try {
      const r = await fetch(
        `/api/delivery/admin/quality-score?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!r.ok) return;
      const json = await r.json() as { ok?: boolean; data?: QualityDashboard } & QualityDashboard;
      // API may return { ok, data } or the dashboard directly
      const dashboard: QualityDashboard = json.data ?? json;
      setData(dashboard);
    } catch {
      // Optional — ignore silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => load(), 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;
  if (loading) return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-2 text-xs text-stone-400">
      <Loader2 size={13} className="animate-spin" />
      Lade Qualitäts-Score…
    </div>
  );
  if (!data?.today) return null;

  const today = data.today;
  const gs = GRADE_STYLE[today.grade] ?? GRADE_STYLE['C'];
  const delta = data.yesterday
    ? Math.round(today.overallScore - data.yesterday.overallScore)
    : null;

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', gs.border)}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition text-left"
        onClick={() => setOpen(o => !o)}
      >
        {/* Grade badge */}
        <div className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black border shrink-0',
          gs.bg, gs.text, gs.border,
        )}>
          {today.grade}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Award size={12} className={gs.text} />
            <span className="text-xs font-bold uppercase tracking-wider text-char">
              Qualitäts-Score
            </span>
          </div>
          <div className="text-[11px] text-stone-400 mt-0.5 flex items-center gap-2">
            <span>Heute: <strong className={gs.text}>{Math.round(today.overallScore)}/100</strong></span>
            {delta !== null && (
              <span className={cn('font-bold', delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} vs. gestern
              </span>
            )}
            {data.weeklyAvg !== null && (
              <span className="text-stone-300">· Ø 7d: {Math.round(data.weeklyAvg)}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); void load(true); }}
            className="p-1 rounded-lg hover:bg-stone-100 transition"
            aria-label="Aktualisieren"
          >
            <RefreshCw size={12} className={cn('text-stone-400', refreshing && 'animate-spin')} />
          </button>
          {open
            ? <ChevronUp size={13} className="text-stone-400" />
            : <ChevronDown size={13} className="text-stone-300" />}
        </div>
      </button>

      {/* Expanded dimension details */}
      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-2.5">
          {DIMENSIONS.map(({ key, label }) => {
            const val = (today[key] as number) ?? 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[11px] text-stone-500">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', bar(val))}
                    style={{ width: `${Math.round(val)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums text-stone-600">
                  {Math.round(val)}
                </span>
              </div>
            );
          })}

          {data.yesterday && (
            <div className="flex items-center gap-2 pt-1 border-t border-stone-100 text-[10px] text-stone-400">
              <span>Gestern: Note {data.yesterday.grade} · {Math.round(data.yesterday.overallScore)}/100</span>
              {data.weeklyAvg !== null && (
                <span className="ml-auto">7d-Ø: {Math.round(data.weeklyAvg)}/100</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
