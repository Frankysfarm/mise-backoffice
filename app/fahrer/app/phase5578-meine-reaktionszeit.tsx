'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5578 — Meine Dispatch-Reaktionszeit (Fahrer)
// Zap yellow-400; avg_reaktionszeit_min 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤3/≤8/>8 min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_reaktionszeit_min: number;
  team_avg_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_reaktionszeit_min: 4.3,
  team_avg_min: 6.1,
  rank_delta: 1,
  ampel: 'gelb',
  alert_hoch: false,
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
  if (v <= 3) return { text: 'Ausgezeichnet! Du reagierst sehr schnell auf neue Aufträge — Top-Reaktion!', color: 'text-green-400' };
  if (v <= 8) return { text: 'Gute Reaktionszeit — versuche noch schneller auf neue Dispatch-Aufträge zu reagieren.', color: 'text-yellow-300' };
  return { text: 'Deine Reaktionszeit ist zu lang. Bitte reagiere zügiger auf eingehende Aufträge.', color: 'text-red-400' };
}

function fmtMin(v: number): string {
  return v.toFixed(1);
}

export function FahrerPhase5578MeineReaktionszeit({
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
        `/api/delivery/admin/fahrer-reaktionszeit-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as { rang: number; avg_reaktionszeit_min: number; rank_delta: number; ampel: Ampel; alert_hoch: boolean };
          setData({
            rang:                  me.rang,
            avg_reaktionszeit_min: me.avg_reaktionszeit_min,
            team_avg_min:          json.team_avg_min ?? MOCK.team_avg_min,
            rank_delta:            me.rank_delta ?? 0,
            ampel:                 me.ampel,
            alert_hoch:            me.alert_hoch,
            gesamt:                json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">Reaktionszeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_reaktionszeit_min, data.team_avg_min, 0.01);
  const c = coaching(data.avg_reaktionszeit_min);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-xs font-semibold text-white">Meine Dispatch-Reaktionszeit</span>
        {data.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-yellow-400">{fmtMin(data.avg_reaktionszeit_min)}</span>
        <span className="text-lg text-yellow-300 mb-0.5">Min</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span>Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ich</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-yellow-400 transition-all duration-500"
              style={{ width: `${(data.avg_reaktionszeit_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-yellow-300 w-14 text-right">{fmtMin(data.avg_reaktionszeit_min)} Min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{fmtMin(data.team_avg_min)} Min</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
