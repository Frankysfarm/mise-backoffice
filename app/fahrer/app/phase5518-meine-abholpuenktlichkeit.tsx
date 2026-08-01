'use client';

import { useEffect, useRef, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5518 — Meine Abholpünktlichkeit (Fahrer)
// Timer violet-400; avg_minuten 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤3/≤5/>5 min; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_minuten: number;
  team_avg_minuten: number;
  rank_delta: number;
  ampel: Ampel;
  alert_langsam: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_minuten: 3.8,
  team_avg_minuten: 4.7,
  rank_delta: 1,
  ampel: 'gruen',
  alert_langsam: false,
  gesamt: 4,
};

const BORDER: Record<Ampel, string> = {
  rot:   'border-red-500/50',
  gelb:  'border-yellow-500/50',
  gruen: 'border-violet-500/50',
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-gray-500" />;
}

function coaching(min: number): { text: string; color: string } {
  if (min <= 3) return { text: 'Spitzentempo! Du holst Bestellungen blitzschnell ab — Kunden und Küche danken es dir!', color: 'text-violet-400' };
  if (min <= 5) return { text: 'Gut — versuche noch früher am Restaurant zu sein, um unter 4 Minuten zu kommen!', color: 'text-yellow-400' };
  return { text: 'Tipp: Checke deine Route zur Abholung — kürzere Wartezeiten verbessern deine Lieferzeit und Bewertung!', color: 'text-red-400' };
}

export function FahrerPhase5518MeineAbholpuenktlichkeit({
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
        `/api/delivery/admin/fahrer-abholpuenktlichkeit-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer_single) {
          setData({
            rang:             json.fahrer_single.rang,
            avg_minuten:      json.fahrer_single.avg_minuten,
            team_avg_minuten: json.fahrer_single.team_avg_minuten,
            rank_delta:       json.fahrer_single.rank_delta ?? 0,
            ampel:            json.fahrer_single.ampel,
            alert_langsam:    json.fahrer_single.alert_langsam,
            gesamt:           json.fahrer_single.gesamt,
          });
        } else if (json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
          if (me) setData({
            rang:             me.rang,
            avg_minuten:      me.avg_minuten,
            team_avg_minuten: json.team_avg_minuten,
            rank_delta:       me.rank_delta,
            ampel:            me.ampel,
            alert_langsam:    me.alert_langsam,
            gesamt:           json.gesamt,
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
        <span className="text-xs text-gray-500">Abholpünktlichkeit — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_minuten, data.team_avg_minuten, 1);
  const c = coaching(data.avg_minuten);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Timer className="h-3.5 w-3.5 text-violet-400" />
        <span className="text-xs font-semibold text-white">Meine Abholpünktlichkeit</span>
        {data.alert_langsam && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-violet-400">{data.avg_minuten}</span>
        <span className="text-sm text-violet-300 mb-1">min Ø</span>
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
              className="h-2 rounded-full bg-violet-400 transition-all duration-500"
              style={{ width: `${(data.avg_minuten / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-violet-300 w-10 text-right">{data.avg_minuten} m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_minuten / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{data.team_avg_minuten} m</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
