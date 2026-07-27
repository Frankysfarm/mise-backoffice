'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_reaktionszeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_reaktionszeit_min: 3.2, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_min: 5.85,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4443MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error) {
          const me = (json.fahrer as FahrerRow[]).find(f => f.fahrer_id === driverId);
          if (me) setData({ ...json, fahrer: [me] });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-gray-400">
        <WifiOff className="mx-auto mb-1 h-5 w-5" />
        <span className="text-xs">Offline — Reaktionszeit nicht verfügbar</span>
      </div>
    );
  }

  const me = data.fahrer[0];
  if (!me) return null;

  // INVERTED: rank_delta>0 = kürzere Reaktionszeit als vorher = Verbesserung = TrendingUp emerald
  const Delta  = me.rank_delta > 0 ? TrendingUp : me.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta > 0 ? 'text-emerald-500' : me.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  const timeColor =
    me.ampel === 'gruen' ? 'text-emerald-600' :
    me.ampel === 'gelb'  ? 'text-yellow-500'  : 'text-red-500';

  const coaching =
    me.avg_reaktionszeit_min <= 3
      ? 'Blitzschnell! Du bist einer der reaktionsschnellsten Fahrer im Team.'
      : me.avg_reaktionszeit_min <= 6
      ? 'Gut! Verkürze die Zeit von Bestelleingang bis Tourstart für noch bessere Platzierung.'
      : 'Verbesserungspotenzial: Reagiere schneller auf neue Touren — jede Minute zählt für Kunden.';

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          <span className="font-semibold text-gray-800 text-sm">Meine Reaktionszeit</span>
        </div>
        {loading && <span className="text-xs text-gray-400">lädt…</span>}
      </div>

      <div className="flex items-end justify-center gap-4 py-2">
        <div className="text-center">
          <div className={`text-5xl font-black ${timeColor}`}>{me.avg_reaktionszeit_min.toFixed(1)}</div>
          <div className="text-xs text-gray-500 mt-1">Minuten Ø</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-700">#{me.rang}</div>
          <div className="flex items-center justify-center gap-1 text-xs">
            <Delta className={`h-4 w-4 ${dColor}`} />
            <span className={dColor}>{me.rank_delta > 0 ? `+${me.rank_delta}` : me.rank_delta}</span>
          </div>
          <div className="text-xs text-gray-400">von {data.gesamt}</div>
        </div>
      </div>

      <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Ø Team: <span className="font-semibold">{data.team_avg_min.toFixed(1)} min</span> · Ziel ≤ 5 min
      </div>

      <div className="mt-3 rounded-lg bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
        ⚡ {coaching}
      </div>

      <div className="mt-2 text-right text-xs text-gray-400">letzte 30 Tage</div>
    </div>
  );
}
