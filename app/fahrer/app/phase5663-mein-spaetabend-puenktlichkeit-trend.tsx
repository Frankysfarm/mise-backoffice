'use client';

import { useEffect, useRef, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5663 — Mein Spätabend-Pünktlichkeits-Trend (Fahrer) — Batch 110
// Moon violet-400; puenktlichkeit_delta ABSTEIGEND Rang 1=größte Verbesserung=bester;
// isOnline-Guard+WifiOff-Fallback; Coaching >0/=0/<0; Dual-Balken Aktuell+Vormonat; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    puenktlichkeit_delta: number;
    aktuell_pct: number;
    vorher_pct: number;
    rank_delta: number;
    ampel: Ampel;
    alert_rueckfall: boolean;
  }>;
  team_avg_delta: number;
  gesamt: number;
}

interface MyData {
  rang: number;
  puenktlichkeit_delta: number;
  aktuell_pct: number;
  vorher_pct: number;
  team_avg_delta: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  puenktlichkeit_delta: 4.2,
  aktuell_pct: 88.0,
  vorher_pct: 83.8,
  team_avg_delta: 0.83,
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
  if (d > 0) return <TrendingUp   className="h-3.5 w-3.5 text-violet-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400"   />;
  return        <Minus        className="h-3.5 w-3.5 text-gray-500"   />;
}

function coaching(delta: number): { text: string; color: string } {
  if (delta > 0) return {
    text: `Deine Spätabend-Pünktlichkeit ist um ${delta.toFixed(1)} Prozentpunkte gestiegen — stark! Ruhige Straßen nach 20 Uhr helfen dir, Versprechen einzuhalten.`,
    color: 'text-violet-400',
  };
  if (delta === 0) return {
    text: 'Deine Spätabend-Pünktlichkeit ist stabil. Die späten Stunden sind ideal — weniger Verkehr, mehr Zuverlässigkeit.',
    color: 'text-yellow-300',
  };
  return {
    text: `Pünktlichkeit um ${Math.abs(delta).toFixed(1)} pp gesunken — prüfe deine Routenplanung für Spätabend-Lieferungen (20–24h) und plane Wartezeiten beim Restaurant großzügiger ein.`,
    color: 'text-red-400',
  };
}

export function FahrerPhase5663MeinSpaetabendPuenktlichkeitsTrend({
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
      const r = await fetch(`/api/delivery/admin/fahrer-spaetabend-puenktlichkeit-trend-ranking?location_id=${locationId}`);
      if (r.ok) {
        const json: ApiResponse = await r.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (me) {
          setData({
            rang:                  me.rang,
            puenktlichkeit_delta:  me.puenktlichkeit_delta,
            aktuell_pct:           me.aktuell_pct,
            vorher_pct:            me.vorher_pct,
            team_avg_delta:        json.team_avg_delta,
            rank_delta:            me.rank_delta,
            ampel:                 me.ampel,
            alert_rueckfall:       me.alert_rueckfall,
            gesamt:                json.gesamt,
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
        <span className="text-xs text-gray-500">Kein Netz — Spätabend-Pünktlichkeit offline</span>
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.puenktlichkeit_delta);
  const sign   = data.puenktlichkeit_delta > 0 ? '+' : '';
  const maxBar = Math.max(data.aktuell_pct, data.vorher_pct, 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Moon className="h-3.5 w-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-white">Mein Spätabend-Pünktlichkeits-Trend</span>
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
          <div className={`text-3xl font-bold font-mono ${data.puenktlichkeit_delta > 0 ? 'text-violet-400' : data.puenktlichkeit_delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
            {sign}{data.puenktlichkeit_delta.toFixed(1)}
          </div>
          <div className="text-[10px] text-gray-500">Δ Prozentpunkte</div>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[10px] text-gray-500">Rang</span>
            <span className="text-lg font-bold text-white">#{data.rang}</span>
            <span className="text-[10px] text-gray-500">/ {data.gesamt}</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <DeltaIcon d={data.puenktlichkeit_delta} />
            <span className="text-[10px] text-gray-400">
              Team Ø {data.team_avg_delta > 0 ? '+' : ''}{data.team_avg_delta.toFixed(1)} pp
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
              className="h-full rounded bg-violet-400"
              style={{ width: `${Math.min(100, (data.aktuell_pct / maxBar) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-violet-400 w-12 text-right">{data.aktuell_pct.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 w-16 shrink-0">Vormonat</span>
          <div className="flex-1 h-2 bg-gray-700 rounded overflow-hidden">
            <div
              className="h-full rounded bg-gray-500"
              style={{ width: `${Math.min(100, (data.vorher_pct / maxBar) * 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{data.vorher_pct.toFixed(1)}%</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] leading-relaxed ${coachColor}`}>{coachText}</p>

      <div className="text-[9px] text-gray-600 text-right">20–24h · 30-Tage-Trend · Pünktlichkeitsquote</div>
    </div>
  );
}
