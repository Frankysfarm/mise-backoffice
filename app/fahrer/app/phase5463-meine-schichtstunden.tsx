'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5463 — Meine Schichtstunden (Fahrer)
// Clock teal-400; avg_stunden 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥6h/≥4h/<4h; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_stunden: number;
  team_avg_stunden: number;
  rank_delta: number;
  ampel: Ampel;
  alert_wenig: boolean;
  gesamt: number;
  ziel_stunden: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_stunden: 6.8,
  team_avg_stunden: 5.93,
  rank_delta: 0,
  ampel: 'gruen',
  alert_wenig: false,
  gesamt: 4,
  ziel_stunden: 6,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-teal-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(h: number): { text: string; color: string } {
  if (h >= 6) return { text: 'Top-Einsatz! Du leistest überdurchschnittlich viele Schichtstunden — weiter so!', color: 'text-teal-400' };
  if (h >= 4) return { text: 'Solide Leistung — noch ein paar Stunden mehr und du erreichst das Teamziel von 6h!', color: 'text-yellow-400' };
  return { text: 'Tipp: Mehr Schichtstunden steigern dein Ranking und deine Gesamteinnahmen!', color: 'text-red-400' };
}

export function FahrerPhase5463MeineSchichtstunden({
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
        `/api/delivery/admin/fahrer-schichtstunden-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            avg_stunden: json.fahrer_single.avg_stunden,
            team_avg_stunden: json.team_avg_stunden,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_wenig: json.fahrer_single.alert_wenig,
            gesamt: json.gesamt,
            ziel_stunden: json.ziel_stunden ?? 6,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            avg_stunden: me.avg_stunden,
            team_avg_stunden: json.team_avg_stunden,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_wenig: me.alert_wenig,
            gesamt: json.gesamt,
            ziel_stunden: json.ziel_stunden ?? 6,
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
        <span className="text-xs text-gray-500">Schichtstunden — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_stunden, data.team_avg_stunden, 1);
  const c = coaching(data.avg_stunden);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-teal-400" />
        <span className="text-xs font-semibold text-white">Meine Schichtstunden</span>
        {data.alert_wenig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-teal-400">{data.avg_stunden.toFixed(1)}</span>
        <span className="text-lg text-teal-300 mb-0.5">h</span>
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
              className="h-2 rounded-full bg-teal-400 transition-all duration-500"
              style={{ width: `${(data.avg_stunden / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-teal-300 w-10 text-right">{data.avg_stunden.toFixed(1)}h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_stunden / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{data.team_avg_stunden.toFixed(1)}h</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
