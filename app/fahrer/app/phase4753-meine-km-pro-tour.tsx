'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Navigation } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_km_pro_tour: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
}

function coachingTipp(km: number): { text: string; color: string } {
  if (km <= 5) return { text: 'Top-Routeneffizienz! Deine kurzen Touren sparen Zeit und Kosten.', color: 'text-green-400' };
  if (km <= 8) return { text: 'Gute Route. Mit smarter Bündelung kannst du noch effizienter werden.', color: 'text-yellow-400' };
  return { text: 'Deine Touren sind vergleichsweise lang. Nutze die Routenoptimierung für kürzere Wege.', color: 'text-red-400' };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4753MeineKmProTour({ driverId, locationId, isOnline }: { driverId: string; locationId: string | null; isOnline: boolean }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-km-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-4 mb-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline — KM-Effizienz nicht verfügbar</span>
      </div>
    );
  }

  if (!data) return null;

  const ranking = data.ranking ?? [];
  const me = ranking.find(f => f.driver_id === driverId) ?? ranking[0];
  if (!me) return null;

  const { text: tipp, color: tippColor } = coachingTipp(me.avg_km_pro_tour);
  const maxKm = Math.max(me.avg_km_pro_tour, data.team_avg, 1);

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Navigation className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Meine KM pro Tour</span>
      </div>

      <div className="text-center mb-4">
        <div className={`text-4xl font-bold ${ampelColor(me.ampel)}`}>{me.avg_km_pro_tour.toFixed(1)} km</div>
        <div className="text-xs text-gray-400 mt-1">Ø Kilometer pro Tour (30 Tage)</div>
        <div className={`text-xl font-semibold mt-1 ${ampelColor(me.ampel)}`}>Rang {me.rang}</div>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ich</span>
            <span className={ampelColor(me.ampel)}>{me.avg_km_pro_tour.toFixed(1)} km</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(me.avg_km_pro_tour / maxKm) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Team-Ø</span>
            <span className="text-gray-300">{data.team_avg.toFixed(1)} km</span>
          </div>
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gray-500 rounded-full" style={{ width: `${(data.team_avg / maxKm) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className={`text-xs rounded p-2 bg-black/20 ${tippColor}`}>{tipp}</div>
    </div>
  );
}
