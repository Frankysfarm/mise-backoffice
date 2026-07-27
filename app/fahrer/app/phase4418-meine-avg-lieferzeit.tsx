'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_lieferzeit_min: number;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_lieferzeit_min: 18.2, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_min: 24.2,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4418MeineAvgLieferzeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-avg-lieferzeit-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) {
        const json = await res.json();
        if (!json.error) {
          const me = (json.fahrer as FahrerRow[]).find(f => f.fahrer_id === driverId);
          if (me) setData({ ...json, fahrer: [me] });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer[0];
  if (!me) return null;

  const ampelColor = me.ampel === 'gruen' ? 'text-green-600' : me.ampel === 'gelb' ? 'text-green-500' : 'text-red-600';
  const ampelBg    = me.ampel === 'gruen' ? 'bg-green-50'   : me.ampel === 'gelb' ? 'bg-green-50'   : 'bg-red-50';
  const Delta  = me.rank_delta > 0 ? TrendingUp : me.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta > 0 ? 'text-emerald-500' : me.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  const coaching =
    me.ampel === 'gruen'
      ? 'Blitzschnell! Du gehörst zu den schnellsten Fahrern. Deine kurze Lieferzeit begeistert Kunden.'
      : me.ampel === 'gelb'
      ? 'Solide Lieferzeit. Mit etwas mehr Tempo kannst du in die Top-25% aufsteigen.'
      : 'Tipp: Deine Lieferzeit liegt im hohen Bereich. Optimiere deine Routen oder wähle kürzere Strecken.';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${ampelBg} border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-gray-900">Meine Ø-Lieferzeit</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold ${ampelColor}`}>{me.avg_lieferzeit_min.toFixed(1)}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-sm text-gray-500">min Ø (30 Tage)</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{me.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Team-Ø: <span className="font-semibold text-gray-700">{data.team_avg_min.toFixed(1)} min</span></span>
        <span>{data.gesamt} Fahrer im Ranking</span>
      </div>

      <div className="bg-white/70 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-700">{coaching}</p>
      </div>
    </div>
  );
}
