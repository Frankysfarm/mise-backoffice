'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TagesVerlauf {
  datum: string;
  avg: number;
}

interface BewertungsDaten {
  avg_rating: number;
  anzahl: number;
  tage_verlauf: TagesVerlauf[];
}

const MOCK: BewertungsDaten = {
  avg_rating: 4.6,
  anzahl: 31,
  tage_verlauf: [
    { datum: '2026-07-01', avg: 4.5 },
    { datum: '2026-07-02', avg: 4.8 },
    { datum: '2026-07-03', avg: 4.4 },
    { datum: '2026-07-04', avg: 4.7 },
    { datum: '2026-07-05', avg: 4.6 },
  ],
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`h-5 w-5 ${n <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        />
      ))}
    </div>
  );
}

function Trend({ verlauf }: { verlauf: TagesVerlauf[] }) {
  if (verlauf.length < 2) return <Minus className="h-4 w-4 text-slate-400" />;
  const first = verlauf[0].avg;
  const last = verlauf[verlauf.length - 1].avg;
  const diff = last - first;
  if (diff > 0.1) return <TrendingUp className="h-4 w-4 text-emerald-500" />;
  if (diff < -0.1) return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-slate-400" />;
}

export function FahrerPhase768EigeneBewertung({ driverId }: { driverId: string }) {
  const [open, setOpen] = useState(false);
  const [daten, setDaten] = useState<BewertungsDaten>(MOCK);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/delivery/driver/bewertung-verlauf?driver_id=${driverId}&tage=14`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.avg_rating != null) setDaten(json);
      } catch {}
    }
    load();
    const id = setInterval(load, 10 * 60_000);
    return () => clearInterval(id);
  }, [driverId]);

  const ratingColor = daten.avg_rating >= 4.5
    ? 'text-emerald-500'
    : daten.avg_rating >= 3.5
    ? 'text-amber-500'
    : 'text-red-500';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Meine Bewertungen
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${ratingColor}`}>{daten.avg_rating.toFixed(1)}</span>
          <Trend verlauf={daten.tage_verlauf} />
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-700/50 px-4 py-3">
            <div>
              <p className={`text-3xl font-bold ${ratingColor}`}>{daten.avg_rating.toFixed(1)}</p>
              <StarRow rating={daten.avg_rating} />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                aus {daten.anzahl} Bewertungen (14 Tage)
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Trend</p>
              <Trend verlauf={daten.tage_verlauf} />
            </div>
          </div>

          {daten.tage_verlauf.length > 0 && (
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Tagesverlauf</p>
              <div className="space-y-1">
                {[...daten.tage_verlauf].reverse().slice(0, 7).map(tv => (
                  <div key={tv.datum} className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 w-20 shrink-0">
                      {tv.datum.slice(5)}
                    </span>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${(tv.avg / 5) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-8 text-right">
                      {tv.avg.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
