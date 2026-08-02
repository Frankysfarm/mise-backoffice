'use client';

import { useEffect, useRef, useState } from 'react';
import { Flame, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5595 — Mein Peak-Stunden-Anteil (Fahrer)
// Flame amber-400; peak_anteil_pct ABSTEIGEND Rang 1=höchster Peak-Anteil=bester;
// 4xl+Rang; isOnline-Guard+WifiOff-Fallback; Coaching ≥70%/≥50%/<50%; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  peak_anteil_pct: number;
  peak_touren: number;
  total_touren: number;
  team_avg_peak_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  peak_anteil_pct: 65,
  peak_touren: 25,
  total_touren: 38,
  team_avg_peak_pct: 56,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
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
  if (v >= 70) return { text: 'Stark! Du arbeitest überwiegend in der Spitzenzeit — genau da wird die Flotte am meisten gebraucht.', color: 'text-green-400' };
  if (v >= 50) return { text: 'Guter Anteil — versuche noch mehr Touren in den Stoßzeiten (11–14 und 17–21 Uhr) anzunehmen.', color: 'text-yellow-300' };
  return { text: 'Dein Peak-Anteil ist niedrig. Stoßzeiten sind die wichtigsten Zeiten — plane deine Schichten dort ein.', color: 'text-red-400' };
}

export function FahrerPhase5595MeinPeakStundenAnteil({
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
        `/api/delivery/admin/fahrer-peak-stunden-anteil-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as {
            rang: number;
            peak_anteil_pct: number;
            peak_touren: number;
            total_touren: number;
            rank_delta: number;
            ampel: Ampel;
            alert_niedrig: boolean;
          };
          setData({
            rang:              me.rang,
            peak_anteil_pct:   me.peak_anteil_pct,
            peak_touren:       me.peak_touren,
            total_touren:      me.total_touren,
            team_avg_peak_pct: json.team_avg_peak_pct ?? MOCK.team_avg_peak_pct,
            rank_delta:        me.rank_delta ?? 0,
            ampel:             me.ampel,
            alert_niedrig:     me.alert_niedrig,
            gesamt:            json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">Peak-Stunden-Anteil — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.peak_anteil_pct, data.team_avg_peak_pct, 0.01);
  const c = coaching(data.peak_anteil_pct);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Flame className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-white">Mein Peak-Stunden-Anteil</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-amber-400">{data.peak_anteil_pct}</span>
        <span className="text-lg text-amber-300 mb-0.5">%</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span>Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-[10px] text-gray-500">
        {data.peak_touren}/{data.total_touren} Touren in Stoßzeiten (11–14 & 17–21 Uhr)
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ich</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${(data.peak_anteil_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-amber-300 w-10 text-right">{data.peak_anteil_pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_peak_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{data.team_avg_peak_pct}%</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
