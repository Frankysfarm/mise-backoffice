'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Timer } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val <= 4) return {
    text: 'Sehr effiziente Stoppzeiten! Du lieferst zügig und hältst die Verweildauer minimal.',
    color: 'text-orange-300',
  };
  if (val <= 7) return {
    text: 'Gute Stoppzeiten. Versuche, die Verweildauer unter 5 Minuten zu halten.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Hohe Verweildauer. Prüfe, ob Prozesse an der Tür optimiert werden können.',
    color: 'text-red-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-orange-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5129MeineStoppVerweildauer({
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
    const res = await fetch(`/api/delivery/admin/fahrer-stopp-verweildauer-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Stopp-Verweildauer — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp   = coachingTipp(mein.avg_min);
  const maxVal = Math.max(mein.avg_min, data.team_avg_min, 1);
  const ichPct = Math.min(100, Math.round((mein.avg_min / maxVal) * 100));
  const avgPct = Math.min(100, Math.round((data.team_avg_min / maxVal) * 100));

  return (
    <div className="rounded-2xl border border-orange-700 bg-orange-950/40 overflow-hidden mb-3">
      <div className="px-4 py-3 border-b border-orange-700/40 flex items-center gap-2 bg-orange-900/20">
        <Timer className="w-4 h-4 text-orange-300" />
        <span className="text-sm font-semibold text-orange-200">Meine Stopp-Verweildauer (letzte 30 Tage)</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.avg_min} min
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Verweildauer je Stopp</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-orange-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-orange-300 w-14 text-right">{mein.avg_min} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-14 text-right">{data.team_avg_min} min</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
