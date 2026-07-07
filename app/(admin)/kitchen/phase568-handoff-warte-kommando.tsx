'use client';

/**
 * Phase 568 — Kitchen: Handoff-Warte-Kommando
 *
 * Zeigt alle Bestellungen im Status "fertig" die noch keinen Fahrer haben.
 * Sortiert nach Wartezeit — längste Wartezeit zuerst.
 *
 * Farbkodierung nach Wartezeit:
 *   grün   → < 3 Min  (frisch fertig)
 *   amber  → 3–8 Min  (aufpassen)
 *   rot    → > 8 Min  (Fahrer rufen!)
 *
 * Zeigt auch: durchschnittliche Handoff-Wartezeit dieser Schicht.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronUp, Clock, Package, Phone, Truck } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string | null;
  fertig_am: string | null;
  delivery_zone: string | null;
  gesamtbetrag?: number;
}

interface Driver {
  id?: string;
  employee_id?: string;
  status?: { ist_online: boolean; aktueller_batch_id: string | null } | null;
  ist_online?: boolean;
  aktueller_batch_id?: string | null;
}

interface Props {
  orders: Order[];
  drivers?: Driver[];
}

type WaitTier = 'fresh' | 'warn' | 'critical';

const TIER: Record<WaitTier, { bg: string; border: string; text: string; badge: string; label: string }> = {
  fresh:    { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800', badge: 'bg-emerald-500 text-white', label: 'Frisch' },
  warn:     { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800',   badge: 'bg-amber-400 text-white',   label: 'Warten' },
  critical: { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-800',     badge: 'bg-red-600 text-white',     label: 'Dringend' },
};

function getTier(waitMin: number): WaitTier {
  if (waitMin >= 8) return 'critical';
  if (waitMin >= 3) return 'warn';
  return 'fresh';
}

function fmtWait(min: number): string {
  if (min < 1) return `${Math.round(min * 60)}s`;
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  return s > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${m} Min`;
}

export function KitchenPhase568HandoffWarteKommando({ orders, drivers = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const freeDrivers = useMemo(() =>
    drivers.filter(d => {
      const online = d.status?.ist_online ?? d.ist_online ?? false;
      const busy = d.status?.aktueller_batch_id ?? d.aktueller_batch_id ?? null;
      return online && !busy;
    }).length,
    [drivers],
  );

  const waitingOrders = useMemo(() => {
    const now = Date.now();
    return orders
      .filter(o => o.status === 'fertig' && o.typ === 'lieferung' && o.fertig_am)
      .map(o => {
        const waitMin = (now - new Date(o.fertig_am!).getTime()) / 60_000;
        return { order: o, waitMin, tier: getTier(waitMin) };
      })
      .sort((a, b) => b.waitMin - a.waitMin);
  }, [orders]);

  const avgWaitMin = useMemo(() => {
    if (waitingOrders.length === 0) return null;
    const total = waitingOrders.reduce((s, w) => s + w.waitMin, 0);
    return total / waitingOrders.length;
  }, [waitingOrders]);

  const criticalCount = waitingOrders.filter(w => w.tier === 'critical').length;

  if (waitingOrders.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', criticalCount > 0 && 'border-red-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors',
          criticalCount > 0 && 'bg-red-50 hover:bg-red-100',
        )}
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
        )}>
          <Package className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Handoff-Warte-Kommando
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black animate-pulse">
                {criticalCount} dringend
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-2">
            <span>{waitingOrders.length} fertig · wartet auf Fahrer</span>
            {avgWaitMin !== null && (
              <span>· Ø {fmtWait(avgWaitMin)} Wartezeit</span>
            )}
            {freeDrivers > 0 && (
              <span className="text-emerald-600 font-semibold">· {freeDrivers} Fahrer frei</span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="divide-y">
          {waitingOrders.map(({ order, waitMin, tier }) => {
            const cfg = TIER[tier];
            return (
              <div key={order.id} className={cn('px-4 py-3 flex items-center gap-3', cfg.bg)}>
                {/* Wartezeit */}
                <div className="shrink-0 text-center w-16">
                  <div className={cn('text-lg font-black tabular-nums leading-none', cfg.text)}>
                    {fmtWait(waitMin)}
                  </div>
                  <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-black font-mono', cfg.text)}>
                      #{order.bestellnummer}
                    </span>
                    {order.delivery_zone && (
                      <span className={cn('text-[10px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold', cfg.text)}>
                        Zone {order.delivery_zone}
                      </span>
                    )}
                  </div>
                  {order.kunde_name && (
                    <div className={cn('text-[10px] truncate', cfg.text)}>{order.kunde_name}</div>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {freeDrivers > 0 ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Truck className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold">Frei</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span className="text-[10px]">Kein Fahrer</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/30">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Fertige Lieferungen ohne Fahrerzuweisung · 5s Aktualisierung
          </span>
          <Badge variant="outline" className="ml-auto text-[9px] h-4">
            {waitingOrders.length} wartend
          </Badge>
        </div>
      )}
    </Card>
  );
}
