'use client';

import { useEffect, useRef, useState } from 'react';
import { Sigma, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5447 — Meine Lieferzeit-Varianz (Fahrer)
// Sigma purple-400; lieferzeit_varianz_min 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤3min/≤6min/>6min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  lieferzeit_varianz_min: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  lieferzeit_varianz_min: 3.2,
  team_avg: 5.0,
  rank_delta: 1,
  ampel: 'gruen',
  alert_hoch: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-purple-500/50',
  gelb:  'border-yellow-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-purple-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(v: number): { text: string; color: string } {
  if (v <= 3.0) return { text: 'Sehr konstant! Deine Lieferzeiten sind sehr zuverlässig vorhersagbar!', color: 'text-purple-400' };
  if (v <= 6.0) return { text: 'Gute Konstanz — versuche noch gleichmäßiger zu liefern!', color: 'text-yellow-400' };
  return { text: 'Hohe Varianz — Kunden erwarten konstante Lieferzeiten!', color: 'text-red-400' };
}

export function FahrerPhase5447MeineLieferzeitVarianz({
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
        `/api/delivery/admin/fahrer-lieferzeit-varianz-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            lieferzeit_varianz_min: json.fahrer_single.lieferzeit_varianz_min,
            team_avg: json.team_avg,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_hoch: json.fahrer_single.alert_hoch,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            lieferzeit_varianz_min: me.lieferzeit_varianz_min,
            team_avg: json.team_avg,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_hoch: me.alert_hoch,
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
        <span className="text-xs text-gray-500">Lieferzeit-Varianz — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.lieferzeit_varianz_min, data.team_avg, 1);
  const c = coaching(data.lieferzeit_varianz_min);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Sigma className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-white">Meine Lieferzeit-Varianz</span>
        {data.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-purple-400">±{data.lieferzeit_varianz_min.toFixed(1)}</span>
        <span className="text-lg text-purple-300 mb-0.5">min</span>
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
              className="h-2 rounded-full bg-purple-400 transition-all duration-500"
              style={{ width: `${(data.lieferzeit_varianz_min / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-purple-300 w-14 text-right">±{data.lieferzeit_varianz_min.toFixed(1)}min</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">±{data.team_avg.toFixed(1)}min</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
