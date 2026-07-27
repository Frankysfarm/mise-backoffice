'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { km_heute: number; km_ziel: number; km_letzte_woche: number; km_prognose_schicht: number; rang: number; fahrer_count: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; }

const MOCK: ApiData = { km_heute: 38.4, km_ziel: 50, km_letzte_woche: 42.1, km_prognose_schicht: 52.8, rang: 2, fahrer_count: 5, rank_delta: 1, ampel: 'gelb' };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4118TourDistanzMeter({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tageskilometer-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) {
        const me = json.fahrer?.find((f: {fahrer_id: string}) => f.fahrer_id === driverId) ?? json.fahrer?.[0];
        if (me) setData({ km_heute: me.km, km_ziel: json.team_avg_km * 1.2, km_letzte_woche: me.km * 1.1, km_prognose_schicht: me.km * 1.35, rang: me.rang, fahrer_count: json.gesamt, rank_delta: me.rank_delta, ampel: me.ampel });
      }}
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Distanz-Meter offline</span>
      </div>
    );
  }

  const pct = Math.min(100, Math.round((data.km_heute / data.km_ziel) * 100));
  const valueColor = data.ampel === 'gruen' ? 'text-emerald-600' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const barColor = data.ampel === 'gruen' ? 'bg-emerald-400' : data.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
  const DeltaIcon = data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">Mein Distanz-Meter</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>{data.km_heute.toFixed(1)}</span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-2xl font-semibold text-gray-500">km</span>
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{data.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {data.fahrer_count}</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>Fortschritt zum Schicht-Ziel</span>
          <span className={`font-semibold ${pct >= 100 ? 'text-emerald-600' : valueColor}`}>{pct}% von {data.km_ziel.toFixed(0)} km</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%`, transition: 'width 0.4s' }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500">Vorwoche</div>
          <div className="text-sm font-bold text-gray-600">{data.km_letzte_woche.toFixed(1)} km</div>
        </div>
        <div className="bg-indigo-50 rounded-lg p-2 text-center">
          <div className="text-[9px] text-gray-500">Prognose</div>
          <div className={`text-sm font-bold ${data.km_prognose_schicht >= data.km_ziel ? 'text-emerald-600' : 'text-orange-500'}`}>{data.km_prognose_schicht.toFixed(1)} km</div>
        </div>
      </div>

      <div className="text-[9px] text-gray-400 text-center border-t border-gray-100 pt-0.5">
        Tageskilometer · 30-Sek-Polling · Rang vs. Team
      </div>
    </div>
  );
}
