'use client';

import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5510 — Meine Zuverlässigkeit (Fahrer)
// ShieldCheck emerald-400; score 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥80/≥60/<60; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  score: number;
  team_avg_score: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  score: 76,
  team_avg_score: 70,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-emerald-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Hervorragend! Dein Zuverlässigkeits-Score ist exzellent — du bist ein verlässlicher Anker im Team!', color: 'text-emerald-400' };
  if (score >= 60) return { text: 'Gut — mit etwas mehr Schichtpünktlichkeit und weniger Ausfällen erreichst du die Spitze!', color: 'text-yellow-400' };
  return { text: 'Tipp: Versuche Schichten seltener abzusagen und pünktlich zu beginnen — das verbessert deinen Score stark!', color: 'text-red-400' };
}

export function FahrerPhase5510MeineZuverlaessigkeit({
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
        `/api/delivery/admin/fahrer-zuverlaessigkeits-score-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang:           json.fahrer_single.rang,
            score:          json.fahrer_single.score,
            team_avg_score: json.team_avg_score,
            rank_delta:     json.fahrer_single.rank_delta ?? 0,
            ampel:          json.fahrer_single.ampel,
            alert_niedrig:  json.fahrer_single.alert_niedrig,
            gesamt:         json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang:           me.rang,
            score:          me.score,
            team_avg_score: json.team_avg_score,
            rank_delta:     me.rank_delta,
            ampel:          me.ampel,
            alert_niedrig:  me.alert_niedrig,
            gesamt:         json.gesamt,
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
        <span className="text-xs text-gray-500">Zuverlässigkeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.score, data.team_avg_score, 1);
  const c = coaching(data.score);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-xs font-semibold text-white">Meine Zuverlässigkeit</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-emerald-400">{data.score}</span>
        <span className="text-sm text-emerald-300 mb-1">Pkt</span>
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
              className="h-2 rounded-full bg-emerald-400 transition-all duration-500"
              style={{ width: `${(data.score / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-emerald-300 w-8 text-right">{data.score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_score / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-8 text-right">{data.team_avg_score}</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
