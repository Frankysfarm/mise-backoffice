'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface Batch {
  id: string;
  driver_id?: string;
  status?: string;
  zone?: string;
  created_at?: string;
  stops?: { geliefert_am?: string | null; angekommen_am?: string | null }[];
  score?: number;
}

interface Driver {
  id: string;
  name?: string;
  vorname?: string;
  nachname?: string;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  className?: string;
}

interface ScoreRow {
  batchId: string;
  driverName: string;
  score: number;
  zone: string;
  progressPct: number;
  stopsTotal: number;
  stopsDone: number;
  stufe: 'exzellent' | 'gut' | 'ok' | 'schwach';
  laufzeitMin: number;
}

const ACTIVE_STATUSES = new Set(['dispatched', 'on_route', 'active', 'in_progress', 'collecting']);

function stufeOf(score: number): ScoreRow['stufe'] {
  if (score >= 90) return 'exzellent';
  if (score >= 75) return 'gut';
  if (score >= 60) return 'ok';
  return 'schwach';
}

const STUFE_META: Record<ScoreRow['stufe'], { bar: string; badge: string; label: string }> = {
  exzellent: { bar: 'bg-emerald-500', badge: 'bg-emerald-900 text-emerald-300', label: 'Exzellent' },
  gut:       { bar: 'bg-blue-500',    badge: 'bg-blue-900 text-blue-300',       label: 'Gut'       },
  ok:        { bar: 'bg-amber-400',   badge: 'bg-amber-900 text-amber-300',     label: 'OK'        },
  schwach:   { bar: 'bg-red-500',     badge: 'bg-red-900 text-red-300',         label: 'Schwach'   },
};

export function DispatchPhase2043TourScoreLiveVisualisierung({ batches, drivers, className }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const driverMap = new Map(drivers.map(d => [d.id, d.vorname ?? d.name ?? 'Fahrer']));

    const list: ScoreRow[] = batches
      .filter(b => ACTIVE_STATUSES.has(b.status ?? ''))
      .map(b => {
        const stops = b.stops ?? [];
        const stopsDone = stops.filter(s => s.geliefert_am).length;
        const progressPct = stops.length > 0 ? Math.round((stopsDone / stops.length) * 100) : 0;
        const now = Date.now();
        const laufzeitMin = b.created_at
          ? Math.floor((now - new Date(b.created_at).getTime()) / 60_000)
          : 0;

        const baseScore = b.score ?? Math.max(0, 100 - laufzeitMin * 1.5 + progressPct * 0.5);
        const score = Math.round(Math.min(100, Math.max(0, baseScore)));

        return {
          batchId: b.id,
          driverName: driverMap.get(b.driver_id ?? '') ?? 'Unbekannt',
          score,
          zone: b.zone ?? '—',
          progressPct,
          stopsTotal: stops.length,
          stopsDone,
          stufe: stufeOf(score),
          laufzeitMin,
        };
      });

    return list.sort((a, b) => b.score - a.score);
  }, [batches, drivers]);

  const schwachCount = rows.filter(r => r.stufe === 'schwach').length;

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-yellow-400" />
          Tour-Score Live-Visualisierung
          {schwachCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {schwachCount} schwach
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {rows.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-3">Keine aktiven Touren</p>
          ) : (
            <div className="space-y-2.5">
              {rows.map(r => {
                const meta = STUFE_META[r.stufe];
                return (
                  <div key={r.batchId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-gray-100">
                        {r.stufe === 'schwach' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                        <span className="font-semibold">{r.driverName}</span>
                        <span className="text-gray-500">Zone {r.zone}</span>
                        <span className="text-gray-500">{r.laufzeitMin}m</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[10px]">
                          {r.stopsDone}/{r.stopsTotal} Stopps
                        </span>
                        <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-black', meta.badge)}>
                          {r.score}
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', meta.bar)}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                    <div className="h-1 rounded-full bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-500 transition-all"
                        style={{ width: `${r.progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(Object.entries(STUFE_META) as [ScoreRow['stufe'], typeof STUFE_META[keyof typeof STUFE_META]][]).map(([stufe, meta]) => (
              <div key={stufe} className={cn('rounded-lg px-2 py-1 text-center', meta.badge)}>
                <div className="text-sm font-black">{rows.filter(r => r.stufe === stufe).length}</div>
                <div className="text-[9px]">{meta.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
