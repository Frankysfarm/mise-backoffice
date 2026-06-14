'use client';

/**
 * DispatchTourKpiRing — Donut-Chart für aktive Touren-Status heute.
 *
 * Zeigt als SVG-Ringe:
 *  - Abgeschlossene Touren (Grün)
 *  - Aktive Touren unterwegs (Blau)
 *  - Wartende Touren (Gelb)
 *
 * Gibt einen schnellen Überblick: "Wie läuft heute der Betrieb?"
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Route, Truck } from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type TourStats = {
  total: number;
  completed: number;
  active: number;
  waiting: number;
  avgEtaMin: number | null;
};

function DonutRing({
  completed,
  active,
  waiting,
  size = 80,
}: {
  completed: number;
  active: number;
  waiting: number;
  size?: number;
}) {
  const total = completed + active + waiting;
  if (total === 0) return null;

  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const gap = 2; // gap between segments in px

  const completedPct = total > 0 ? completed / total : 0;
  const activePct    = total > 0 ? active / total : 0;
  const waitingPct   = total > 0 ? waiting / total : 0;

  const completedDash = completedPct * circ;
  const activeDash    = activePct * circ;
  const waitingDash   = waitingPct * circ;

  const completedOffset = 0;
  const activeOffset    = circ - completedDash;
  const waitingOffset   = circ - completedDash - activeDash;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      {/* Track */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth={7} />
      {/* Waiting (yellow) */}
      {waiting > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#f59e0b" strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, waitingDash - gap)} ${circ - Math.max(0, waitingDash - gap)}`}
          strokeDashoffset={waitingOffset}
        />
      )}
      {/* Active (blue) */}
      {active > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#3b82f6" strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, activeDash - gap)} ${circ - Math.max(0, activeDash - gap)}`}
          strokeDashoffset={activeOffset}
        />
      )}
      {/* Completed (green) */}
      {completed > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#22c55e" strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={`${Math.max(0, completedDash - gap)} ${circ - Math.max(0, completedDash - gap)}`}
          strokeDashoffset={completedOffset}
        />
      )}
    </svg>
  );
}

export function DispatchTourKpiRing() {
  const supabase = createClient();
  const [stats, setStats] = useState<TourStats | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data: batches } = await supabase
        .from('mise_delivery_batches')
        .select('id, state, total_eta_min')
        .eq('location_id', LOCATION_ID)
        .gte('created_at', todayStart.toISOString());

      const rows = batches ?? [];
      const completed = rows.filter(b =>
        b.state === 'completed' || b.state === 'delivered',
      ).length;
      const active = rows.filter(b =>
        b.state === 'on_route' || b.state === 'at_restaurant' || b.state === 'assigned',
      ).length;
      const waiting = rows.filter(b =>
        b.state === 'pending_acceptance' || b.state === 'pending',
      ).length;

      const etaVals = rows
        .map((b: { total_eta_min: number | null }) => b.total_eta_min)
        .filter((v: number | null): v is number => v != null);
      const avgEtaMin =
        etaVals.length > 0
          ? Math.round(etaVals.reduce((s: number, v: number) => s + v, 0) / etaVals.length)
          : null;

      setStats({ total: rows.length, completed, active, waiting, avgEtaMin });
    } catch {}
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !stats || stats.total === 0) return null;

  const completePct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2 mb-2">
        <Route className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-sm font-bold">Touren heute</span>
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
          {stats.total} gesamt
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative shrink-0">
          <DonutRing
            completed={stats.completed}
            active={stats.active}
            waiting={stats.waiting}
            size={80}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-black tabular-nums text-foreground">{completePct}%</span>
            <span className="text-[8px] text-muted-foreground uppercase">fertig</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground">Abgeschlossen</span>
            <span className="ml-auto font-black text-sm tabular-nums text-green-600">{stats.completed}</span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <span className="text-[11px] text-muted-foreground">Unterwegs</span>
            <span className="ml-auto font-black text-sm tabular-nums text-blue-600">{stats.active}</span>
          </div>
          {stats.waiting > 0 && (
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-amber-400 shrink-0" />
              <span className="text-[11px] text-muted-foreground">Wartend</span>
              <span className="ml-auto font-black text-sm tabular-nums text-amber-600">{stats.waiting}</span>
            </div>
          )}
          {stats.avgEtaMin != null && (
            <div className={cn(
              'mt-1 rounded-lg px-2 py-1 text-[10px] font-bold',
              stats.avgEtaMin <= 25 ? 'bg-green-50 text-green-700' :
              stats.avgEtaMin <= 35 ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-700',
            )}>
              Ø {stats.avgEtaMin} Min ETA
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
