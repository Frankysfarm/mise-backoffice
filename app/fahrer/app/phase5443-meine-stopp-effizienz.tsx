'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5443 — Meine Stopp-Effizienz (Fahrer)
// Zap amber-400; stopps_pro_stunde 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥3.0/≥2.0/<2.0; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  stopps_pro_stunde: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_bottom: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  stopps_pro_stunde: 2.8,
  team_avg: 2.4,
  rank_delta: 1,
  ampel: 'gruen',
  alert_bottom: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-amber-500/50',
  gelb:  'border-yellow-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-amber-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(s: number): { text: string; color: string } {
  if (s >= 3.0) return { text: 'Top-Effizienz! Du lieferst über 3 Stopps pro Stunde!', color: 'text-amber-400' };
  if (s >= 2.0) return { text: 'Gute Geschwindigkeit — versuche noch effizienter zu werden!', color: 'text-yellow-400' };
  return { text: 'Stopp-Effizienz zu niedrig — Routen optimieren!', color: 'text-red-400' };
}

export function FahrerPhase5443MeineStoppEffizienz({
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
        `/api/delivery/admin/fahrer-stopps-pro-stunde-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            stopps_pro_stunde: json.fahrer_single.stopps_pro_stunde,
            team_avg: json.team_avg,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_bottom: json.fahrer_single.alert_bottom,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            stopps_pro_stunde: me.stopps_pro_stunde,
            team_avg: json.team_avg,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_bottom: me.alert_bottom,
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
        <span className="text-xs text-gray-500">Stopp-Effizienz — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.stopps_pro_stunde, data.team_avg, 1);
  const c = coaching(data.stopps_pro_stunde);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-xs font-semibold text-white">Meine Stopp-Effizienz</span>
        {data.alert_bottom && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-amber-400">{data.stopps_pro_stunde.toFixed(1)}</span>
        <span className="text-lg text-amber-300 mb-0.5">/h</span>
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
              className="h-2 rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${(data.stopps_pro_stunde / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-amber-300 w-12 text-right">{data.stopps_pro_stunde.toFixed(1)}/h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{data.team_avg.toFixed(1)}/h</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
