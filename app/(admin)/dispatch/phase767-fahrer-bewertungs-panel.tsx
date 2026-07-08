'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

interface TagesVerlauf {
  datum: string;
  avg: number;
}

interface FahrerBewertung {
  driver_id: string;
  name: string;
  avg_rating: number;
  anzahl: number;
  tage_verlauf: TagesVerlauf[];
}

const MOCK: FahrerBewertung[] = [
  { driver_id: 'a', name: 'Max Mustermann', avg_rating: 4.8, anzahl: 23, tage_verlauf: [] },
  { driver_id: 'b', name: 'Lena Schmidt', avg_rating: 4.3, anzahl: 17, tage_verlauf: [] },
  { driver_id: 'c', name: 'Tom Fischer', avg_rating: 3.9, anzahl: 11, tage_verlauf: [] },
];

function StarBar({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`h-3.5 w-3.5 ${n <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{rating.toFixed(1)}</span>
    </div>
  );
}

function RatingColor(avg: number): string {
  if (avg >= 4.5) return 'text-emerald-600 dark:text-emerald-400';
  if (avg >= 3.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function DispatchPhase767FahrerBewertungsPanel({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(false);
  const [fahrer, setFahrer] = useState<FahrerBewertung[]>(MOCK);
  const [tage, setTage] = useState(14);

  useEffect(() => {
    if (!locationId) return;
    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-verlauf?location_id=${locationId}&tage=${tage}`);
        if (!res.ok) return;
        const json = await res.json();
        if (Array.isArray(json.fahrer) && json.fahrer.length > 0) setFahrer(json.fahrer);
      } catch {}
    }
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
  }, [locationId, tage]);

  if (!fahrer.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Fahrer-Bewertungen
          </span>
          <span className="rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs px-2 py-0.5">
            {tage}T
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={tage}
            onChange={e => { e.stopPropagation(); setTage(Number(e.target.value)); }}
            onClick={e => e.stopPropagation()}
            className="text-xs rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1 py-0.5"
          >
            <option value={7}>7T</option>
            <option value={14}>14T</option>
            <option value={30}>30T</option>
          </select>
          {open ? (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {fahrer.map((f, i) => (
            <div
              key={f.driver_id}
              className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 w-5 text-right">{i + 1}.</span>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{f.anzahl} Bewertungen</p>
                </div>
              </div>
              <div className="text-right">
                <StarBar rating={f.avg_rating} />
                <p className={`text-xs font-semibold mt-0.5 ${RatingColor(f.avg_rating)}`}>
                  {f.avg_rating >= 4.5 ? 'Sehr gut' : f.avg_rating >= 3.5 ? 'Gut' : 'Verbesserung nötig'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
