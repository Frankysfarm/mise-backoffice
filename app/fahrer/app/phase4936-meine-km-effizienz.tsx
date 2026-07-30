'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Route } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    km_pro_tour: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_km: number;
  gesamt: number;
}

function coachingTipp(km: number): { text: string; color: string } {
  if (km < 5.5) return {
    text: 'Hervorragende Route! Du fährst sehr effizient — kurze Wege, weniger Spritkosten und weniger CO₂. Weiter so!',
    color: 'text-emerald-400',
  };
  if (km < 8.0) return {
    text: 'Gute Routeneffizienz. Nutze die Bündelung von Stopps in einer Zone, um die Kilometer pro Tour weiter zu senken.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Optimierungspotenzial: Plane Stopps räumlich enger. Weniger Umwege bedeuten schnellere Lieferungen und höhere Einnahmen.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-emerald-400';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase4936MeineKmEffizienz({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-km-effizienz-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Kilometer-Effizienz — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find(f => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.km_pro_tour);
  const maxKm = data.fahrer[data.fahrer.length - 1]?.km_pro_tour ?? 1;
  const barPct = Math.min(100, Math.round((mein.km_pro_tour / Math.max(maxKm, 1)) * 100));

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-emerald-700/50 bg-emerald-900/20">
        <Route className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="text-sm font-semibold text-emerald-200">Meine Kilometer-Effizienz</span>
      </div>

      {/* Main stat */}
      <div className="px-4 py-4 flex items-end gap-3">
        <span className={`text-4xl font-extrabold tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.km_pro_tour.toFixed(1)}
        </span>
        <div className="pb-1">
          <div className="text-sm text-gray-400">km/Tour</div>
          <div className="text-xs text-gray-500">Rang #{mein.rang} von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini-Balken: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Ich</span>
          <div className="flex-1 h-2 bg-emerald-900/50 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${mein.ampel === 'gruen' ? 'bg-emerald-500' : mein.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${barPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-bold tabular-nums w-12 text-right ${ampelColor(mein.ampel)}`}>
            {mein.km_pro_tour.toFixed(1)} km
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-14 shrink-0">Team-Ø</span>
          <div className="flex-1 h-2 bg-emerald-900/50 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-800"
              style={{ width: `${Math.min(100, Math.round((data.team_avg_km / Math.max(maxKm, 1)) * 100))}%` }}
            />
          </div>
          <span className="text-[10px] text-gray-400 tabular-nums w-12 text-right">
            {data.team_avg_km.toFixed(1)} km
          </span>
        </div>
      </div>

      {/* Coaching */}
      <div className="px-4 pb-3">
        <div className={`text-xs ${tipp.color} bg-emerald-900/30 rounded-lg px-3 py-2 leading-relaxed`}>
          {tipp.text}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-emerald-800/30">
        <span className="text-[10px] text-gray-600">Rang 1 = wenigste km/Tour · 30-Min-Polling · letzte 30 Tage</span>
      </div>
    </div>
  );
}
