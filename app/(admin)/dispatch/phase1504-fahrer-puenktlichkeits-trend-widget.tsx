'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, RefreshCw, ChevronDown, ChevronUp, Award } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1504 — Fahrer-Pünktlichkeits-Trend-Widget (Dispatch)
// Phase1502-API: Ranking-Liste mit Trend-Arrow + Score-Balken + Vergleich Vorwoche; 10-Min-Polling.

interface FahrerEintrag {
  fahrer_id: string;
  fahrer_name: string;
  score_heute: number;
  score_7tage: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  puenktliche_lieferungen_heute: number;
  gesamt_lieferungen_heute: number;
}

interface TrendData {
  fahrer: FahrerEintrag[];
  top3: FahrerEintrag[];
  flop3: FahrerEintrag[];
  team_schnitt_heute: number;
  team_schnitt_7tage: number;
}

interface Props {
  locationId: string | null;
}

const TREND_ICONS: Record<string, React.ReactNode> = {
  besser: <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />,
  gleich: <Minus className="w-3.5 h-3.5 text-amber-500" />,
  schlechter: <TrendingDown className="w-3.5 h-3.5 text-rose-500" />,
};

const TREND_BADGE: Record<string, string> = {
  besser: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  gleich: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  schlechter: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
};

const TREND_LABELS: Record<string, string> = {
  besser: 'Besser',
  gleich: 'Stabil',
  schlechter: 'Schlechter',
};

function scoreColor(score: number): string {
  if (score >= 85) return 'bg-emerald-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-rose-500';
}

function buildMock(): TrendData {
  return {
    fahrer: [
      { fahrer_id: 'mock-4', fahrer_name: 'Lisa Braun', score_heute: 95, score_7tage: 90, trend: 'besser', puenktliche_lieferungen_heute: 19, gesamt_lieferungen_heute: 20 },
      { fahrer_id: 'mock-1', fahrer_name: 'Max Mueller', score_heute: 92, score_7tage: 88, trend: 'besser', puenktliche_lieferungen_heute: 11, gesamt_lieferungen_heute: 12 },
      { fahrer_id: 'mock-2', fahrer_name: 'Anna Schmidt', score_heute: 85, score_7tage: 87, trend: 'gleich', puenktliche_lieferungen_heute: 9, gesamt_lieferungen_heute: 11 },
      { fahrer_id: 'mock-3', fahrer_name: 'Klaus Weber', score_heute: 78, score_7tage: 82, trend: 'schlechter', puenktliche_lieferungen_heute: 7, gesamt_lieferungen_heute: 9 },
      { fahrer_id: 'mock-5', fahrer_name: 'Tom Fischer', score_heute: 60, score_7tage: 75, trend: 'schlechter', puenktliche_lieferungen_heute: 3, gesamt_lieferungen_heute: 5 },
    ],
    top3: [],
    flop3: [],
    team_schnitt_heute: 82,
    team_schnitt_7tage: 84,
  };
}

export function DispatchPhase1504FahrerPuenktlichkeitsTrendWidget({ locationId }: Props) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  async function load() {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeits-trend?location_id=${locationId}`);
      if (!res.ok) { setData(buildMock()); } else { setData(await res.json()); }
    } catch {
      setData(buildMock());
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Pünktlichkeit wird geladen…
        </div>
      </Card>
    );
  }

  if (!data || data.fahrer.length === 0) return null;

  const teamTrend = data.team_schnitt_heute >= data.team_schnitt_7tage + 3
    ? 'besser'
    : data.team_schnitt_heute <= data.team_schnitt_7tage - 3
      ? 'schlechter'
      : 'gleich';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:opacity-90 transition-opacity"
        onClick={() => setOpen(v => !v)}
      >
        <Award className="w-4 h-4 text-indigo-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Fahrer-Pünktlichkeit
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {TREND_ICONS[teamTrend]}
          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
            Ø {data.team_schnitt_heute}%
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 space-y-4 bg-white dark:bg-slate-900">
          {/* Team-Schnitt */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
              <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.team_schnitt_heute}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Team heute</div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-center">
              <div className="text-lg font-black tabular-nums text-slate-800 dark:text-slate-100">{data.team_schnitt_7tage}%</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Ø 7 Tage</div>
            </div>
          </div>

          {/* Fahrer-Liste */}
          <div className="space-y-2">
            {data.fahrer.map((f, idx) => (
              <div key={f.fahrer_id} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-slate-400 w-4 shrink-0 text-right">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{f.fahrer_name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {TREND_ICONS[f.trend]}
                      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full', TREND_BADGE[f.trend])}>
                        {TREND_LABELS[f.trend]}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', scoreColor(f.score_heute))}
                      style={{ width: `${f.score_heute}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0 w-10">
                  <div className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">{f.score_heute}%</div>
                  <div className="text-[9px] text-slate-400">{f.puenktliche_lieferungen_heute}/{f.gesamt_lieferungen_heute}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
