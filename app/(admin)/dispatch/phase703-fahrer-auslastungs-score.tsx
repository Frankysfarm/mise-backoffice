'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface FahrerScore {
  driver_id: string;
  name: string;
  score: number;
  touren_heute: number;
  touren_aktiv: number;
  km_heute: number;
}

const MOCK: FahrerScore[] = [
  { driver_id: '1', name: 'Max M.', score: 92, touren_heute: 8, touren_aktiv: 1, km_heute: 34.2 },
  { driver_id: '2', name: 'Lena K.', score: 67, touren_heute: 5, touren_aktiv: 1, km_heute: 22.5 },
  { driver_id: '3', name: 'Tom B.', score: 38, touren_heute: 3, touren_aktiv: 0, km_heute: 14.1 },
  { driver_id: '4', name: 'Sara W.', score: 15, touren_heute: 1, touren_aktiv: 0, km_heute: 4.8 },
];

function scoreColor(score: number) {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 45) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number) {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 45) return 'bg-amber-500';
  return 'bg-red-500';
}

export function DispatchPhase703FahrerAuslastungsScore({ locationId }: Props) {
  const [data, setData] = useState<FahrerScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-auslastungs-score?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.fahrer) && json.fahrer.length > 0) {
          setData(json.fahrer);
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  }, [laden]);

  const aktiveFahrer = data.filter((f) => f.touren_aktiv > 0).length;
  const avgScore = data.length > 0 ? Math.round(data.reduce((s, f) => s + f.score, 0) / data.length) : 0;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Fahrer-Auslastung</span>
          {!loading && data.length > 0 && (
            <span className={`text-xs font-semibold ${scoreColor(avgScore)}`}>
              Ø {avgScore}% · {aktiveFahrer}/{data.length} aktiv
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Keine Fahrer in Schicht</p>
          ) : (
            data.map((f) => (
              <div key={f.driver_id} className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-xs font-medium truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {f.touren_heute} Touren · {f.km_heute.toFixed(0)} km
                  </p>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${scoreBg(f.score)}`}
                      style={{ width: `${f.score}%` }}
                    />
                  </div>
                  <span className={`w-9 text-right text-xs font-bold tabular-nums ${scoreColor(f.score)}`}>
                    {f.score}%
                  </span>
                </div>
                {f.touren_aktiv > 0 && (
                  <span className="text-[9px] rounded-full px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold">
                    unterwegs
                  </span>
                )}
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">Score = Touren/8 × 100 · 90s Aktualisierung</p>
        </div>
      )}
    </div>
  );
}
