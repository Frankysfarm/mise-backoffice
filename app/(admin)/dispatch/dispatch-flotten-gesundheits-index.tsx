'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle2, Clock, Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  stops: { geliefert_am: string | null }[];
};

type ReadyOrder = {
  id: string;
  status: string;
  fertig_am: string | null;
};

interface Props {
  drivers: Driver[];
  batches: Batch[];
  readyOrders: ReadyOrder[];
}

interface HealthDimension {
  label: string;
  score: number;
  detail: string;
  status: 'good' | 'warn' | 'bad';
}

function computeHealth(drivers: Driver[], batches: Batch[], readyOrders: ReadyOrder[], now: number): {
  composite: number;
  dimensions: HealthDimension[];
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  trend: 'up' | 'down' | 'neutral';
} {
  const onlineDrivers = drivers.filter(d => d.ist_online);
  const freeDrivers = onlineDrivers.filter(d => !d.aktueller_batch_id);
  const activeBatches = batches.filter(b =>
    ['unterwegs', 'on_route', 'assigned', 'at_restaurant', 'pickup'].includes(b.status),
  );

  // Dimension 1: Kapazität (freie Fahrer vs. wartende Bestellungen)
  const waitingOrders = readyOrders.filter(o => o.status === 'fertig');
  let kapScore = 100;
  if (waitingOrders.length > 0 && freeDrivers.length === 0) kapScore = 20;
  else if (waitingOrders.length > freeDrivers.length * 2) kapScore = 50;
  else if (waitingOrders.length > freeDrivers.length) kapScore = 75;

  const kapDim: HealthDimension = {
    label: 'Kapazität',
    score: kapScore,
    detail: `${freeDrivers.length} frei · ${waitingOrders.length} wartend`,
    status: kapScore >= 80 ? 'good' : kapScore >= 50 ? 'warn' : 'bad',
  };

  // Dimension 2: SLA (überfällige Touren)
  let overdueCount = 0;
  for (const b of activeBatches) {
    if (!b.startzeit || b.total_eta_min == null) continue;
    const etaMs = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    if (now > etaMs + 5 * 60_000) overdueCount++;
  }
  const slaScore = activeBatches.length === 0 ? 100 :
    Math.max(0, 100 - (overdueCount / activeBatches.length) * 100);
  const slaDim: HealthDimension = {
    label: 'SLA',
    score: Math.round(slaScore),
    detail: overdueCount === 0 ? 'Alle im Plan' : `${overdueCount} überfällig`,
    status: slaScore >= 90 ? 'good' : slaScore >= 70 ? 'warn' : 'bad',
  };

  // Dimension 3: Auslastung (aktive Touren vs. Online-Fahrer)
  const utilPct = onlineDrivers.length === 0 ? 100 :
    (activeBatches.length / onlineDrivers.length) * 100;
  const utilScore = utilPct > 120 ? 40 : utilPct > 100 ? 60 : utilPct > 60 ? 90 : utilPct > 30 ? 80 : 70;
  const utilDim: HealthDimension = {
    label: 'Auslastung',
    score: Math.round(utilScore),
    detail: `${activeBatches.length} Touren · ${onlineDrivers.length} online`,
    status: utilScore >= 80 ? 'good' : utilScore >= 60 ? 'warn' : 'bad',
  };

  // Dimension 4: Wartezeit (älteste fertige Bestellung)
  let maxWaitMin = 0;
  for (const o of waitingOrders) {
    if (!o.fertig_am) continue;
    const waitMin = (now - new Date(o.fertig_am).getTime()) / 60_000;
    if (waitMin > maxWaitMin) maxWaitMin = waitMin;
  }
  const waitScore = maxWaitMin === 0 ? 100 :
    maxWaitMin < 5 ? 90 :
    maxWaitMin < 10 ? 70 :
    maxWaitMin < 20 ? 40 : 20;
  const waitDim: HealthDimension = {
    label: 'Wartezeit',
    score: Math.round(waitScore),
    detail: maxWaitMin === 0 ? 'Keine Wartezeit' : `Max ${Math.floor(maxWaitMin)} Min`,
    status: waitScore >= 80 ? 'good' : waitScore >= 50 ? 'warn' : 'bad',
  };

  const composite = Math.round((kapScore + slaScore + utilScore + waitScore) / 4);
  const grade: 'A' | 'B' | 'C' | 'D' | 'F' =
    composite >= 90 ? 'A' : composite >= 75 ? 'B' : composite >= 60 ? 'C' : composite >= 40 ? 'D' : 'F';

  return {
    composite,
    dimensions: [kapDim, slaDim, utilDim, waitDim],
    grade,
    trend: 'neutral',
  };
}

export function DispatchFlottenGesundheitsIndex({ drivers, batches, readyOrders }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const health = computeHealth(drivers, batches, readyOrders, now);

  const gradeBg = {
    A: 'from-matcha-600 to-matcha-500',
    B: 'from-blue-600 to-blue-500',
    C: 'from-amber-500 to-amber-400',
    D: 'from-orange-600 to-orange-500',
    F: 'from-red-600 to-red-500',
  }[health.grade];

  const scoreColor = health.composite >= 80 ? 'text-matcha-700' :
    health.composite >= 60 ? 'text-amber-700' : 'text-red-700';

  const statusColors = {
    good: { bar: 'bg-matcha-500', dot: 'bg-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' },
    warn: { bar: 'bg-amber-400', dot: 'bg-amber-400', text: 'text-amber-700', bg: 'bg-amber-50' },
    bad: { bar: 'bg-red-500', dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50' },
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header with composite score */}
      <div className={cn('bg-gradient-to-r px-4 py-3 flex items-center gap-4', gradeBg)}>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Activity size={14} className="text-white/80" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
              Flotten-Gesundheits-Index
            </span>
          </div>
          <div className="text-white/90 text-[10px] mt-0.5">Echtzeit-Betriebsstatus</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-white tabular-nums leading-none">{health.composite}</div>
          <div className="text-[10px] text-white/70 mt-0.5">von 100</div>
        </div>
        <div className="shrink-0">
          <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-2xl font-black text-white">{health.grade}</span>
          </div>
        </div>
      </div>

      {/* Dimension breakdown */}
      <div className="p-4 space-y-2.5">
        {health.dimensions.map(dim => {
          const colors = statusColors[dim.status];
          return (
            <div key={dim.label} className={cn('rounded-lg px-3 py-2 flex items-center gap-3', colors.bg)}>
              <div className={cn('h-2 w-2 rounded-full shrink-0', colors.dot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-[11px] font-bold', colors.text)}>{dim.label}</span>
                  <span className={cn('text-[10px] font-black tabular-nums', colors.text)}>{dim.score}</span>
                </div>
                <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
                    style={{ width: `${dim.score}%` }}
                  />
                </div>
                <div className={cn('text-[9px] mt-0.5', colors.text, 'opacity-70')}>{dim.detail}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Status summary */}
      <div className="px-4 pb-3">
        <div className={cn(
          'rounded-lg px-3 py-2 text-[10px] font-medium',
          health.composite >= 80 ? 'bg-matcha-50 text-matcha-700' :
          health.composite >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700',
        )}>
          {health.composite >= 90 ? '✓ Betrieb läuft optimal — alle Dimensionen im grünen Bereich.' :
           health.composite >= 75 ? '⚡ Betrieb gut — kleine Optimierungen möglich.' :
           health.composite >= 60 ? '⚠ Betrieb unter Druck — Aufmerksamkeit erforderlich.' :
           health.composite >= 40 ? '🚨 Kritischer Zustand — sofortige Maßnahmen nötig!' :
           '🔴 Flottenausfall-Risiko — alle Kapazitäten mobilisieren!'}
        </div>
      </div>
    </div>
  );
}
