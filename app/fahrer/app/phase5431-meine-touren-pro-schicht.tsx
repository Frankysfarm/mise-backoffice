'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5431 — Meine Touren/Schicht (Fahrer)
// Activity indigo-400; touren_pro_schicht 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥8/≥6/<6; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  touren_pro_schicht: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_wenig: boolean;
  gesamt: number;
  ziel: number;
}

const MOCK: MyData = {
  rang: 2,
  touren_pro_schicht: 7.2,
  team_avg: 6.35,
  rank_delta: 0,
  ampel: 'gruen',
  alert_wenig: false,
  gesamt: 4,
  ziel: 6.0,
};

const BORDER: Record<Ampel, string> = {
  gruen: 'border-indigo-500/50',
  gelb:  'border-amber-500/50',
  rot:   'border-red-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(t: number): { text: string; color: string } {
  if (t >= 8) return { text: 'Top-Produktivität! Ausgezeichnete Schicht-Auslastung.', color: 'text-emerald-400' };
  if (t >= 6) return { text: 'Gute Leistung — Zielbereich erreicht!', color: 'text-amber-400' };
  return { text: 'Unter Ziel — mehr Touren je Schicht möglich!', color: 'text-red-400' };
}

export function FahrerPhase5431MeineTourenProSchicht({
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
        `/api/delivery/admin/fahrer-touren-pro-schicht-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            touren_pro_schicht: json.fahrer_single.touren_pro_schicht,
            team_avg: json.team_avg,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_wenig: json.fahrer_single.alert_wenig,
            gesamt: json.gesamt,
            ziel: json.ziel ?? 6.0,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            touren_pro_schicht: me.touren_pro_schicht,
            team_avg: json.team_avg,
            rank_delta: me.rank_delta,
            ampel: me.ampel,
            alert_wenig: me.alert_wenig,
            gesamt: json.gesamt,
            ziel: json.ziel ?? 6.0,
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
      <div className="rounded-xl bg-gray-900 border border-gray-700/50 p-4 flex items-center gap-2 text-sm text-gray-500">
        <WifiOff className="h-4 w-4" />
        Offline — Touren/Schicht nicht verfügbar
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.touren_pro_schicht);
  const maxVal = Math.max(data.touren_pro_schicht, data.team_avg, data.ziel, 0.01);

  return (
    <div className={`rounded-xl bg-gray-900 border-2 ${BORDER[data.ampel]} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Meine Touren/Schicht</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <DeltaIcon d={data.rank_delta} />
          <span>Rang #{data.rang} von {data.gesamt}</span>
        </div>
      </div>

      <div className="text-center py-2">
        <div className="text-4xl font-black text-indigo-400">{data.touren_pro_schicht.toFixed(1)}</div>
        <div className="text-xs text-gray-400 mt-0.5">Ø Touren je Schicht</div>
      </div>

      {data.alert_wenig && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 rounded-lg px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Deutlich unter Team-Ø — Schicht-Auslastung steigern
        </div>
      )}
      <div className={`text-xs ${coachColor} text-center`}>{coachText}</div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Ich</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-indigo-400 transition-all" style={{ width: `${(data.touren_pro_schicht / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-16 text-right">{data.touren_pro_schicht.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Team-Ø</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-500 transition-all" style={{ width: `${(data.team_avg / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-16 text-right">{data.team_avg.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Ziel</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-indigo-900 border border-indigo-500/50 transition-all" style={{ width: `${(data.ziel / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-500 w-16 text-right">{data.ziel.toFixed(1)}</span>
        </div>
      </div>

      <div className="text-[10px] text-gray-600 text-right">30-Min-Update</div>
    </div>
  );
}
