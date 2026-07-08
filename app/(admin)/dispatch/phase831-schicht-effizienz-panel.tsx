'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, BarChart2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface FahrerEffizienz {
  driver_id: string;
  name: string;
  umsatz_heute: number;
  batches: number;
  aktiv_stunden: number;
  umsatz_pro_stunde: number;
}

interface Benchmark {
  heute_avg: number;
  gestern_avg: number;
  trend_pct: number | null;
}

interface SchichtData {
  fahrer: FahrerEffizienz[];
  benchmark: Benchmark;
  schicht_stunden: number;
  aktualisiert: string;
}

const MOCK: SchichtData = {
  fahrer: [
    { driver_id: 'd1', name: 'Mehmet A.', umsatz_heute: 142.50, batches: 6, aktiv_stunden: 3.2, umsatz_pro_stunde: 44.53 },
    { driver_id: 'd2', name: 'Sarah K.',  umsatz_heute: 118.00, batches: 5, aktiv_stunden: 2.8, umsatz_pro_stunde: 42.14 },
    { driver_id: 'd3', name: 'Jonas B.', umsatz_heute: 89.50,  batches: 4, aktiv_stunden: 2.5, umsatz_pro_stunde: 35.80 },
  ],
  benchmark: { heute_avg: 40.82, gestern_avg: 37.50, trend_pct: 8.9 },
  schicht_stunden: 5.5,
  aktualisiert: new Date().toISOString(),
};

export function DispatchPhase831SchichtEffizienzPanel({ locationId }: Props) {
  const [data, setData] = useState<SchichtData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/admin/schicht-effizienz?location_id=${locationId}`)
        .then(r => r.json())
        .then(d => {
          if (d.fahrer && d.benchmark) setData(d as SchichtData);
          else setData(MOCK);
        })
        .catch(() => setData(MOCK))
        .finally(() => setLoading(false));
    };
    load();
    const id = setInterval(load, 3 * 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const d = data ?? MOCK;
  const trend = d.benchmark.trend_pct;
  const maxRate = Math.max(...d.fahrer.map(f => f.umsatz_pro_stunde), d.benchmark.heute_avg, 1);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Schicht-Effizienz</span>
          {trend !== null && (
            <span className={cn(
              'rounded-full text-[10px] font-bold px-1.5 py-0.5 leading-none flex items-center gap-0.5',
              trend > 0 ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-950 dark:text-matcha-300' :
              trend < 0 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                          'bg-muted text-muted-foreground'
            )}>
              {trend > 0 ? <TrendingUp className="h-2.5 w-2.5" /> :
               trend < 0 ? <TrendingDown className="h-2.5 w-2.5" /> :
                           <Minus className="h-2.5 w-2.5" />}
              {trend > 0 ? '+' : ''}{trend?.toFixed(1)}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t">
          {/* Benchmark-Leiste */}
          <div className="px-4 py-3 bg-muted/20 flex items-center gap-4 text-[11px]">
            <div>
              <div className="text-muted-foreground">Ø heute</div>
              <div className="text-sm font-black tabular-nums">
                {d.benchmark.heute_avg.toFixed(2)} €/h
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Ø gestern</div>
              <div className="text-sm font-bold tabular-nums text-muted-foreground">
                {d.benchmark.gestern_avg.toFixed(2)} €/h
              </div>
            </div>
            <div className="ml-auto">
              <div className="text-muted-foreground">Schicht</div>
              <div className="text-sm font-bold tabular-nums">{d.schicht_stunden} h</div>
            </div>
          </div>

          {/* Benchmark-Bar */}
          <div className="px-4 pb-2 pt-1">
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1">
              <span className="w-20 shrink-0">Benchmark</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${Math.round((d.benchmark.gestern_avg / maxRate) * 100)}%` }}
                />
              </div>
              <span className="w-14 text-right tabular-nums">{d.benchmark.gestern_avg.toFixed(1)} €/h</span>
            </div>
          </div>

          {/* Fahrer-Liste */}
          <div className="divide-y">
            {d.fahrer.slice(0, 6).map((f, idx) => {
              const pct = Math.round((f.umsatz_pro_stunde / maxRate) * 100);
              const aboveBench = f.umsatz_pro_stunde >= d.benchmark.heute_avg;
              return (
                <div key={f.driver_id} className="px-4 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-4 shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="flex-1 text-sm font-semibold truncate">{f.name}</span>
                    <span className={cn(
                      'text-sm font-black tabular-nums',
                      aboveBench ? 'text-matcha-700 dark:text-matcha-400' : 'text-muted-foreground'
                    )}>
                      {f.umsatz_pro_stunde.toFixed(2)} €/h
                    </span>
                    {aboveBench
                      ? <TrendingUp className="h-3 w-3 text-matcha-600 shrink-0" />
                      : <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                    }
                  </div>
                  {/* Bar */}
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0" />
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          aboveBench ? 'bg-matcha-500' : 'bg-red-400'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-20 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                      {f.batches} Touren · {f.aktiv_stunden} h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {d.fahrer.length === 0 && (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center">
              Noch keine Schicht-Daten verfügbar.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
