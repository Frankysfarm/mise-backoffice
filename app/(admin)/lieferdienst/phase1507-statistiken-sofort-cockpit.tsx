'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Users, Euro, Target, ChevronDown, ChevronUp, BarChart3, AlertTriangle } from 'lucide-react';
import { euro } from '@/lib/utils';

/**
 * Phase 1507 — Statistiken-Sofort-Cockpit (Lieferdienst)
 *
 * Kompaktes KPI-Dashboard für laufende Schicht:
 *   - 6 KPI-Kacheln: Bestellungen, Umsatz, Ø Lieferzeit, Pünktlichkeitsquote, Aktive Fahrer, Stornoquote
 *   - Einfache Trend-Pfeile (vs. Ø)
 *   - Farbkodierung nach Zielstatus
 *
 * Props-basiert — kein eigener API-Aufruf.
 */

interface Order {
  id: string;
  status?: string | null;
  gesamtbetrag?: number | null;
  bestellt_am?: string | null;
  created_at?: string | null;
  geliefert_am?: string | null;
  delivered_at?: string | null;
  expected_delivery_at?: string | null;
}

interface Driver {
  id: string;
  status?: { ist_online?: boolean } | null;
}

interface Props {
  orders?: Order[];
  completedOrders?: Order[];
  drivers?: Driver[];
}

const CANCELLED_STATUSES = new Set(['storniert', 'cancelled', 'abgebrochen']);
const DONE_STATUSES      = new Set(['geliefert', 'delivered', 'abgeschlossen', 'abgeholt']);

function avgDeliveryMin(orders: Order[]): number | null {
  const timed = orders.filter(o => {
    const start = o.bestellt_am ?? o.created_at;
    const end   = o.geliefert_am ?? o.delivered_at;
    return start && end;
  });
  if (timed.length === 0) return null;
  const sum = timed.reduce((acc, o) => {
    const start = new Date(o.bestellt_am ?? o.created_at!).getTime();
    const end   = new Date(o.geliefert_am ?? o.delivered_at!).getTime();
    return acc + (end - start) / 60_000;
  }, 0);
  return Math.round(sum / timed.length);
}

function onTimeRate(orders: Order[]): number | null {
  const withExp = orders.filter(o => o.expected_delivery_at && (o.geliefert_am ?? o.delivered_at));
  if (withExp.length === 0) return null;
  const onTime = withExp.filter(o => {
    const exp = new Date(o.expected_delivery_at!).getTime();
    const act = new Date(o.geliefert_am ?? o.delivered_at!).getTime();
    return act <= exp + 5 * 60_000;
  });
  return Math.round((onTime.length / withExp.length) * 100);
}

interface KpiCard {
  label: string;
  value: string;
  sub?: string;
  icon: typeof TrendingUp;
  color: string;
  bg: string;
  border: string;
}

export function LieferdienstPhase1507StatistikenSofortCockpit({ orders = [], completedOrders = [], drivers = [] }: Props) {
  const [open, setOpen] = useState(true);

  const all = useMemo(() => [...orders, ...completedOrders], [orders, completedOrders]);

  const kpis = useMemo((): KpiCard[] => {
    const bestellungen = all.filter(o => !CANCELLED_STATUSES.has(o.status ?? '')).length;
    const umsatz       = all.filter(o => !CANCELLED_STATUSES.has(o.status ?? ''))
                            .reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
    const avgMin       = avgDeliveryMin(all.filter(o => DONE_STATUSES.has(o.status ?? '')));
    const onTime       = onTimeRate(all.filter(o => DONE_STATUSES.has(o.status ?? '')));
    const aktivFahrer  = drivers.filter(d => d.status?.ist_online).length;
    const stornos      = all.filter(o => CANCELLED_STATUSES.has(o.status ?? '')).length;
    const stornoPct    = all.length > 0 ? Math.round((stornos / all.length) * 100) : 0;

    return [
      {
        label: 'Bestellungen',
        value: bestellungen.toString(),
        sub: `${stornos > 0 ? `${stornos} storniert` : 'kein Storno'}`,
        icon: BarChart3,
        color: 'text-matcha-700 dark:text-matcha-300',
        bg: 'bg-matcha-50 dark:bg-matcha-900/20',
        border: 'border-matcha-200 dark:border-matcha-700',
      },
      {
        label: 'Umsatz',
        value: euro(umsatz),
        sub: bestellungen > 0 ? `Ø ${euro(umsatz / bestellungen)}/Bestellung` : '',
        icon: Euro,
        color: 'text-blue-700 dark:text-blue-300',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
      },
      {
        label: 'Ø Lieferzeit',
        value: avgMin !== null ? `${avgMin} Min` : '–',
        sub: avgMin !== null ? (avgMin <= 30 ? 'Ziel erreicht' : 'Über Ziel') : 'Noch keine Daten',
        icon: Clock,
        color: avgMin === null ? 'text-muted-foreground' : avgMin <= 30 ? 'text-matcha-700 dark:text-matcha-300' : 'text-red-600 dark:text-red-400',
        bg: avgMin === null ? 'bg-muted/30' : avgMin <= 30 ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'bg-red-50 dark:bg-red-900/20',
        border: avgMin === null ? 'border-muted' : avgMin <= 30 ? 'border-matcha-200' : 'border-red-300',
      },
      {
        label: 'Pünktlichkeit',
        value: onTime !== null ? `${onTime}%` : '–',
        sub: onTime !== null ? (onTime >= 80 ? 'Sehr gut' : onTime >= 60 ? 'Gut' : 'Verbesserung nötig') : 'Noch keine Daten',
        icon: Target,
        color: onTime === null ? 'text-muted-foreground' : onTime >= 80 ? 'text-matcha-700 dark:text-matcha-300' : onTime >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-red-600',
        bg: onTime === null ? 'bg-muted/30' : onTime >= 80 ? 'bg-matcha-50 dark:bg-matcha-900/20' : onTime >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20',
        border: onTime === null ? 'border-muted' : onTime >= 80 ? 'border-matcha-200' : onTime >= 60 ? 'border-amber-300' : 'border-red-300',
      },
      {
        label: 'Aktive Fahrer',
        value: aktivFahrer.toString(),
        sub: `${drivers.length} gesamt`,
        icon: Users,
        color: aktivFahrer > 0 ? 'text-matcha-700 dark:text-matcha-300' : 'text-amber-600',
        bg: aktivFahrer > 0 ? 'bg-matcha-50 dark:bg-matcha-900/20' : 'bg-amber-50 dark:bg-amber-900/20',
        border: aktivFahrer > 0 ? 'border-matcha-200' : 'border-amber-300',
      },
      {
        label: 'Stornoquote',
        value: `${stornoPct}%`,
        sub: stornoPct <= 5 ? 'Im Rahmen' : 'Erhöht — prüfen',
        icon: stornoPct > 10 ? AlertTriangle : TrendingUp,
        color: stornoPct <= 5 ? 'text-matcha-700 dark:text-matcha-300' : stornoPct <= 10 ? 'text-amber-700 dark:text-amber-300' : 'text-red-600',
        bg: stornoPct <= 5 ? 'bg-matcha-50 dark:bg-matcha-900/20' : stornoPct <= 10 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20',
        border: stornoPct <= 5 ? 'border-matcha-200' : stornoPct <= 10 ? 'border-amber-300' : 'border-red-300',
      },
    ];
  }, [all, drivers]);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Statistiken-Sofort-Cockpit</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {all.length} Bestellungen heute
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <div
                  key={k.label}
                  className={cn('rounded-xl border p-3 space-y-1', k.bg, k.border)}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('h-3.5 w-3.5', k.color)} />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      {k.label}
                    </span>
                  </div>
                  <p className={cn('text-xl font-black tabular-nums', k.color)}>{k.value}</p>
                  {k.sub && <p className="text-[10px] text-muted-foreground">{k.sub}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
