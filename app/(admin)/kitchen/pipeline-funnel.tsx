'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, CheckCircle2, Truck } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  typ: string;
  bestellt_am: string | null;
  fertig_am: string | null;
};

type Stage = {
  key: string;
  label: string;
  statuses: string[];
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
};

const STAGES: Stage[] = [
  {
    key: 'offen',
    label: 'Offen',
    statuses: ['neu', 'akzeptiert'],
    icon: <Clock className="h-3.5 w-3.5" />,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
  },
  {
    key: 'kochend',
    label: 'In Zubereitung',
    statuses: ['in_zubereitung'],
    icon: <ChefHat className="h-3.5 w-3.5" />,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-800',
  },
  {
    key: 'fertig',
    label: 'Fertig / Wartet',
    statuses: ['fertig'],
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    color: 'text-matcha-700',
    bgColor: 'bg-matcha-50',
    borderColor: 'border-matcha-300',
    textColor: 'text-matcha-800',
  },
  {
    key: 'abgeholt',
    label: 'Abgeholt / Geliefert',
    statuses: ['abgeholt', 'geliefert', 'beendet', 'abgeschlossen'],
    icon: <Truck className="h-3.5 w-3.5" />,
    color: 'text-stone-500',
    bgColor: 'bg-stone-50',
    borderColor: 'border-stone-200',
    textColor: 'text-stone-600',
  },
];

/* ──────────────────────────────────────────────────────────────
   KitchenPipelineFunnel
   Kompakter horizontaler Funnel-Überblick aller Bestellungen
   nach Küchen-Phase. Hilft sofort Engpässe zu erkennen.
   ────────────────────────────────────────────────────────────── */
export function KitchenPipelineFunnel({ orders }: { orders: Order[] }) {
  const stageCounts = STAGES.map((stage) => {
    const stageOrders = orders.filter((o) => stage.statuses.includes(o.status));
    let avgWaitMin: number | null = null;
    if (stage.key === 'fertig') {
      const waits = stageOrders
        .filter((o) => o.fertig_am)
        .map((o) => Math.floor((Date.now() - new Date(o.fertig_am!).getTime()) / 60_000));
      if (waits.length > 0) avgWaitMin = Math.round(waits.reduce((s, v) => s + v, 0) / waits.length);
    }
    if (stage.key === 'kochend') {
      const waits = stageOrders
        .filter((o) => o.bestellt_am)
        .map((o) => Math.floor((Date.now() - new Date(o.bestellt_am!).getTime()) / 60_000));
      if (waits.length > 0) avgWaitMin = Math.round(waits.reduce((s, v) => s + v, 0) / waits.length);
    }
    return { stage, count: stageOrders.length, avgWaitMin };
  });

  const totalActive = stageCounts
    .filter((s) => s.stage.key !== 'abgeholt')
    .reduce((sum, s) => sum + s.count, 0);

  const maxCount = Math.max(...stageCounts.map((s) => s.count), 1);

  if (totalActive === 0 && stageCounts[3].count === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Küchen-Pipeline</span>
        <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {totalActive} aktiv
        </span>
      </div>

      <div className="grid grid-cols-4 divide-x">
        {stageCounts.map(({ stage, count, avgWaitMin }, idx) => {
          const barPct = Math.round((count / maxCount) * 100);
          const isBottleneck = stage.key === 'fertig' && count >= 3;
          return (
            <div
              key={stage.key}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-3 transition-colors',
                isBottleneck && 'bg-red-50',
              )}
            >
              {/* Bar */}
              <div className="w-full flex flex-col items-center gap-1">
                <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      stage.key === 'offen' ? 'bg-blue-400' :
                      stage.key === 'kochend' ? 'bg-amber-400' :
                      stage.key === 'fertig' ? (isBottleneck ? 'bg-red-500' : 'bg-matcha-500') :
                      'bg-stone-300',
                    )}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* Count */}
              <div className={cn('text-2xl font-black tabular-nums leading-none', stage.textColor, isBottleneck && 'text-red-700')}>
                {count}
              </div>

              {/* Icon + Label */}
              <div className={cn('flex items-center gap-1', stage.color, isBottleneck && 'text-red-600')}>
                {stage.icon}
                <span className="text-[9px] font-bold uppercase tracking-wide hidden sm:inline">
                  {stage.label}
                </span>
              </div>

              {/* Avg wait */}
              {avgWaitMin !== null && count > 0 && (
                <div className={cn(
                  'text-[9px] font-semibold tabular-nums',
                  stage.key === 'fertig' && avgWaitMin > 5 ? 'text-red-500' :
                  stage.key === 'fertig' && avgWaitMin > 2 ? 'text-amber-500' :
                  'text-muted-foreground',
                )}>
                  ⌀ {avgWaitMin} Min
                </div>
              )}

              {/* Engpass-Warnung */}
              {isBottleneck && (
                <div className="text-[8px] font-bold text-red-600 animate-pulse">
                  ENGPASS
                </div>
              )}

              {/* Pfeil zwischen Stages (nicht nach letztem) */}
              {idx < STAGES.length - 1 && (
                <div className="hidden sm:block absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-10 text-muted-foreground text-xs">
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
