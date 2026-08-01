'use client';

import { useEffect, useRef, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5557 — Meine km pro Tag (Fahrer)
// Gauge blue-400; avg_km_pro_tag 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≥80/≥50/<50 km/Tag; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  avg_km_pro_tag: number;
  team_avg_km_pro_tag: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  avg_km_pro_tag: 74.2,
  team_avg_km_pro_tag: 62.8,
  rank_delta: 1,
  ampel: 'gruen',
  alert_niedrig: false,
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

function coaching(v: number): { text: string; color: string } {
  if (v >= 80) return { text: 'Starke Leistung! Du fährst überdurchschnittlich viele Kilometer pro Tag — hohes Engagement!', color: 'text-green-400' };
  if (v >= 50) return { text: 'Solide Tagesleistung — mehr aktive Stunden können deine km/Tag weiter steigern.', color: 'text-yellow-300' };
  return { text: 'Deine km pro Tag sind niedrig. Mehr Touren pro Schicht helfen dir im Ranking nach oben.', color: 'text-red-400' };
}

export function FahrerPhase5557MeineKmProTag({
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
        `/api/delivery/admin/fahrer-km-pro-tag?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`,
      );
      if (r.ok) {
        const json = await r.json();
        if (json.fahrer && json.fahrer.length > 0) {
          const me = json.fahrer[0] as { rang: number; avg_km_pro_tag: number; rank_delta: number; ampel: Ampel; alert_niedrig: boolean };
          setData({
            rang:               me.rang,
            avg_km_pro_tag:     me.avg_km_pro_tag,
            team_avg_km_pro_tag: json.team_avg_km_pro_tag ?? MOCK.team_avg_km_pro_tag,
            rank_delta:         me.rank_delta ?? 0,
            ampel:              me.ampel,
            alert_niedrig:      me.alert_niedrig,
            gesamt:             json.gesamt ?? MOCK.gesamt,
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
        <span className="text-xs text-gray-500">km pro Tag — offline nicht verfügbar</span>
      </div>
    );
  }

  const maxVal = Math.max(data.avg_km_pro_tag, data.team_avg_km_pro_tag, 0.01);
  const c = coaching(data.avg_km_pro_tag);

  return (
    <div className={`rounded-lg bg-gray-900 border ${BORDER[data.ampel]} p-3 space-y-2`}>
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <Gauge className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-xs font-semibold text-white">Meine km pro Tag</span>
        {data.alert_niedrig && <AlertTriangle className="h-3 w-3 text-red-400 ml-auto" />}
      </div>

      {/* Hauptwert */}
      <div className="flex items-end gap-2">
        <span className="text-4xl font-black text-blue-400">{data.avg_km_pro_tag.toFixed(1)}</span>
        <span className="text-lg text-blue-300 mb-0.5">km/Tag</span>
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
              className="h-2 rounded-full bg-blue-400 transition-all duration-500"
              style={{ width: `${(data.avg_km_pro_tag / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-blue-300 w-14 text-right">{data.avg_km_pro_tag.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-8">Ø</span>
          <div className="flex-1 h-2 rounded-full bg-gray-800">
            <div
              className="h-2 rounded-full bg-gray-500 transition-all duration-500"
              style={{ width: `${(data.team_avg_km_pro_tag / maxVal) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-gray-400 w-14 text-right">{data.team_avg_km_pro_tag.toFixed(1)} km</span>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[10px] ${c.color}`}>{c.text}</p>
    </div>
  );
}
