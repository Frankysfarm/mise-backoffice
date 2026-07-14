'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Route, MapPin, Clock, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1459 — Tour-Live-Hub (Dispatch)
// Erweiterte Tour-Visualisierung: Stop-Sequenz mit ETA-Abweichung,
// Fortschrittsbalken und Fahrer-Score-Ampel je aktiver Tour.

interface Stop {
  id: string;
  reihenfolge?: number | null;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
  geplante_ankunft?: string | null;
  erstellt_am?: string | null;
  order?: {
    kunde_adresse?: string | null;
    kunde_name?: string | null;
    gesamtbetrag?: number | null;
  } | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  erstellt_am?: string | null;
  stops?: Stop[] | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function getScoreColor(pct: number): { cls: string; label: string } {
  if (pct >= 80) return { cls: 'text-emerald-600 bg-emerald-50', label: 'Gut' };
  if (pct >= 55) return { cls: 'text-amber-600 bg-amber-50', label: 'Ok' };
  return { cls: 'text-red-600 bg-red-50', label: 'Kritisch' };
}

function computeOnTimePct(stops: Stop[]): number {
  const delivered = stops.filter(s => s.geliefert_am && s.geplante_ankunft);
  if (!delivered.length) return 100;
  const onTime = delivered.filter(s => {
    const actual = new Date(s.geliefert_am!).getTime();
    const planned = new Date(s.geplante_ankunft!).getTime();
    return actual <= planned + 5 * 60_000;
  });
  return Math.round((onTime.length / delivered.length) * 100);
}

function getEtaDelta(stop: Stop): string | null {
  if (!stop.geliefert_am || !stop.geplante_ankunft) return null;
  const delta = Math.round(
    (new Date(stop.geliefert_am).getTime() - new Date(stop.geplante_ankunft).getTime()) / 60_000,
  );
  if (delta > 0) return `+${delta} Min`;
  if (delta < 0) return `${delta} Min`;
  return 'Pünktlich';
}

export function DispatchPhase1459TourLiveHub({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const driverMap = useMemo(() => {
    const m = new Map<string, Driver>();
    drivers.forEach(d => m.set(d.id, d));
    return m;
  }, [drivers]);

  const active = useMemo(() => {
    return batches
      .filter(b => b.status && !['completed', 'cancelled', 'abgeschlossen'].includes(b.status))
      .map(b => {
        const stops = (b.stops ?? []).sort((a, z) => (a.reihenfolge ?? 0) - (z.reihenfolge ?? 0));
        const done = stops.filter(s => !!s.geliefert_am).length;
        const pct = stops.length > 0 ? Math.round((done / stops.length) * 100) : 0;
        const score = computeOnTimePct(stops);
        const driver = b.fahrer_id ? driverMap.get(b.fahrer_id) : null;
        const driverName = driver ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() : 'Kein Fahrer';
        return { ...b, stops, done, pct, score, driverName };
      })
      .sort((a, b) => a.score - b.score);
  }, [batches, driverMap]);

  if (!active.length) return null;

  return (
    <Card className="overflow-hidden border shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Tour-Live-Hub</span>
          <span className="text-[10px] text-muted-foreground font-medium">({active.length} aktiv)</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {active.map(tour => {
            const sc = getScoreColor(tour.score);
            const isExpanded = expanded === tour.id;
            return (
              <div key={tour.id}>
                <button
                  onClick={() => setExpanded(isExpanded ? null : tour.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold truncate">{tour.driverName}</span>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', sc.cls)}>
                        {sc.label} ({tour.score}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden w-full">
                      <div
                        className={cn('h-full rounded-full transition-all', tour.score >= 80 ? 'bg-emerald-500' : tour.score >= 55 ? 'bg-amber-400' : 'bg-red-500')}
                        style={{ width: `${tour.pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {tour.done}/{tour.stops.length} Stops · {tour.pct}% erledigt
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="bg-slate-50 border-t px-4 py-2 space-y-1.5">
                    {tour.stops.map((stop, idx) => {
                      const done = !!stop.geliefert_am;
                      const delta = getEtaDelta(stop);
                      return (
                        <div key={stop.id} className={cn('flex items-start gap-2 rounded-lg px-2 py-1.5', done ? 'bg-emerald-50/60' : 'bg-white border border-slate-100')}>
                          <div className={cn('mt-0.5 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0',
                            done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>
                            {done ? '✓' : (stop.reihenfolge ?? idx + 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-semibold truncate">
                              {stop.order?.kunde_name ?? `Stopp ${idx + 1}`}
                            </div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {stop.order?.kunde_adresse ?? '—'}
                            </div>
                          </div>
                          {delta && (
                            <span className={cn('text-[10px] font-bold shrink-0',
                              delta === 'Pünktlich' || delta.startsWith('-') ? 'text-emerald-600' : 'text-orange-600')}>
                              {delta}
                            </span>
                          )}
                          {!done && !stop.angekommen_am && (
                            <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-0.5">
                              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Unterwegs
                            </span>
                          )}
                          {!done && stop.angekommen_am && (
                            <span className="text-[10px] text-amber-600 font-bold shrink-0">Ankgk.</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
