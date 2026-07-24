'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerUmsatzRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerUmsatzRow[];
  team_avg_umsatz: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Spitzenleistung! Dein Umsatz/h liegt über dem Teamziel — weiter so.',
  gelb: 'Solider Umsatz/h. Ein bisschen mehr Tempo könnte dich in die Spitzengruppe bringen.',
  rot: 'Niedriger Umsatz/h! Mehr Touren pro Stunde und kürzere Pausen helfen.',
};

export function FahrerPhase3625MeinUmsatzProStunde({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!isOnline || !locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  if (!me) return null;

  const myRang = sorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const total = sorted.length;
  const pct = total > 0 ? (myRang / total) * 100 : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-emerald-500" />
        <h3 className="font-semibold text-gray-900">Mein Umsatz/h</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
          {me.umsatz_pro_stunde.toFixed(1)} €
        </div>
        <div className="text-sm text-gray-500">pro Stunde</div>
        <div className={`text-3xl font-bold ${me.ampel === 'gruen' ? 'text-emerald-500' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
          Rang #{myRang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.rank_delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : me.rank_delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span>Team-Ø: {data.team_avg_umsatz.toFixed(1)} €/h</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang-Position</span>
          <span>#{myRang} von {total}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full ${me.ampel === 'gruen' ? 'bg-emerald-500' : me.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(100 - pct + 100 / total, 5)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">Ziel ≥35 €/h · Letzte 30 Tage</div>

      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{COACHING[me.ampel]}</p>
    </div>
  );
}
