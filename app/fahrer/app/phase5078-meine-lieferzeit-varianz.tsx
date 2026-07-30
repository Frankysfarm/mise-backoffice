'use client';

import { useEffect, useState } from 'react';
import { WifiOff, BarChart2 } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  stddev_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stddev: number;
  gesamt: number;
}

function coachingTipp(val: number): { text: string; color: string } {
  if (val <= 5) return {
    text: 'Top-Konsistenz! Deine Lieferzeiten sind sehr stabil — Kunden wissen genau, wann du kommst.',
    color: 'text-green-300',
  };
  if (val <= 10) return {
    text: 'Gute Konsistenz. Versuche deine Route gleichmäßiger zu fahren, um noch stabiler zu werden.',
    color: 'text-yellow-400',
  };
  return {
    text: 'Hohe Varianz. Versuche deine Lieferzeiten zu stabilisieren — das verbessert die Kundenzufriedenheit.',
    color: 'text-gray-400',
  };
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

export function FahrerPhase5078MeineLieferzeitVarianz({
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
    const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz-ranking?${params}`);
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
        <span className="text-xs text-gray-500">Meine Lieferzeit-Varianz — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp    = coachingTipp(mein.stddev_min);
  const maxVal  = 20;
  const ichPct  = Math.min(100, Math.round((mein.stddev_min / maxVal) * 100));
  const avgPct  = Math.min(100, Math.round((data.team_avg_stddev / maxVal) * 100));

  return (
    <div className="rounded-2xl border border-indigo-700 bg-indigo-950/40 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-indigo-700/40 flex items-center gap-2 bg-indigo-900/20">
        <BarChart2 className="w-4 h-4 text-indigo-300" />
        <span className="text-sm font-semibold text-indigo-200">Meine Lieferzeit-Varianz (letzte 30 Tage)</span>
      </div>

      {/* Main Stats */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className={`text-4xl font-black ${ampelColor(mein.ampel)}`}>
            ±{mein.stddev_min} min
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Standardabweichung Lieferzeit</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-bold ${mein.rang === 1 ? 'text-green-300' : 'text-gray-300'}`}>
            #{mein.rang}
          </div>
          <div className="text-xs text-gray-500">von {data.gesamt}</div>
        </div>
      </div>

      {/* Mini Bar: Ich vs Team-Ø */}
      <div className="px-4 pb-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Ich</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-400" style={{ width: `${ichPct}%` }} />
          </div>
          <span className="text-[10px] text-indigo-300 w-14 text-right">±{mein.stddev_min} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10 shrink-0">Team-Ø</span>
          <div className="flex-1 h-1.5 rounded-full bg-gray-800 overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${avgPct}%` }} />
          </div>
          <span className="text-[10px] text-gray-400 w-14 text-right">±{data.team_avg_stddev} min</span>
        </div>
      </div>

      {/* Coaching Tipp */}
      <div className="px-4 pb-3">
        <p className={`text-xs ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
