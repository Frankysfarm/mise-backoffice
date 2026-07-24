'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wartezeit_min: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Kurze Wartezeiten! Du holst Bestellungen effizient ab — weiter so!',
  gelb: 'Mittlere Wartezeit. Mit schnellerer Abholung kommst du in die Top-25%.',
  rot: 'Lange Wartezeit. Bitte früher am Restaurant erscheinen oder Dispatcher informieren.',
};

export function FahrerPhase3610MeineWartezeit({
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
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  if (!me) return null;

  const myRang = sorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const total = sorted.length;
  const pct = total > 0 ? (1 - (myRang - 1) / total) * 100 : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-gray-900">Meine Wartezeit</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${me.ampel === 'gruen' ? 'text-emerald-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
          {me.avg_wartezeit_min.toFixed(1)} min
        </div>
        <div className={`text-3xl font-bold ${me.ampel === 'gruen' ? 'text-emerald-500' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
          Rang #{myRang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.trend_delta < 0 ? (
            <TrendingDown className="w-4 h-4 text-emerald-500" />
          ) : me.trend_delta > 0 ? (
            <TrendingUp className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span>Team-Ø: {data.team_avg_wartezeit_min.toFixed(1)} min</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang-Position</span>
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
