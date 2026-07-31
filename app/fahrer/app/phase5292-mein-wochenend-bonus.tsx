'use client';

import { useEffect, useState } from 'react';
import { WifiOff, CalendarDays } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wochenend_bonus_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val >= 40) return {
    text: 'Starke Wochenend-Bonus-Quote! Du erzielst an Sa/So auf mehr als 40% deiner Touren einen Bonus — top Wochenend-Einsatz.',
    color: 'text-purple-300',
  };
  if (val >= 20) return {
    text: 'Solide Wochenend-Performance. Mit schnellen Lieferzeiten am Wochenende erreichst du öfter Bonus-Schwellen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Geringe Wochenend-Bonus-Quote. Fokussiere am Sa/So auf Pünktlichkeit und kurze Abholzeiten für mehr Bonus-Touren.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-purple-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5292MeinWochenendBonus({
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
    const res = await fetch(`/api/delivery/admin/fahrer-wochenend-bonus-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Mein Wochenend-Bonus — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.wochenend_bonus_pct);
  const teamAvg = data.team_avg_pct;

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${
      mein.ampel === 'gruen' ? 'border-purple-700 bg-purple-950/40' :
      mein.ampel === 'gelb'  ? 'border-yellow-700 bg-yellow-950/30' :
                               'border-red-700 bg-red-950/40'
    }`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${
        mein.ampel === 'gruen' ? 'border-purple-800/40 bg-purple-900/20' :
        mein.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                                 'border-red-800/40 bg-red-900/20'
      }`}>
        <CalendarDays className="w-4 h-4 text-purple-500 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Mein Wochenend-Bonus</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${ampelColor(mein.ampel)}`}>
          {mein.wochenend_bonus_pct.toFixed(0)}<span className="text-xl font-semibold">%</span>
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
              mein.ampel === 'gruen' ? 'bg-purple-500' :
              mein.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${mein.wochenend_bonus_pct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span>{mein.wochenend_bonus_pct.toFixed(0)}%</span>
          <span>{teamAvg.toFixed(0)}%</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
