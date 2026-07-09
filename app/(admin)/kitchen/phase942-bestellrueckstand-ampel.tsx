'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertOctagon, Clock, PackageOpen } from 'lucide-react';

/**
 * Phase 942 — Bestellrückstand-Ampel (Kitchen)
 *
 * Alert wenn Bestellungen >10 Min warten ohne Kochstart (status='neu' oder 'bestätigt').
 * Client-seitig via useMemo.
 */

const RUECKSTAND_WARN_MIN = 10;
const RUECKSTAND_CRIT_MIN = 20;

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  bestellnummer?: string | number | null;
}

interface Props {
  orders: Order[];
}

interface StuckOrder {
  id: string;
  bestellnummer: string | number | null;
  minutenWartend: number;
}

export function KitchenPhase942BestellrueckstandAmpel({ orders }: Props) {
  const stuckOrders = useMemo<StuckOrder[]>(() => {
    const now = Date.now();
    return orders
      .filter(o => {
        const inaktiv = ['neu', 'bestätigt', 'bestaetigt', 'pending', 'confirmed'].includes(o.status?.toLowerCase() ?? '');
        if (!inaktiv || !o.bestellt_am) return false;
        const ageMin = (now - new Date(o.bestellt_am).getTime()) / 60_000;
        return ageMin >= RUECKSTAND_WARN_MIN;
      })
      .map(o => ({
        id: o.id,
        bestellnummer: o.bestellnummer ?? null,
        minutenWartend: Math.round((now - new Date(o.bestellt_am!).getTime()) / 60_000),
      }))
      .sort((a, b) => b.minutenWartend - a.minutenWartend);
  }, [orders]);

  if (stuckOrders.length === 0) return null;

  const hasCritical = stuckOrders.some(o => o.minutenWartend >= RUECKSTAND_CRIT_MIN);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      hasCritical
        ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    )}>
      <div className={cn(
        'flex items-center gap-2.5 px-4 py-2.5 border-b',
        hasCritical
          ? 'border-red-200 dark:border-red-800'
          : 'border-amber-200 dark:border-amber-800',
      )}>
        <AlertOctagon className={cn(
          'h-4 w-4 shrink-0',
          hasCritical ? 'text-red-500 animate-pulse' : 'text-amber-500',
        )} />
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          hasCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
        )}>
          Bestellrückstand
        </span>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black text-white',
          hasCritical ? 'bg-red-500' : 'bg-amber-400',
        )}>
          {stuckOrders.length} {stuckOrders.length === 1 ? 'Bestellung' : 'Bestellungen'}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <p className={cn(
          'text-xs font-semibold',
          hasCritical ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
        )}>
          {stuckOrders.length === 1
            ? '1 Bestellung wartet seit über 10 Min ohne Kochstart!'
            : `${stuckOrders.length} Bestellungen warten ohne Kochstart!`}
        </p>

        <div className="space-y-1.5">
          {stuckOrders.slice(0, 5).map(o => {
            const isCrit = o.minutenWartend >= RUECKSTAND_CRIT_MIN;
            return (
              <div key={o.id} className="flex items-center gap-2">
                <PackageOpen className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isCrit ? 'text-red-500' : 'text-amber-500',
                )} />
                <span className="text-[11px] text-muted-foreground flex-1">
                  {o.bestellnummer ? `#${o.bestellnummer}` : o.id.slice(0, 8)}
                </span>
                <div className={cn(
                  'flex items-center gap-1 rounded-md px-2 py-0.5',
                  isCrit ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                )}>
                  <Clock className="h-3 w-3" />
                  <span className="text-[10px] font-black tabular-nums">{o.minutenWartend} Min</span>
                </div>
              </div>
            );
          })}
          {stuckOrders.length > 5 && (
            <p className="text-[10px] text-muted-foreground pl-5">
              +{stuckOrders.length - 5} weitere…
            </p>
          )}
        </div>

        <div className="text-[9px] text-muted-foreground">
          Schwelle: ≥{RUECKSTAND_WARN_MIN} Min ohne Kochstart · Kritisch: ≥{RUECKSTAND_CRIT_MIN} Min
        </div>
      </div>
    </div>
  );
}
