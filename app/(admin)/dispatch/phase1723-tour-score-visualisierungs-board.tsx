'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Target, Route } from 'lucide-react';

/**
 * Phase 1723 — Tour-Score-Visualisierungs-Board (Dispatch)
 *
 * Score-Ring je aktiver Tour + Stopp-Fortschrittsbalken + Health-Ampel.
 * Ohne Polling — reagiert auf batches/drivers Props.
 * Score 0-100 basierend auf Stopp-Fortschritt vs. verstrichener ETA.
 */

interface Stop {
  id: string;
  geliefert_am?: string | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  zone?: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  stops?: Stop[] | null;
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string; nachname?: string } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

type Health = 'on-time' | 'tight' | 'late' | 'unknown';

const ACTIVE_STATUS = new Set(['unterwegs', 'on_route', 'gestartet', 'active']);

const RING_R = 22;
const RING_CIRC = 2 * Math.PI * RING_R;

function ScoreRing({ score, health }: { score: number; health: Health }) {
  const pct = score / 100;
  const dash = pct * RING_CIRC;
  const ringColor =
    health === 'on-time' ? 'text-matcha-500' :
    health === 'tight'   ? 'text-amber-400'  :
    health === 'late'    ? 'text-red-500'     : 'text-muted-foreground';

  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={RING_R} fill="none" strokeWidth="4"
        stroke="currentColor" className="text-muted/20" />
      <circle cx="26" cy="26" r={RING_R} fill="none" strokeWidth="4"
        stroke="currentColor" className={ringColor}
        strokeDasharray={`${dash} ${RING_CIRC}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dasharray 0.8s ease-out' }} />
      <text x="26" y="23" textAnchor="middle" style={{ fontSize: 11, fontWeight: 900 }}
        className={`fill-current ${ringColor}`}>
        {score}
      </text>
      <text x="26" y="33" textAnchor="middle" style={{ fontSize: 7, fontWeight: 600 }}
        className="fill-current text-muted-foreground">
        Score
      </text>
    </svg>
  );
}

const HEALTH_CFG: Record<Health, { badge: string; label: string; barColor: string }> = {
  'on-time': { badge: 'bg-matcha-500 text-white',     label: 'Pünktlich',  barColor: 'bg-matcha-500' },
  tight:     { badge: 'bg-amber-400 text-white',      label: 'Knapp',      barColor: 'bg-amber-400' },
  late:      { badge: 'bg-red-500 text-white',        label: 'Verspätet',  barColor: 'bg-red-500' },
  unknown:   { badge: 'bg-muted text-muted-foreground', label: 'Unbekannt', barColor: 'bg-muted-foreground' },
};

export function DispatchPhase1723TourScoreVisualisierungsBoard({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const tours = useMemo(() => {
    const now = Date.now();
    return batches
      .filter(b => ACTIVE_STATUS.has(b.status))
      .map(b => {
        const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
        const driverName = driver?.employee
          ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`.trim()
          : 'Fahrer';

        const startMs = b.startzeit
          ? new Date(b.startzeit).getTime()
          : b.started_at
          ? new Date(b.started_at).getTime()
          : null;

        const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
        const totalStops = b.stops?.length ?? 0;
        const completedStops = b.stops?.filter(s => s.geliefert_am).length ?? 0;
        const etaMin = b.total_eta_min ?? null;

        const donePct = totalStops > 0 ? completedStops / totalStops : 0;
        const usedPct = etaMin && etaMin > 0 ? elapsedMin / etaMin : 0;
        const gap = usedPct - donePct;

        const health: Health = etaMin
          ? gap > 0.3 ? 'late' : gap > 0.1 ? 'tight' : 'on-time'
          : 'unknown';

        const score = Math.max(0, Math.min(100, Math.round(
          (donePct * 0.6 + Math.max(0, 1 - Math.max(0, gap)) * 0.4) * 100
        )));

        const remainMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;

        return { id: b.id, driverName, zone: b.zone, score, health, completedStops, totalStops, elapsedMin, remainMin };
      })
      .sort((a, b) => a.score - b.score);
  }, [batches, drivers]);

  if (tours.length === 0) return null;

  const lateCount = tours.filter(t => t.health === 'late').length;

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      lateCount > 0
        ? 'border-red-200 dark:border-red-800 bg-red-50/20 dark:bg-red-950/10'
        : 'border-border bg-card',
    )}>
      <button onClick={() => setOpen(v => !v)} className="flex w-full items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold">
          <Route className="h-4 w-4 text-matcha-500" />
          Tour-Score-Board
          {lateCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-black text-white">
              {lateCount} verspätet
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{tours.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {tours.map(tour => {
            const hcfg = HEALTH_CFG[tour.health];
            const stopPct = tour.totalStops > 0 ? (tour.completedStops / tour.totalStops) * 100 : 0;
            return (
              <div key={tour.id} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 p-2">
                <ScoreRing score={tour.score} health={tour.health} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{tour.driverName}</span>
                    {tour.zone && (
                      <span className="rounded-full border bg-white/50 dark:bg-black/20 px-1.5 py-0.5 text-[9px] font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', hcfg.badge)}>
                      {hcfg.label}
                    </span>
                  </div>

                  {/* Stop progress */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', hcfg.barColor)}
                        style={{ width: `${stopPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {tour.completedStops}/{tour.totalStops} Stopps
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">
                      {tour.elapsedMin} Min vergangen
                    </span>
                    {tour.remainMin !== null && (
                      <span className={cn('text-[10px] font-bold', hcfg.barColor.replace('bg-', 'text-'))}>
                        ~{tour.remainMin} Min verbl.
                      </span>
                    )}
                  </div>
                </div>

                {/* Score badge */}
                <div className="shrink-0 text-right">
                  <Target className={cn(
                    'h-4 w-4 mx-auto',
                    tour.health === 'on-time' ? 'text-matcha-500' :
                    tour.health === 'tight'   ? 'text-amber-400'  :
                    tour.health === 'late'    ? 'text-red-500'    : 'text-muted-foreground',
                  )} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-2 flex gap-4">
          {(['on-time', 'tight', 'late'] as Health[]).map(h => {
            const cnt = tours.filter(t => t.health === h).length;
            if (cnt === 0) return null;
            const cfg = HEALTH_CFG[h];
            return (
              <span key={h} className="text-[10px] font-bold text-muted-foreground">
                <span className={cn('rounded px-1 py-0.5', cfg.badge)}>{cnt}</span>{' '}
                {cfg.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
