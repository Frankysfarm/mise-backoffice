'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock3, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5485 — Meine Tourstart-Pünktlichkeit (Fahrer)
// Clock3 blue-400; avg_verzoegerung_min 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤0/≤5/>5 min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_verzoegerung_min: number;
  team_avg_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_verspaetet: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_verzoegerung_min: 2,
  team_avg_min: 4.75,
  rank_delta: -1,
  ampel: 'gruen',
  alert_verspaetet: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-blue-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(m: number): { text: string; color: string } {
  if (m <= 0) return { text: 'Perfekt! Du startest deine Touren immer pünktlich — weiter so!', color: 'text-blue-400' };
  if (m <= 5) return { text: 'Gute Arbeit — ein bisschen früher bereit sein und du bist in der Spitzengruppe!', color: 'text-yellow-400' };
  return { text: 'Tipp: Bereite dich rechtzeitig vor dem geplanten Tourstart vor, um deinen Rang zu verbessern!', color: 'text-red-400' };
}

function fmtMin(m: number): string {
  if (m === 0) return '0';
  return m.toFixed(1);
}

export function FahrerPhase5485MeineTourstartPuenktlichkeit({
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
        `/api/delivery/admin/fahrer-tourstart-puenktlichkeit?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            avg_verzoegerung_min: json.fahrer_single.avg_verzoegerung_min,
            team_avg_min: json.team_avg_min,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_verspaetet: json.fahrer_single.alert_verspaetet,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            avg_verzoegerung_min: me.avg_verzoegerung_min,
            team_avg_min: json.team_avg_min,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_verspaetet: me.alert_verspaetet,
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
        <span className="text-xs text-gray-500">Tourstart-Pünktlichkeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_verzoegerung_min, data.team_avg_min, 1);
  const c = coaching(data.avg_verzoegerung_min);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-white">Mein Tourstart</span>
        {data.alert_verspaetet && <AlertTriangle className="h-3 w-3 text-yellow-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-blue-400">{fmtMin(data.avg_verzoegerung_min)}</span>
        <span className="text-lg text-blue-300 mb-0.5">min</span>
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
              style={{ width: `${(data.avg_verzoegerung_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-blue-300 w-12 text-right">{fmtMin(data.avg_verzoegerung_min)} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{fmtMin(data.team_avg_min)} min</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
