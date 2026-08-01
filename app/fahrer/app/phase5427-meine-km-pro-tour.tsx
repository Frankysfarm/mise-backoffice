'use client';

import { useEffect, useRef, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, WifiOff, AlertTriangle } from 'lucide-react';

// Phase 5427 — Meine km/Tour (Fahrer)
// Route green-400; km_avg 4xl+Rang; isOnline-Guard+WifiOff-Fallback;
// Coaching ≤5/≤7/>7 km; Dual-Balken Ich+Team-Ø; Ampel-Border; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface MyData {
  rang: number;
  km_avg: number;
  team_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_top: boolean;
  gesamt: number;
}

const MOCK: MyData = {
  rang: 2,
  km_avg: 5.1,
  team_avg: 6.35,
  rank_delta: 1,
  ampel: 'gelb',
  alert_top: false,
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

function coaching(km: number): { text: string; color: string } {
  if (km <= 5) return { text: 'Top-Routeneffizienz! Sehr kurze Wege.', color: 'text-emerald-400' };
  if (km <= 7) return { text: 'Gute Route — noch Optimierungspotenzial!', color: 'text-amber-400' };
  return { text: 'Lange Routen — Stoppplanung optimieren!', color: 'text-red-400' };
}

export function FahrerPhase5427MeineKmProTour({
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
      const r = await fetch(`/api/delivery/admin/fahrer-km-pro-tour-ranking?driver_id=${driverId}${locationId ? `&location_id=${locationId}` : ''}`);
      if (r.ok) {
        const json = await r.json();
        const me = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        if (me) setData({
          rang: me.rang,
          km_avg: me.km_avg,
          team_avg: json.team_avg,
          rank_delta: me.rank_delta,
          ampel: me.ampel,
          alert_top: me.alert_top,
          gesamt: json.gesamt,
        });
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
        Offline — km/Tour nicht verfügbar
      </div>
    );
  }

  const { text: coachText, color: coachColor } = coaching(data.km_avg);
  const maxVal = Math.max(data.km_avg, data.team_avg, 0.01);

  return (
    <div className={`rounded-xl bg-gray-900 border-2 ${BORDER[data.ampel]} p-4 space-y-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-green-400" />
          <span className="text-sm font-semibold text-white">Meine km/Tour</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <DeltaIcon d={data.rank_delta} />
          <span>Rang #{data.rang} von {data.gesamt}</span>
        </div>
      </div>

      <div className="text-center py-2">
        <div className="text-4xl font-black text-green-400">{data.km_avg.toFixed(1)}</div>
        <div className="text-xs text-gray-400 mt-0.5">Ø km je Tour</div>
      </div>

      {data.alert_top && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/30 rounded-lg px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Routen deutlich länger als Team-Ø
        </div>
      )}
      <div className={`text-xs ${coachColor} text-center`}>{coachText}</div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Ich</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-green-400 transition-all" style={{ width: `${(data.km_avg / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-16 text-right">{data.km_avg.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 w-10">Team-Ø</span>
          <div className="flex-1 bg-gray-800 rounded-full h-2">
            <div className="h-2 rounded-full bg-gray-500 transition-all" style={{ width: `${(data.team_avg / maxVal) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-300 w-16 text-right">{data.team_avg.toFixed(1)} km</span>
        </div>
      </div>

      <div className="text-[10px] text-gray-600 text-right">30-Min-Update</div>
    </div>
  );
}
