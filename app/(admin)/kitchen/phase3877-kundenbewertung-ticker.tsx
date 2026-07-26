'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  bewertung_avg: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, bewertung_avg: 4.9, trend_delta:  0.1, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, bewertung_avg: 4.5, trend_delta:  0.0, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, bewertung_avg: 3.8, trend_delta: -0.2, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, bewertung_avg: 3.2, trend_delta: -0.4, ampel: 'rot'   },
  ],
  team_durchschnitt: 4.1,
  alert_count: 1,
};

export function KitchenPhase3877KundenbewertungTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kundenbewertung?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.bewertung_avg - a.bewertung_avg);
  const best = sorted[0];
  const maxVal = Math.max(...sorted.map(f => f.bewertung_avg), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span className="text-sm font-semibold text-gray-900">Kundenbewertung</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-emerald-700">{best.bewertung_avg}★</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Niedrige Bewertungen!</span>
        </div>
      )}

      {/* Kompakt-Liste (absteigend: höchste = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.bewertung_avg}★</span>
                {f.trend_delta > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : f.trend_delta < 0
                    ? <TrendingDown className="w-3 h-3 text-red-400" />
                    : <Minus className="w-3 h-3 text-gray-300" />
                }
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.bewertung_avg / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_durchschnitt}★</span>
        <span>Ziel ≥4.5★</span>
      </div>
    </div>
  );
}
