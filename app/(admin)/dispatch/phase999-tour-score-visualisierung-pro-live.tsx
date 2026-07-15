'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, CheckCircle2, Clock, TrendingUp } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  zone?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  locationId?: string | null;
}

type Health = 'on-time' | 'tight' | 'late' | 'unknown';

const HEALTH: Record<Health, { label: string; bg: string; border: string; ring: string; text: string; dot: string }> = {
  'on-time': { label: 'Pünktlich', bg: 'bg-matcha-50', border: 'border-matcha-200', ring: 'bg-matcha-500', text: 'text-matcha-700', dot: 'bg-matcha-500' },
  tight:     { label: 'Knapp',    bg: 'bg-amber-50',   border: 'border-amber-200',   ring: 'bg-amber-400',  text: 'text-amber-700',  dot: 'bg-amber-400'  },
  late:      { label: 'Verspätet', bg: 'bg-red-50',    border: 'border-red-200',     ring: 'bg-red-500',    text: 'text-red-700',    dot: 'bg-red-500'    },
  unknown:   { label: 'Unbekannt', bg: 'bg-muted/30',  border: 'border-border',      ring: 'bg-muted-foreground', text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
};

function computeScore(elapsedMin: number, etaMin: number | null, completedStops: number, totalStops: number): number {
  const donePct = totalStops > 0 ? completedStops / totalStops : 0;
  const usedPct = etaMin ? elapsedMin / Math.max(etaMin, 1) : 0;
  const timingScore = Math.max(0, 1 - Math.max(0, usedPct - donePct));
  const progressScore = donePct;
  return Math.round((timingScore * 0.6 + progressScore * 0.4) * 100);
}

export function DispatchPhase999TourScoreVisualisierungProLive({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const now = Date.now();
    const active = batches.filter((b) =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status ?? ''),
    );
    return active
      .map((b) => {
        const driver = drivers.find((d) => d.employee_id === (b.fahrer_id ?? ''));
        const driverName = driver?.employee
          ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`
          : 'Fahrer';
        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
        const elapsedMin = Math.floor((now - startMs) / 60_000);
        const totalStops = b.stops?.length ?? 0;
        const completedStops = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const etaMin = b.total_eta_min ?? null;
        const remainMin = etaMin ? Math.max(0, etaMin - elapsedMin) : null;
        const donePct = totalStops > 0 ? completedStops / totalStops : 0;
        const usedPct = etaMin ? elapsedMin / Math.max(etaMin, 1) : 0;
        let health: Health = 'unknown';
        if (etaMin) {
          const delta = usedPct - donePct;
          health = delta > 0.3 ? 'late' : delta > 0.1 ? 'tight' : 'on-time';
        }
        const score = computeScore(elapsedMin, etaMin, completedStops, totalStops);
        return {
          b, driverName, elapsedMin, remainMin, totalStops, completedStops,
          donePct, score, health, etaMin,
        };
      })
      .sort((a, b) => {
        const order: Health[] = ['late', 'tight', 'on-time', 'unknown'];
        return order.indexOf(a.health) - order.indexOf(b.health);
      });
  }, [batches, drivers]);

  if (rows.length === 0) return null;

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
  const lateCount = rows.filter((r) => r.health === 'late').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Live-Visualisierung</span>
          <span className="rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
            Ø {avgScore}
          </span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
              {lateCount} verspätet
            </span>
          )}
          <span className="rounded-full bg-stone-100 text-stone-600 px-2 py-0.5 text-[10px] font-bold ml-auto">
            {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(({ b, driverName, elapsedMin, remainMin, totalStops, completedStops, donePct, score, health, etaMin }) => {
            const cfg = HEALTH[health];
            const scoreColor = score >= 75 ? 'text-matcha-700' : score >= 50 ? 'text-amber-600' : 'text-red-600';
            const scoreBg = score >= 75 ? 'bg-matcha-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500';
            return (
              <div key={b.id} className={cn('px-4 py-3', cfg.bg)}>
                <div className="flex items-start gap-3">
                  {/* Score-Ring */}
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <div className="relative h-10 w-10">
                      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-black/10" />
                        <circle
                          cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
                          className={scoreColor}
                          strokeDasharray={`${(score / 100) * 94.2} 94.2`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className={cn('absolute inset-0 flex items-center justify-center text-[11px] font-black', scoreColor)}>
                        {score}
                      </div>
                    </div>
                    <span className={cn('text-[8px] font-bold rounded-full px-1.5 py-0.5', cfg.bg, cfg.border, 'border', cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{driverName}</span>
                      {b.zone && (
                        <span className="text-[9px] rounded-full border bg-white/60 px-1.5 py-0.5 font-bold">Zone {b.zone}</span>
                      )}
                      {remainMin !== null && (
                        <span className={cn('text-[10px] font-bold tabular-nums', cfg.text)}>
                          ~{remainMin} Min verbleibend
                        </span>
                      )}
                    </div>

                    {/* Stop dots */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {Array.from({ length: totalStops }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-3 w-3 rounded-full border-2 flex items-center justify-center',
                            i < completedStops
                              ? 'border-matcha-500 bg-matcha-500'
                              : 'border-border bg-background',
                          )}
                        >
                          {i < completedStops && <div className="h-1 w-1 rounded-full bg-white" />}
                        </div>
                      ))}
                      <span className="text-[9px] text-muted-foreground ml-1 font-bold">
                        {completedStops}/{totalStops} Stopps
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', scoreBg)}
                        style={{ width: `${Math.round(donePct * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed */}
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-black tabular-nums">{elapsedMin}m</div>
                    {etaMin && (
                      <div className="text-[9px] text-muted-foreground">/ {etaMin}m</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
