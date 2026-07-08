'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BatchCountdown {
  batchId: string;
  zone: string | null;
  ordersCount: number;
  remainingMin: number;
  elapsedMin: number;
  estimatedPrepMin: number;
  urgency: 'on_track' | 'due_soon' | 'overdue';
  status: string;
  driverName: string | null;
}

interface Summary {
  activeBatches: number;
  overdueCount: number;
  dueSoonCount: number;
  avgRemainingMin: number | null;
}

interface ApiResponse {
  ok: boolean;
  batches: BatchCountdown[];
  summary: Summary;
}

interface Props {
  locationId: string | null;
}

function urgencyStyle(u: BatchCountdown['urgency']) {
  switch (u) {
    case 'overdue':
      return {
        bg: 'bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-700/50',
        badge: 'bg-red-500 text-white',
        bar: 'bg-red-500',
        timer: 'text-red-600 dark:text-red-400',
        label: 'Überfällig',
        icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500" />,
      };
    case 'due_soon':
      return {
        bg: 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700/50',
        badge: 'bg-amber-500 text-white',
        bar: 'bg-amber-500',
        timer: 'text-amber-700 dark:text-amber-400',
        label: 'Gleich fällig',
        icon: <Clock className="h-3.5 w-3.5 text-amber-500" />,
      };
    default:
      return {
        bg: 'bg-matcha-50 border-matcha-200 dark:bg-matcha-950/20 dark:border-matcha-800/40',
        badge: 'bg-matcha-500 text-white',
        bar: 'bg-matcha-500',
        timer: 'text-matcha-700 dark:text-matcha-400',
        label: 'Im Plan',
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />,
      };
  }
}

function CountdownRing({ pct, urgency }: { pct: number; urgency: BatchCountdown['urgency'] }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const color = urgency === 'overdue' ? '#ef4444' : urgency === 'due_soon' ? '#f59e0b' : '#6b9f4e';

  return (
    <svg width={52} height={52} className="-rotate-90 shrink-0">
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={5} />
      <circle
        cx={26} cy={26} r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
    </svg>
  );
}

export function KitchenPhase785SmartCountdownCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kitchen-batch-countdown?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {}
    }

    load();
    const poll = setInterval(load, 15_000);
    return () => { active = false; clearInterval(poll); };
  }, [locationId]);

  // 1-second tick for countdown display
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!data || data.batches.length === 0) return null;

  const { summary } = data;
  const sorted = [...data.batches].sort((a, b) => {
    const order = { overdue: 0, due_soon: 1, on_track: 2 };
    return order[a.urgency] - order[b.urgency];
  });

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/50 text-matcha-700 dark:text-matcha-400">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Smart Countdown · Farbkodierung
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            {summary.activeBatches} aktive Batches
            {summary.overdueCount > 0 && (
              <span className="ml-2 text-red-500 font-bold">
                · {summary.overdueCount} überfällig
              </span>
            )}
            {summary.dueSoonCount > 0 && (
              <span className="ml-2 text-amber-500 font-bold">
                · {summary.dueSoonCount} gleich fällig
              </span>
            )}
          </div>
        </div>
        {summary.avgRemainingMin !== null && (
          <div className="text-right shrink-0">
            <div className="text-sm font-black tabular-nums text-stone-700 dark:text-stone-200">
              ~{Math.round(summary.avgRemainingMin)} Min
            </div>
            <div className="text-[9px] text-stone-400">Ø verbleibend</div>
          </div>
        )}
      </div>

      {/* Batch rows */}
      <div className="divide-y divide-stone-100 dark:divide-stone-800">
        {sorted.map((b) => {
          const style = urgencyStyle(b.urgency);
          const totalMin = b.elapsedMin + Math.max(b.remainingMin, 0);
          const pct = totalMin > 0 ? (b.elapsedMin / totalMin) * 100 : 0;
          const remaining = b.urgency === 'overdue'
            ? `+${Math.abs(Math.round(b.remainingMin))} Min überfällig`
            : `${Math.round(b.remainingMin)} Min verbleibend`;

          return (
            <div
              key={b.batchId}
              className={cn(
                'flex items-center gap-3 px-4 py-3 border-l-4 transition-colors',
                style.bg,
                b.urgency === 'overdue' ? 'border-l-red-500' :
                b.urgency === 'due_soon' ? 'border-l-amber-500' : 'border-l-matcha-500',
              )}
            >
              {/* SVG ring */}
              <div className="relative shrink-0">
                <CountdownRing pct={pct} urgency={b.urgency} />
                <div className="absolute inset-0 flex items-center justify-center rotate-90">
                  <span className="text-[9px] font-black tabular-nums text-stone-700 dark:text-stone-200">
                    {Math.round(b.elapsedMin)}m
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {style.icon}
                  <span className="text-xs font-bold text-stone-800 dark:text-stone-100">
                    {b.zone ? `Zone ${b.zone}` : 'Batch'}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', style.badge)}>
                    {style.label}
                  </span>
                  {b.driverName && (
                    <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                      · {b.driverName}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <span className={cn('text-[10px] font-bold tabular-nums shrink-0', style.timer)}>
                    {remaining}
                  </span>
                </div>
                <div className="mt-0.5 text-[9px] text-stone-400">
                  {b.ordersCount} Bestellung{b.ordersCount !== 1 ? 'en' : ''} · Ziel: {b.estimatedPrepMin} Min
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
