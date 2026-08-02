'use client';

import { useEffect, useRef, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5599 — Meine Touren pro Stunde (Fahrer)
// Route blue-400; touren_pro_stunde ABSTEIGEND Rang 1=höchste Effizienz=bester;
// 4xl+Rang; isOnline-Guard+WifiOff-Fallback; Coaching ≥2/≥1.5/<1.5; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  touren_pro_stunde: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  touren_pro_stunde: 1.8,
  team_avg: 1.6,
  rank_delta: 1,
  ampel: 'gruen',
  alert_bottom: false,
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
  if (v >= 2.0) return { text: 'Stark! Du lieferst sehr effizient — mehr als 2 Touren pro Stunde. Weiter so!', color: 'text-green-400' };
  if (v >= 1.5) return { text: 'Gute Effizienz — versuche kürzere Wartezeiten und optimierte Routen für mehr Touren/Stunde.', color: 'text-yellow-300' };
  return { text: 'Deine Effizienz ist unter dem Teamdurchschnitt. Fokussiere dich auf kürzere Stop-Zeiten und direkte Routen.', color: 'text-red-400' };
}

export function FahrerPhase5599MeineTourenProStunde({
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
        `/api/delivery/admin/fahrer-touren-pro-stunde-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        const me = Array.isArray(json.fahrer) && json.fahrer.length > 0
          ? (json.fahrer[0] as {
              rang: number;
              touren_pro_stunde: number;
              rank_delta: number;
              ampel: Ampel;
              alert_bottom: boolean;
            })
          : null;
        if (me) {
          setData({
            rang:               me.rang,
            touren_pro_stunde:  me.touren_pro_stunde,
            team_avg:           json.team_avg ?? MOCK.team_avg,
            rank_delta:         me.rank_delta,
            ampel:              me.ampel,
            alert_bottom:       me.alert_bottom,
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
      <div className="rounded-lg bg-gray-900 border border-gray-700/50 p-3 flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs text-gray-500">Offline – Touren/Stunde nicht verfügbar</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.touren_pro_stunde);
  const maxBar = Math.max(data.touren_pro_stunde, data.team_avg, 0.1);
  const myPct  = Math.round((data.touren_pro_stunde / maxBar) * 100);
  const avgPct = Math.round((data.team_avg / maxBar) * 100);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Route className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-white">Meine Touren/Stunde</span>
        {data.alert_bottom && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-white leading-none">
          {data.touren_pro_stunde.toFixed(1)}
        </span>
        <span className="text-sm text-gray-400 mb-0.5">/h</span>
        <div className="flex items-center gap-1 ml-auto mb-0.5">
          <span className="text-xs text-gray-500">Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Ich</span>
            <span>{data.touren_pro_stunde.toFixed(1)}/h</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div
              className="h-1.5 rounded-full bg-blue-400 transition-all duration-500"
              style={{ width: `${myPct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Team-Ø</span>
            <span>{data.team_avg.toFixed(1)}/h</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div
              className="h-1.5 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${avgPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] leading-snug ${coachColor}`}>{coachText}</p>
    </div>
  );
}
