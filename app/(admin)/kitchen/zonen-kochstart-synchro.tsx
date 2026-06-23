'use client';

/**
 * KitchenZonenKochstartSynchro — Phase 440
 * Gruppiert aktive Bestellungen nach Lieferzone und zeigt synchronisierte
 * Kochstart-Zeitfenster je Zone, damit Fahrer nicht auf einzelne Bestellungen warten.
 * Farbkodierung: Grün = synchron, Gelb = leicht versetzt, Rot = kritisch versetzt.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Flame, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  delivery_zone?: string | null;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface TimingRow {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
}

interface ZoneGroup {
  zone: string;
  orders: Order[];
  timings: TimingRow[];
  avgReadyIn: number;
  minReadyIn: number;
  maxReadyIn: number;
  syncGap: number;
  status: 'synced' | 'tight' | 'critical' | 'waiting';
}

const STATUS_META = {
  synced:   { bg: 'bg-matcha-50',  border: 'border-matcha-200', badge: 'bg-matcha-500 text-white',  label: 'Synchron',   icon: CheckCircle2 },
  tight:    { bg: 'bg-amber-50',   border: 'border-amber-200',  badge: 'bg-amber-400 text-white',   label: 'Leicht off', icon: Clock },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',    badge: 'bg-red-500 text-white',     label: 'Kritisch',   icon: Flame },
  waiting:  { bg: 'bg-blue-50',    border: 'border-blue-200',   badge: 'bg-blue-400 text-white',    label: 'Wartend',    icon: AlertTriangle },
};

function computeReadyIn(order: Order, timing: TimingRow | null, nowMs: number): number {
  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 20;
  if (timing?.ready_target) {
    return Math.round((new Date(timing.ready_target).getTime() - nowMs) / 60_000);
  }
  const startMs = timing?.cook_start_at
    ? new Date(timing.cook_start_at).getTime()
    : order.bestellt_am
    ? new Date(order.bestellt_am).getTime()
    : null;
  if (!startMs) return prepMin;
  const elapsed = Math.floor((nowMs - startMs) / 60_000);
  return Math.max(0, prepMin - elapsed);
}

export function KitchenZonenKochstartSynchro({
  orders,
  timings,
}: {
  orders: Order[];
  timings: TimingRow[];
}) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter(o => ['neu', 'in_zubereitung'].includes(o.status)),
    [orders],
  );

  const groups = useMemo<ZoneGroup[]>(() => {
    const byZone = new Map<string, Order[]>();
    for (const o of activeOrders) {
      const z = o.delivery_zone ?? 'Unbekannt';
      if (!byZone.has(z)) byZone.set(z, []);
      byZone.get(z)!.push(o);
    }

    const result: ZoneGroup[] = [];
    byZone.forEach((zoneOrders, zone) => {
      if (zoneOrders.length < 2) return;

      const readyIns = zoneOrders.map(o => {
        const t = timings.find(t => t.order_id === o.id) ?? null;
        return computeReadyIn(o, t, now);
      });

      const avgReadyIn = Math.round(readyIns.reduce((s, v) => s + v, 0) / readyIns.length);
      const minReadyIn = Math.min(...readyIns);
      const maxReadyIn = Math.max(...readyIns);
      const syncGap = maxReadyIn - minReadyIn;

      let status: ZoneGroup['status'] = 'synced';
      if (readyIns.every(r => r <= 0)) status = 'waiting';
      else if (syncGap >= 10) status = 'critical';
      else if (syncGap >= 5) status = 'tight';

      result.push({ zone, orders: zoneOrders, timings, avgReadyIn, minReadyIn, maxReadyIn, syncGap, status });
    });

    return result.sort((a, b) => {
      const order = ['critical', 'tight', 'synced', 'waiting'];
      return order.indexOf(a.status) - order.indexOf(b.status);
    });
  }, [activeOrders, timings, now]);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-xl border overflow-hidden bg-card">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition border-b"
      >
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Zonen-Kochstart-Synchro
        </span>
        <span className="text-[10px] font-bold bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5">
          {groups.length} Zone{groups.length !== 1 ? 'n' : ''}
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {groups.map(g => {
            const meta = STATUS_META[g.status];
            const Icon = meta.icon;
            return (
              <div key={g.zone} className={cn('px-4 py-3', meta.bg)}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn('text-[9px] font-black px-2 py-0.5 rounded-full', meta.badge)}>
                    {meta.label}
                  </span>
                  <span className="text-xs font-bold">Zone {g.zone}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {g.orders.length} Bestell.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    {g.orders.map(o => {
                      const t = timings.find(tt => tt.order_id === o.id) ?? null;
                      const ri = computeReadyIn(o, t, now);
                      const barW = Math.min(100, Math.max(0, 100 - (ri / 30) * 100));
                      return (
                        <div key={o.id} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground w-16 shrink-0 truncate">
                            #{o.bestellnummer.slice(-4)}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full transition-all duration-500',
                                ri <= 0 ? 'bg-stone-300' : ri <= 3 ? 'bg-matcha-500' : ri <= 8 ? 'bg-amber-400' : 'bg-blue-400'
                              )}
                              style={{ width: `${barW}%` }}
                            />
                          </div>
                          <span className={cn(
                            'text-[10px] font-bold tabular-nums w-10 text-right shrink-0',
                            ri <= 0 ? 'text-stone-400' : ri <= 3 ? 'text-matcha-700' : ri <= 8 ? 'text-amber-700' : 'text-blue-700',
                          )}>
                            {ri <= 0 ? 'Fertig' : `${ri} Min`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="shrink-0 text-right pl-2 border-l border-black/10">
                    <div className="text-xs font-black tabular-nums">
                      {g.syncGap === 0 ? '✓' : `±${g.syncGap}m`}
                    </div>
                    <div className="text-[8px] text-muted-foreground">Versatz</div>
                  </div>
                </div>

                {g.status === 'critical' && (
                  <div className="mt-2 text-[10px] text-red-600 font-semibold flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    Kochstart anpassen — {g.syncGap} Min Versatz!
                  </div>
                )}
                {g.status === 'tight' && (
                  <div className="mt-2 text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {g.syncGap} Min Versatz — Fahrer wartet möglicherweise.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
