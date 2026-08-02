'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5643 — Mein Wochenend-Effizienz-Trend (Fahrer) — Batch 105
// Zap purple-400; effizienz_delta ABSTEIGEND Rang 1=größte Verbesserung=bester;
// isOnline-Guard+WifiOff-Fallback; Coaching >0/=0/<0; Dual-Balken Aktuell+Vormonat; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRowFromApi {
  fahrer_id: string;
  rang: number;
  effizienz_delta: number;
  aktuell_touren_pro_std: number;
  vorher_touren_pro_std: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface MyData {
  rang: number;
  effizienz_delta: number;
  aktuell_touren_pro_std: number;
  vorher_touren_pro_std: number;
  team_avg_delta: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  effizienz_delta: 0.4,
  aktuell_touren_pro_std: 3.1,
  vorher_touren_pro_std: 2.7,
  team_avg_delta: 0.125,
  rank_delta: 0,
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
  if (d > 0) return <TrendingUp  className="h-3.5 w-3.5 text-purple-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400"   />;
  return        <Minus        className="h-3.5 w-3.5 text-gray-500"   />;
}

function coaching(delta: number): { text: string; color: string } {
  if (delta > 0) return {
    text: `Deine Wochenend-Effizienz ist um ${delta.toFixed(2)} Touren/Std gestiegen — top! Wochenend-Routinen und schnelle Übergaben zahlen sich aus.`,
    color: 'text-purple-400',
  };
  if (delta === 0) return {
    text: 'Deine Wochenend-Effizienz ist stabil. Optimiere Stop-Reihenfolge und Wartezeiten für weitere Gewinne.',
    color: 'text-yellow-300',
  };
  return {
    text: `Wochenend-Effizienz um ${Math.abs(delta).toFixed(2)} T/Std gesunken — prüfe deine Routen und versuche Spitzenzeiten besser zu nutzen.`,
    color: 'text-red-400',
  };
}

export function FahrerPhase5643MeinWochenendEffizienzTrend({
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
        `/api/delivery/admin/fahrer-wochenend-effizienz-trend-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        const me = Array.isArray(json.fahrer)
          ? (json.fahrer as FahrerRowFromApi[]).find(f => f.fahrer_id === driverId) ?? null
          : null;
        if (me) {
          setData({
            rang:                    me.rang,
            effizienz_delta:         me.effizienz_delta,
            aktuell_touren_pro_std:  me.aktuell_touren_pro_std,
            vorher_touren_pro_std:   me.vorher_touren_pro_std,
            team_avg_delta:          json.team_avg_delta ?? 0,
            rank_delta:              me.rank_delta,
            ampel:                   me.ampel,
            alert_rueckfall:         me.alert_rueckfall,
            gesamt:                  json.gesamt ?? 0,
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
      <div className="rounded-lg bg-gray-900 border border-gray-700/40 p-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-gray-500" />
        <span className="text-xs text-gray-500">Wochenend-Effizienz offline nicht verfügbar</span>
      </div>
    );
  }

  const c = coaching(data.effizienz_delta);
  const maxBar = Math.max(data.aktuell_touren_pro_std, data.vorher_touren_pro_std, 0.1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white">Mein Wochenend-Trend</span>
        </div>
        {data.alert_rueckfall && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Rückfall
          </div>
        )}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className={`text-4xl font-mono font-bold ${data.effizienz_delta > 0 ? 'text-purple-400' : data.effizienz_delta < 0 ? 'text-red-400' : 'text-gray-300'}`}>
          {data.effizienz_delta > 0 ? '+' : ''}{data.effizienz_delta.toFixed(2)}
        </span>
        <div className="pb-1 space-y-0.5">
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <DeltaIcon d={data.effizienz_delta} />
            T/Std · Rang #{data.rang}/{data.gesamt}
          </div>
          <div className="text-[10px] text-gray-500">
            Team-Trend {data.team_avg_delta > 0 ? '+' : ''}{data.team_avg_delta.toFixed(2)} T/Std
          </div>
        </div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Aktuell (30 Tage)</span>
            <span className="font-mono text-purple-400">{data.aktuell_touren_pro_std.toFixed(2)} T/h</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-purple-400 rounded" style={{ width: `${(data.aktuell_touren_pro_std / maxBar) * 100}%` }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Vormonat</span>
            <span className="font-mono text-gray-400">{data.vorher_touren_pro_std.toFixed(2)} T/h</span>
          </div>
          <div className="h-1.5 bg-gray-700 rounded overflow-hidden">
            <div className="h-full bg-gray-500 rounded" style={{ width: `${(data.vorher_touren_pro_std / maxBar) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] leading-relaxed ${c.color}`}>{c.text}</p>
    </div>
  );
}
