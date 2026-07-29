'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  akzeptanz_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_akzeptanz: number;
  gesamt: number;
}

function rangColor(ampel: 'gruen' | 'gelb' | 'rot') {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb') return 'text-yellow-500 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-600 dark:text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-500 dark:text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function coachingTipp(rate: number): string {
  if (rate >= 90) return 'Sehr gut! Deine hohe Akzeptanz-Rate zeigt Verlässlichkeit — weiter so!';
  if (rate >= 75) return 'Gut! Versuche, mehr Aufträge anzunehmen — das stärkt deine Bewertung.';
  return 'Tipp: Eine höhere Annahmequote verbessert deinen Score und dein Einkommen deutlich.';
}

export function FahrerPhase4729MeineAkzeptanzRate({
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
        const res = await fetch(`/api/delivery/admin/fahrer-akzeptanz-rate-ranking?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) {
          setData(me);
          setTeamAvg(json.team_avg_akzeptanz);
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
        <span className="text-xs">Offline – Akzeptanz-Rate nicht verfügbar</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 p-3">
        <span className="text-xs text-teal-700 dark:text-teal-300">Akzeptanz-Rate nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-28" />;
  }

  const maxVal = teamAvg !== null ? Math.max(data.akzeptanz_rate, teamAvg) * 1.05 : data.akzeptanz_rate * 1.05 || 1;
  const myBarWidth  = Math.min((data.akzeptanz_rate / maxVal) * 100, 100);
  const avgBarWidth = teamAvg !== null ? Math.min((teamAvg / maxVal) * 100, 100) : 50;

  return (
    <div className="rounded-2xl border border-teal-200 dark:border-teal-900 bg-teal-50 dark:bg-teal-950 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-teal-900 dark:text-teal-200 uppercase tracking-wide">
          Meine Akzeptanz-Rate
        </span>
        <div className="flex items-center gap-1">
          <DeltaIcon delta={data.rank_delta} />
          <span className={`text-[11px] font-semibold ${rangColor(data.ampel)}`}>Rang #{data.rang}</span>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-4xl font-black leading-none text-teal-800 dark:text-teal-300">
          {data.akzeptanz_rate.toFixed(1)} %
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Annahmequote (30 Tage)</span>
      </div>

      {teamAvg !== null && (
        <div className="space-y-1">
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Ich</span>
              <span>{data.akzeptanz_rate.toFixed(1)} %</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-teal-500 dark:bg-teal-400" style={{ width: `${myBarWidth}%` }} />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Team-Ø</span>
              <span>{teamAvg.toFixed(1)} %</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${avgBarWidth}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/60 dark:bg-teal-900/30 rounded-xl p-2 text-[10px] text-teal-900 dark:text-teal-200">
        {coachingTipp(data.akzeptanz_rate)}
      </div>
    </div>
  );
}
