'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  aktuell_pct: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max M.',  aktuell_pct: 93, trend: 'steigend', alert: false },
    { fahrer_id: 'f2', name: 'Sara K.', aktuell_pct: 60, trend: 'fallend',  alert: true  },
    { fahrer_id: 'f3', name: 'Luca P.', aktuell_pct: 75, trend: 'stabil',   alert: false },
  ],
  alert_count: 1,
};

export function DispatchPhase3939PuenktlichkeitTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-trend?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  // descending: highest aktuell_pct = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => b.aktuell_pct - a.aktuell_pct);
  const n = sorted.length;
  const teamAvg = n > 0 ? Math.round(sorted.reduce((s, f) => s + f.aktuell_pct, 0) / n) : 0;
  const best = sorted[0];
  const worst = sorted[n - 1];

  function ampel(f: FahrerRow): 'gruen' | 'gelb' | 'rot' {
    return f.aktuell_pct >= 85 ? 'gruen' : f.aktuell_pct >= 70 ? 'gelb' : 'rot';
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Pünktlichkeits-Trend</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="text-[11px] bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
            {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Sinkende Pünktlichkeit!</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-emerald-600 font-medium">Bester</div>
          <div className="text-lg font-black text-emerald-700">{best?.aktuell_pct ?? '–'}%</div>
          <div className="text-[10px] text-emerald-500 truncate">{best?.name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-lg font-black text-gray-700">{teamAvg}%</div>
          <div className="text-[10px] text-gray-400">Ziel ≥85%</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-red-500 font-medium">Niedrigster</div>
          <div className="text-lg font-black text-red-600">{worst?.aktuell_pct ?? '–'}%</div>
          <div className="text-[10px] text-red-400 truncate">{worst?.name ?? '–'}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const amp = ampel(f);
          const tColor = amp === 'gruen' ? 'text-emerald-600' : amp === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const bgColor = amp === 'gruen' ? 'bg-emerald-50' : amp === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
          const DeltaIcon = f.trend === 'steigend'
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.trend === 'fallend'
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${bgColor}`}>
              <span className="w-5 text-center text-[11px] font-mono text-gray-400">#{i + 1}</span>
              <span className="flex-1 text-xs font-medium text-gray-800 truncate">{f.name}</span>
              <span className={`text-sm font-bold ${tColor}`}>{f.aktuell_pct}%</span>
              {DeltaIcon}
              {f.alert && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
