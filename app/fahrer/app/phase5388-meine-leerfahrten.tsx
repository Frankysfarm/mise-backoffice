'use client';

import { useEffect, useState } from 'react';
import { Navigation, WifiOff } from 'lucide-react';

// Phase 5388 — Meine Leerfahrten
// Navigation orange-400; leerfahrten_pct 4xl+Rang; Dual-Balken Ich+Team-Ø;
// Coaching ≤10/≤20/>30%; Ampel-Border; isOnline-Guard; WifiOff-Fallback;
// 30-Min-Poll; Mock-Fallback

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerfahrten_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_leerfahrten_pct: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [{ fahrer_id: 'me', fahrer_name: 'Ich', rang: 2, leerfahrten_pct: 12, rank_delta: 1, ampel: 'gruen', alert_bottom: false }],
  team_avg_leerfahrten_pct: 19.3,
  gesamt: 4,
};

function borderClass(ampel: string) {
  if (ampel === 'gruen') return 'border-green-500';
  if (ampel === 'gelb')  return 'border-yellow-400';
  return 'border-red-500';
}

function barColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

function coaching(pct: number) {
  if (pct <= 10) return { text: 'Super effizient! Fast keine Leerfahrten — weiter so!', color: 'text-green-400' };
  if (pct <= 20) return { text: 'Gut. Optimiere Rückwege um noch effizienter zu werden.', color: 'text-yellow-400' };
  return { text: 'Leerfahrten-Quote zu hoch — Touren besser bündeln hilft.', color: 'text-red-400' };
}

export function FahrerPhase5388MeineLeerfahrten({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-leerfahrten-ranking?location_id=${locationId}&driver_id=${driverId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 flex items-center gap-2 text-gray-500">
        <WifiOff className="w-4 h-4" />
        <span className="text-sm">Leerfahrten nicht verfügbar (offline)</span>
      </div>
    );
  }

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Leerfahrten…</div>;

  const me = data.fahrer[0];
  if (!me) return null;

  const maxPct = 50;
  const { text: coachText, color: coachColor } = coaching(me.leerfahrten_pct);

  return (
    <div className={`bg-gray-900 rounded-xl p-4 border-2 space-y-3 ${borderClass(me.ampel)}`}>
      <div className="flex items-center gap-2">
        <Navigation className="w-4 h-4 text-orange-400" />
        <span className="text-white font-semibold text-sm">Meine Leerfahrten</span>
      </div>

      {/* Hauptwert */}
      <div className="text-center">
        <div className="text-4xl font-bold text-orange-400">{me.leerfahrten_pct.toFixed(1)}<span className="text-base ml-1">%</span></div>
        <div className="text-[11px] text-gray-400 mt-0.5">Rang {me.rang} von {data.gesamt}</div>
      </div>

      {/* Dual-Balken */}
      <div className="space-y-1.5">
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Ich</span>
            <span>{me.leerfahrten_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${barColor(me.ampel)}`}
              style={{ width: `${Math.min((me.leerfahrten_pct / maxPct) * 100, 100)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
            <span>Team-Ø</span>
            <span>{data.team_avg_leerfahrten_pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gray-500"
              style={{ width: `${Math.min((data.team_avg_leerfahrten_pct / maxPct) * 100, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Coaching */}
      <p className={`text-[11px] ${coachColor}`}>{coachText}</p>
    </div>
  );
}
