'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { retour_quote_pct: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg: number; fahrer_count: number; }

const MOCK: ApiData = { retour_quote_pct: 5, rang: 2, rank_delta: 1, ampel: 'gruen', team_avg: 7.75, fahrer_count: 4 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4113MeineRetourQuote({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-retour-quote?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) {
          const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? json.fahrer?.[0];
          if (me) setData({ retour_quote_pct: me.retour_quote_pct, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg: json.team_avg, fahrer_count: json.gesamt });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
        <WifiOff className="w-5 h-5 text-gray-300" />
        <span className="text-sm text-gray-400">Retour-Quote nicht verfügbar (offline)</span>
      </div>
    );
  }

  const rankColor = data.ampel === 'gruen' ? 'text-emerald-500' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const DeltaIcon = data.rank_delta > 0 ? TrendingUp : data.rank_delta < 0 ? TrendingDown : Minus;
  const deltaColor = data.rank_delta > 0 ? 'text-emerald-500' : data.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  const coaching =
    data.ampel === 'gruen' ? 'Stark – deine Retourquote ist sehr niedrig!' :
    data.ampel === 'gelb'  ? 'Tipp: Prüfe vor der Ablieferung die Bestellung sorgfältig, um Retouren zu vermeiden.' :
                             'Achtung: Deine Retourquote liegt über dem Teamdurchschnitt.';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Retour-Quote</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end justify-center gap-3">
        <span className="text-5xl font-extrabold text-gray-900">{data.retour_quote_pct?.toFixed(1)}</span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-2xl font-bold text-gray-500">%</span>
          <span className={`text-2xl font-bold ${rankColor}`}>#{data.rang}</span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2">
        <DeltaIcon className={`w-4 h-4 ${deltaColor}`} />
        <span className={`text-xs font-semibold ${deltaColor}`}>
          {data.rank_delta > 0 ? `+${data.rank_delta} Plätze verbessert` : data.rank_delta < 0 ? `${data.rank_delta} Plätze gefallen` : 'Rang unverändert'}
        </span>
      </div>

      <div className="bg-gray-50 rounded-xl p-3 text-center">
        <p className="text-xs text-gray-500">Team-Ø: <span className="font-semibold text-gray-700">{data.team_avg?.toFixed(1)} %</span></p>
        <p className="text-xs text-gray-400">unter {data.fahrer_count} Fahrern</p>
      </div>

      <p className={`text-xs text-center font-medium ${rankColor}`}>{coaching}</p>
    </div>
  );
}
