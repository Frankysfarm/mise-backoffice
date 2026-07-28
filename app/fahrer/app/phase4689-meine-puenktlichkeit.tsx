'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  gesamt: number;
}

function rangColor(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb') return 'text-yellow-500 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function pctColor(pct: number) {
  if (pct >= 90) return 'text-green-600 dark:text-green-400';
  if (pct >= 80) return 'text-yellow-500 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function coachingTipp(pct: number): string {
  if (pct >= 90) return 'Ausgezeichnet! Du lieferst fast immer pünktlich.';
  if (pct >= 80) return 'Solide – versuche, Abholzeiten noch genauer einzuhalten.';
  return 'Achte auf pünktliche Abholung in der Küche und spare Fahrzeit.';
}

export function FahrerPhase4689MeinePuenktlichkeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<FahrerRow | null>(null);
  const [teamAvg, setTeamAvg] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        params.set('driver_id', driverId);
        const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-ranking?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) {
          setData(me);
          setTeamAvg(json.team_avg_pct);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId]);

  if (!isOnline) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Offline – Pünktlichkeit nicht verfügbar</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 p-3">
        <span className="text-xs text-teal-700 dark:text-teal-300">Pünktlichkeits-Daten nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-28" />;
  }

  const maxScale = teamAvg !== null ? Math.max(teamAvg * 1.1, 100) : 100;
  const myBarWidth = Math.min((data.puenktlichkeit_pct / maxScale) * 100, 100);
  const teamBarWidth = teamAvg !== null ? Math.min((teamAvg / maxScale) * 100, 100) : 80;

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
          Meine Pünktlichkeit
        </span>
        <div className="flex items-center gap-1">
          <DeltaIcon delta={data.rank_delta} />
          <span className={`text-[11px] font-semibold ${rangColor(data.ampel)}`}>Rang #{data.rang}</span>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-4xl font-black leading-none ${pctColor(data.puenktlichkeit_pct)}`}>
          {data.puenktlichkeit_pct}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">% pünktliche Lieferungen (30 Tage)</span>
      </div>

      {teamAvg !== null && (
        <div className="space-y-1">
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Ich</span>
              <span>{data.puenktlichkeit_pct} %</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${pctColor(data.puenktlichkeit_pct).replace('text-', 'bg-').replace('dark:text-', 'dark:bg-')}`}
                style={{ width: `${myBarWidth}%` }}
              />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Team-Ø</span>
              <span>{teamAvg} %</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${teamBarWidth}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/60 dark:bg-teal-900/30 rounded-xl p-2 text-[10px] text-teal-900 dark:text-teal-200">
        {coachingTipp(data.puenktlichkeit_pct)}
      </div>
    </div>
  );
}
