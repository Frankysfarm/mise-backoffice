'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5549 — Meine Leerfahrten-Quote (Fahrer)
// Navigation red-400; leerfahrten_pct 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤10%/≤25%/>25%; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  leerfahrten_pct: number;
  team_avg_leerfahrten_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  leerfahrten_pct: 12,
  team_avg_leerfahrten_pct: 19.25,
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
  if (v <= 10) return { text: 'Top! Deine Leerfahrten-Quote ist ausgezeichnet — du planst sehr effizient!', color: 'text-green-400' };
  if (v <= 25) return { text: 'Gute Quote — versuche, Rückfahrten mit Aufträgen zu kombinieren um sie weiter zu senken.', color: 'text-yellow-300' };
  return { text: 'Deine Leerfahrten-Quote ist zu hoch. Sprich mit dem Dispatch über bessere Routenplanung.', color: 'text-red-400' };
}

function fmtPct(v: number): string {
  return v.toFixed(1);
}

export function FahrerPhase5549MeineLeerfahrtenQuote({
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
        `/api/delivery/admin/fahrer-leerfahrten-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as { rang: number; leerfahrten_pct: number; rank_delta: number; ampel: Ampel; alert_bottom: boolean };
          setData({
            rang:                    me.rang,
            leerfahrten_pct:         me.leerfahrten_pct,
            team_avg_leerfahrten_pct: json.team_avg_leerfahrten_pct ?? MOCK.team_avg_leerfahrten_pct,
            rank_delta:              me.rank_delta ?? 0,
            ampel:                   me.ampel,
            alert_bottom:            me.alert_bottom,
            gesamt:                  json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">Leerfahrten-Quote — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.leerfahrten_pct, data.team_avg_leerfahrten_pct, 0.01);
  const c = coaching(data.leerfahrten_pct);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Navigation className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs font-semibold text-white">Meine Leerfahrten-Quote</span>
        {data.alert_bottom && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-red-400">{fmtPct(data.leerfahrten_pct)}</span>
        <span className="text-lg text-red-300 mb-0.5">%</span>
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
              className="h-2 rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${(data.leerfahrten_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-red-300 w-12 text-right">{fmtPct(data.leerfahrten_pct)} %</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_leerfahrten_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{fmtPct(data.team_avg_leerfahrten_pct)} %</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
