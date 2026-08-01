'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

// Phase 5376 — Meine Wartezeit Restaurant
// Clock orange-400; avg_wartezeit_min 4xl+Rang; Dual-Balken Ich+Team-Ø;
// Coaching ≤5/≤10/>10min; Ampel-Border; isOnline-Guard; WifiOff-Fallback;
// 30-Min-Poll; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_wartezeit_min: number;
  tour_count: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_wartezeit: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, avg_wartezeit_min: 5, tour_count: 38, rank_delta: 1, ampel: 'gruen', alert_lang: false }],
  team_avg_wartezeit: 7,
  gesamt: 4,
};

function borderClass(ampel: string) {
  if (ampel === 'gruen') return 'border-orange-400';
  if (ampel === 'gelb')  return 'border-yellow-400';
  return 'border-red-500';
}

function barColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function coaching(min: number) {
  if (min <= 5)  return { text: 'Top! Minimale Wartezeit — Restaurant-Koordination perfekt.', color: 'text-green-400' };
  if (min <= 10) return { text: 'Gut. Versuche, früher beim Restaurant einzutreffen.', color: 'text-yellow-400' };
  return { text: 'Wartezeit zu lang — mit Restaurant-Timing abstimmen.', color: 'text-red-400' };
}

export function FahrerPhase5376MeineWartezeitRestaurant({
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
      `/api/delivery/admin/fahrer-wartezeit-restaurant-ranking?location_id=${locationId}&driver_id=${driverId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-2 text-gray-500">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">Wartezeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Wartezeit…</div>;

  const me = data.fahrer[0];
  if (!me) return null;

  const maxMin = Math.max(me.avg_wartezeit_min, data.team_avg_wartezeit, 1);
  const { text: coachText, color: coachColor } = coaching(me.avg_wartezeit_min);

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border-2 space-y-3 ${borderClass(me.ampel)}`}>
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-400" />
        <span className="text-white font-semibold text-sm">Meine Wartezeit Restaurant</span>
      </div>

      {/* Hauptwert */}
      <div className="text-center">
        <div className="text-4xl font-bold text-orange-400">{me.avg_wartezeit_min}<span className="text-base ml-1">min</span></div>
        <div className="text-[11px] text-gray-400 mt-0.5">Rang {me.rang} von {data.gesamt} · {me.tour_count} Touren</div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Ich</span>
            <span>{me.avg_wartezeit_min}min</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barColor(me.ampel)}`} style={{ width: `${(me.avg_wartezeit_min / maxMin) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Team-Ø</span>
            <span>{data.team_avg_wartezeit}min</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-gray-500" style={{ width: `${(data.team_avg_wartezeit / maxMin) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[11px] ${coachColor}`}>{coachText}</p>
    </div>
  );
}
