'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Moon } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_std: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tph: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 3.5) return {
    text: 'Herausragende Abendschicht-Produktivität! Du erledigst sehr viele Touren pro Stunde in der Stoßzeit.',
    color: 'text-green-300',
  };
  if (val >= 2.0) return {
    text: 'Gute Abendleistung. Über 3,5 Touren/Std in der Abendschicht steigert dein Ranking.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Abendproduktivität steigern. Straffere Routenführung in der Stoßzeit verbessert deinen Score.',
    color: 'text-red-400',
  };
}

export function FahrerPhase5268MeineAbendprod({
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
    const res = await fetch(`/api/delivery/admin/fahrer-abendprod-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Abendproduktivität — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.touren_pro_std);
  const teamAvg = data.team_avg_tph;

  return (
    <div className="rounded-2xl border border-indigo-700 bg-indigo-950/40 mb-3 overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-2 border-b border-indigo-800/40 bg-indigo-900/20">
        <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Abendproduktivität</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className="text-4xl font-black tabular-nums text-indigo-300">
          {mein.touren_pro_std.toFixed(1)}<span className="text-xl font-semibold"> T/h</span>
        </div>
        <div className="text-2xl font-bold mt-1 text-indigo-300">
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
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${Math.min(100, Math.round((mein.touren_pro_std / Math.max(teamAvg * 2, 1)) * 100))}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.touren_pro_std.toFixed(1)} T/h</span>
          <span>{teamAvg.toFixed(1)} T/h</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
