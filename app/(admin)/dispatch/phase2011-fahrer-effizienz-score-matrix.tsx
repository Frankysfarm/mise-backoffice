'use client';

import { useState, useEffect } from 'react';
import { Award, Clock, Package, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerSchicht {
  fahrer_id: string;
  name: string;
  score_gesamt: number;
  puenktlichkeit_pct: number;
  lieferungen: number;
  avg_lieferzeit_min: number;
}

const MOCK: FahrerSchicht[] = [
  { fahrer_id: 'f1', name: 'Max Müller',   score_gesamt: 94, puenktlichkeit_pct: 97, lieferungen: 22, avg_lieferzeit_min: 14 },
  { fahrer_id: 'f2', name: 'Lisa Schmidt', score_gesamt: 87, puenktlichkeit_pct: 91, lieferungen: 19, avg_lieferzeit_min: 16 },
  { fahrer_id: 'f3', name: 'Anna Becker',  score_gesamt: 79, puenktlichkeit_pct: 83, lieferungen: 17, avg_lieferzeit_min: 18 },
  { fahrer_id: 'f4', name: 'Tom Wagner',   score_gesamt: 65, puenktlichkeit_pct: 72, lieferungen: 14, avg_lieferzeit_min: 22 },
];

export function DispatchPhase2011FahrerEffizienzScoreMatrix({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<FahrerSchicht[] | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-analyse?location_id=${locationId}`);
      if (!res.ok) { setDaten(MOCK); return; }
      setDaten(await res.json());
    } catch {
      setDaten(MOCK);
    }
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const anzeige = daten ?? MOCK;
  const sortiert = [...anzeige].sort((a, b) => b.score_gesamt - a.score_gesamt);

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Award className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Effizienz-Score-Matrix</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
            {sortiert.length} Fahrer
          </span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700 text-[10px] text-slate-400 uppercase tracking-wide">
                  <th className="px-4 py-2 text-left">#</th>
                  <th className="px-4 py-2 text-left">Fahrer</th>
                  <th className="px-4 py-2 text-center">Score</th>
                  <th className="px-4 py-2 text-center">
                    <span className="flex items-center justify-center gap-0.5"><Clock className="w-3 h-3" /> Pünktl.</span>
                  </th>
                  <th className="px-4 py-2 text-center">
                    <span className="flex items-center justify-center gap-0.5"><Package className="w-3 h-3" /> Lief.</span>
                  </th>
                  <th className="px-4 py-2 text-center">Ø Zeit</th>
                </tr>
              </thead>
              <tbody>
                {sortiert.map((fahrer, idx) => {
                  const istErster = idx === 0;
                  return (
                    <tr
                      key={fahrer.fahrer_id}
                      className={cn(
                        'border-b border-slate-50 dark:border-slate-700/50 last:border-0 transition-colors',
                        istErster
                          ? 'bg-amber-50 dark:bg-amber-900/20'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      )}
                    >
                      <td className="px-4 py-2.5 text-center">
                        {istErster
                          ? <Award className="w-3.5 h-3.5 text-amber-500 mx-auto" />
                          : <span className="text-slate-400 font-semibold">{idx + 1}</span>
                        }
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('font-semibold', istErster ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200')}>
                          {fahrer.name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('font-bold text-sm tabular-nums', istErster ? 'text-amber-600 dark:text-amber-400' : 'text-slate-800 dark:text-slate-100')}>
                          {fahrer.score_gesamt}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {fahrer.puenktlichkeit_pct}%
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {fahrer.lieferungen}
                      </td>
                      <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                        {fahrer.avg_lieferzeit_min} Min.
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
