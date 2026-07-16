'use client';

import { useState, useEffect } from 'react';
import { Calendar, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KalenderZelle {
  tag: number;
  stunde: number;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface KalenderData {
  zellen: KalenderZelle[];
  gesamt_avg: number;
  peak_tag: number;
  peak_stunde: number;
  peak_anzahl: number;
}

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-green-200 dark:bg-green-800',
  gelb: 'bg-amber-300 dark:bg-amber-700',
  rot: 'bg-red-400 dark:bg-red-700',
};

const VISIBLE_STUNDEN = [7, 9, 11, 13, 15, 17, 19, 21];

export default function DispatchPhase1944TourauslastungsKalenderWidget({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const [daten, setDaten] = useState<KalenderData | null>(null);
  const [offen, setOffen] = useState(true);

  const laden = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tourauslastungs-kalender?location_id=${locationId}`);
      if (!res.ok) return;
      const json: KalenderData = await res.json();
      setDaten(json);
    } catch {}
  };

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId) return null;

  const zelleMap = new Map<string, KalenderZelle>();
  for (const z of daten?.zellen ?? []) {
    zelleMap.set(`${z.tag}:${z.stunde}`, z);
  }

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Tourauslastungs-Kalender</span>
          {daten && (
            <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
              Peak {String(daten.peak_stunde).padStart(2, '0')}:00
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          {!daten ? (
            <p className="text-xs text-slate-400 text-center py-2">Lade Kalender…</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left pr-2 text-slate-400 font-normal w-8"></th>
                      {VISIBLE_STUNDEN.map((h) => (
                        <th key={h} className="text-center text-slate-400 font-normal pb-1 px-0.5">
                          {String(h).padStart(2, '0')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TAGE.map((tagName, tagIdx) => (
                      <tr key={tagIdx}>
                        <td className="text-slate-500 dark:text-slate-400 pr-2 py-0.5 text-right font-medium">
                          {tagName}
                        </td>
                        {VISIBLE_STUNDEN.map((stunde) => {
                          const z = zelleMap.get(`${tagIdx}:${stunde}`);
                          const isPeak = daten.peak_tag === tagIdx && daten.peak_stunde === stunde;
                          return (
                            <td key={stunde} className="px-0.5 py-0.5">
                              <div
                                title={`${z?.anzahl ?? 0} Bestellungen`}
                                className={cn(
                                  'w-6 h-5 rounded text-center text-[9px] font-bold flex items-center justify-center',
                                  z && z.anzahl > 0 ? AMPEL_BG[z.ampel] : 'bg-slate-100 dark:bg-slate-700',
                                  isPeak ? 'ring-1 ring-violet-500' : '',
                                )}
                              >
                                {z && z.anzahl > 0 ? z.anzahl : ''}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>Legende:</span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800 inline-block" />
                  Ruhig
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-amber-300 dark:bg-amber-700 inline-block" />
                  Normal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-400 dark:bg-red-700 inline-block" />
                  Hochtouren
                </span>
              </div>

              <p className="text-xs text-slate-400">
                Ø {daten.gesamt_avg} Bestellungen/Stunde · Peak {TAGE[daten.peak_tag]} {String(daten.peak_stunde).padStart(2, '0')}:00 ({daten.peak_anzahl} Best.)
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
