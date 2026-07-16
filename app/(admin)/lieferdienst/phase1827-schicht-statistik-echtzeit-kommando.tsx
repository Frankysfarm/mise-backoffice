'use client';

/**
 * Phase 1827 — Schicht-Statistik-Echtzeit-Kommando
 * Kompaktes Statistiken-Dashboard: zeigt die wichtigsten Schichtkennzahlen
 * in Echtzeit auf einen Blick — Umsatz, Lieferungen, Ø Zeit, Pünktlichkeit, Fahrerstatus.
 * Designt für den Überblick ohne Tab-Wechsel.
 */

import { useMemo } from 'react';
import { TrendingUp, Clock, Euro, Bike, CheckCircle2, XCircle, Target } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  gesamtbetrag?: number | null;
  total?: number | null;
  acceptedAt?: string | null;
  doneAt?: string | null;
  bestellt_am?: string | null;
  typ?: string | null;
};

type Driver = {
  id: string;
  name?: string;
  ist_online?: boolean;
  state?: string;
};

type Props = {
  orders: Order[];
  completedOrders: Order[];
  drivers: Driver[];
  schichtStart?: string | null;
};

type Stat = {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: 'matcha' | 'amber' | 'red' | 'blue';
  highlight?: boolean;
};

export function LieferdienstPhase1827SchichtStatistikEchtzeitKommando({
  orders,
  completedOrders,
  drivers,
  schichtStart,
}: Props) {
  const stats = useMemo<Stat[]>(() => {
    const allToday = [...orders, ...completedOrders];
    const done = completedOrders.filter(o => o.status === 'done' || o.status === 'delivered');
    const rejected = completedOrders.filter(o => o.status === 'rejected' || o.status === 'cancelled');
    const lieferungen = done.filter(o => !o.typ || o.typ === 'lieferung');

    const revenue = done.reduce((s, o) => s + ((o as any).total ?? o.gesamtbetrag ?? 0), 0);

    const prepTimes = done
      .filter(o => o.acceptedAt && o.doneAt)
      .map(o => (new Date(o.doneAt!).getTime() - new Date(o.acceptedAt!).getTime()) / 60_000);
    const avgPrep = prepTimes.length > 0
      ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length
      : null;

    const onlineDrivers = drivers.filter(
      d => d.ist_online || d.state === 'on_route' || d.state === 'idle' || d.state === 'assigned',
    ).length;

    const schichtDurMin = schichtStart
      ? (Date.now() - new Date(schichtStart).getTime()) / 60_000
      : null;
    const throughput = schichtDurMin && schichtDurMin >= 5
      ? (done.length / schichtDurMin) * 60
      : null;

    const rejectionRate = allToday.length > 0
      ? (rejected.length / allToday.length) * 100
      : 0;

    const onTimeCount = done.filter(o => {
      if (!o.acceptedAt || !o.doneAt) return false;
      const prepMin = (new Date(o.doneAt).getTime() - new Date(o.acceptedAt).getTime()) / 60_000;
      return prepMin <= 35;
    }).length;
    const punctuality = done.length > 0 ? (onTimeCount / done.length) * 100 : null;

    return [
      {
        label: 'Umsatz',
        value: euro(revenue),
        sub: `${done.length} Bestellungen`,
        icon: <Euro className="h-4 w-4" />,
        accent: 'matcha',
        highlight: revenue > 0,
      },
      {
        label: 'Lieferungen',
        value: String(lieferungen.length),
        sub: throughput ? `${throughput.toFixed(1)}/h` : '–',
        icon: <Bike className="h-4 w-4" />,
        accent: 'blue',
      },
      {
        label: 'Ø Zubereitungszeit',
        value: avgPrep !== null ? `${Math.round(avgPrep)} Min` : '–',
        sub: prepTimes.length > 0 ? `${prepTimes.length} Messungen` : 'noch keine Daten',
        icon: <Clock className="h-4 w-4" />,
        accent: avgPrep !== null && avgPrep > 30 ? 'red' : avgPrep !== null && avgPrep > 22 ? 'amber' : 'matcha',
      },
      {
        label: 'Pünktlichkeit',
        value: punctuality !== null ? `${Math.round(punctuality)}%` : '–',
        sub: punctuality !== null ? (punctuality >= 80 ? 'Sehr gut' : punctuality >= 60 ? 'Okay' : 'Verbesserung nötig') : 'noch keine Daten',
        icon: <Target className="h-4 w-4" />,
        accent: punctuality === null ? 'blue' : punctuality >= 80 ? 'matcha' : punctuality >= 60 ? 'amber' : 'red',
      },
      {
        label: 'Fahrer online',
        value: `${onlineDrivers}/${drivers.length}`,
        sub: onlineDrivers === 0 ? 'Niemand online' : onlineDrivers === 1 ? '1 aktiv' : `${onlineDrivers} aktiv`,
        icon: <CheckCircle2 className="h-4 w-4" />,
        accent: onlineDrivers === 0 ? 'red' : onlineDrivers >= 2 ? 'matcha' : 'amber',
      },
      {
        label: 'Ablehnungsrate',
        value: `${Math.round(rejectionRate)}%`,
        sub: `${rejected.length} abgelehnt`,
        icon: <XCircle className="h-4 w-4" />,
        accent: rejectionRate > 15 ? 'red' : rejectionRate > 5 ? 'amber' : 'matcha',
      },
    ];
  }, [orders, completedOrders, drivers, schichtStart]);

  const accentStyles = {
    matcha: {
      bg: 'bg-matcha-50 dark:bg-matcha-950/30',
      border: 'border-matcha-200 dark:border-matcha-800',
      icon: 'bg-matcha-500 text-white',
      label: 'text-matcha-700 dark:text-matcha-300',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
      icon: 'bg-amber-400 text-white',
      label: 'text-amber-700 dark:text-amber-300',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-200 dark:border-red-800',
      icon: 'bg-red-500 text-white',
      label: 'text-red-700 dark:text-red-300',
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'bg-blue-500 text-white',
      label: 'text-blue-700 dark:text-blue-300',
    },
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">
          Schicht-Statistiken · Echtzeit
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
        {stats.map(stat => {
          const s = accentStyles[stat.accent];
          return (
            <div
              key={stat.label}
              className={cn(
                'rounded-xl border p-3 flex flex-col gap-1',
                s.bg,
                s.border,
              )}
            >
              <div className="flex items-center gap-2">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded-lg shrink-0', s.icon)}>
                  {stat.icon}
                </div>
                <span className={cn('text-[10px] font-bold uppercase tracking-wider', s.label)}>
                  {stat.label}
                </span>
              </div>
              <p className="text-xl font-black tabular-nums text-foreground leading-none">
                {stat.value}
              </p>
              {stat.sub && (
                <p className="text-[10px] text-muted-foreground">{stat.sub}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
