'use client';

/**
 * Phase 2635 — Smart-Kochzeit-Ampel-Board
 *
 * Farbkodiertes Echtzeit-Board für aktive Küchen-Batches:
 * - Ampel grün (>5 Min) / gelb (1–5 Min) / rot (überfällig)
 * - Countdown in Sekunden, 1-Sek-Tick + 30-Sek-Polling
 * - Kacheln sortiert nach Dringlichkeit (überfällig zuerst)
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, AlertTriangle, Clock, CheckCircle2, Loader2 } from 'lucide-react';

type BatchUrgency = 'on_track' | 'due_soon' | 'overdue';

interface BatchData {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  estimatedPrepMin: number;
  remainingMin: number;
  urgency: BatchUrgency;
  driverName: string | null;
}

interface ApiResponse {
  batches: BatchData[];
  summary: {
    activeBatches: number;
    overdueCount: number;
    dueSoonCount: number;
    avgRemainingMin: number | null;
  };
}

function urgencyMeta(u: BatchUrgency): { bg: string; border: string; ring: string; dot: string; label: string } {
  switch (u) {
    case 'overdue':  return { bg: 'bg-red-50',    border: 'border-red-200',    ring: 'ring-red-400',    dot: 'bg-red-500',    label: 'Überfällig' };
    case 'due_soon': return { bg: 'bg-amber-50',  border: 'border-amber-200',  ring: 'ring-amber-400',  dot: 'bg-amber-500',  label: 'Bald fällig' };
    default:         return { bg: 'bg-matcha-50', border: 'border-matcha-200', ring: 'ring-matcha-400', dot: 'bg-matcha-500', label: 'Im Plan'     };
  }
}

function fmtCountdown(minFloat: number): string {
  const totalSec = Math.round(minFloat * 60);
  if (totalSec <= 0) {
    const over = Math.abs(totalSec);
    const m = Math.floor(over / 60);
    const s = over % 60;
    return `-${m}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase2635SmartKochzeitAmpelBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!locationId) return;
    setLoading(prev => data === null ? true : prev);
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-batch-countdown?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        setData(json);
      }
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 30_000);
    intervalRef.current = setInterval(() => setTick(t => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const sorted = data?.batches
    ? [...data.batches].sort((a, b) => a.remainingMin - b.remainingMin)
    : [];

  const tickAdjusted = sorted.map(b => ({
    ...b,
    displayRemain: b.remainingMin - tick / 60,
  }));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-matcha-50/50">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-matcha-700">
            Kochzeit-Ampel
          </span>
          {data?.summary && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {data.summary.activeBatches} aktiv
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data?.summary && data.summary.overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {data.summary.overdueCount} überfällig
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {tickAdjusted.length === 0 && !loading && (
        <div className="flex items-center justify-center gap-2 px-5 py-6 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
          Keine aktiven Batches
        </div>
      )}

      {tickAdjusted.length > 0 && (
        <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
          {tickAdjusted.map((b) => {
            const meta = urgencyMeta(b.urgency);
            const pct = Math.max(0, Math.min(100,
              (b.displayRemain / b.estimatedPrepMin) * 100
            ));

            return (
              <div
                key={b.batchId}
                className={cn(
                  'relative rounded-xl border p-3 flex flex-col gap-2 transition-all',
                  meta.bg, meta.border,
                  b.urgency === 'overdue' && 'ring-2 ' + meta.ring,
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full', meta.dot)} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Zone {b.zone ?? '?'}
                    </span>
                  </div>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {b.ordersCount} Best.
                  </span>
                </div>

                <div className={cn(
                  'font-mono text-2xl font-black tabular-nums leading-none text-center',
                  b.urgency === 'overdue'  ? 'text-red-600' :
                  b.urgency === 'due_soon' ? 'text-amber-600' :
                  'text-matcha-700'
                )}>
                  {fmtCountdown(b.displayRemain)}
                </div>

                <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000',
                      b.urgency === 'overdue'  ? 'bg-red-500' :
                      b.urgency === 'due_soon' ? 'bg-amber-500' :
                      'bg-matcha-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {b.driverName && (
                  <div className="text-[9px] text-muted-foreground truncate font-medium">
                    {b.driverName}
                  </div>
                )}

                <div className={cn(
                  'text-[9px] font-bold text-center',
                  b.urgency === 'overdue'  ? 'text-red-600' :
                  b.urgency === 'due_soon' ? 'text-amber-600' :
                  'text-matcha-600'
                )}>
                  {meta.label}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data?.summary && data.summary.avgRemainingMin !== null && (
        <div className="border-t px-5 py-2 flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Ø verbleibend:{' '}
            <span className="font-bold text-foreground">
              {Math.round(data.summary.avgRemainingMin)} Min
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
