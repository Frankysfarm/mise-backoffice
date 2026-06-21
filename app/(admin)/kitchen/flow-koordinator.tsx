'use client';

/**
 * KitchenFlowKoordinator — Phase 380
 *
 * Kombiniert Fahrer-ETAs, Bestellstatus und Kochstart-Empfehlung in EINER Kachel.
 * Zeigt: "Fahrer X kommt in N Minuten → JETZT Bestellungen A, B starten"
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChefHat, Clock, AlertTriangle, CheckCircle2, Zap, ArrowRight } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  items?: { name: string; menge: number }[];
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
}

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
}

interface Props {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}

type ActionLevel = 'jetzt' | 'bald' | 'warten' | 'ok';

interface KochAction {
  orderId: string;
  bestellnummer: string;
  level: ActionLevel;
  prepMin: number;
  driverName: string | null;
  driverEtaMin: number | null;
  marginMin: number | null;
  items: string[];
}

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
}

function computeActions(
  orders: Order[],
  batches: Batch[],
  stops: Stop[],
  drivers: Driver[],
  now: number,
): KochAction[] {
  const pending = orders.filter((o) =>
    ['bestätigt', 'neu'].includes(o.status),
  );
  if (!pending.length) return [];

  const driverMap = new Map(drivers.map((d) => [d.id, d]));

  const activeBatches = batches.filter(
    (b) => b.status === 'unterwegs' && b.fahrer_id,
  );

  const batchDriverEta = new Map<string, number>();
  for (const batch of activeBatches) {
    if (!batch.startzeit || !batch.total_eta_min || !batch.fahrer_id) continue;
    const startedAt = new Date(batch.startzeit).getTime();
    const totalMin = batch.total_eta_min;
    const elapsed = (now - startedAt) / 60_000;
    const remaining = Math.max(0, totalMin - elapsed);
    const pendingStops = stops.filter(
      (s) => s.batch_id === batch.id && !s.geliefert_am,
    );
    const stopsLeft = pendingStops.length;
    const etaMin = stopsLeft > 0 ? remaining / Math.max(1, stopsLeft) : remaining;
    batchDriverEta.set(batch.fahrer_id, Math.round(etaMin));
  }

  const returningBatches = batches.filter(
    (b) => ['geliefert', 'abgeschlossen'].includes(b.status) && b.fahrer_id,
  );
  for (const batch of returningBatches) {
    if (!batch.fahrer_id) continue;
    const currentEta = batchDriverEta.get(batch.fahrer_id);
    if (!currentEta) batchDriverEta.set(batch.fahrer_id, 5);
  }

  if (!batchDriverEta.size) {
    const assignedDriverIds = [...new Set(
      batches.filter((b) => b.fahrer_id).map((b) => b.fahrer_id!),
    )];
    for (const driverId of assignedDriverIds) {
      if (!batchDriverEta.has(driverId)) batchDriverEta.set(driverId, 10);
    }
  }

  const bestDriverEta =
    batchDriverEta.size > 0
      ? Math.min(...batchDriverEta.values())
      : null;

  const bestDriverId =
    bestDriverEta !== null
      ? [...batchDriverEta.entries()].find(([, eta]) => eta === bestDriverEta)?.[0] ?? null
      : null;

  const bestDriver = bestDriverId ? driverMap.get(bestDriverId) : null;
  const bestDriverName = bestDriver
    ? `${bestDriver.vorname} ${bestDriver.nachname}`
    : null;

  return pending.map((order): KochAction => {
    const prepMin = order.geschaetzte_zubereitung_min ?? 20;
    const elapsed = elapsedMin(order.bestellt_am);
    const prepRemain = Math.max(0, prepMin - elapsed);
    const margin = bestDriverEta !== null ? bestDriverEta - prepMin : null;

    let level: ActionLevel = 'warten';
    if (margin !== null) {
      if (margin <= 2) level = 'jetzt';
      else if (margin <= 7) level = 'bald';
      else level = 'warten';
    } else if (elapsed >= prepMin * 0.7) {
      level = 'bald';
    }

    const items = (order.items ?? [])
      .map((i) => `${i.menge}× ${i.name}`)
      .slice(0, 3);

    return {
      orderId: order.id,
      bestellnummer: order.bestellnummer,
      level,
      prepMin,
      driverName: bestDriverName,
      driverEtaMin: bestDriverEta,
      marginMin: margin,
      items,
    };
  }).sort((a, b) => {
    const order: ActionLevel[] = ['jetzt', 'bald', 'warten', 'ok'];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });
}

const LEVEL_STYLES: Record<ActionLevel, {
  bg: string; border: string; badge: string; label: string; icon: typeof Zap;
}> = {
  jetzt:  { bg: 'bg-red-50',    border: 'border-red-300',    badge: 'bg-red-500 text-white',       label: 'JETZT STARTEN', icon: Zap         },
  bald:   { bg: 'bg-amber-50',  border: 'border-amber-300',  badge: 'bg-amber-400 text-white',     label: 'Bald starten',  icon: AlertTriangle },
  warten: { bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-400 text-white',      label: 'Warten',        icon: Clock        },
  ok:     { bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',    label: 'Fertig',        icon: CheckCircle2  },
};

export function KitchenFlowKoordinator({ orders, batches, stops, drivers }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const actions = computeActions(orders, batches, stops, drivers, now);
  if (!actions.length) return null;

  const urgent = actions.filter((a) => a.level === 'jetzt').length;
  const soon = actions.filter((a) => a.level === 'bald').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Flow-Koordinator
        </span>
        {urgent > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white">
            {urgent} JETZT
          </span>
        )}
        {soon > 0 && urgent === 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-white">
            {soon} bald
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">
          {actions.length} Bestellung{actions.length !== 1 ? 'en' : ''}
        </span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {actions.slice(0, 6).map((action) => {
            const s = LEVEL_STYLES[action.level];
            const Icon = s.icon;
            return (
              <div
                key={action.orderId}
                className={cn('flex items-start gap-3 px-4 py-3', s.bg)}
              >
                <div className={cn('mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black flex items-center gap-1', s.badge)}>
                  <Icon className="h-2.5 w-2.5" />
                  {s.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">#{action.bestellnummer}</span>
                    <span className="text-[10px] text-muted-foreground">~{action.prepMin} Min Zubereitung</span>
                    {action.items.length > 0 && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">
                        {action.items.join(', ')}
                      </span>
                    )}
                  </div>
                  {action.driverName && (
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px]">
                      <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{action.driverName}</span>
                      {action.driverEtaMin !== null && (
                        <>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                          <span className={cn(
                            'font-bold tabular-nums',
                            action.driverEtaMin <= 5 ? 'text-red-600' : action.driverEtaMin <= 12 ? 'text-amber-600' : 'text-matcha-700',
                          )}>
                            ~{action.driverEtaMin} Min
                          </span>
                          {action.marginMin !== null && (
                            <span className={cn(
                              'text-[9px]',
                              action.marginMin < 0 ? 'text-red-500' : 'text-muted-foreground',
                            )}>
                              ({action.marginMin > 0 ? '+' : ''}{action.marginMin} Min Puffer)
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {actions.length > 6 && (
            <div className="px-4 py-2 text-[11px] text-muted-foreground text-center">
              + {actions.length - 6} weitere Bestellung{actions.length - 6 !== 1 ? 'en' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
