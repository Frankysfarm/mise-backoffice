'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerTrend {
  fahrer_id: string;
  name: string;
  aktuell_pct: number;
  trend: Trend;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerTrend[];
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

function ampel(pct: number): 'gruen' | 'gelb' | 'rot' {
  if (pct >= 90) return 'gruen';
  if (pct >= 70) return 'gelb';
  return 'rot';
}

export function KitchenPhase3942PuenktlichkeitTrendTicker({ locationId }: { locationId: string | null }) {
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

  const sorted = [...data.fahrer].sort((a, b) => b.aktuell_pct - a.aktuell_pct);
  const best = sorted[0];
  const teamAvg = sorted.length > 0
    ? Math.round(sorted.reduce((s, f) => s + f.aktuell_pct, 0) / sorted.length)
    : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Pünktlichkeit</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.name}</span>
            <span className="font-black text-gray-700">{best.aktuell_pct}%</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Sinkende Pünktlichkeit!</span>
        </div>
      )}

      {/* Kompakt-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const a = ampel(f.aktuell_pct);
          const tColor = a === 'gruen' ? 'text-gray-700' : a === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = a === 'gruen' ? 'bg-blue-400' : a === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.trend === 'steigend'
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend === 'fallend'
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.name}</span>
                <span className={`font-bold ${tColor}`}>{f.aktuell_pct}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${f.aktuell_pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {teamAvg}%</span>
        <span>Ziel ≥90%</span>
      </div>
    </div>
  );
}
