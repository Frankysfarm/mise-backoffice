'use client';

import { useEffect, useRef, useState } from 'react';
import { Coffee, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5531 — Meine Pauseneffizienz (Fahrer)
// Coffee cyan-400; pausenquote_pct 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤5%/≤10%/>10%; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  pausenquote_pct: number;
  team_avg_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_hoch: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  pausenquote_pct: 6.8,
  team_avg_pct: 10.0,
  rank_delta: 1,
  ampel: 'gruen',
  alert_hoch: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-cyan-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(pct: number): { text: string; color: string } {
  if (pct <= 5)  return { text: 'Top-Effizienz! Du nutzt deine Schichtzeit optimal — minimale Pausen, maximale Lieferleistung!', color: 'text-cyan-400' };
  if (pct <= 10) return { text: 'Gut — versuche, kurze Pausen gezielt zwischen Touren zu legen, um die Effizienz weiter zu steigern!', color: 'text-yellow-400' };
  return { text: 'Tipp: Pausen über 10% der Schichtzeit kosten Lieferungen. Kurze, geplante Pausen helfen dir und dem Team!', color: 'text-red-400' };
}

export function FahrerPhase5531MeinePauseneffizienz({
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
        `/api/delivery/admin/fahrer-pauseneffizienz-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang:             json.fahrer_single.rang,
            pausenquote_pct:  json.fahrer_single.pausenquote_pct,
            team_avg_pct:     json.fahrer_single.team_avg_pct,
            rank_delta:       json.fahrer_single.rank_delta ?? 0,
            ampel:            json.fahrer_single.ampel,
            alert_hoch:       json.fahrer_single.alert_hoch,
            gesamt:           json.fahrer_single.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang:            me.rang,
            pausenquote_pct: me.pausenquote_pct,
            team_avg_pct:    json.team_avg_pct,
            rank_delta:      me.rank_delta,
            ampel:           me.ampel,
            alert_hoch:      me.alert_hoch,
            gesamt:          json.gesamt,
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
        <span className="text-xs text-gray-500">Pauseneffizienz — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.pausenquote_pct, data.team_avg_pct, 1);
  const c = coaching(data.pausenquote_pct);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Coffee className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold text-white">Meine Pauseneffizienz</span>
        {data.alert_hoch && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-cyan-400">{data.pausenquote_pct}</span>
        <span className="text-sm text-cyan-300 mb-1">% Pausenquote</span>
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
              className="h-2 rounded-full bg-cyan-400 transition-all duration-500"
              style={{ width: `${(data.pausenquote_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-cyan-300 w-10 text-right">{data.pausenquote_pct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_pct / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{data.team_avg_pct}%</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
