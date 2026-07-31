'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stopps_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 3) return {
    text: 'Top-Durchsatz! Du erledigst Stopps sehr zügig — hohe Effizienz und Produktivität.',
    color: 'text-green-300',
  };
  if (val >= 2) return {
    text: 'Solider Durchsatz. Optimiertes Routing und kurze Übergabezeiten können die Rate steigern.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Niedriger Durchsatz. Routenoptimierung, Pausen-Timing und schnellere Übergaben helfen.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5216MeineStoppsProStunde({
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
    const res = await fetch(`/api/delivery/admin/fahrer-stopps-pro-stunde-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Ø-Stopps/h — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp    = coachingTipp(mein.stopps_pro_stunde);
  const teamAvg = data.team_avg;

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${
      mein.ampel === 'gruen' ? 'border-green-700 bg-green-950/40' :
      mein.ampel === 'gelb'  ? 'border-yellow-700 bg-yellow-950/30' :
                               'border-red-700 bg-red-950/40'
    }`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${
        mein.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
        mein.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                                 'border-red-800/40 bg-red-900/20'
      }`}>
        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Ø-Stopps/h (Durchsatz)</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.stopps_pro_stunde.toFixed(1)} <span className="text-xl font-semibold">/h</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${ampelColor(mein.ampel)}`}>
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Ich</span>
          <span className="text-gray-500">Team-Ø</span>
        </div>
        <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
          <div
            className={`h-full rounded-full ${
              mein.ampel === 'gruen' ? 'bg-green-500' :
              mein.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(100, Math.round((mein.stopps_pro_stunde / Math.max(teamAvg * 2, 1)) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.stopps_pro_stunde.toFixed(1)}/h</span>
          <span>{teamAvg.toFixed(1)}/h</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
