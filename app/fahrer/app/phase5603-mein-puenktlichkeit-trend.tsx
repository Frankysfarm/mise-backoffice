'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5603 — Mein Pünktlichkeits-Trend (Fahrer)
// TrendingUp cyan-400; trend_delta_pct 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching >0%/=0%/<0%; Dual-Balken Aktuell+Vormonat; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRowFromApi {
  fahrer_id: string;
  rang: number;
  trend_delta_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface MyData {
  rang: number;
  trend_delta_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  team_avg_trend: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  trend_delta_pct: 5,
  aktuell_pct: 90,
  vorher_pct: 85,
  team_avg_trend: 1.0,
  rank_delta: 1,
  ampel: 'gruen',
  alert_rueckfall: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-green-500/50',
  gelb:  'border-yellow-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(delta: number): { text: string; color: string } {
  if (delta > 0) return { text: `Deine Pünktlichkeit hat sich um ${delta}% verbessert — stark! Halte dieses Niveau.`, color: 'text-green-400' };
  if (delta === 0) return { text: 'Deine Pünktlichkeit ist stabil. Versuche, noch pünktlicher zu liefern.', color: 'text-yellow-300' };
  return { text: `Rückgang um ${Math.abs(delta)}% — analysiere Verzögerungsursachen und sprich mit deinem Dispatcher.`, color: 'text-red-400' };
}

export function FahrerPhase5603MeinPuenktlichkeitsTrend({
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
        `/api/delivery/admin/fahrer-puenktlichkeits-trend-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        const me = Array.isArray(json.fahrer)
          ? (json.fahrer as FahrerRowFromApi[]).find((f) => f.fahrer_id === driverId) ?? null
          : null;
        if (me) {
          setData({
            rang:            me.rang,
            trend_delta_pct: me.trend_delta_pct,
            aktuell_pct:     me.aktuell_pct,
            vorher_pct:      me.vorher_pct,
            team_avg_trend:  (json.team_avg_trend as number) ?? MOCK.team_avg_trend,
            rank_delta:      me.rank_delta,
            ampel:           me.ampel,
            alert_rueckfall: me.alert_rueckfall,
            gesamt:          (json.gesamt as number) ?? MOCK.gesamt,
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
      <div className="rounded-lg bg-gray-900 border border-gray-700/50 p-3 flex items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 text-gray-500" />
        <span className="text-xs text-gray-500">Offline – Pünktlichkeits-Trend nicht verfügbar</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.trend_delta_pct);
  const maxBar = Math.max(data.aktuell_pct, data.vorher_pct, 1);
  const curPct  = Math.round((data.aktuell_pct / maxBar) * 100);
  const prevPct = Math.round((data.vorher_pct / maxBar) * 100);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-3.5 w-3.5 text-cyan-400" />
        <span className="text-xs font-semibold text-white">Mein Pünktlichkeits-Trend</span>
        {data.alert_rueckfall && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-black leading-none ${data.trend_delta_pct >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>
          {data.trend_delta_pct > 0 ? '+' : ''}{data.trend_delta_pct}%
        </span>
        <div className="flex items-center gap-1 ml-auto mb-0.5">
          <span className="text-xs text-gray-500">Rang {data.rang}/{data.gesamt}</span>
          <DeltaIcon d={data.rank_delta} />
        </div>
      </div>

      {/* Dual-Balken Aktuell + Vormonat */}
      <div className="space-y-1">
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Aktuell</span>
            <span>{data.aktuell_pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div className="h-1.5 rounded-full bg-cyan-400 transition-all duration-500" style={{ width: `${curPct}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
            <span>Vormonat</span>
            <span>{data.vorher_pct}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-800">
            <div className="h-1.5 rounded-full bg-gray-500 transition-all duration-500" style={{ width: `${prevPct}%` }} />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] leading-snug ${coachColor}`}>{coachText}</p>
    </div>
  );
}
