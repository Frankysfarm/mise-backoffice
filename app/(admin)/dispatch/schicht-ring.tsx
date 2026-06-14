'use client';

/**
 * DispatchSchichtRing — Phase 165
 *
 * Kreisförmiger Schicht-Fortschrittsring für den Dispatch.
 * Zeigt auf einen Blick: Wie viele Stops wurden heute erledigt?
 * - Gesamt-Stops geliefert / gesamt beauftragt
 * - Aktive Touren (laufend)
 * - Ø Zeit pro Stop
 * - SLA-Quote (Pünktlichkeit)
 *
 * Anders als TourHealthStrip (per-Tour-Balken) und
 * DriverLeaderboardStrip (per-Fahrer-Ranking):
 * → Dieser Ring zeigt den SCHICHT-GESAMTFORTSCHRITT auf Makroebene.
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Package, Target, TrendingUp, Zap } from 'lucide-react';

type Batch = {
  id: string;
  status: string;
  started_at?: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  stops: {
    id: string;
    geliefert_am: string | null;
    angekommen_am?: string | null;
    order: { eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
};

interface ShiftStats {
  totalStops: number;
  deliveredStops: number;
  activeTours: number;
  avgMinPerStop: number | null;
  slaOnTimePct: number | null;
}

function computeStats(batches: Batch[], shiftStart: Date): ShiftStats {
  const shiftBatches = batches.filter(b => {
    const t = b.startzeit ?? b.started_at;
    return t ? new Date(t) >= shiftStart : true;
  });

  let totalStops = 0;
  let deliveredStops = 0;
  let activeTours = 0;
  let onTime = 0;
  let lateCount = 0;
  const stopTimes: number[] = [];

  for (const batch of shiftBatches) {
    if (['unterwegs', 'on_route', 'created', 'assigned'].includes(batch.status)) {
      activeTours++;
    }
    for (const stop of batch.stops) {
      totalStops++;
      if (stop.geliefert_am) {
        deliveredStops++;
        const delivMs = new Date(stop.geliefert_am).getTime();
        const startMs = batch.startzeit || batch.started_at ? new Date((batch.startzeit ?? batch.started_at)!).getTime() : null;
        if (startMs) {
          stopTimes.push((delivMs - startMs) / 60_000);
        }
        if (stop.order?.eta_latest) {
          const etaMs = new Date(stop.order.eta_latest).getTime();
          if (delivMs <= etaMs + 5 * 60_000) onTime++;
          else lateCount++;
        }
      }
    }
  }

  const totalRated = onTime + lateCount;
  return {
    totalStops,
    deliveredStops,
    activeTours,
    avgMinPerStop: stopTimes.length > 0
      ? Math.round(stopTimes.reduce((a, b) => a + b, 0) / stopTimes.length)
      : null,
    slaOnTimePct: totalRated > 0 ? Math.round((onTime / totalRated) * 100) : null,
  };
}

function AnimatedRing({
  pct,
  size = 96,
  strokeWidth = 8,
  color,
  children,
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const [rendered, setRendered] = useState(0);
  const target = Math.min(100, Math.max(0, pct));

  useEffect(() => {
    const timeout = setTimeout(() => setRendered(target), 80);
    return () => clearTimeout(timeout);
  }, [target]);

  const dashOffset = circumference * (1 - rendered / 100);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 absolute inset-0">
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground/15"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.25,0.46,0.45,0.94)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function DispatchSchichtRing({
  batches,
  schichtStart,
}: {
  batches: Batch[];
  schichtStart?: Date;
}) {
  const [open, setOpen] = useState(false);
  const supabase = createClient();
  const [todayDelivered, setTodayDelivered] = useState<number | null>(null);
  const mountedRef = useRef(true);

  const shiftStart = schichtStart ?? (() => {
    const d = new Date();
    d.setHours(6, 0, 0, 0);
    return d;
  })();

  const stats = computeStats(batches, shiftStart);
  const ringPct = stats.totalStops > 0 ? (stats.deliveredStops / stats.totalStops) * 100 : 0;

  // Load total delivered today from Supabase for reference
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    supabase
      .from('batch_stops')
      .select('id', { count: 'exact', head: true })
      .not('geliefert_am', 'is', null)
      .gte('geliefert_am', today.toISOString())
      .then(({ count }: { count: number | null }) => {
        if (mountedRef.current) setTodayDelivered(count ?? null);
      });
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slaColor =
    stats.slaOnTimePct == null ? '#6b7280'
    : stats.slaOnTimePct >= 90 ? '#22c55e'
    : stats.slaOnTimePct >= 75 ? '#f59e0b'
    : '#ef4444';

  const ringColor =
    ringPct >= 80 ? '#22c55e'
    : ringPct >= 50 ? '#3b82f6'
    : '#f59e0b';

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition"
        aria-label="Schicht-Ring öffnen/schließen"
      >
        <AnimatedRing pct={ringPct} size={52} strokeWidth={5} color={ringColor}>
          <span className="text-[10px] font-black tabular-nums" style={{ color: ringColor }}>
            {Math.round(ringPct)}%
          </span>
        </AnimatedRing>
        <div className="flex-1 min-w-0">
          <div className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Schicht-Fortschritt
          </div>
          <div className="text-sm font-black text-foreground mt-0.5">
            {stats.deliveredStops} / {stats.totalStops} Stops geliefert
          </div>
          {stats.activeTours > 0 && (
            <div className="text-[10px] text-blue-600 font-semibold mt-0.5">
              {stats.activeTours} Tour{stats.activeTours !== 1 ? 'en' : ''} aktiv
            </div>
          )}
        </div>
        {stats.slaOnTimePct != null && (
          <div className="text-right flex-shrink-0">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">SLA</div>
            <div className={cn('text-lg font-black tabular-nums', {
              'text-matcha-600': stats.slaOnTimePct >= 90,
              'text-amber-600': stats.slaOnTimePct >= 75 && stats.slaOnTimePct < 90,
              'text-red-600': stats.slaOnTimePct < 75,
            })}>
              {stats.slaOnTimePct}%
            </div>
          </div>
        )}
      </button>

      {open && (
        <div className="border-t px-4 py-4">
          <div className="flex items-center justify-center gap-8 mb-4">
            {/* Main ring */}
            <AnimatedRing pct={ringPct} size={96} strokeWidth={8} color={ringColor}>
              <div className="text-center">
                <div className="font-mono text-lg font-black tabular-nums leading-none" style={{ color: ringColor }}>
                  {Math.round(ringPct)}%
                </div>
                <div className="text-[9px] text-muted-foreground font-bold uppercase">Erledigt</div>
              </div>
            </AnimatedRing>

            {/* SLA ring */}
            {stats.slaOnTimePct != null && (
              <AnimatedRing pct={stats.slaOnTimePct} size={72} strokeWidth={6} color={slaColor}>
                <div className="text-center">
                  <div className="font-mono text-sm font-black tabular-nums leading-none" style={{ color: slaColor }}>
                    {stats.slaOnTimePct}%
                  </div>
                  <div className="text-[8px] text-muted-foreground font-bold uppercase">SLA</div>
                </div>
              </AnimatedRing>
            )}
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KpiCell icon={<Package className="h-3.5 w-3.5" />} label="Geliefert" value={String(stats.deliveredStops)} sub={`von ${stats.totalStops}`} />
            <KpiCell icon={<Zap className="h-3.5 w-3.5" />} label="Aktive Touren" value={String(stats.activeTours)} accent={stats.activeTours > 0} />
            {stats.avgMinPerStop != null && (
              <KpiCell
                icon={<Clock className="h-3.5 w-3.5" />}
                label="Ø Min/Stop"
                value={`${stats.avgMinPerStop} Min`}
                danger={stats.avgMinPerStop > 20}
              />
            )}
            {todayDelivered != null && (
              <KpiCell icon={<TrendingUp className="h-3.5 w-3.5" />} label="Heute gesamt" value={String(todayDelivered)} sub="alle Schichten" />
            )}
            {stats.slaOnTimePct != null && (
              <KpiCell
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Pünktlich"
                value={`${stats.slaOnTimePct}%`}
                accent={stats.slaOnTimePct >= 90}
                danger={stats.slaOnTimePct < 75}
              />
            )}
            <KpiCell icon={<Target className="h-3.5 w-3.5" />} label="Pending" value={String(stats.totalStops - stats.deliveredStops)} />
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCell({
  icon, label, value, sub, accent = false, danger = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5',
      accent && 'bg-matcha-50 border-matcha-200',
      danger && 'bg-red-50 border-red-200',
      !accent && !danger && 'bg-muted/30',
    )}>
      <div className={cn(
        'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide mb-1',
        accent ? 'text-matcha-600' : danger ? 'text-red-600' : 'text-muted-foreground',
      )}>
        {icon}
        {label}
      </div>
      <div className={cn(
        'font-display text-xl font-black tabular-nums leading-none',
        accent ? 'text-matcha-700' : danger ? 'text-red-700' : 'text-foreground',
      )}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
