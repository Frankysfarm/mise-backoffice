'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerPuenktlichkeit[];
  team_avg_pct: number;
  alert_count: number;
}

interface Props {
  locationId?: string | null;
}

const POLL_INTERVAL = 30 * 60 * 1000;

function ampelColor(ampel: string) {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb')  return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-500" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

export function KitchenPhase3219PuenktlichkeitsTicker({ locationId }: Props) {
  const [data, setData]       = useState<ApiResponse | null>(null);
  const [open, setOpen]       = useState(false);
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

  const best = data?.fahrer?.[0];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors rounded-xl"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
            Pünktlichkeit
            {best && (
              <span className="ml-1 text-green-600 dark:text-green-400">
                #{best.rang} {best.fahrer_name} {best.puenktlichkeit_pct}%
              </span>
            )}
          </span>
          {data && data.alert_count > 0 && (
            <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
          )}
          {loading && <span className="text-xs text-gray-400 animate-pulse">↻</span>}
        </div>
        {open ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
      </button>

      {open && data && (
        <div className="px-3 pb-3 space-y-2">
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-900/20 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300">Niedrige Pünktlichkeit!</span>
            </div>
          )}
          {data.fahrer.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className={`text-xs font-bold w-5 text-right ${ampelColor(f.ampel)}`}>#{f.rang}</span>
              <span className="text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">{f.fahrer_name}</span>
              <DeltaIcon delta={f.rank_delta} />
              <span className={`text-xs font-bold ${ampelColor(f.ampel)}`}>{f.puenktlichkeit_pct}%</span>
            </div>
          ))}
          <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
            Team-Ø: <span className="font-semibold text-blue-600 dark:text-blue-400">{data.team_avg_pct}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
