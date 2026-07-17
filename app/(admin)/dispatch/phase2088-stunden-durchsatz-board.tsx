'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, BarChart2, ChevronDown, ChevronUp, TrendingDown, TrendingUp, Zap } from 'lucide-react';

interface StundenDurchsatz {
  stunde: number;
  bestellungen: number;
  vortag_bestellungen: number;
  ist_peak: boolean;
}

interface ApiData {
  stunden: StundenDurchsatz[];
  peak_stunde: number;
  naechste_stunde_prognose: number;
  team_gesamt_heute: number;
  alert_sinkend: boolean;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const MOCK: ApiData = {
  stunden: Array.from({ length: 24 }, (_, h) => ({
    stunde: h,
    bestellungen: h < 10 ? 0 : h < 12 ? 3 : h < 14 ? 12 : h < 17 ? 6 : h < 20 ? 14 : h < 22 ? 10 : 2,
    vortag_bestellungen: h < 10 ? 0 : h < 12 ? 2 : h < 14 ? 11 : h < 17 ? 5 : h < 20 ? 13 : h < 22 ? 9 : 1,
    ist_peak: h === 19,
  })),
  peak_stunde: 19,
  naechste_stunde_prognose: 11,
  team_gesamt_heute: 87,
  alert_sinkend: false,
};

function padH(h: number): string {
  return `${h}:00`;
}

export function DispatchPhase2088StundenDurchsatzBoard({ locationId, className }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/bestelldurchsatz-stunden?location_id=${locationId}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      // keep previous
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  const nowH = new Date().getHours();
  const visible = data.stunden.filter(s => s.stunde <= nowH);
  const maxVal = Math.max(...visible.map(s => s.bestellungen), 1);

  return (
    <div className={cn('rounded-2xl border bg-card overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Stunden-Durchsatz</span>
        {data.alert_sinkend && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
            <TrendingDown className="h-2.5 w-2.5" />
            Durchsatz sinkt
          </span>
        )}
        <span className="ml-auto font-mono text-sm font-black text-matcha-700">{data.team_gesamt_heute}</span>
        <span className="text-[10px] text-muted-foreground">heute</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* Alert */}
          {data.alert_sinkend && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
              <p className="text-xs text-red-700 font-medium">
                Durchsatz sinkt — letzte Stunde deutlich weniger Bestellungen als zuvor.
              </p>
            </div>
          )}

          {/* Bar chart */}
          <div className="flex items-end gap-0.5 h-20">
            {visible.map(s => {
              const pct = maxVal > 0 ? (s.bestellungen / maxVal) * 100 : 0;
              const isCurrent = s.stunde === nowH;
              const barColor = s.ist_peak
                ? 'bg-matcha-500'
                : isCurrent
                ? 'bg-blue-400'
                : 'bg-muted-foreground/30';

              return (
                <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5" title={`${padH(s.stunde)}: ${s.bestellungen} Bestellungen`}>
                  <div className="w-full flex flex-col justify-end h-16 relative">
                    <div
                      className={cn('w-full rounded-t transition-all', barColor, s.ist_peak && 'ring-1 ring-matcha-600')}
                      style={{ height: `${pct}%`, minHeight: s.bestellungen > 0 ? '2px' : '0' }}
                    />
                    {/* Vortag line */}
                    {s.vortag_bestellungen > 0 && (
                      <div
                        className="absolute w-full border-t border-dashed border-muted-foreground/40"
                        style={{ bottom: `${(s.vortag_bestellungen / maxVal) * 100 * 0.64}%` }}
                      />
                    )}
                  </div>
                  <span className={cn('text-[7px] tabular-nums', s.ist_peak ? 'text-matcha-700 font-black' : isCurrent ? 'text-blue-600 font-bold' : 'text-muted-foreground')}>
                    {s.stunde}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-matcha-500" />Peak</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-blue-400" />Aktuell</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-muted-foreground/60" />Vortag</span>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Peak</div>
              <div className="text-sm font-black tabular-nums">{padH(data.peak_stunde)}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Jetzt</div>
              <div className="text-sm font-black tabular-nums">{data.stunden[nowH]?.bestellungen ?? 0}</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-[9px] text-muted-foreground uppercase">Prognose +1h</div>
              <div className={cn(
                'text-sm font-black tabular-nums flex items-center justify-center gap-0.5',
                data.naechste_stunde_prognose > (data.stunden[nowH]?.bestellungen ?? 0) ? 'text-matcha-700' : 'text-amber-600',
              )}>
                {data.naechste_stunde_prognose > (data.stunden[nowH]?.bestellungen ?? 0)
                  ? <TrendingUp className="h-3 w-3" />
                  : <TrendingDown className="h-3 w-3" />}
                {data.naechste_stunde_prognose}
              </div>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="flex items-center gap-1.5 px-4 py-2 border-t bg-muted/20">
          <Zap className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] text-muted-foreground">30-Min-Polling</span>
        </div>
      )}
    </div>
  );
}
