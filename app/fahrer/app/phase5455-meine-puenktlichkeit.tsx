'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5455 — Meine Pünktlichkeit (Fahrer)
// Clock3 blue-400; rate_pct 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥90%/≥70%/<70%; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  rate_pct: number;
  team_avg_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  rate_pct: 88,
  team_avg_pct: 78,
  rank_delta: 0,
  ampel: 'gelb',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-blue-500/50',
  gelb:  'border-yellow-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-blue-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(q: number): { text: string; color: string } {
  if (q >= 90) return { text: 'Top-Pünktlichkeit! Du lieferst fast immer rechtzeitig — weiter so!', color: 'text-blue-400' };
  if (q >= 70) return { text: 'Gute Pünktlichkeit — versuche noch gleichmäßiger in der Zeit zu bleiben!', color: 'text-yellow-400' };
  return { text: 'Pünktlichkeit verbessern — Kunden verlassen sich auf deine ETA!', color: 'text-red-400' };
}

export function FahrerPhase5455MeinePuenktlichkeit({
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
        `/api/delivery/admin/fahrer-puenktlichkeits-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            rate_pct: me.rate_pct,
            team_avg_pct: json.team_avg_pct,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_niedrig: me.alert_niedrig,
            gesamt: json.gesamt,
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
        <span className="text-xs text-gray-500">Pünktlichkeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.rate_pct, data.team_avg_pct, 1);
  const c = coaching(data.rate_pct);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-white">Meine Pünktlichkeit</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-blue-400">{data.rate_pct}</span>
        <span className="text-lg text-blue-300 mb-0.5">%</span>
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
              className="h-2 rounded-full bg-blue-400 transition-all duration-500"
              style={{ width: `${(data.rate_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-blue-300 w-8 text-right">{data.rate_pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{data.team_avg_pct}%</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
