'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, Target } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  sub_puenktlichkeit: number;
  sub_abschluss: number;
  sub_speed: number;
  trend: 'up' | 'down' | 'stable';
  ampel: 'gruen' | 'gelb' | 'rot';
  touren_heute: number;
  lieferzeit_avg_min: number;
}

interface ApiResponse {
  fahrer: FahrerScore[];
  flotten_avg: number;
  bester_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Leon K.', rang: 1, score: 94, sub_puenktlichkeit: 96, sub_abschluss: 100, sub_speed: 87, trend: 'up', ampel: 'gruen', touren_heute: 5, lieferzeit_avg_min: 28 },
    { fahrer_id: '2', fahrer_name: 'Mia S.', rang: 2, score: 88, sub_puenktlichkeit: 91, sub_abschluss: 95, sub_speed: 80, trend: 'stable', ampel: 'gruen', touren_heute: 4, lieferzeit_avg_min: 31 },
    { fahrer_id: '3', fahrer_name: 'Finn B.', rang: 3, score: 72, sub_puenktlichkeit: 68, sub_abschluss: 90, sub_speed: 58, trend: 'down', ampel: 'gelb', touren_heute: 3, lieferzeit_avg_min: 38 },
    { fahrer_id: '4', fahrer_name: 'Sara N.', rang: 4, score: 61, sub_puenktlichkeit: 55, sub_abschluss: 78, sub_speed: 50, trend: 'down', ampel: 'rot', touren_heute: 2, lieferzeit_avg_min: 45 },
  ],
  flotten_avg: 79,
  bester_name: 'Leon K.',
  alert_count: 1,
  gesamt: 4,
};

const AMPEL_BAR: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const AMPEL_TEXT: Record<string, string> = { gruen: 'text-emerald-600', gelb: 'text-amber-600', rot: 'text-red-600' };
const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3582TourScoreAnzeigeDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>(MOCK);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-ranking?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.fahrer) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Trophy className="w-4 h-4 text-amber-500" />
          Tour-Score Anzeige Dashboard
          {data.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* Alert */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Niedriger Tour-Score! {data.alert_count} Fahrer unter Zielwert (≥75)
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Bester</div>
              <div className="text-xs font-semibold text-emerald-600 truncate">{data.bester_name}</div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Flotten-Ø</div>
              <div className={`text-sm font-bold ${data.flotten_avg >= 80 ? 'text-emerald-600' : data.flotten_avg >= 65 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.flotten_avg}
              </div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Ziel</div>
              <div className="text-xs font-semibold text-gray-600 flex items-center justify-center gap-1">
                <Target className="w-3 h-3" /> ≥75
              </div>
            </div>
          </div>

          {/* Fahrer-Scorecards */}
          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => setExpanded(e => e === f.fahrer_id ? null : f.fahrer_id)}
                >
                  <span className="text-sm w-6 text-center flex-shrink-0">
                    {RANK_BADGE[f.rang] ?? <span className="text-gray-500 text-xs">#{f.rang}</span>}
                  </span>
                  <span className="text-sm font-medium flex-1 truncate">{f.fahrer_name}</span>
                  <div className="flex-1 max-w-[80px] bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${AMPEL_BAR[f.ampel]}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <span className={`text-sm font-mono font-bold w-8 text-right flex-shrink-0 ${AMPEL_TEXT[f.ampel]}`}>
                    {f.score}
                  </span>
                  {f.trend === 'up' ? <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    : f.trend === 'down' ? <TrendingDown className="w-3 h-3 text-red-500 flex-shrink-0" />
                    : <Minus className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                </button>

                {expanded === f.fahrer_id && (
                  <div className="px-3 pb-3 border-t bg-gray-50 dark:bg-gray-800/50 space-y-1.5">
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {[
                        { label: 'Pünktlichkeit', val: f.sub_puenktlichkeit },
                        { label: 'Abschluss', val: f.sub_abschluss },
                        { label: 'Speed', val: f.sub_speed },
                      ].map(kpi => (
                        <div key={kpi.label} className="text-center bg-white dark:bg-gray-900 rounded p-1.5 border">
                          <div className="text-[9px] text-gray-500 uppercase">{kpi.label}</div>
                          <div className={`text-xs font-bold ${kpi.val >= 80 ? 'text-emerald-600' : kpi.val >= 65 ? 'text-amber-600' : 'text-red-600'}`}>
                            {kpi.val}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 pt-1">
                      <span>Touren heute: {f.touren_heute}</span>
                      <span>Ø Lieferzeit: {f.lieferzeit_avg_min} Min</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-400 pt-1 text-right">Aktualisierung alle 20 Sek</div>
        </div>
      )}
    </div>
  );
}
