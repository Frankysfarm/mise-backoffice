'use client';

import { useState, useEffect } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  trend: 'up' | 'down' | 'gleich';
}

const MOCK: FahrerScore[] = [
  { fahrer_id: 'f1', fahrer_name: 'Max Müller',    score: 95, trend: 'up'     },
  { fahrer_id: 'f2', fahrer_name: 'Lisa Schmidt',  score: 82, trend: 'gleich' },
  { fahrer_id: 'f3', fahrer_name: 'Tom Wagner',    score: 68, trend: 'down'   },
  { fahrer_id: 'f4', fahrer_name: 'Anna Becker',   score: 74, trend: 'up'     },
];

function scoreKlasse(score: number): { ring: string; text: string; badge: string; label: string } {
  if (score >= 80) return { ring: 'text-green-500',  text: 'text-green-700 dark:text-green-400',  badge: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',  label: 'Exzellent'    };
  if (score >= 60) return { ring: 'text-amber-500',  text: 'text-amber-700 dark:text-amber-400',  badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',  label: 'Gut'          };
  return              { ring: 'text-red-500',    text: 'text-red-600 dark:text-red-400',      badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',          label: 'Ausbaufähig'  };
}

const RADIUS = 16;
const UMFANG = 2 * Math.PI * RADIUS;

export function DispatchPhase2009TourScoreAnzeigeCockpit({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<FahrerScore[] | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tages-score?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;
  const sortiert = [...anzeige].sort((a, b) => b.score - a.score);

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Tour-Score Cockpit</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {sortiert.length} Fahrer
          </span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-3">
          {sortiert.map((fahrer, idx) => {
            const k = scoreKlasse(fahrer.score);
            const offset = UMFANG - (fahrer.score / 100) * UMFANG;
            return (
              <div key={fahrer.fahrer_id} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4 text-center tabular-nums">{idx + 1}</span>

                {/* Score-Ring */}
                <div className="shrink-0 relative w-10 h-10">
                  <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
                    <circle cx="20" cy="20" r={RADIUS} fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-slate-700" />
                    <circle
                      cx="20" cy="20" r={RADIUS}
                      fill="none" strokeWidth="4"
                      strokeLinecap="round"
                      className={cn('transition-all duration-700', k.ring)}
                      strokeDasharray={`${UMFANG}`}
                      strokeDashoffset={offset}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700 dark:text-slate-200 rotate-0">
                    {fahrer.score}
                  </span>
                </div>

                {/* Name + Badge */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{fahrer.fahrer_name}</p>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', k.badge)}>{k.label}</span>
                </div>

                {/* Trend */}
                <div className="shrink-0">
                  {fahrer.trend === 'up'     && <TrendingUp   className="w-4 h-4 text-green-500" />}
                  {fahrer.trend === 'down'   && <TrendingDown className="w-4 h-4 text-red-500"   />}
                  {fahrer.trend === 'gleich' && <Minus        className="w-4 h-4 text-slate-400" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
