'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5587 — Meine Schicht-Abbruch-Quote (Fahrer)
// AlertOctagon red-400; abbruch_pct 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤2%/≤10%/>10%; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  abbruch_pct: number;
  abbrueche: number;
  schichten: number;
  team_avg_abbruch_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  abbruch_pct: 3.8,
  abbrueche: 2,
  schichten: 53,
  team_avg_abbruch_pct: 6.7,
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
  if (v <= 2)  return { text: 'Ausgezeichnet! Deine Schicht-Abbruchrate ist sehr niedrig — absolute Zuverlässigkeit!', color: 'text-green-400' };
  if (v <= 10) return { text: 'Gute Abbruchrate — versuche, jede angenommene Schicht vollständig abzuschließen.', color: 'text-yellow-300' };
  return { text: 'Deine Abbruchrate ist zu hoch. Bitte brich Schichten nur im absoluten Notfall ab.', color: 'text-red-400' };
}

export function FahrerPhase5587MeineSchichtAbbruchQuote({
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
        `/api/delivery/admin/fahrer-schicht-abbruch-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as {
            rang: number;
            abbruch_pct: number;
            abbrueche: number;
            schichten: number;
            rank_delta: number;
            ampel: Ampel;
            alert_hoch: boolean;
          };
          setData({
            rang:                 me.rang,
            abbruch_pct:          me.abbruch_pct,
            abbrueche:            me.abbrueche,
            schichten:            me.schichten,
            team_avg_abbruch_pct: json.team_avg_abbruch_pct ?? MOCK.team_avg_abbruch_pct,
            rank_delta:           me.rank_delta ?? 0,
            ampel:                me.ampel,
            alert_hoch:           me.alert_hoch,
            gesamt:               json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">Schicht-Abbruch-Quote — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.abbruch_pct, data.team_avg_abbruch_pct, 0.01);
  const c = coaching(data.abbruch_pct);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <AlertOctagon className="h-3.5 w-3.5 text-red-400" />
        <span className="text-xs font-semibold text-white">Meine Schicht-Abbruch-Quote</span>
        {data.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-red-400">{data.abbruch_pct.toFixed(1)}</span>
        <span className="text-lg text-red-300 mb-0.5">%</span>
        <div className="ml-auto flex items-center gap-1 text-xs text-gray-400">
          <span>Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Subtitle */}
      <div className="text-[10px] text-gray-500">
        {data.abbrueche} Abbrüche bei {data.schichten} Schichten (30 Tage)
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ich</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-red-400 transition-all duration-500"
              style={{ width: `${(data.abbruch_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-red-300 w-14 text-right">{data.abbruch_pct.toFixed(1)} %</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_abbruch_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{data.team_avg_abbruch_pct.toFixed(1)} %</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
