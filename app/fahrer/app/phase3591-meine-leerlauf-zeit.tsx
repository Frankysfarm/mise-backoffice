'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_id: string; fahrer_name: string; rang: number; leerlauf_min: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_top: boolean }[];
  team_avg: number;
  gesamt: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Sehr gute Auslastung! Minimale Leerlauf-Zeit — du nutzt deine Schicht optimal.',
  gelb: 'Solide Auslastung. Mit besserer Tourenplanung kannst du die Leerlauf-Zeit noch senken.',
  rot: 'Hohe Leerlauf-Zeit. Bitte Schicht-Einteilung und Tourenvergabe mit dem Dispatcher besprechen.',
};

export function FahrerPhase3591MeineLeerlaufZeit({
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
    if (!isOnline) return;
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-leerlauf-zeit?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-leerlauf-zeit';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const me = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!me) return null;

  const pct = data.gesamt > 0 ? (1 - (me.rang - 1) / data.gesamt) * 100 : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900">Meine Leerlauf-Zeit</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
          {me.leerlauf_min} <span className="text-2xl">min</span>
        </div>
        <div className={`text-3xl font-bold ${me.ampel === 'gruen' ? 'text-emerald-500' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
          Rang #{me.rang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.rank_delta < 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : me.rank_delta > 0 ? <TrendingDown className="w-4 h-4 text-red-500" /> : <Minus className="w-4 h-4 text-gray-400" />}
          <span>Team-Ø: {data.team_avg} min</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Auslastungs-Rang</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full ${me.ampel === 'gruen' ? 'bg-emerald-500' : me.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{COACHING[me.ampel]}</p>
    </div>
  );
}
