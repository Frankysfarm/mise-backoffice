'use client';

import { useEffect, useRef, useState } from 'react';
import { Coins, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5405 — Mein Trinkgeld (Fahrer)
// Coins orange-400; avg_trinkgeld_eur 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥2.00/≥1.00/<0.80; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

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
  gruen: 'border-emerald-500/50',
  gelb:  'border-amber-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(tip: number): { text: string; color: string } {
  if (tip >= 2.00) return { text: 'Sehr gutes Trinkgeld! Weiter so!', color: 'text-emerald-400' };
  if (tip >= 1.00) return { text: 'Solides Trinkgeld — bleib freundlich!', color: 'text-amber-400' };
  return { text: 'Trinkgeld unter Team-Ø — Kundenkontakt verbessern', color: 'text-red-400' };
}

export function FahrerPhase5405MeinTrinkgeld({
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
      const r = await fetch(`/api/delivery/admin/fahrer-trinkgeld-pro-tour-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`);
      if (r.ok) {
        const json = await r.json();
        const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        if (me) setData({ rang: me.rang, avg_trinkgeld: me.avg_trinkgeld, team_avg_trinkgeld: json.team_avg_trinkgeld, rank_delta: me.rank_delta, ampel: me.ampel, alert_niedrig: me.alert_niedrig, gesamt: json.gesamt });
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
      <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 flex items-center gap-2 text-sm text-gray-500">
        <WifiOff className="h-4 w-4" />
        Offline — Trinkgeld-Daten nicht verfügbar
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.avg_trinkgeld);
  const maxVal = Math.max(data.avg_trinkgeld, data.team_avg_trinkgeld, 0.01);

  return (
    <div className={`rounded-xl bg-gray-900 border-2 ${BORDER[data.ampel]} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-orange-400" />
          <span className="text-sm font-semibold text-white">Mein Trinkgeld</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <DeltaIcon d={data.rank_delta} />
          <span>Rang #{data.rang} von {data.gesamt}</span>
        </div>
      </div>

      {/* Big Value */}
      <div className="text-center py-2">
        <div className="text-4xl font-black text-orange-400">€{data.avg_trinkgeld.toFixed(2)}</div>
        <div className="text-xs text-gray-400 mt-0.5">Ø Trinkgeld pro Tour</div>
      </div>

      {/* Coaching */}
      {data.alert_niedrig && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 rounded-lg px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Trinkgeld deutlich unter Team-Ø
        </div>
      )}
      <div className={`text-xs ${coachColor} text-center`}>{coachText}</div>

      {/* Dual Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Ich</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-orange-400 transition-all" style={{ width: `${(data.avg_trinkgeld / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-10 text-right">€{data.avg_trinkgeld.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Team-Ø</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-500 transition-all" style={{ width: `${(data.team_avg_trinkgeld / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-10 text-right">€{data.team_avg_trinkgeld.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-[10px] text-gray-600 text-right">30-Min-Update</div>
    </div>
  );
}
