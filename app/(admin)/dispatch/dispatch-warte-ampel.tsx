'use client';

/**
 * DispatchWarteAmpel — Phase 257
 *
 * Ampel-Anzeige für den "Ready-but-not-dispatched" Zustand.
 * Zeigt wie lange fertige Lieferbestellungen auf Zuweisung warten.
 *
 * Ampel:
 *  GRÜN   — alle Ready-Orders < 5 Min wartend
 *  AMBER  — mind. 1 Order 5–15 Min wartend
 *  ROT    — mind. 1 Order > 15 Min wartend
 *
 * Wird nur gerendert wenn ≥1 Order im Status 'fertig' (Typ lieferung) vorhanden.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Package, Truck } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  fertig_am: string | null;
  delivery_zone: string | null;
};

type AmpelLevel = 'gruen' | 'amber' | 'rot';

function waitMin(fertig_am: string | null): number {
  if (!fertig_am) return 0;
  return Math.floor((Date.now() - new Date(fertig_am).getTime()) / 60_000);
}

function getLevel(orders: ReadyOrder[]): AmpelLevel {
  const maxWait = Math.max(0, ...orders.map(o => waitMin(o.fertig_am)));
  if (maxWait >= 15) return 'rot';
  if (maxWait >= 5)  return 'amber';
  return 'gruen';
}

const LEVEL_STYLES: Record<AmpelLevel, {
  bg: string; border: string; icon: typeof CheckCircle2;
  iconColor: string; label: string; sublabel: string;
}> = {
  gruen: {
    bg: 'bg-matcha-50', border: 'border-matcha-200',
    icon: CheckCircle2, iconColor: 'text-matcha-600',
    label: 'Bereit für Dispatch', sublabel: 'Alle Bestellungen < 5 Min',
  },
  amber: {
    bg: 'bg-amber-50', border: 'border-amber-200',
    icon: Clock, iconColor: 'text-amber-600',
    label: 'Wartezeit steigt', sublabel: 'Mind. 1 Bestellung 5–15 Min wartend',
  },
  rot: {
    bg: 'bg-red-50', border: 'border-red-200',
    icon: AlertTriangle, iconColor: 'text-red-600',
    label: 'Dispatch-Engpass!', sublabel: 'Mind. 1 Bestellung > 15 Min wartend',
  },
};

const AMPEL_DOT: Record<AmpelLevel, string> = {
  gruen: 'bg-matcha-500',
  amber: 'bg-amber-400',
  rot:   'bg-red-500 animate-pulse',
};

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

export function DispatchWarteAmpel({ orders }: { orders: ReadyOrder[] }) {
  useTick();

  const readyOrders = orders.filter(
    o => o.status === 'fertig' && o.typ === 'lieferung',
  );

  if (readyOrders.length === 0) return null;

  const level = getLevel(readyOrders);
  const style = LEVEL_STYLES[level];
  const Icon = style.icon;
  const maxWait = Math.max(0, ...readyOrders.map(o => waitMin(o.fertig_am)));

  const byZone = readyOrders.reduce<Record<string, number>>((acc, o) => {
    const z = o.delivery_zone ?? 'Unbekannt';
    acc[z] = (acc[z] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className={cn('rounded-2xl border p-4 transition-all duration-500', style.bg, style.border)}>
      <div className="flex items-start gap-3">
        {/* Ampel-Dot */}
        <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
          {(['gruen', 'amber', 'rot'] as AmpelLevel[]).map(l => (
            <div
              key={l}
              className={cn(
                'h-3 w-3 rounded-full transition-all duration-300',
                l === level ? AMPEL_DOT[l] : 'bg-black/10',
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className={cn('h-4 w-4 shrink-0', style.iconColor)} />
            <span className="text-sm font-bold">{style.label}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{style.sublabel}</p>

          {/* KPIs */}
          <div className="mt-2 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1 text-xs">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="font-bold">{readyOrders.length}</span>
              <span className="text-muted-foreground">fertig</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className={cn('font-bold', level === 'rot' ? 'text-red-600' : level === 'amber' ? 'text-amber-600' : 'text-matcha-600')}>
                {maxWait} Min
              </span>
              <span className="text-muted-foreground">max. Wartezeit</span>
            </div>
          </div>

          {/* Zone Breakdown */}
          {Object.keys(byZone).length > 0 && (
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              {Object.entries(byZone).map(([zone, count]) => (
                <span
                  key={zone}
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold bg-white/60"
                >
                  <Truck className="h-2.5 w-2.5 text-muted-foreground" />
                  Zone {zone}: {count}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
