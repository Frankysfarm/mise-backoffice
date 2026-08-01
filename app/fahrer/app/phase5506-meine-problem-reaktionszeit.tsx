'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5506 — Meine Problem-Reaktionszeit (Fahrer)
// Zap yellow-400; reaktionszeit_min 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤10/≤20/>20 min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  reaktionszeit_min: number;
  team_avg_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_langsam: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  reaktionszeit_min: 14.0,
  team_avg_min: 20.5,
  rank_delta: 1,
  ampel: 'gruen',
  alert_langsam: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-yellow-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(v: number): { text: string; color: string } {
  if (v <= 10) return { text: 'Blitzschnell! Du löst Probleme sofort — das schätzen Kunden und Team sehr!', color: 'text-yellow-400' };
  if (v <= 20) return { text: 'Gute Reaktionszeit — noch etwas schneller und du bist in der Spitzengruppe!', color: 'text-yellow-400' };
  return { text: 'Tipp: Bei Problemen sofort melden — schnelle Reaktion verhindert Eskalationen und Beschwerden!', color: 'text-red-400' };
}

function fmtMin(v: number): string {
  return v.toFixed(1);
}

export function FahrerPhase5506MeineProblemReaktionszeit({
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
        `/api/delivery/admin/fahrer-problem-reaktionszeit-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            reaktionszeit_min: json.fahrer_single.reaktionszeit_min,
            team_avg_min: json.team_avg_min,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_langsam: json.fahrer_single.alert_langsam,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            reaktionszeit_min: me.reaktionszeit_min,
            team_avg_min: json.team_avg_min,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_langsam: me.alert_langsam,
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
        <span className="text-xs text-gray-500">Problem-Reaktionszeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.reaktionszeit_min, data.team_avg_min, 1);
  const c = coaching(data.reaktionszeit_min);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Zap className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-xs font-semibold text-white">Meine Problem-Reaktionszeit</span>
        {data.alert_langsam && <AlertTriangle className="h-3 w-3 text-yellow-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-yellow-400">{fmtMin(data.reaktionszeit_min)}</span>
        <span className="text-sm text-yellow-300 mb-1">min</span>
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
              style={{ width: `${(data.reaktionszeit_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-yellow-300 w-14 text-right">{fmtMin(data.reaktionszeit_min)} min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{fmtMin(data.team_avg_min)} min</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
