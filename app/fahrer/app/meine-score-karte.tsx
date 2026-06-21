'use client';

/**
 * FahrerMeineScoreKarte — Phase 357
 *
 * Zeigt dem Fahrer seinen eigenen wöchentlichen Composite-Score,
 * Rang im Team und Grade (A+/A/B/C/D). Pollt alle 10 Minuten.
 */

import { useEffect, useState, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface PerformanceData {
  rank: number;
  total_drivers: number;
  composite_score: number;
  grade: string;
  trend?: number;
}

function gradeStyle(grade: string): { bg: string; text: string; border: string } {
  switch (grade) {
    case 'A+': return { bg: 'bg-matcha-100', text: 'text-matcha-700', border: 'border-matcha-300' };
    case 'A':  return { bg: 'bg-matcha-50',  text: 'text-matcha-600', border: 'border-matcha-200' };
    case 'B':  return { bg: 'bg-blue-50',    text: 'text-blue-600',   border: 'border-blue-200' };
    case 'C':  return { bg: 'bg-amber-50',   text: 'text-amber-600',  border: 'border-amber-200' };
    default:   return { bg: 'bg-red-50',     text: 'text-red-600',    border: 'border-red-200' };
  }
}

export function FahrerMeineScoreKarte() {
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/driver/my-performance?period=week', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as Record<string, unknown>;
      const score = typeof json.composite_score === 'number' ? json.composite_score : 0;
      const grade = typeof json.grade === 'string' ? json.grade : 'B';
      const rank  = typeof json.rank === 'number' ? json.rank : 0;
      const total = typeof json.total_drivers === 'number' ? json.total_drivers : 0;
      if (score > 0) {
        setData({ rank, total_drivers: total, composite_score: score, grade });
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading || !data) return null;

  const style = gradeStyle(data.grade);
  const scoreBar = Math.min(100, data.composite_score);

  return (
    <div className={`mx-4 rounded-xl border p-3 ${style.bg} ${style.border}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Star className={`w-3.5 h-3.5 ${style.text}`} />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Mein Wochen-Score
          </span>
        </div>
        {data.rank > 0 && data.total_drivers > 0 && (
          <span className="text-[10px] text-gray-500 font-medium">
            #{data.rank} von {data.total_drivers}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className={`text-3xl font-black tabular-nums ${style.text}`}>
          {Math.round(data.composite_score)}
        </div>
        <div className="flex-1">
          <div className="h-2 w-full bg-white/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                data.composite_score >= 85 ? 'bg-matcha-500' :
                data.composite_score >= 70 ? 'bg-amber-500' : 'bg-red-500'
              }`}
              style={{ width: `${scoreBar}%` }}
            />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-gray-400">0</span>
            <span className={`text-[10px] font-black ${style.text}`}>{data.grade}</span>
            <span className="text-[9px] text-gray-400">100</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FahrerMeineScoreKarte;
