'use client';

import { useEffect, useState } from 'react';
import { Timer, ChevronDown, ChevronUp, Loader2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type BatchUrgency = 'on_track' | 'due_soon' | 'overdue';

interface KitchenBatchCountdown {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  startedAt: string | null;
  estimatedPrepMin: number;
  elapsedMin: number;
  remainingMin: number;
  urgency: BatchUrgency;
  status: string;
  driverName: string | null;
}

interface BatchCountdownSummary {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  avgRemainingMin: number | null;
}

interface ApiResponse {
  ok: boolean;
  batches: KitchenBatchCountdown[];
  summary: BatchCountdownSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const urgencyStyle: Record<BatchUrgency, {
  row: string; badge: string; badgeLabel: string; timeColor: string; icon: React.ReactNode; bar: string;
}> = {
  overdue:  {
    row: 'border-red-200 bg-red-50/60',
    badge: 'bg-red-100 text-red-700',
    badgeLabel: 'Überfällig',
    timeColor: 'text-red-600 font-black',
    icon: <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />,
    bar: 'bg-red-400',
  },
  due_soon: {
    row: 'border-amber-200 bg-amber-50/50',
    badge: 'bg-amber-100 text-amber-700',
    badgeLabel: 'Bald fällig',
    timeColor: 'text-amber-600 font-bold',
    icon: <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />,
    bar: 'bg-amber-400',
  },
  on_track: {
    row: 'border-matcha-100 bg-matcha-50/30',
    badge: 'bg-matcha-100 text-matcha-700',
    badgeLabel: 'Im Plan',
    timeColor: 'text-matcha-700 font-bold',
    icon: <CheckCircle className="h-4 w-4 text-matcha-500 shrink-0 mt-0.5" />,
    bar: 'bg-matcha-400',
  },
};

export function KitchenBatchCountdown({ locationId }: Props) {
  const [batches, setBatches] = useState<KitchenBatchCountdown[]>([]);
  const [summary, setSummary] = useState<BatchCountdownSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/kitchen-batch-countdown?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => {
        setBatches(d.batches ?? []);
        setSummary(d.summary ?? null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const hasOverdue = (summary?.overdueCount ?? 0) > 0;
  const hasBatches = batches.length > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Timer className={cn('h-4 w-4', hasOverdue ? 'text-red-500' : hasBatches ? 'text-amber-500' : 'text-muted-foreground')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Batch-Fertigstellungs-Countdown
          </span>
          {summary && summary.overdueCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {summary.overdueCount} überfällig
            </span>
          )}
          {summary && summary.overdueCount === 0 && summary.activeBatches > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {summary.activeBatches} aktiv
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Overdue alert banner */}
          {!loading && hasOverdue && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-sm font-bold text-red-700">
                {summary!.overdueCount} Batch{summary!.overdueCount > 1 ? 'es' : ''} überfällig — Fahrer wartet!
              </span>
            </div>
          )}

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Lade Batches…
            </div>
          )}

          {!loading && summary && hasBatches && (
            <div className="grid grid-cols-3 gap-3">
              <div className={cn('rounded-lg border px-3 py-2 text-center', hasOverdue ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100')}>
                <div className={cn('text-2xl font-black tabular-nums', hasOverdue ? 'text-red-700' : 'text-slate-700')}>
                  {summary.activeBatches}
                </div>
                <div className={cn('text-[10px] font-bold uppercase tracking-wide mt-0.5', hasOverdue ? 'text-red-500' : 'text-slate-500')}>
                  Aktive Batches
                </div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-center">
                <div className="text-2xl font-black tabular-nums text-amber-700">
                  {summary.overdueCount + summary.dueSoonCount}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-amber-500 mt-0.5">Kritisch</div>
              </div>
              <div className="rounded-lg bg-matcha-50 border border-matcha-100 px-3 py-2 text-center">
                <div className="text-2xl font-black tabular-nums text-matcha-700">
                  {summary.avgRemainingMin !== null ? `${summary.avgRemainingMin}` : '—'}
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-matcha-500 mt-0.5">Ø Rest (Min)</div>
              </div>
            </div>
          )}

          {!loading && !hasBatches && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <CheckCircle className="h-4 w-4 text-matcha-500" />
              Keine aktiven Batches in Vorbereitung.
            </div>
          )}

          {!loading && hasBatches && (
            <div className="space-y-2">
              {batches.map((batch) => {
                const us = urgencyStyle[batch.urgency];
                const progressPct = Math.min(100, (batch.elapsedMin / batch.estimatedPrepMin) * 100);

                return (
                  <div
                    key={batch.batchId}
                    className={cn('flex items-start gap-3 rounded-lg border px-3 py-2.5', us.row)}
                  >
                    {us.icon}

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {batch.zone && (
                          <span className="font-bold text-xs">Zone {batch.zone}</span>
                        )}
                        <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', us.badge)}>
                          {us.badgeLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {batch.ordersCount} Bestellung{batch.ordersCount !== 1 ? 'en' : ''}
                        </span>
                        {batch.status === 'bereit' && (
                          <span className="text-[9px] rounded-full bg-matcha-100 px-1.5 py-0.5 font-bold text-matcha-700">
                            Bereit
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-700', us.bar)}
                            style={{ width: `${Math.min(100, progressPct)}%` }}
                          />
                        </div>
                        <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                          {batch.elapsedMin}/{batch.estimatedPrepMin} Min
                        </span>
                      </div>

                      {batch.driverName && (
                        <div className="text-[10px] text-muted-foreground">
                          Fahrer: {batch.driverName}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className={cn('text-sm tabular-nums', us.timeColor)}>
                        {batch.urgency === 'overdue'
                          ? `+${Math.abs(batch.remainingMin)} Min`
                          : `${batch.remainingMin} Min`}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {batch.urgency === 'overdue' ? 'überfällig' : 'verbleibend'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!locationId && (
            <div className="text-sm text-muted-foreground">Bitte Filiale auswählen.</div>
          )}
        </div>
      )}
    </div>
  );
}
