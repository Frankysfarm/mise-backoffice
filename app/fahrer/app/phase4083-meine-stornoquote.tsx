'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { stornoquote_pct: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg_pct: number; fahrer_count: number; ziel_pct: number; }

const MOCK: ApiData = { stornoquote_pct: 2.8, rang: 2, rank_delta: 0, ampel: 'gelb', team_avg_pct: 3.95, fahrer_count: 4, ziel_pct: 3 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4083MeineStornoquote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stornoquote-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error && json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? json.fahrer[0];
          if (me) setData({ stornoquote_pct: me.stornoquote_pct, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg_pct: json.team_avg_pct, fahrer_count: json.gesamt, ziel_pct: json.ziel_pct ?? 3 });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Stornoquote-Ranking nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valueColor = data.ampel === 'gruen' ? 'text-emerald-600' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const coaching = data.ampel === 'gruen' ? 'Ausgezeichnet – deine Stornoquote ist sehr niedrig!' : data.ampel === 'gelb' ? 'Tipp: Bessere Kommunikation mit Kunden reduziert Stornierungen.' : 'Achtung: Deine Stornoquote liegt deutlich über dem Ziel.';
  const DeltaIcon = data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Stornoquote</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>{data.stornoquote_pct?.toFixed(1)}%</span>
        <div className="flex flex-col items-start pb-1">
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{data.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {data.fahrer_count} Fahrern</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</div>
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg_pct?.toFixed(1)}% | Ziel ≤{data.ziel_pct}%</span>
        <span>Rang 1 = niedrigste Stornoquote</span>
      </div>
    </div>
  );
}
