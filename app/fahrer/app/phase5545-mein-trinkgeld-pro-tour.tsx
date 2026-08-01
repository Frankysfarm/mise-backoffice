'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5545 — Mein Trinkgeld pro Tour (Fahrer)
// Coins yellow-400; avg_trinkgeld 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥2.50/≥1.50/<1.50 €; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_trinkgeld: number;
  team_avg_trinkgeld: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_trinkgeld: 2.10,
  team_avg_trinkgeld: 1.70,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
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
  if (v >= 2.50) return { text: 'Spitzen-Trinkgeld! Deine Kunden schätzen deinen Service sehr — top!', color: 'text-yellow-400' };
  if (v >= 1.50) return { text: 'Gutes Trinkgeld — Pünktlichkeit und freundliche Übergabe bringen noch mehr!', color: 'text-yellow-300' };
  return { text: 'Tipp: Lächeln, Blickkontakt und eine ordentliche Übergabe machen oft den Unterschied beim Trinkgeld.', color: 'text-red-400' };
}

function fmtTip(v: number): string {
  return v.toFixed(2);
}

export function FahrerPhase5545MeinTrinkgeldProTour({
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
        `/api/delivery/admin/fahrer-trinkgeld-pro-tour-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as { rang: number; avg_trinkgeld: number; rank_delta: number; ampel: Ampel; alert_niedrig: boolean };
          setData({
            rang: me.rang,
            avg_trinkgeld: me.avg_trinkgeld,
            team_avg_trinkgeld: json.team_avg_trinkgeld ?? MOCK.team_avg_trinkgeld,
            rank_delta: me.rank_delta ?? 0,
            ampel: me.ampel,
            alert_niedrig: me.alert_niedrig,
            gesamt: json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">Trinkgeld pro Tour — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_trinkgeld, data.team_avg_trinkgeld, 0.01);
  const c = coaching(data.avg_trinkgeld);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Coins className="h-3.5 w-3.5 text-yellow-400" />
        <span className="text-xs font-semibold text-white">Mein Trinkgeld pro Tour</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-yellow-400">{fmtTip(data.avg_trinkgeld)}</span>
        <span className="text-lg text-yellow-300 mb-0.5">€</span>
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
              style={{ width: `${(data.avg_trinkgeld / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-yellow-300 w-12 text-right">{fmtTip(data.avg_trinkgeld)} €</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_trinkgeld / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{fmtTip(data.team_avg_trinkgeld)} €</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
