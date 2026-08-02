'use client';

import { useEffect, useRef, useState } from 'react';
import { Sunset, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5651 — Mein Feierabend-Effizienz-Trend (Fahrer) — Batch 107
// Sunset orange-500; effizienz_delta ABSTEIGEND Rang 1=größte Verbesserung=bester;
// isOnline-Guard+WifiOff-Fallback; Coaching >0/=0/<0; Dual-Balken Aktuell+Vormonat; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    effizienz_delta: number;
    aktuell_touren_pro_std: number;
    vorher_touren_pro_std: number;
    rank_delta: number;
    ampel: Ampel;
    alert_rueckfall: boolean;
  }>;
  team_avg_delta: number;
  gesamt: number;
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
  effizienz_delta: 0.3,
  aktuell_touren_pro_std: 3.1,
  vorher_touren_pro_std: 2.8,
  team_avg_delta: 0.075,
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
  if (d > 0) return <TrendingUp   className="h-3.5 w-3.5 text-orange-500" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400"   />;
  return        <Minus        className="h-3.5 w-3.5 text-gray-500"   />;
}

function coaching(delta: number): { text: string; color: string } {
  if (delta > 0) return {
    text: `Deine Feierabend-Effizienz ist um ${delta.toFixed(2)} Touren/Std gestiegen — stark! Smarte Routenwahl in der Stoßzeit zahlt sich aus.`,
    color: 'text-orange-500',
  };
  if (delta === 0) return {
    text: 'Deine Feierabend-Effizienz ist stabil. Nutze ruhigere Parallelrouten zwischen 16–20h für mehr Touren pro Stunde.',
    color: 'text-yellow-300',
  };
  return {
    text: `Effizienz um ${Math.abs(delta).toFixed(2)} T/Std gesunken — prüfe deine Feierabendrouten und reduziere Wartezeiten beim Restaurant im Abendpeak.`,
    color: 'text-red-400',
  };
}

export function FahrerPhase5651MeinFeierabendEffizienzTrend({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData]       = useState<MyData>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId || !driverId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-feierabend-effizienz-trend-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json: ApiResponse = await r.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setData({
            rang:                   me.rang,
            effizienz_delta:        me.effizienz_delta,
            aktuell_touren_pro_std: me.aktuell_touren_pro_std,
            vorher_touren_pro_std:  me.vorher_touren_pro_std,
            team_avg_delta:         json.team_avg_delta,
            rank_delta:             me.rank_delta,
            ampel:                  me.ampel,
            alert_rueckfall:        me.alert_rueckfall,
            gesamt:                 json.gesamt,
          });
        }
      }
    } catch { /* use mock */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-lg bg-gray-900 border border-gray-700 p-3 flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Kein Netz — Feierabend-Trend offline</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.effizienz_delta);
  const sign = data.effizienz_delta > 0 ? '+' : '';
  const maxBar = Math.max(data.aktuell_touren_pro_std, data.vorher_touren_pro_std, 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sunset className="h-3.5 w-3.5 text-orange-500" />
          <span className="text-xs font-semibold text-white">Mein Feierabend-Trend</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_rueckfall && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Rückfall
          </div>
        )}
      </div>

      {/* Delta + Rang */}
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className={`text-3xl font-bold font-mono ${data.effizienz_delta > 0 ? 'text-orange-500' : data.effizienz_delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {sign}{data.effizienz_delta.toFixed(2)}
          </div>
          <div className="text-[10px] text-gray-500">Δ Touren/Std</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[10px] text-gray-500">Rang</span>
            <span className="text-lg font-bold text-white">#{data.rang}</span>
            <span className="text-[10px] text-gray-500">/ {data.gesamt}</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <DeltaIcon d={data.effizienz_delta} />
            <span className="text-[10px] text-gray-400">
              Team Ø {data.team_avg_delta > 0 ? '+' : ''}{data.team_avg_delta.toFixed(2)} T/h
            </span>
          </div>
        </div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-16 shrink-0">Aktuell</span>
          <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full rounded bg-orange-500"
              style={{ width: `${Math.min(100, (data.aktuell_touren_pro_std / maxBar) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-orange-500 w-12 text-right">{data.aktuell_touren_pro_std.toFixed(2)} T/h</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-16 shrink-0">Vormonat</span>
          <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full rounded bg-gray-500"
              style={{ width: `${Math.min(100, (data.vorher_touren_pro_std / maxBar) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{data.vorher_touren_pro_std.toFixed(2)} T/h</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] leading-relaxed ${coachColor}`}>{coachText}</p>

      <div className="text-[9px] text-gray-600 text-right">16–20h · 30-Tage-Trend · Touren/Std</div>
    </div>
  );
}
