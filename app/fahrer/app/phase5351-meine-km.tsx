'use client';

import { useEffect, useState } from 'react';
import { Route, WifiOff } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_km_pro_tour: number;
  touren: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
}

const MOCK: ApiResponse = {
  ranking: [
    { driver_id: 'm1', name: 'Tim B.',   rang: 1, avg_km_pro_tour: 18.4, touren: 42, ampel: 'gruen' },
    { driver_id: 'm2', name: 'Sara K.',  rang: 2, avg_km_pro_tour: 15.2, touren: 38, ampel: 'gruen' },
    { driver_id: 'm3', name: 'Max M.',   rang: 3, avg_km_pro_tour: 12.7, touren: 35, ampel: 'gelb'  },
    { driver_id: 'm4', name: 'Julia F.', rang: 4, avg_km_pro_tour:  9.3, touren: 29, ampel: 'rot'   },
  ],
  team_avg: 13.9,
};

function coachingTipp(km: number): { text: string; color: string } {
  if (km >= 16) return {
    text: 'Top-Reichweite! Du fährst besonders viele km pro Tour — exzellente Effizienz!',
    color: 'text-green-300',
  };
  if (km >= 10) return {
    text: 'Gute Kilometerzahl. Optimierte Routen können deine Abdeckung weiter steigern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Wenige km pro Tour. Versuche längere Lieferzonen oder mehr Stopps je Tour einzuplanen.',
    color: 'text-orange-400',
  };
}

export function FahrerPhase5351MeineKm({
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
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-km-ranking?location_id=${locationId}`
    ).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
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
        <span className="text-xs text-gray-500">Meine km — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.ranking.find((f: FahrerRow) => f.driver_id === driverId) ?? data.ranking[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.avg_km_pro_tour);
  const maxKm = data.ranking[0]?.avg_km_pro_tour ?? 1;
  const barWidth     = Math.min(100, Math.round((mein.avg_km_pro_tour / maxKm) * 100));
  const teamBarWidth = Math.min(100, Math.round((data.team_avg / maxKm) * 100));

  const borderColor =
    mein.ampel === 'gruen' ? 'border-blue-700 bg-blue-950/30' :
    mein.ampel === 'gelb'  ? 'border-yellow-800 bg-yellow-950/20' :
                             'border-red-700 bg-red-950/30';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-blue-800/40 bg-blue-900/20' :
    mein.ampel === 'gelb'  ? 'border-yellow-900/40 bg-yellow-900/10' :
                             'border-red-800/40 bg-red-900/20';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Route className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine km (30 Tage)</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-blue-300">
          {mein.avg_km_pro_tour.toFixed(1)} km
        </div>
        <div className="text-2xl font-bold mt-1 text-blue-300">
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.ranking.length}</span>
        </div>
        <div className="text-xs text-gray-500 mt-0.5">Ø km pro Tour · {mein.touren} Touren</div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø {data.team_avg.toFixed(1)} km</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1">
          <div className="absolute left-0 top-0 h-full rounded-full bg-blue-400 transition-all" style={{ width: `${barWidth}%` }} />
        </div>
        <div className="relative h-1.5 rounded-full bg-gray-800 overflow-hidden">
          <div className="absolute left-0 top-0 h-full rounded-full bg-gray-500 transition-all" style={{ width: `${teamBarWidth}%` }} />
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
