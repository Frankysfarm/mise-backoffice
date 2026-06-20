'use client';

import React, { useEffect, useState } from 'react';
import { TrendingDown, TrendingUp, Minus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RankData {
  rank: number;
  total: number;
  score: number;
}

interface PerfData {
  rankData: RankData | null;
}

// Zeigt dem Fahrer seinen aktuellen Live-Score und Rang in der Schicht.
export function EchtzeitLeistungsAnzeige() {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch('/api/delivery/driver/my-performance?period=week')
        .then((r) => r.json())
        .then((d) => {
          if (!cancelled) {
            setData({
              rankData: d.rankData ?? null,
            });
          }
        })
        .catch(() => {
          if (!cancelled) setData(null);
        })
        .finally(() => { if (!cancelled) setLoading(false); });
    };
    load();
    const id = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  if (loading) return null;
  if (!data?.rankData) return null;

  const { rank, total, score } = data.rankData;
  const pct = total > 0 ? Math.round((1 - (rank - 1) / total) * 100) : 0;
  const isTop = rank <= Math.ceil(total * 0.25);

  const label =
    score >= 85 ? 'Ausgezeichnet' :
    score >= 65 ? 'Gut' :
    score >= 45 ? 'Durchschnittlich' : 'Verbesserungsbedarf';

  const labelColor =
    score >= 85 ? 'text-matcha-700' :
    score >= 65 ? 'text-blue-700' :
    score >= 45 ? 'text-amber-700' : 'text-red-700';

  const barColor =
    score >= 85 ? 'bg-matcha-500' :
    score >= 65 ? 'bg-blue-500' :
    score >= 45 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="mx-3 mb-3 rounded-2xl bg-matcha-900/90 text-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
        <Star className="h-4 w-4 text-matcha-300 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-200">
          Dein Live-Score
        </span>
        {isTop && (
          <span className="ml-auto text-[9px] font-black rounded-full bg-matcha-500 px-2 py-0.5 text-white">
            TOP 25%
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex items-center gap-4">
        {/* Score-Ring (Text-basiert) */}
        <div className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white/10">
          <span className="text-2xl font-black tabular-nums">{score}</span>
          <span className="text-[8px] font-bold text-matcha-300">/100</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-bold mb-1', labelColor.replace('text-', 'text-')
            .replace('matcha-700', 'matcha-300')
            .replace('blue-700', 'blue-300')
            .replace('amber-700', 'amber-300')
            .replace('red-700', 'red-300')
          )}>
            {label}
          </div>

          {/* Score-Balken */}
          <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-2">
            <div
              className={cn('h-full rounded-full transition-all duration-700', barColor)}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="text-[10px] text-matcha-300">
            Platz {rank} von {total} Fahrern diese Woche · Top {100 - pct + 1}%
          </div>
        </div>
      </div>
    </div>
  );
}
