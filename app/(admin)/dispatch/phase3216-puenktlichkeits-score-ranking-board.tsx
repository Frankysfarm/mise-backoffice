'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  on_time: number;
  gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerPuenktlichkeit[];
  team_avg_pct: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

interface Props {
  locationId: string | null;
}

const POLL_INTERVAL = 30 * 60 * 1000;

function ampelColor(ampel: string) {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb')  return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function ampelBg(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-500';
  return 'bg-red-500';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function DispatchPhase3216PuenktlichkeitsScoreRankingBoard({ locationId }: Props) {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [open, setOpen]       = useState(true);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-puenktlichkeit-score?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-puenktlichkeit-score';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm mb-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900 dark:text-white text-sm">
            Pünktlichkeits-Score-Ranking
          </span>
          {data && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              — Bester: {data.bester_name} ({data.fahrer[0]?.puenktlichkeit_pct ?? 0}%)
            </span>
          )}
          {loading && <span className="text-xs text-gray-400 animate-pulse">↻</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3">
          {/* Alert Banner */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300 font-medium">
                {data.alert_count} Fahrer mit niedriger Pünktlichkeit!
              </span>
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Bester', value: `${data.fahrer[0]?.puenktlichkeit_pct ?? 0}%`, name: data.bester_name, color: 'text-green-600 dark:text-green-400' },
              { label: 'Team-Ø', value: `${data.team_avg_pct}%`, name: `${data.gesamt} Fahrer`, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Niedrigster', value: `${data.fahrer[data.fahrer.length - 1]?.puenktlichkeit_pct ?? 0}%`, name: data.niedrigster_name, color: 'text-red-600 dark:text-red-400' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 text-center">
                <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{kpi.label}</div>
                <div className="text-xs text-gray-400 truncate">{kpi.name}</div>
              </div>
            ))}
          </div>

          {/* Ranked List */}
          <div className="space-y-2">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2">
                <span className={`w-5 text-xs font-bold text-right ${ampelColor(f.ampel)}`}>#{f.rang}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{f.fahrer_name}</span>
                    <div className="flex items-center gap-1 ml-1">
                      <DeltaIcon delta={f.rank_delta} />
                      <span className={`text-xs font-bold ${ampelColor(f.ampel)}`}>{f.puenktlichkeit_pct}%</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ampelBg(f.ampel)}`}
                      style={{ width: `${f.puenktlichkeit_pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-12 text-right">{f.on_time}/{f.gesamt}</span>
              </div>
            ))}
          </div>

          {/* Ampel Legend */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-gray-800">
            {[
              { color: 'bg-green-500', label: 'Top 25%' },
              { color: 'bg-yellow-500', label: 'Mitte 50%' },
              { color: 'bg-red-500', label: 'Bottom 25%' },
            ].map(a => (
              <div key={a.label} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${a.color}`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">{a.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
