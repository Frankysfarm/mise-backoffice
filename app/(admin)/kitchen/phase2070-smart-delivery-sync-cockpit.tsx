'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, Clock, Zap, AlertTriangle, CheckCircle2, Timer } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 2070 — Smart-Delivery-Sync-Cockpit (Kitchen)
 *
 * Echtzeit-Abgleich: Küchen-Zubereitungszeit vs. Fahrer-ETA.
 * Ampel-Empfehlung: Wann genau jetzt mit Kochen anfangen?
 *   GRÜN  — Timing perfekt, jetzt starten
 *   GELB  — Noch etwas warten (Fahrer kommt früher)
 *   ROT   — Sofort starten, Fahrer ist fast da
 *   GRAU  — Kein Fahrer zugewiesen
 */

interface Order {
  id: string;
  status?: string | null;
  bestellnummer?: number | null;
  kunde_name?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  bestellt_am?: string | null;
  prep_started_at?: string | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
}

interface Batch {
  id: string;
  driver_id?: string | null;
  status?: string | null;
}

interface Stop {
  id: string;
  batch_id?: string | null;
  order_id?: string | null;
  eta?: string | null;
  status?: string | null;
}

interface Timing {
  order_id: string;
  started_at?: string | null;
  target_ready_at?: string | null;
  prep_min?: number | null;
}

interface Props {
  orders: Order[];
  drivers: Driver[];
  batches: Batch[];
  stops: Stop[];
  timings?: Timing[];
}

type SyncState = 'perfect' | 'wait' | 'urgent' | 'no_driver';

const STATE_CFG: Record<SyncState, {
  bg: string; border: string; badge: string; badgeBg: string; icon: React.ReactNode; label: string;
}> = {
  perfect:   { bg: 'bg-emerald-50/60 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', badge: 'text-emerald-700 dark:text-emerald-300', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/40', icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Jetzt starten' },
  wait:      { bg: 'bg-amber-50/60 dark:bg-amber-950/20',     border: 'border-amber-200 dark:border-amber-800',     badge: 'text-amber-700 dark:text-amber-300',     badgeBg: 'bg-amber-100 dark:bg-amber-900/40',     icon: <Clock className="h-3.5 w-3.5" />,        label: 'Warten' },
  urgent:    { bg: 'bg-rose-50/60 dark:bg-rose-950/20',       border: 'border-rose-200 dark:border-rose-800',       badge: 'text-rose-700 dark:text-rose-300',       badgeBg: 'bg-rose-100 dark:bg-rose-900/40',       icon: <Zap className="h-3.5 w-3.5" />,          label: 'Sofort!' },
  no_driver: { bg: 'bg-muted/30',                              border: 'border-border',                               badge: 'text-muted-foreground',                  badgeBg: 'bg-muted/50',                           icon: <Bike className="h-3.5 w-3.5" />,         label: 'Kein Fahrer' },
};

const ACTIVE = new Set(['neu', 'bestätigt', 'confirmed', 'accepted', 'in_zubereitung', 'preparing']);

function getSyncState(
  order: Order,
  timing: Timing | undefined,
  driverEtaMs: number | null,
): { state: SyncState; driverEtaMin: number | null; prepMin: number; remainPrepSec: number | null } {
  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;

  // How much prep time remains?
  let remainPrepSec: number | null = null;
  const startStr = timing?.started_at ?? order.prep_started_at ?? null;
  if (startStr) {
    const endMs = new Date(startStr).getTime() + prepMin * 60_000;
    remainPrepSec = Math.round((endMs - Date.now()) / 1000);
  }

  if (driverEtaMs === null) {
    return { state: 'no_driver', driverEtaMin: null, prepMin, remainPrepSec };
  }

  const driverEtaMin = (driverEtaMs - Date.now()) / 60_000;
  const driverEtaRounded = Math.round(driverEtaMin);

  // If we're already cooking, just show progress
  if (remainPrepSec !== null) {
    if (remainPrepSec < 0) return { state: 'urgent', driverEtaMin: driverEtaRounded, prepMin, remainPrepSec };
    return { state: 'perfect', driverEtaMin: driverEtaRounded, prepMin, remainPrepSec };
  }

  // Not yet started: recommend based on driver ETA vs prep time
  const bufferMin = 2; // 2-min buffer
  if (driverEtaMin <= prepMin + bufferMin) {
    return { state: 'urgent', driverEtaMin: driverEtaRounded, prepMin, remainPrepSec: null };
  }
  if (driverEtaMin <= prepMin + 5) {
    return { state: 'perfect', driverEtaMin: driverEtaRounded, prepMin, remainPrepSec: null };
  }
  return { state: 'wait', driverEtaMin: driverEtaRounded, prepMin, remainPrepSec: null };
}

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = sec < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase2070SmartDeliverySyncCockpit({ orders, drivers, batches, stops, timings = [] }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    // Build order→driver ETA map
    const orderEtaMap = new Map<string, number | null>();
    for (const stop of stops) {
      if (!stop.order_id || !stop.eta) continue;
      orderEtaMap.set(stop.order_id, new Date(stop.eta).getTime());
    }

    // Build order→driver name map
    const orderDriverMap = new Map<string, string>();
    for (const batch of batches) {
      if (!batch.driver_id) continue;
      const driver = drivers.find(d => d.id === batch.driver_id);
      if (!driver) continue;
      for (const stop of stops.filter(s => s.batch_id === batch.id)) {
        if (stop.order_id) {
          orderDriverMap.set(stop.order_id, `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim());
        }
      }
    }

    const timingMap = new Map(timings.map(t => [t.order_id, t]));

    return orders
      .filter(o => ACTIVE.has(o.status ?? ''))
      .map(o => {
        const eta = orderEtaMap.get(o.id) ?? null;
        const timing = timingMap.get(o.id);
        const sync = getSyncState(o, timing, eta);
        return {
          order: o,
          driverName: orderDriverMap.get(o.id) ?? null,
          ...sync,
        };
      })
      .sort((a, b) => {
        const priority: Record<SyncState, number> = { urgent: 0, perfect: 1, wait: 2, no_driver: 3 };
        return priority[a.state] - priority[b.state];
      });
  }, [orders, stops, batches, drivers, timings]);

  const urgentCount = rows.filter(r => r.state === 'urgent').length;
  const activeCount = rows.length;

  if (activeCount === 0) return null;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <ChefHat className="h-4 w-4 text-matcha-600" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-700 dark:text-matcha-300">
          Delivery-Sync · {activeCount} aktiv
        </span>
        {urgentCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" /> {urgentCount} sofort
          </span>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y">
        {rows.slice(0, 8).map(({ order, driverName, state, driverEtaMin, prepMin, remainPrepSec }) => {
          const cfg = STATE_CFG[state];
          return (
            <div key={order.id} className={cn('flex items-center gap-3 px-4 py-2.5', cfg.bg)}>
              {/* State badge */}
              <div className={cn(
                'shrink-0 flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black min-w-[80px] justify-center',
                cfg.badge, cfg.badgeBg,
              )}>
                {cfg.icon}
                {cfg.label}
              </div>

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold">
                    #{String(order.bestellnummer ?? '').slice(-4) || order.id.slice(-4)}
                  </span>
                  {order.kunde_name && (
                    <span className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Timer className="h-2.5 w-2.5" /> Prep {prepMin} Min
                  </span>
                  {driverName && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground truncate">
                      <Bike className="h-2.5 w-2.5" /> {driverName}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: driver ETA or countdown */}
              <div className="shrink-0 text-right">
                {remainPrepSec !== null ? (
                  <div>
                    <div className={cn(
                      'font-mono text-sm font-black tabular-nums',
                      remainPrepSec < 0 ? 'text-rose-600' : remainPrepSec < 120 ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-300',
                    )}>
                      {fmtSec(remainPrepSec)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">verbleibend</div>
                  </div>
                ) : driverEtaMin !== null ? (
                  <div>
                    <div className="font-mono text-sm font-black tabular-nums text-foreground">
                      {driverEtaMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">Fahrer-ETA</div>
                  </div>
                ) : (
                  <span className="text-[10px] text-muted-foreground">–</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
