'use client';

/**
 * Phase 2780 — Küchen-Dispatch-Sync-Cockpit
 * Einheitliche Cross-System-Ansicht: Küche → Dispatch → Fahrer
 * Zeigt für jede aktive Bestellung: Prep-Status, Fahrer-ETA, Kochstart-Empfehlung
 * Polling: 20 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, Clock, Zap, AlertTriangle, CheckCircle2, ArrowRight, Timer } from 'lucide-react';

type SyncOrder = {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  status: string;
  created_at: string;
  eta_earliest: string | null;
  driver_name: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
};

type Phase = 'prep' | 'ready' | 'pickup' | 'on_route' | 'done';

function classifyPhase(status: string): Phase {
  if (['geliefert', 'storniert'].includes(status)) return 'done';
  if (['unterwegs', 'abgeholt'].includes(status)) return 'on_route';
  if (status === 'fertig') return 'pickup';
  if (status === 'in_zubereitung') return 'prep';
  return 'prep';
}

function secsUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function fmtMmSs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function prepColor(secs: number | null): 'green' | 'yellow' | 'red' {
  if (secs === null) return 'yellow';
  if (secs > 600) return 'green';
  if (secs > 180) return 'yellow';
  return 'red';
}

const COLOR = {
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
};

const PHASE_LABEL: Record<Phase, { label: string; icon: React.ElementType; cls: string }> = {
  prep:     { label: 'Zubereitung', icon: ChefHat,       cls: 'text-orange-400' },
  ready:    { label: 'Abholbereit', icon: CheckCircle2,   cls: 'text-green-400' },
  pickup:   { label: 'Abholung',    icon: Bike,           cls: 'text-blue-400' },
  on_route: { label: 'Unterwegs',   icon: ArrowRight,     cls: 'text-purple-400' },
  done:     { label: 'Erledigt',    icon: CheckCircle2,   cls: 'text-gray-400' },
};

export function KitchenPhase2780KuechenDispatchSyncCockpit({
  locationId,
}: {
  locationId?: string;
}) {
  const [orders, setOrders] = useState<SyncOrder[]>([]);
  const [tick, setTick] = useState(0);
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const q = supabase
      .from('customer_orders')
      .select(`
        id, bestellnummer, kunde_name, status, created_at, eta_earliest,
        batch:mise_delivery_batches(
          driver:mise_drivers(name, last_lat, last_lng)
        )
      `)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'abgeholt', 'unterwegs'])
      .order('created_at', { ascending: true })
      .limit(12);

    if (locationId) q.eq('location_id', locationId);

    const { data } = await q;
    if (!data) return;

    setOrders(
      data.map((o: any) => {
        const batch = Array.isArray(o.batch) ? o.batch[0] : o.batch;
        const driver = batch?.driver
          ? Array.isArray(batch.driver) ? batch.driver[0] : batch.driver
          : null;
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6),
          kunde_name: o.kunde_name,
          status: o.status,
          created_at: o.created_at,
          eta_earliest: o.eta_earliest,
          driver_name: driver?.name ?? null,
          driver_lat: driver?.last_lat ?? null,
          driver_lng: driver?.last_lng ?? null,
        };
      }),
    );
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 20_000);
    timerRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      clearInterval(poll);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [locationId]);

  const active = orders.filter((o) => classifyPhase(o.status) !== 'done');
  const overdue = active.filter((o) => {
    const s = secsUntil(o.eta_earliest);
    return s !== null && s === 0 && classifyPhase(o.status) !== 'on_route';
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-purple-400" />
          <span className="text-sm font-semibold text-white">Küche ↔ Dispatch ↔ Fahrer</span>
        </div>
        <div className="flex items-center gap-2">
          {overdue.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400">
              <AlertTriangle className="h-3 w-3" />
              {overdue.length} überfällig
            </span>
          )}
          <span className="text-xs text-white/40">{active.length} aktiv</span>
        </div>
      </div>

      {/* Order cards */}
      {active.length === 0 ? (
        <p className="text-center text-xs text-white/30 py-4">Keine aktiven Bestellungen</p>
      ) : (
        <div className="space-y-2">
          {active.map((order) => {
            const phase = classifyPhase(order.status);
            const etaSecs = secsUntil(order.eta_earliest);
            const color = prepColor(etaSecs);
            const phaseInfo = PHASE_LABEL[phase];
            const PhaseIcon = phaseInfo.icon;

            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-lg border p-3 transition-all',
                  COLOR[color],
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Left: order info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono font-bold text-white/80">
                        #{order.bestellnummer}
                      </span>
                      {order.kunde_name && (
                        <span className="truncate text-xs text-white/50">{order.kunde_name}</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <PhaseIcon className={cn('h-3 w-3', phaseInfo.cls)} />
                      <span className={cn('text-xs', phaseInfo.cls)}>{phaseInfo.label}</span>
                      {order.driver_name && (
                        <>
                          <span className="text-white/20">·</span>
                          <Bike className="h-3 w-3 text-blue-400" />
                          <span className="text-xs text-blue-300">{order.driver_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: countdown */}
                  <div className="shrink-0 text-right">
                    {etaSecs !== null ? (
                      <div className={cn('text-base font-mono font-bold tabular-nums', color === 'red' ? 'text-red-400' : color === 'yellow' ? 'text-yellow-400' : 'text-green-400')}>
                        {fmtMmSs(etaSecs)}
                      </div>
                    ) : (
                      <span className="text-xs text-white/30">–</span>
                    )}
                    <div className="text-xs text-white/30">bis ETA</div>
                  </div>
                </div>

                {/* Progress bar */}
                {etaSecs !== null && order.eta_earliest && (
                  <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        color === 'red' ? 'bg-red-500' : color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500',
                      )}
                      style={{
                        width: `${Math.max(2, Math.min(100, (etaSecs / 2400) * 100))}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Kochstart-Empfehlung */}
      {(() => {
        const nextPrep = active.find((o) => {
          const s = secsUntil(o.eta_earliest);
          return classifyPhase(o.status) === 'prep' && s !== null && s < 600;
        });
        if (!nextPrep) return null;
        return (
          <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 p-2 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-orange-400 shrink-0" />
            <span className="text-xs text-orange-300">
              Jetzt starten: <span className="font-semibold">#{nextPrep.bestellnummer}</span> — ETA in{' '}
              {fmtMmSs(secsUntil(nextPrep.eta_earliest) ?? 0)}
            </span>
          </div>
        );
      })()}
    </div>
  );
}
