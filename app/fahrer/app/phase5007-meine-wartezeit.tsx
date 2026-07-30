'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Timer } from 'lucide-react';

interface RankRow {
  rang: number;
  driver_id: string;
  name: string;
  avg_wartezeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  ranking: RankRow[];
  team_avg: number;
}

function coachingTipp(min: number): { text: string; color: string } {
  if (min <= 5) return {
    text: 'Sehr kurze Wartezeiten! Du holst Bestellungen schnell ab — das hält die Lieferkette flüssig.',
    color: 'text-green-300',
  };
  if (min <= 15) return {
    text: 'Durchschnittliche Wartezeit. Früh ankündigen und Küche kontaktieren kann helfen, unter 5 min zu kommen.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Hohe Wartezeiten: Melde lange Wartezeiten an die Küche — das hilft das Timing zu verbessern.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5007MeineWartezeit({
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
    const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Wartezeit — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.ranking.find(f => f.driver_id === driverId) ?? data.ranking[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.avg_wartezeit_min);
  const maxBar = 20;
  const ichPct = Math.min(100, (mein.avg_wartezeit_min / maxBar) * 100);
  const avgPct = Math.min(100, (data.team_avg / maxBar) * 100);

  return (
    <div className="rounded-2xl border border-purple-700 bg-purple-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-purple-700/40 flex items-center gap-2 bg-purple-900/20">
        <Timer className="w-4 h-4 text-purple-300" />
        <span className="text-sm font-semibold text-purple-200">Meine Wartezeit (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            {mein.avg_wartezeit_min} min
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Wartezeit am Restaurant</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-green-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.ranking.length}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-purple-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-purple-300 w-16 text-right">{mein.avg_wartezeit_min} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-16 text-right">{data.team_avg} min</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
