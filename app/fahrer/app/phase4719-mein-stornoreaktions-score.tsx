'use client';

import { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_reaktions_score: number;
  storno_quote: number;
  reaktionszeit_score: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
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

function coachingTipp(score: number): string {
  if (score >= 80) return 'Sehr gut! Du reagierst schnell und hast wenige Stornierungen — weiter so!';
  if (score >= 60) return 'Gut! Versuche noch schneller auf neue Aufträge zu reagieren und Stornierungen zu vermeiden.';
  return 'Tipp: Nimm Aufträge schneller an und informiere Kunden bei Problemen frühzeitig — das reduziert Stornierungen!';
}

export function FahrerPhase4719MeinStornoreaktionsScore({
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
        const res = await fetch(`/api/delivery/admin/fahrer-storno-reaktions-score-ranking?${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) {
          setData(me);
          setTeamAvg(json.team_avg_score);
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
        <span className="text-xs">Offline – Storno-Reaktions-Score nicht verfügbar</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950 p-3">
        <span className="text-xs text-rose-700 dark:text-rose-300">Storno-Reaktions-Daten nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-28" />;
  }

  const maxVal = teamAvg !== null ? Math.max(data.storno_reaktions_score, teamAvg) * 1.1 : data.storno_reaktions_score * 1.1 || 100;
  const myBarWidth  = Math.min((data.storno_reaktions_score / maxVal) * 100, 100);
  const avgBarWidth = teamAvg !== null ? Math.min((teamAvg / maxVal) * 100, 100) : 50;

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
          Mein Storno-Reaktions-Score
        </span>
        <div className="flex items-center gap-1">
          <DeltaIcon delta={data.rank_delta} />
          <span className={`text-[11px] font-semibold ${rangColor(data.ampel)}`}>Rang #{data.rang}</span>
        </div>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-4xl font-black leading-none text-rose-800 dark:text-rose-300">
          {data.storno_reaktions_score}
        </span>
        <span className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">Punkte (30 Tage)</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {[
          { label: 'Storno-Quote', value: `${data.storno_quote.toFixed(1)}%` },
          { label: 'Reaktions-Score', value: `${data.reaktionszeit_score}` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white dark:bg-rose-900/30 rounded-xl p-1.5 text-center">
            <div className="text-[11px] font-bold text-rose-900 dark:text-rose-200">{kpi.value}</div>
            <div className="text-[9px] text-rose-700 dark:text-rose-400 mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      {teamAvg !== null && (
        <div className="space-y-1">
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Ich</span>
              <span>{data.storno_reaktions_score}</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-rose-500 dark:bg-rose-400" style={{ width: `${myBarWidth}%` }} />
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between text-[9px] text-gray-500">
              <span>Team-Ø</span>
              <span>{teamAvg.toFixed(1)}</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gray-400 dark:bg-gray-500" style={{ width: `${avgBarWidth}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/60 dark:bg-rose-900/30 rounded-xl p-2 text-[10px] text-rose-900 dark:text-rose-200">
        {coachingTipp(data.storno_reaktions_score)}
      </div>
    </div>
  );
}
