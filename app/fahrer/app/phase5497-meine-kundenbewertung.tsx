'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5497 — Meine Kundenbewertung (Fahrer)
// Star orange-400; avg_bewertung 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥4.5/≥4.0/<4.0; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_bewertung: number;
  team_avg_bewertung: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_bewertung: 4.7,
  team_avg_bewertung: 4.43,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-orange-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(v: number): { text: string; color: string } {
  if (v >= 4.5) return { text: 'Exzellente Bewertung! Deine Kunden sind begeistert — weiter so!', color: 'text-orange-400' };
  if (v >= 4.0) return { text: 'Gute Bewertung — noch etwas Freundlichkeit und du erreichst die Spitze!', color: 'text-yellow-400' };
  return { text: 'Tipp: Lächeln, pünktlich sein und Bestellung sorgfältig übergeben — das macht den Unterschied!', color: 'text-red-400' };
}

function fmtStar(v: number): string {
  return v.toFixed(1);
}

export function FahrerPhase5497MeineKundenbewertung({
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
        `/api/delivery/admin/fahrer-kundenbewertung-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            avg_bewertung: json.fahrer_single.avg_bewertung,
            team_avg_bewertung: json.team_avg_bewertung,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_niedrig: json.fahrer_single.alert_niedrig,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            avg_bewertung: me.avg_bewertung,
            team_avg_bewertung: json.team_avg_bewertung,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_niedrig: me.alert_niedrig,
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
        <span className="text-xs text-gray-500">Kundenbewertung — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_bewertung, data.team_avg_bewertung, 1);
  const c = coaching(data.avg_bewertung);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Star className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-white">Meine Kundenbewertung</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-orange-400">{fmtStar(data.avg_bewertung)}</span>
        <span className="text-lg text-orange-300 mb-0.5">★</span>
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
              className="h-2 rounded-full bg-orange-400 transition-all duration-500"
              style={{ width: `${(data.avg_bewertung / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-orange-300 w-10 text-right">{fmtStar(data.avg_bewertung)} ★</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_bewertung / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{fmtStar(data.team_avg_bewertung)} ★</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
