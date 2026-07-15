'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Trophy, TrendingUp, MapPin, Clock, CheckCircle2 } from 'lucide-react';

interface Stop {
  geliefert_am?: string | null;
  kunde_adresse?: string | null;
  eta_min?: number | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: 'text-matcha-600', bg: 'bg-matcha-500', label: 'bg-matcha-100 text-matcha-800' };
  if (score >= 60) return { ring: 'text-amber-500', bg: 'bg-amber-400', label: 'bg-amber-100 text-amber-800' };
  return { ring: 'text-red-500', bg: 'bg-red-400', label: 'bg-red-100 text-red-800' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const colors = scoreColor(score);
  const strokeColor = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center w-11 h-11 shrink-0">
      <svg width={44} height={44} className="-rotate-90 absolute">
        <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={22}
          cy={22}
          r={r}
          fill="none"
          stroke={strokeColor}
          strokeWidth={4}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('relative z-10 text-[11px] font-black tabular-nums', colors.ring)}>
        {score}
      </span>
    </div>
  );
}

export function DispatchPhase1708TourScoreLiveAnzeige({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const activeTours = useMemo(() => {
    const now = Date.now();
    return batches
      .filter((b) => ['unterwegs', 'on_route', 'gestartet'].includes(b.status ?? ''))
      .map((b) => {
        const dr = drivers.find((d) => d.employee_id === b.fahrer_id);
        const driverName = dr?.employee
          ? `${dr.employee.vorname} ${(dr.employee.nachname ?? '')[0]}.`
          : 'Fahrer';

        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
        const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
        const totalStops = b.stops?.length ?? 0;
        const completedStops = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const etaMin = b.total_eta_min ?? null;

        const donePct = totalStops > 0 ? completedStops / totalStops : 0;
        const timePct = etaMin ? elapsedMin / etaMin : 0;
        const delta = timePct - donePct;

        let health: 'on-time' | 'tight' | 'late' = delta > 0.3 ? 'late' : delta > 0.1 ? 'tight' : 'on-time';
        const score = Math.max(0, Math.min(100, Math.round((donePct * 0.5 + (1 - Math.max(0, delta)) * 0.5) * 100)));

        const nextStop = b.stops?.find((s) => !s.geliefert_am);
        const remainMin = etaMin ? Math.max(0, etaMin - elapsedMin) : null;

        return {
          id: b.id,
          driverName,
          score,
          health,
          completedStops,
          totalStops,
          elapsedMin: Math.round(elapsedMin),
          remainMin: remainMin !== null ? Math.round(remainMin) : null,
          zone: b.zone,
          nextAddress: nextStop?.kunde_adresse ?? null,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [batches, drivers]);

  if (activeTours.length === 0) return null;

  const avgScore = Math.round(activeTours.reduce((s, t) => s + t.score, 0) / activeTours.length);

  return (
    <Card className="overflow-hidden border">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score Live
          </span>
          <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
            Ø {avgScore} · {activeTours.length} aktiv
          </span>
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="border-t divide-y">
          {activeTours.map((tour) => {
            const colors = scoreColor(tour.score);
            const healthLabel =
              tour.health === 'late'
                ? 'Verzögert'
                : tour.health === 'tight'
                ? 'Knapp'
                : 'Pünktlich';
            const healthColor =
              tour.health === 'late'
                ? 'text-red-600 bg-red-50'
                : tour.health === 'tight'
                ? 'text-amber-600 bg-amber-50'
                : 'text-matcha-700 bg-matcha-50';

            return (
              <div key={tour.id} className="px-4 py-3 flex items-center gap-3">
                <ScoreRing score={tour.score} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{tour.driverName}</span>
                    {tour.zone && (
                      <span className="rounded-full border bg-muted px-1.5 py-0.5 text-[9px] font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', healthColor)}>
                      {healthLabel}
                    </span>
                  </div>

                  {/* Stop progress bar */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', colors.bg)}
                        style={{
                          width: `${tour.totalStops > 0 ? (tour.completedStops / tour.totalStops) * 100 : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-bold text-muted-foreground tabular-nums shrink-0">
                      {tour.completedStops}/{tour.totalStops}
                    </span>
                  </div>

                  {tour.nextAddress && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{tour.nextAddress}</span>
                    </div>
                  )}
                </div>

                <div className="shrink-0 text-right">
                  {tour.remainMin !== null ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="font-mono text-sm font-black tabular-nums">
                          {tour.remainMin}m
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">verbleibend</div>
                    </>
                  ) : (
                    <div className="font-mono text-sm font-black tabular-nums text-muted-foreground">
                      {tour.elapsedMin}m
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
