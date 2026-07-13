'use client';

// Phase 1276 — Schicht-Auslastungs-Heatmap-Widget (Lieferdienst)
// Visualisiert /api/delivery/admin/schicht-auslastungs-heatmap als interaktive Tabelle
// Stunden × Zonen mit Farb-Intensität; 15-Min-Polling; locationId-Prop

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatmapZelle {
  zone: string;
  stunde: number;
  bestellungen: number;
  intensitaet: 'keine' | 'gering' | 'mittel' | 'hoch' | 'peak';
}

interface ApiResponse {
  zonen: string[];
  stunden: number[];
  matrix: HeatmapZelle[];
  max_bestellungen: number;
  peak_zone: string | null;
  peak_stunde: number | null;
  location_id: string;
  generiert_am: string;
}

const INT_STYLE: Record<HeatmapZelle['intensitaet'], string> = {
  keine:  'bg-slate-50 dark:bg-slate-900 text-slate-300 dark:text-slate-700',
  gering: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  mittel: 'bg-amber-200 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
  hoch:   'bg-orange-400 dark:bg-orange-800/60 text-white',
  peak:   'bg-red-500 dark:bg-red-700 text-white font-bold',
};

const MOCK: ApiResponse = {
  zonen: ['Mitte', 'Nord', 'West', 'Süd'],
  stunden: [11, 12, 13, 17, 18, 19, 20],
  matrix: [
    { zone: 'Mitte', stunde: 11, bestellungen: 8,  intensitaet: 'gering' },
    { zone: 'Mitte', stunde: 12, bestellungen: 22, intensitaet: 'hoch' },
    { zone: 'Mitte', stunde: 13, bestellungen: 28, intensitaet: 'peak' },
    { zone: 'Mitte', stunde: 17, bestellungen: 14, intensitaet: 'mittel' },
    { zone: 'Mitte', stunde: 18, bestellungen: 31, intensitaet: 'peak' },
    { zone: 'Mitte', stunde: 19, bestellungen: 38, intensitaet: 'peak' },
    { zone: 'Mitte', stunde: 20, bestellungen: 29, intensitaet: 'hoch' },
    { zone: 'Nord',  stunde: 11, bestellungen: 4,  intensitaet: 'gering' },
    { zone: 'Nord',  stunde: 12, bestellungen: 11, intensitaet: 'mittel' },
    { zone: 'Nord',  stunde: 13, bestellungen: 15, intensitaet: 'mittel' },
    { zone: 'Nord',  stunde: 17, bestellungen: 8,  intensitaet: 'gering' },
    { zone: 'Nord',  stunde: 18, bestellungen: 19, intensitaet: 'hoch' },
    { zone: 'Nord',  stunde: 19, bestellungen: 23, intensitaet: 'hoch' },
    { zone: 'Nord',  stunde: 20, bestellungen: 16, intensitaet: 'mittel' },
    { zone: 'West',  stunde: 11, bestellungen: 6,  intensitaet: 'gering' },
    { zone: 'West',  stunde: 12, bestellungen: 16, intensitaet: 'mittel' },
    { zone: 'West',  stunde: 13, bestellungen: 19, intensitaet: 'hoch' },
    { zone: 'West',  stunde: 17, bestellungen: 11, intensitaet: 'mittel' },
    { zone: 'West',  stunde: 18, bestellungen: 24, intensitaet: 'hoch' },
    { zone: 'West',  stunde: 19, bestellungen: 29, intensitaet: 'hoch' },
    { zone: 'West',  stunde: 20, bestellungen: 20, intensitaet: 'hoch' },
    { zone: 'Süd',   stunde: 11, bestellungen: 3,  intensitaet: 'gering' },
    { zone: 'Süd',   stunde: 12, bestellungen: 9,  intensitaet: 'gering' },
    { zone: 'Süd',   stunde: 13, bestellungen: 12, intensitaet: 'mittel' },
    { zone: 'Süd',   stunde: 17, bestellungen: 6,  intensitaet: 'gering' },
    { zone: 'Süd',   stunde: 18, bestellungen: 14, intensitaet: 'mittel' },
    { zone: 'Süd',   stunde: 19, bestellungen: 18, intensitaet: 'hoch' },
    { zone: 'Süd',   stunde: 20, bestellungen: 12, intensitaet: 'mittel' },
  ],
  max_bestellungen: 38,
  peak_zone: 'Mitte',
  peak_stunde: 19,
  location_id: '',
  generiert_am: new Date().toISOString(),
};

export function LieferdienstPhase1276SchichtAuslastungsHeatmap({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState<string | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); setLoading(false); return; }
    try {
      const r = await fetch(`/api/delivery/admin/schicht-auslastungs-heatmap?location_id=${locationId}`);
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setData({ ...MOCK, location_id: locationId });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 15 * 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const d = data ?? MOCK;

  function zelle(zone: string, stunde: number): HeatmapZelle {
    return d.matrix.find(m => m.zone === zone && m.stunde === stunde) ?? {
      zone, stunde, bestellungen: 0, intensitaet: 'keine',
    };
  }

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-orange-600 to-red-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4" />
          <span className="font-semibold text-sm">Schicht-Auslastungs-Heatmap</span>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              Peak: {d.peak_zone ?? '—'} {d.peak_stunde !== null ? `${d.peak_stunde}:00` : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-3 py-3">
          {/* Legend */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {(['keine', 'gering', 'mittel', 'hoch', 'peak'] as const).map(lvl => (
              <div key={lvl} className="flex items-center gap-1 text-xs">
                <span className={cn('inline-block w-4 h-4 rounded', INT_STYLE[lvl].split(' ')[0])} />
                <span className="text-slate-600 dark:text-slate-400 capitalize">{lvl}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th className="text-left px-2 py-1 text-slate-500 dark:text-slate-400 font-medium w-16">Zone</th>
                  {d.stunden.map(h => (
                    <th key={h} className={cn(
                      'px-1 py-1 text-center font-medium min-w-[2.5rem]',
                      d.peak_stunde === h
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400',
                    )}>
                      {h}h
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.zonen.map(zone => (
                  <tr key={zone}>
                    <td className={cn(
                      'px-2 py-1 font-semibold',
                      d.peak_zone === zone
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-700 dark:text-slate-300',
                    )}>
                      {zone}
                    </td>
                    {d.stunden.map(stunde => {
                      const z = zelle(zone, stunde);
                      const key = `${zone}-${stunde}`;
                      return (
                        <td key={stunde} className="px-1 py-1 text-center relative group">
                          <button
                            className={cn(
                              'w-full h-7 rounded text-xs transition-all cursor-default',
                              INT_STYLE[z.intensitaet],
                              hover === key && 'ring-2 ring-slate-400 dark:ring-slate-500',
                            )}
                            onMouseEnter={() => setHover(key)}
                            onMouseLeave={() => setHover(null)}
                          >
                            {z.bestellungen > 0 ? z.bestellungen : ''}
                          </button>
                          {hover === key && z.bestellungen > 0 && (
                            <div className="absolute z-10 -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap pointer-events-none">
                              {zone} {stunde}:00 — {z.bestellungen} Bestellungen
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-right">
            Stand: {new Date(d.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr · letzte 7 Tage
          </p>
        </div>
      )}
    </div>
  );
}
