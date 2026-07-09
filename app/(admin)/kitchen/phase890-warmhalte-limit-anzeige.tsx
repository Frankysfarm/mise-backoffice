'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Flame } from 'lucide-react';

/**
 * phase890 — Warmhalte-Limit-Anzeige
 *
 * Alert für fertige Bestellungen die ≥8 Min auf einen Fahrer warten.
 * Rot ≥15 Min (mit Puls-Animation), amber ≥8 Min.
 * Komplett client-seitig via useMemo — kein API-Aufruf.
 */

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  fertig_am: string | null;
  kunde_name: string;
}

interface Props {
  orders: Order[];
}

const LIMIT_ROT_MIN = 15;
const LIMIT_AMBER_MIN = 8;

interface WartenderOrder {
  order: Order;
  wartetSeit: number;
  level: 'rot' | 'amber';
}

export function KitchenPhase890WarmhalteLimitAnzeige({ orders }: Props) {
  const wartende = useMemo<WartenderOrder[]>(() => {
    const now = Date.now();
    return orders
      .filter(o => o.status === 'fertig' && o.fertig_am)
      .map(o => {
        const wartetSeit = Math.floor((now - new Date(o.fertig_am!).getTime()) / 60_000);
        const level: 'rot' | 'amber' | null =
          wartetSeit >= LIMIT_ROT_MIN ? 'rot' :
          wartetSeit >= LIMIT_AMBER_MIN ? 'amber' : null;
        return level ? { order: o, wartetSeit, level } : null;
      })
      .filter((x): x is WartenderOrder => x !== null)
      .sort((a, b) => b.wartetSeit - a.wartetSeit);
  }, [orders]);

  if (!wartende.length) return null;

  const rotAnzahl = wartende.filter(w => w.level === 'rot').length;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      rotAnzahl > 0
        ? 'border-red-300 bg-red-50 dark:bg-red-950/30'
        : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-2.5 border-b',
        rotAnzahl > 0 ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800',
      )}>
        <Flame className={cn(
          'h-4 w-4 shrink-0',
          rotAnzahl > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500',
        )} />
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          rotAnzahl > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
        )}>
          Warmhalte-Limit
        </span>
        <span className={cn(
          'ml-auto rounded-full px-2 py-0.5 text-[10px] font-black',
          rotAnzahl > 0 ? 'bg-red-500 text-white' : 'bg-amber-400 text-white',
        )}>
          {wartende.length} {wartende.length === 1 ? 'Bestellung' : 'Bestellungen'}
        </span>
      </div>

      {/* List */}
      <div className="divide-y divide-red-100 dark:divide-red-900/30">
        {wartende.map(({ order, wartetSeit, level }) => (
          <div
            key={order.id}
            className="flex items-center gap-3 px-4 py-2.5"
          >
            <AlertTriangle className={cn(
              'h-4 w-4 shrink-0',
              level === 'rot' ? 'text-red-500' : 'text-amber-500',
            )} />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-foreground truncate">
                #{order.bestellnummer} — {order.kunde_name}
              </div>
              <div className={cn(
                'text-[10px] font-semibold',
                level === 'rot' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
              )}>
                Fertig seit {wartetSeit} Min — kein Fahrer!
              </div>
            </div>
            <div className={cn(
              'shrink-0 flex items-center gap-1 rounded-lg px-2 py-1',
              level === 'rot'
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-amber-400 text-white',
            )}>
              <Clock className="h-3 w-3" />
              <span className="text-[11px] font-black tabular-nums">{wartetSeit}m</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div className={cn(
        'px-4 py-2 text-[9px]',
        rotAnzahl > 0
          ? 'text-red-500 dark:text-red-400'
          : 'text-amber-600 dark:text-amber-400',
      )}>
        ≥{LIMIT_AMBER_MIN} Min = Warnung · ≥{LIMIT_ROT_MIN} Min = Kritisch
      </div>
    </div>
  );
}
