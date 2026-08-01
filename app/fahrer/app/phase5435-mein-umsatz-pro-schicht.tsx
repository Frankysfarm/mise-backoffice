'use client';

import { useEffect, useRef, useState } from 'react';
import { Banknote, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5435 — Mein Umsatz/Schicht (Fahrer)
// Banknote orange-400; umsatz_pro_schicht 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥160/≥120/<120 €; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  umsatz_pro_schicht: number;
  team_avg_umsatz: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  umsatz_pro_schicht: 162,
  team_avg_umsatz: 147.5,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-orange-500/50',
  gelb:  'border-amber-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(u: number): { text: string; color: string } {
  if (u >= 160) return { text: 'Spitzen-Umsatz! Ausgezeichnete Schicht-Leistung.', color: 'text-emerald-400' };
  if (u >= 120) return { text: 'Guter Umsatz — weiter so!', color: 'text-amber-400' };
  return { text: 'Unter Ziel — mehr Touren für höheren Umsatz!', color: 'text-red-400' };
}

export function FahrerPhase5435MeinUmsatzProSchicht({
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
        `/api/delivery/admin/fahrer-umsatz-pro-schicht-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            umsatz_pro_schicht: json.fahrer_single.umsatz_pro_schicht,
            team_avg_umsatz: json.team_avg_umsatz,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_niedrig: json.fahrer_single.alert_niedrig,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            umsatz_pro_schicht: me.umsatz_pro_schicht,
            team_avg_umsatz: json.team_avg_umsatz,
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
        <span className="text-xs text-gray-500">Umsatz/Schicht — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.umsatz_pro_schicht, data.team_avg_umsatz, 1);
  const c = coaching(data.umsatz_pro_schicht);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Banknote className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-white">Mein Umsatz/Schicht</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-orange-400">{data.umsatz_pro_schicht.toFixed(0)}</span>
        <span className="text-lg text-orange-300 mb-0.5">€</span>
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
              style={{ width: `${(data.umsatz_pro_schicht / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-orange-300 w-12 text-right">{data.umsatz_pro_schicht.toFixed(0)} €</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_umsatz / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{data.team_avg_umsatz.toFixed(0)} €</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
