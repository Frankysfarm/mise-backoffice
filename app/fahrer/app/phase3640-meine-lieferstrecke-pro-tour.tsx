'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerStreckeRow {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerStreckeRow[];
  team_avg_km: number;
}

const COACHING: Record<string, string> = {
  gruen: 'Sehr effiziente Routen! Deine kurzen Strecken pro Tour zeigen optimales Routing.',
  gelb: 'Solide Strecke/Tour. Bessere Routenplanung kann dich in die Spitzengruppe bringen.',
  rot: 'Hohe Strecke/Tour! Kürzere Routen und bessere Reihenfolge der Stopps helfen dir.',
};

export function FahrerPhase3640MeineLieferstreckeProTour({
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
      const res = await fetch(`/api/delivery/admin/fahrer-lieferstrecke-pro-tour?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.km_pro_tour - b.km_pro_tour);
  const me = sorted.find(f => f.fahrer_id === driverId) ?? sorted[0];
  if (!me) return null;

  const myRang = sorted.findIndex(f => f.fahrer_id === me.fahrer_id) + 1;
  const total = sorted.length;
  // For efficiency: rank 1 (shortest) is best → fill bar from left
  const pct = total > 0 ? ((total - myRang + 1) / total) * 100 : 50;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-cyan-500" />
        <h3 className="font-semibold text-gray-900">Meine Strecke/Tour</h3>
      </div>

      <div className="text-center space-y-1">
        <div className={`text-5xl font-black ${me.ampel === 'gruen' ? 'text-cyan-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
          {me.km_pro_tour.toFixed(1)}
        </div>
        <div className="text-sm text-gray-500">km pro Tour</div>
        <div className={`text-3xl font-bold ${me.ampel === 'gruen' ? 'text-cyan-500' : me.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500'}`}>
          Rang #{myRang}
        </div>
        <div className="flex items-center justify-center gap-1 text-sm text-gray-500">
          {me.rank_delta < 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          ) : me.rank_delta > 0 ? (
            <TrendingDown className="w-4 h-4 text-red-500" />
          ) : (
            <Minus className="w-4 h-4 text-gray-400" />
          )}
          <span>Team-Ø: {data.team_avg_km.toFixed(1)} km/Tour</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Rang-Position</span>
          <span>#{myRang} von {total}</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full ${me.ampel === 'gruen' ? 'bg-cyan-500' : me.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${Math.max(pct, 5)}%` }}
          />
        </div>
      </div>

      <div className="text-xs text-gray-400 text-center">Ziel ≤6 km/Tour · Letzte 30 Tage</div>

      <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{COACHING[me.ampel]}</p>
    </div>
  );
}
