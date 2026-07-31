'use client';

import { useEffect, useState } from 'react';
import { WifiOff, TrendingUp, TrendingDown } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  trend_pct: number;
  aktuell_pct: number;
  vorher_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_negativ: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_trend_pct: number;
  gesamt: number;
}

function coachingTipp(trend: number): { text: string; color: string } {
  if (trend >= 10) return {
    text: 'Starke Verbesserung! Deine Schicht-Pünktlichkeit hat sich deutlich verbessert — weiter so!',
    color: 'text-green-300',
  };
  if (trend >= 0) return {
    text: 'Stabiler Trend. Deine Pünktlichkeit hält sich konstant — kleine Verbesserungen zahlen sich langfristig aus.',
    color: 'text-yellow-400',
  };
  if (trend >= -10) return {
    text: 'Leichte Verschlechterung erkannt. Achte darauf, Schichten pünktlicher zu starten um deinen Rang zu halten.',
    color: 'text-orange-400',
  };
  return {
    text: 'Deine Pünktlichkeit verschlechtert sich spürbar. Pünktlichkeit ist entscheidend für deinen Score und Boni.',
    color: 'text-red-400',
  };
}

export function FahrerPhase5307MeinSchichtPuenktlichkeitTrend({
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
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    const res = await fetch(`/api/delivery/admin/fahrer-schicht-puenktlichkeit-trend-ranking?${params}`);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/40 px-4 py-3 flex items-center gap-2 mb-3">
        <WifiOff className="w-4 h-4 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Mein Pünktlichkeits-Trend — offline</span>
      </div>
    );
  }

  if (!data) return null;

  const mein = data.fahrer.find((f: FahrerRow) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const tipp = coachingTipp(mein.trend_pct);
  const isPositive = mein.trend_pct >= 0;

  const borderColor =
    mein.ampel === 'gruen' ? 'border-green-700 bg-green-950/40' :
    mein.ampel === 'gelb'  ? 'border-yellow-700 bg-yellow-950/30' :
                             'border-red-700 bg-red-950/40';
  const headerBg =
    mein.ampel === 'gruen' ? 'border-green-800/40 bg-green-900/20' :
    mein.ampel === 'gelb'  ? 'border-yellow-800/40 bg-yellow-900/20' :
                             'border-red-800/40 bg-red-900/20';
  const valColor = isPositive ? 'text-emerald-300' : 'text-red-400';
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <div className={`rounded-2xl border mb-3 overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 flex items-center gap-2 border-b ${headerBg}`}>
        <TrendIcon className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Mein Pünktlichkeits-Trend</span>
      </div>

      <div className="px-4 py-4 text-center">
        <div className={`text-4xl font-black tabular-nums ${valColor}`}>
          {isPositive ? '+' : ''}{mein.trend_pct}
          <span className="text-xl font-semibold text-gray-400">%</span>
        </div>
        <div className={`text-2xl font-bold mt-1 ${valColor}`}>
          Rang #{mein.rang} <span className="text-sm text-gray-500">von {data.gesamt}</span>
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          Aktuell {mein.aktuell_pct}% · Vorperiode {mein.vorher_pct}%
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Mein Trend</span>
          <span className="text-gray-500">Team-Trend</span>
        </div>
        <div className="relative h-2 rounded-full bg-gray-800 overflow-hidden">
          {isPositive ? (
            <div
              className="absolute left-1/2 top-0 h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min((mein.trend_pct / Math.max(Math.abs(mein.trend_pct), Math.abs(data.team_trend_pct), 1)) * 50, 50)}%` }}
            />
          ) : (
            <div
              className="absolute top-0 h-full rounded-full bg-red-500"
              style={{
                width: `${Math.min((Math.abs(mein.trend_pct) / Math.max(Math.abs(mein.trend_pct), Math.abs(data.team_trend_pct), 1)) * 50, 50)}%`,
                right: '50%',
              }}
            />
          )}
          <div className="absolute left-1/2 top-0 h-full w-px bg-gray-600" />
        </div>
        <div className="flex items-center justify-between text-[10px] mt-0.5 text-gray-500">
          <span className={valColor}>{isPositive ? '+' : ''}{mein.trend_pct}%</span>
          <span className={data.team_trend_pct >= 0 ? 'text-emerald-400' : 'text-red-400'}>
            {data.team_trend_pct >= 0 ? '+' : ''}{data.team_trend_pct}%
          </span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <p className={`text-xs leading-snug ${tipp.color}`}>{tipp.text}</p>
      </div>
    </div>
  );
}
