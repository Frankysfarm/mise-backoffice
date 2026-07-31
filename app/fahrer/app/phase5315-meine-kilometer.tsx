'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Route } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_heute: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  gesamt: number;
}

function coachingTipp(km: number, teamAvg: number): { text: string; color: string } {
  if (km >= teamAvg * 1.2) return {
    text: 'Starke Leistung heute! Du fährst deutlich mehr als deine Kollegen — perfekte Abdeckung.',
    color: 'text-green-300',
  };
  if (km >= teamAvg * 0.8) return {
    text: 'Solide Kilometer heute. Noch eine Tour drauf und du liegst über dem Team-Durchschnitt.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Noch wenige Kilometer heute. Nimm aktiv Touren an, um deinen Beitrag zu steigern.',
    color: 'text-orange-400',
  };
}

export function FahrerPhase5315MeineKilometer({
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
    const res = await fetch(`/api/delivery/admin/fahrer-kilometer-ranking?${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
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
        <span className="text-xs text-gray-500">Meine Kilometer — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.km_heute, data.team_avg_km);
  const maxKm = Math.max(...data.fahrer.map(f => f.km_heute), 1);
  const barWidth = Math.min(100, (mein.km_heute / maxKm) * 100);
  const teamBarWidth = Math.min(100, (data.team_avg_km / maxKm) * 100);

  const borderColor =
    mein.ampel === 'gruen' ? 'border-green-700 bg-green-950/30' :
    mein.ampel === 'gelb'  ? 'border-green-800 bg-green-950/20' :
                             'border-red-700 bg-red-950/30';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
    mein.ampel === 'gelb'  ? 'border-green-900/40 bg-green-900/10' :
                             'border-red-800/40 bg-red-900/20';

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <Route className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Kilometer heute</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-green-300">
          {mein.km_heute}
          <span className="text-xl font-semibold text-gray-400"> km</span>
        </div>
        <div className="text-2xl font-bold mt-1 text-green-300">
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø {data.team_avg_km} km</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden mb-1">
          <div className="absolute left-0 top-0 h-full rounded-full bg-green-400 transition-all" style={{ width: `${barWidth}%` }} />
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
