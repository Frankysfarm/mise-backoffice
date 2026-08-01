'use client';

import { useEffect, useRef, useState } from 'react';
import { Package2, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5481 — Meine Gesamtlieferungen (Fahrer)
// Package2 green-400; gesamt_lieferungen 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥280/≥180/<180; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  gesamt_lieferungen: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  gesamt_lieferungen: 287,
  team_avg: 228,
  rank_delta: 0,
  ampel: 'gruen',
  alert_niedrig: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-green-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(n: number): { text: string; color: string } {
  if (n >= 280) return { text: 'Stark! Du gehörst zu den aktivsten Fahrern im Team — weiter so!', color: 'text-green-400' };
  if (n >= 180) return { text: 'Gute Leistung — ein paar mehr Schichten steigern deinen Rang spürbar!', color: 'text-yellow-400' };
  return { text: 'Tipp: Nimm mehr Schichten an, um deine Gesamtlieferungen und deinen Rang zu verbessern!', color: 'text-red-400' };
}

export function FahrerPhase5481MeineGesamtlieferungen({
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
        `/api/delivery/admin/fahrer-gesamtlieferungen-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang: json.fahrer_single.rang,
            gesamt_lieferungen: json.fahrer_single.gesamt_lieferungen,
            team_avg: json.team_avg,
            rank_delta: json.fahrer_single.rank_delta ?? 0,
            ampel: json.fahrer_single.ampel,
            alert_niedrig: json.fahrer_single.alert_niedrig,
            gesamt: json.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang: me.rang,
            gesamt_lieferungen: me.gesamt_lieferungen,
            team_avg: json.team_avg,
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
        <span className="text-xs text-gray-500">Gesamtlieferungen — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.gesamt_lieferungen, data.team_avg, 1);
  const c = coaching(data.gesamt_lieferungen);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Package2 className="h-3.5 w-3.5 text-green-400" />
        <span className="text-xs font-semibold text-white">Meine Gesamtlieferungen</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-green-400">{data.gesamt_lieferungen}</span>
        <span className="text-lg text-green-300 mb-0.5">L</span>
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
              className="h-2 rounded-full bg-green-400 transition-all duration-500"
              style={{ width: `${(data.gesamt_lieferungen / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-green-300 w-12 text-right">{data.gesamt_lieferungen}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{data.team_avg}</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
