'use client';

/**
 * Phase 2785 — Smart-Timing Ultimate Cockpit
 * Echtzeit-Countdown + Farbkodierung grün/gelb/rot je Bestellung
 * + Fahrer-ETA-Bridge + On-Time-Rate-Gauge + Kochstart-Empfehlung
 * + Batch-Alert + Überfällig-Eskalation
 * Polling: 15 Sek. + 1-Sek-Tick
 */

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Bike, Timer, TrendingUp, Flame } from 'lucide-react';

type OrderTiming = {
  id: string;
  bestellnummer: string;
  kunde_name: string | null;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  eta_earliest: string | null;
  driver_name: string | null;
  cook_start_at: string | null;
  ready_target: string | null;
};

function secsLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

function fmtMmSs(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

type Ampel = 'gruen' | 'gelb' | 'rot' | 'ueberfaellig';

function getAmpel(secs: number | null, status: string): Ampel {
  if (['fertig', 'unterwegs', 'abgeholt', 'geliefert'].includes(status)) return 'gruen';
  if (secs === null) return 'gelb';
  if (secs < 0) return 'ueberfaellig';
  if (secs > 480) return 'gruen';
  if (secs > 120) return 'gelb';
  return 'rot';
}

const AMPEL_CLS: Record<Ampel, { card: string; badge: string; time: string; dot: string }> = {
  gruen:       { card: 'border-green-200 bg-green-50',   badge: 'bg-green-100 text-green-700',   time: 'text-green-700',  dot: 'bg-green-500'  },
  gelb:        { card: 'border-amber-200 bg-amber-50',   badge: 'bg-amber-100 text-amber-700',   time: 'text-amber-700',  dot: 'bg-amber-400'  },
  rot:         { card: 'border-red-200 bg-red-50',       badge: 'bg-red-100 text-red-700',       time: 'text-red-700',    dot: 'bg-red-500'    },
  ueberfaellig:{ card: 'border-red-300 bg-red-100 animate-pulse', badge: 'bg-red-600 text-white', time: 'text-red-800 font-black', dot: 'bg-red-600 animate-ping' },
};

function prepLabel(status: string): string {
  if (status === 'neu') return 'Neu';
  if (status === 'bestätigt') return 'Bestätigt';
  if (status === 'in_zubereitung') return 'Kocht';
  if (status === 'fertig') return 'Fertig';
  if (status === 'unterwegs') return 'Unterwegs';
  return status;
}

export function KitchenPhase2785SmartTimingUltimateCockpit({ locationId }: { locationId?: string | null }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderTiming[]>([]);
  const [tick, setTick] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    let q = supabase
      .from('customer_orders')
      .select(`
        id, bestellnummer, kunde_name, status, bestellt_am, geschaetzte_zubereitung_min, eta_earliest,
        timing:kitchen_timings(cook_start_at, ready_target),
        batch:mise_delivery_batches(driver:mise_drivers(name))
      `)
      .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
      .order('bestellt_am', { ascending: true })
      .limit(16);

    if (locationId) q = q.eq('location_id', locationId);

    const { data } = await q;
    if (!data) return;

    setOrders(
      data.map((o: any) => {
        const timing = Array.isArray(o.timing) ? o.timing[0] : o.timing;
        const batch = Array.isArray(o.batch) ? o.batch[0] : o.batch;
        const driver = batch?.driver ? (Array.isArray(batch.driver) ? batch.driver[0] : batch.driver) : null;
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? o.id.slice(0, 6).toUpperCase(),
          kunde_name: o.kunde_name,
          status: o.status,
          bestellt_am: o.bestellt_am,
          geschaetzte_zubereitung_min: o.geschaetzte_zubereitung_min ?? 15,
          eta_earliest: o.eta_earliest,
          driver_name: driver?.name ?? null,
          cook_start_at: timing?.cook_start_at ?? null,
          ready_target: timing?.ready_target ?? null,
        };
      }),
    );
  }

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 15_000);
    tickRef.current = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const activeOrders = orders.filter((o) => !['geliefert', 'storniert'].includes(o.status));

  // On-Time-Rate: Bestellungen mit ready_target die noch im Plan sind
  const withTarget = activeOrders.filter((o) => o.ready_target);
  const onTime = withTarget.filter((o) => {
    const s = secsLeft(o.ready_target);
    return s !== null && s >= 0;
  });
  const onTimeRate = withTarget.length > 0 ? Math.round((onTime.length / withTarget.length) * 100) : null;

  const ueberfaellig = activeOrders.filter((o) => {
    const target = o.ready_target ?? o.eta_earliest;
    const s = secsLeft(target);
    return s !== null && s < 0 && o.status !== 'fertig';
  });

  const rateColor = onTimeRate === null ? 'text-stone-400' : onTimeRate >= 85 ? 'text-green-600' : onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600';
  const rateBg = onTimeRate === null ? 'bg-stone-100' : onTimeRate >= 85 ? 'bg-green-100' : onTimeRate >= 70 ? 'bg-amber-100' : 'bg-red-100';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
            <Timer className="h-4 w-4 text-orange-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Smart-Timing Cockpit</div>
            <div className="text-[11px] text-stone-400">Echtzeit-Countdown · Farbkodierung · Fahrer-Sync</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ueberfaellig.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {ueberfaellig.length} überfällig
            </span>
          )}
          {onTimeRate !== null && (
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold tabular-nums', rateBg, rateColor)}>
              <TrendingUp className="mr-1 inline h-3 w-3" />
              {onTimeRate}% pünktlich
            </span>
          )}
          <span className="text-[10px] text-stone-400 tabular-nums">{activeOrders.length} aktiv</span>
        </div>
      </div>

      {/* On-Time-Rate Bar */}
      {onTimeRate !== null && (
        <div className="border-b border-stone-50 bg-stone-50 px-5 py-2">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-stone-500 w-20 shrink-0">On-Time-Rate</span>
            <div className="relative flex-1 h-2 rounded-full bg-stone-200 overflow-hidden">
              <div
                className={cn('absolute left-0 top-0 h-full rounded-full transition-all duration-500',
                  onTimeRate >= 85 ? 'bg-green-500' : onTimeRate >= 70 ? 'bg-amber-400' : 'bg-red-500'
                )}
                style={{ width: `${onTimeRate}%` }}
              />
              {/* Ziel-Linie bei 85% */}
              <div className="absolute top-0 h-full w-0.5 bg-green-700/50" style={{ left: '85%' }} />
            </div>
            <span className={cn('text-[11px] font-bold tabular-nums w-10 text-right', rateColor)}>{onTimeRate}%</span>
          </div>
        </div>
      )}

      {/* Order Grid */}
      <div className="p-4">
        {activeOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
            <p className="text-sm font-medium text-stone-500">Keine aktiven Bestellungen</p>
            <p className="text-xs text-stone-400">Küche ist frei</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => {
              const target = order.ready_target ?? (
                order.bestellt_am && order.geschaetzte_zubereitung_min
                  ? new Date(new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000).toISOString()
                  : null
              );
              const secs = secsLeft(target);
              const ampel = getAmpel(secs, order.status);
              const cls = AMPEL_CLS[ampel];

              const prepMin = order.geschaetzte_zubereitung_min ?? 15;
              const elapsed = order.bestellt_am
                ? (Date.now() - new Date(order.bestellt_am).getTime()) / 1000
                : 0;
              const progressPct = Math.min(100, Math.round((elapsed / (prepMin * 60)) * 100));

              return (
                <div key={order.id} className={cn('rounded-xl border p-3 transition-all', cls.card)}>
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('relative flex h-2 w-2 shrink-0 rounded-full', cls.dot)} />
                        <span className="font-mono text-xs font-bold text-stone-800">#{order.bestellnummer.replace('FF-', '')}</span>
                        <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', cls.badge)}>
                          {prepLabel(order.status)}
                        </span>
                      </div>
                      {order.kunde_name && (
                        <p className="mt-0.5 truncate text-[10px] text-stone-500">{order.kunde_name}</p>
                      )}
                    </div>
                    {/* Countdown */}
                    <div className="shrink-0 text-right">
                      {order.status === 'fertig' ? (
                        <div className="flex items-center gap-1 rounded-lg bg-green-500 px-2 py-1">
                          <CheckCircle2 className="h-3 w-3 text-white" />
                          <span className="text-[10px] font-bold text-white">Fertig</span>
                        </div>
                      ) : secs !== null ? (
                        <div className={cn('font-mono text-lg font-black tabular-nums leading-none', cls.time)}>
                          {secs < 0 && <span className="text-[10px] font-normal">+</span>}
                          {fmtMmSs(secs)}
                        </div>
                      ) : (
                        <Clock className="h-4 w-4 text-stone-400" />
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {order.status !== 'fertig' && (
                    <div className="mb-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all',
                          ampel === 'gruen' ? 'bg-green-500' : ampel === 'gelb' ? 'bg-amber-400' : 'bg-red-500'
                        )}
                        style={{ width: `${Math.max(3, progressPct)}%` }}
                      />
                    </div>
                  )}

                  {/* Driver row */}
                  {order.driver_name && (
                    <div className="flex items-center gap-1 text-[10px] text-stone-500">
                      <Bike className="h-3 w-3 text-blue-500" />
                      <span className="font-medium text-blue-600">{order.driver_name}</span>
                      {order.eta_earliest && (
                        <>
                          <span className="text-stone-300">·</span>
                          <span className="tabular-nums">
                            ETA {fmtMmSs(Math.max(0, secsLeft(order.eta_earliest) ?? 0))} Min
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Kochstart-Empfehlung */}
                  {order.cook_start_at && order.status !== 'in_zubereitung' && order.status !== 'fertig' && (
                    <div className="mt-1.5 flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2 py-1">
                      <Flame className="h-3 w-3 text-orange-500" />
                      <span className="text-[9px] font-bold text-orange-700">
                        Kochstart: {fmtMmSs(Math.max(0, secsLeft(order.cook_start_at) ?? 0))} Min
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 border-t border-stone-100 px-5 py-2 bg-stone-50">
        {(['gruen', 'gelb', 'rot', 'ueberfaellig'] as Ampel[]).map((a) => (
          <div key={a} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', AMPEL_CLS[a].dot.replace(' animate-ping', ''))} />
            <span className="text-[10px] text-stone-500">
              {a === 'gruen' ? '>8 Min' : a === 'gelb' ? '2–8 Min' : a === 'rot' ? '<2 Min' : 'Überfällig'}
            </span>
          </div>
        ))}
        <span className="ml-auto text-[9px] text-stone-400">↻ 15 Sek</span>
      </div>
    </div>
  );
}
