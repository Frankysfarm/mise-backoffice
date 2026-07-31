'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, WifiOff, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ApiResponse {
  schichten_pro_woche: number;
  rang: number;
  gesamt: number;
  team_avg: number;
  ampel: string;
  rank_delta: number;
}

const MOCK: ApiResponse = {
  schichten_pro_woche: 4.5,
  rang: 2,
  gesamt: 8,
  team_avg: 3.8,
  ampel: 'gruen',
  rank_delta: 1,
};

function coaching(v: number): { text: string; color: string } {
  if (v >= 5) return { text: 'Ausgezeichnet — du bist sehr aktiv!', color: 'text-green-400' };
  if (v >= 3) return { text: 'Gut — halte deine Schichtfrequenz', color: 'text-yellow-400' };
  return { text: 'Erhöhe deine Schichtanzahl für mehr Verdienst', color: 'text-red-400' };
}

export function FahrerPhase5297MeineSchichtDichte({
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
    const params = new URLSearchParams({ driver_id: driverId });
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/fahrer/meine-schicht-dichte?${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Schicht-Dichte — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const { text: coachText, color: coachColor } = coaching(data.schichten_pro_woche);
  const borderColor = data.ampel === 'gruen' ? 'border-blue-700/60' : data.ampel === 'gelb' ? 'border-yellow-700/60' : 'border-red-700/60';
  const pct = data.team_avg > 0 ? Math.min((data.schichten_pro_woche / (data.team_avg * 2)) * 100, 100) : 50;

  return (
    <div className={`rounded-2xl border ${borderColor} bg-gray-900/40 p-4 mb-3`}>
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Meine Schicht-Dichte</span>
        <span className="ml-auto text-[10px] text-gray-500">Rang {data.rang}/{data.gesamt}</span>
      </div>

      <div className="text-center mb-3">
        <div className="text-4xl font-black text-blue-300 tabular-nums">{data.schichten_pro_woche.toFixed(1)}</div>
        <div className="text-xs text-gray-400 mt-0.5">Schichten / Woche</div>
        <div className="flex items-center justify-center gap-1 mt-1">
          {data.rank_delta > 0 && <TrendingUp className="w-3 h-3 text-green-400" />}
          {data.rank_delta < 0 && <TrendingDown className="w-3 h-3 text-red-400" />}
          {data.rank_delta === 0 && <Minus className="w-3 h-3 text-gray-500" />}
          <span className="text-xs text-gray-400">Team-Ø: {data.team_avg.toFixed(1)}</span>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>0</span>
          <span>Team-Ø ({data.team_avg.toFixed(1)})</span>
          <span>Max</span>
        </div>
        <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
          <div className="h-full rounded-full bg-blue-500 transition-all duration-700" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className={`text-xs ${coachColor} bg-gray-800/40 rounded-lg px-3 py-2`}>{coachText}</div>
    </div>
  );
}
