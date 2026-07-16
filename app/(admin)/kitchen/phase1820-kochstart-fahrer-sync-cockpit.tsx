'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Zap } from 'lucide-react';

type KochstartFahrerSyncRow = {
  orderId: string;
  orderNum: string;
  kundeName: string;
  cookStartAt: string | null;
  readyTarget: string | null;
  prepMin: number | null;
  timingStatus: string;
  driverEtaMs: number | null;
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

function fmtSec(sec: number): string {
  const m = Math.floor(Math.abs(sec) / 60);
  const s = Math.abs(sec) % 60;
  return (sec < 0 ? '-' : '') + `${m}:${String(s).padStart(2, '0')}`;
}

type SyncStatus = 'perfekt' | 'ok' | 'kritisch' | 'konflikt';

function getSyncStatus(secToReady: number | null, secToDriver: number | null): SyncStatus {
  if (secToReady === null || secToDriver === null) return 'ok';
  const delta = secToDriver - secToReady;
  if (delta >= 0 && delta <= 120) return 'perfekt';
  if (delta > 120) return 'ok';
  if (delta < -300) return 'konflikt';
  return 'kritisch';
}

const STATUS_STYLES: Record<SyncStatus, { bg: string; border: string; badge: string; label: string; icon: typeof CheckCircle2 }> = {
  perfekt:  { bg: 'bg-accent/5',     border: 'border-accent/40',      badge: 'bg-accent text-matcha-900',          label: '✓ Perfekt',   icon: CheckCircle2 },
  ok:       { bg: 'bg-blue-500/5',   border: 'border-blue-400/30',    badge: 'bg-blue-500 text-white',             label: 'OK',          icon: ChefHat },
  kritisch: { bg: 'bg-amber-500/5',  border: 'border-amber-400/40',   badge: 'bg-amber-500 text-white',            label: '! Knapp',     icon: Clock },
  konflikt: { bg: 'bg-red-500/5',    border: 'border-red-400/40',     badge: 'bg-red-500 text-white',              label: '⚠ Konflikt',  icon: AlertTriangle },
};

export function KitchenPhase1820KochstartFahrerSyncCockpit({
  orders,
  timings,
  batches,
  stops,
}: {
  orders: { id: string; bestellnummer: string; kunde_name: string; status: string }[];
  timings: { id: string; order_id: string; cook_start_at: string | null; ready_target: string | null; prep_min: number | null; status: string }[];
  batches: { id: string; driver_id: string; status: string; started_at: string | null; total_eta_min: number | null }[];
  stops: { id: string; batch_id: string; order_id: string; reihenfolge: number; geliefert_am: string | null }[];
}) {
  useTick();

  const now = Date.now();

  const rows: KochstartFahrerSyncRow[] = timings
    .filter(t => ['scheduled', 'cooking'].includes(t.status))
    .map(t => {
      const order = orders.find(o => o.id === t.order_id);
      if (!order) return null;

      const stop = stops.find(s => s.order_id === t.order_id && !s.geliefert_am);
      let driverEtaMs: number | null = null;
      if (stop) {
        const batch = batches.find(b => b.id === stop.batch_id);
        if (batch?.started_at && batch.total_eta_min != null) {
          driverEtaMs = new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000;
        }
      }

      return {
        orderId: order.id,
        orderNum: order.bestellnummer,
        kundeName: order.kunde_name,
        cookStartAt: t.cook_start_at,
        readyTarget: t.ready_target,
        prepMin: t.prep_min,
        timingStatus: t.status,
        driverEtaMs,
      } satisfies KochstartFahrerSyncRow;
    })
    .filter((r): r is KochstartFahrerSyncRow => r !== null);

  if (rows.length === 0) return null;

  const conflicts = rows.filter(r => {
    const secToReady = r.readyTarget ? Math.floor((new Date(r.readyTarget).getTime() - now) / 1000) : null;
    const secToDriver = r.driverEtaMs ? Math.floor((r.driverEtaMs - now) / 1000) : null;
    return getSyncStatus(secToReady, secToDriver) === 'konflikt';
  }).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-matcha-900/30 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <Zap className="h-4 w-4 text-accent shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-accent">
          Kochstart · Fahrer-Sync
        </span>
        {conflicts > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-400 animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {conflicts} Konflikt{conflicts > 1 ? 'e' : ''}
          </span>
        )}
      </div>

      <div className="divide-y divide-white/5">
        {rows.map(row => {
          const secToReady = row.readyTarget
            ? Math.floor((new Date(row.readyTarget).getTime() - now) / 1000)
            : null;
          const secToDriver = row.driverEtaMs
            ? Math.floor((row.driverEtaMs - now) / 1000)
            : null;
          const status = getSyncStatus(secToReady, secToDriver);
          const st = STATUS_STYLES[status];

          return (
            <div key={row.orderId} className={cn('flex items-center gap-3 px-4 py-3', st.bg)}>
              {/* Status badge */}
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[64px] text-center', st.badge)}>
                {st.label}
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-matcha-100 truncate">{row.kundeName}</div>
                <div className="text-[9px] text-matcha-500">{row.orderNum}</div>
              </div>

              {/* Timing columns */}
              <div className="flex items-center gap-3 shrink-0">
                {/* Cook ready */}
                <div className="text-right">
                  <div className={cn(
                    'text-sm font-mono font-black tabular-nums',
                    secToReady === null ? 'text-matcha-500'
                      : secToReady < 0 ? 'text-red-400 animate-pulse'
                      : secToReady < 120 ? 'text-amber-400'
                      : 'text-accent',
                  )}>
                    {secToReady !== null ? fmtSec(secToReady) : '--:--'}
                  </div>
                  <div className="text-[8px] text-matcha-600">fertig</div>
                </div>

                {/* Divider */}
                <div className="h-5 w-px bg-white/10" />

                {/* Driver ETA */}
                <div className="text-right">
                  <div className={cn(
                    'text-sm font-mono font-black tabular-nums',
                    secToDriver === null ? 'text-matcha-500'
                      : secToDriver < 60 ? 'text-accent'
                      : secToDriver < 300 ? 'text-amber-400'
                      : 'text-matcha-300',
                  )}>
                    {secToDriver !== null ? fmtSec(secToDriver) : '--:--'}
                  </div>
                  <div className="text-[8px] text-matcha-600">fahrer</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-2 border-t border-white/5">
        {Object.entries(STATUS_STYLES).map(([k, v]) => (
          <span key={k} className={cn('inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[8px] font-bold', v.badge)}>
            {v.label}
          </span>
        ))}
      </div>
    </div>
  );
}
