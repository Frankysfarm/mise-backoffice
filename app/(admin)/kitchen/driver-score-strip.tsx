'use client';

/**
 * KitchenDriverScoreStrip — Phase 357
 *
 * Zeigt dem Küchen-Team einen kompakten Überblick der Top-3 Fahrer-Dispatch-Scores.
 * Hilft der Küche, Timing an verfügbare Fahrer anzupassen.
 * Pollt alle 5 Minuten.
 */

import { useEffect, useState, useCallback } from 'react';
import { Star, TrendingDown, AlertCircle } from 'lucide-react';

interface DriverScore {
  name: string;
  vehicle: 'bike' | 'car';
  score: number;
}

function gradeColor(score: number): string {
  if (score >= 85) return 'text-matcha-700 bg-matcha-100';
  if (score >= 70) return 'text-amber-700 bg-amber-100';
  return 'text-red-700 bg-red-100';
}

function gradeLabel(score: number): string {
  if (score >= 85) return 'Top';
  if (score >= 70) return 'OK';
  return 'Krit.';
}

export function KitchenDriverScoreStrip() {
  const [drivers, setDrivers] = useState<DriverScore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/dispatch/scores', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as DriverScore[];
      if (Array.isArray(json)) setDrivers(json.slice(0, 3));
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
    const t = setInterval(fetchScores, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchScores]);

  if (loading || drivers.length === 0) return null;

  const lowScoreDrivers = drivers.filter((d) => d.score < 70);
  const allGood = lowScoreDrivers.length === 0;

  return (
    <div className={`w-full rounded-xl border px-4 py-3 ${allGood ? 'border-matcha-200 bg-matcha-50' : 'border-amber-200 bg-amber-50'}`}>
      <div className="flex items-center gap-2 mb-2">
        {allGood
          ? <Star className="w-3.5 h-3.5 text-matcha-500" />
          : <TrendingDown className="w-3.5 h-3.5 text-amber-500" />}
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
          Fahrer-Scores
        </span>
        {!allGood && (
          <div className="ml-auto flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            <span className="text-[10px] text-amber-600 font-medium">
              {lowScoreDrivers.length} Fahrer unter 70
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {drivers.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-gray-700 truncate max-w-[80px]">
              {d.name}
            </span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full tabular-nums ${gradeColor(d.score)}`}>
              {d.score} {gradeLabel(d.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default KitchenDriverScoreStrip;
