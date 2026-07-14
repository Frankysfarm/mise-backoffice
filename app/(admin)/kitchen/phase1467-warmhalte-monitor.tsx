'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1467 — Warmhalte-Monitor (Kitchen)
// Zeigt fertige Bestellungen die auf Abholung warten; farbkodiert nach Wartezeit;
// Props-basiert; keine API; nach Phase1466.

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  ready_at?: string | null;
  kunde_name?: string | null;
  typ?: string | null;
}

interface Props {
  orders: Order[];
}

const WARM_OK_MIN = 5;
const WARM_WARN_MIN = 12;
const WARM_CRIT_MIN = 20;

function getWarmLevel(min: number): 'ok' | 'warn' | 'crit' {
  if (min < WARM_OK_MIN) return 'ok';
  if (min < WARM_WARN_MIN) return 'warn';
  return 'crit';
}

const LEVEL_STYLE = {
  ok:   { row: 'bg-emerald-50/60 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Frisch' },
  warn: { row: 'bg-amber-50/60 dark:bg-amber-950/20',     badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         dot: 'bg-amber-500',   label: 'Warm' },
  crit: { row: 'bg-rose-50/60 dark:bg-rose-950/20',       badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             dot: 'bg-rose-500',    label: 'Kritisch' },
};

export function KitchenPhase1467WarmhalteMonitor({ orders }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const now = Date.now();

  const waitingOrders = useMemo(() => {
    return orders
      .filter((o) => o.status === 'fertig' && o.ready_at)
      .map((o) => {
        const waitMin = Math.max(0, Math.round((now - new Date(o.ready_at!).getTime()) / 60_000));
        return { ...o, waitMin, level: getWarmLevel(waitMin) };
      })
      .sort((a, b) => b.waitMin - a.waitMin);
  }, [orders, now]);

  if (waitingOrders.length === 0) return null;

  const critCount = waitingOrders.filter((o) => o.level === 'crit').length;

  return (
    <Card className={cn('overflow-hidden', critCount > 0 && 'border-rose-300 dark:border-rose-700')}>
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Flame className={cn('h-4 w-4 shrink-0', critCount > 0 ? 'text-rose-500' : 'text-amber-500')} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Warmhalte-Monitor
        </span>
        {critCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 px-2 py-0.5">
            <AlertTriangle className="h-3 w-3" />
            {critCount} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{waitingOrders.length} fertig</span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {!collapsed && (
        <div className="divide-y">
          {waitingOrders.map((o) => {
            const st = LEVEL_STYLE[o.level];
            return (
              <div key={o.id} className={cn('flex items-center gap-3 px-4 py-2.5', st.row)}>
                <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', st.dot)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold">#{o.bestellnummer ?? o.id.slice(-4)}</span>
                    {o.kunde_name && (
                      <span className="text-[11px] text-muted-foreground truncate">{o.kunde_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={cn('text-xs font-bold tabular-nums', o.level === 'crit' ? 'text-rose-600 dark:text-rose-400' : o.level === 'warn' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                    {o.waitMin} Min
                  </span>
                  <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', st.badge)}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
