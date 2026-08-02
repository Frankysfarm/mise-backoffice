'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5591 — Meine Wartezeit Restaurant (Fahrer)
// Clock cyan-400; avg_wartezeit_min 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤5/≤10/>10 min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_wartezeit_min: number;
  tour_count: number;
  team_avg_wartezeit: number;
  rank_delta: number;
  ampel: Ampel;
  alert_lang: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_wartezeit_min: 5,
  tour_count: 38,
  team_avg_wartezeit: 7,
  rank_delta: 1,
  ampel: 'gruen',
  alert_lang: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-green-500/50',
  gelb:  'border-yellow-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(v: number): { text: string; color: string } {
  if (v <= 5)  return { text: 'Top! Deine Wartezeit am Restaurant ist sehr kurz — du holst schnell und effizient ab.', color: 'text-green-400' };
  if (v <= 10) return { text: 'Solide Abholzeit — versuche, pünktlicher am Restaurant zu sein um Wartezeiten zu verkürzen.', color: 'text-yellow-300' };
  return { text: 'Deine Wartezeit am Restaurant ist zu hoch. Koordiniere Abholzeiten besser mit der Küche.', color: 'text-red-400' };
}

export function FahrerPhase5591MeineWartezeitRestaurant({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<MyData>(MOCK);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!isOnline || !driverId) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-wartezeit-restaurant-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as {
            rang: number;
            avg_wartezeit_min: number;
            tour_count: number;
            rank_delta: number;
            ampel: Ampel;
            alert_lang: boolean;
          };
          setData({
            rang:               me.rang,
            avg_wartezeit_min:  me.avg_wartezeit_min,
            tour_count:         me.tour_count,
            team_avg_wartezeit: json.team_avg_wartezeit ?? MOCK.team_avg_wartezeit,
            rank_delta:         me.rank_delta ?? 0,
            ampel:              me.ampel,
            alert_lang:         me.alert_lang,
            gesamt:             json.gesamt ?? MOCK.gesamt,
          });
        }
      }
    } catch { /* use mock */ }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-gray-900 border border-gray-700/50 px-3 py-2">
        <WifiOff className="h-3.5 w-3.5 text-gray-600" />
        <span className="text-xs text-gray-500">Wartezeit Restaurant — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_wartezeit_min, data.team_avg_wartezeit, 0.01);
  const c = coaching(data.avg_wartezeit_min);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold text-white">Meine Wartezeit Restaurant</span>
        {data.alert_lang && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-cyan-400">{data.avg_wartezeit_min}</span>
        <span className="text-lg text-cyan-300 mb-0.5">min</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span>Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-[10px] text-gray-500">
        {data.tour_count} Touren · Ø Wartezeit am Restaurant (30 Tage)
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ich</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${(data.avg_wartezeit_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-cyan-300 w-14 text-right">{data.avg_wartezeit_min} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_wartezeit / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{data.team_avg_wartezeit} min</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
