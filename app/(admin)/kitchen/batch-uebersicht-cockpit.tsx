'use client';

import { useEffect, useState } from 'react';
import { Clock, Package, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type Phase = 'bereit' | 'kochend' | 'wartend';
type Urgency = 'ok' | 'knapp' | 'kritisch';

interface EnrichedOrder {
  order: Order;
  timing: KitchenTiming | undefined;
  phase: Phase;
  urgency: Urgency;
  secsLeft: number | null;
}

function getPhase(order: Order, timing: KitchenTiming | undefined): Phase {
  if (timing?.status === 'cooking') return 'kochend';
  if (timing?.status === 'ready' || order.status === 'fertig') return 'bereit';
  return 'wartend';
}

function getSecsLeft(timing: KitchenTiming | undefined): number | null {
  if (!timing?.ready_target) return null;
  return Math.round((new Date(timing.ready_target).getTime() - Date.now()) / 1000);
}

function getUrgency(secsLeft: number | null): Urgency {
  if (secsLeft === null) return 'ok';
  if (secsLeft < 0) return 'kritisch';
  if (secsLeft < 180) return 'knapp';
  return 'ok';
}

function fmt(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = secs < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

const URGENCY_STYLE: Record<Urgency, { badge: string; bar: string; text: string }> = {
  ok:       { badge: 'bg-matcha-100 text-matcha-700', bar: 'bg-matcha-500', text: 'text-matcha-700' },
  knapp:    { badge: 'bg-amber-100 text-amber-700',   bar: 'bg-amber-500',  text: 'text-amber-700'  },
  kritisch: { badge: 'bg-red-100 text-red-700',       bar: 'bg-red-500',    text: 'text-red-700'    },
};

const PHASE_ICON: Record<Phase, typeof ChefHat> = {
  kochend: ChefHat,
  bereit:  Package,
  wartend: Clock,
};

export function KitchenBatchUebersichtCockpit({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = orders.filter(
    o => o.status !== 'geliefert' && o.status !== 'storniert' && o.status !== 'abgebrochen',
  );

  if (active.length === 0) return null;

  const enriched: EnrichedOrder[] = active.map(order => {
    const timing = timings.find(t => t.order_id === order.id);
    const phase = getPhase(order, timing);
    const secsLeft = getSecsLeft(timing);
    const urgency = getUrgency(secsLeft);
    return { order, timing, phase, urgency, secsLeft };
  });

  const sorted = [...enriched].sort((a, b) => {
    const urgencyOrder: Urgency[] = ['kritisch', 'knapp', 'ok'];
    const ua = urgencyOrder.indexOf(a.urgency);
    const ub = urgencyOrder.indexOf(b.urgency);
    if (ua !== ub) return ua - ub;
    if (a.secsLeft !== null && b.secsLeft !== null) return a.secsLeft - b.secsLeft;
    return 0;
  });

  const counts = {
    kochend: enriched.filter(e => e.phase === 'kochend').length,
    wartend: enriched.filter(e => e.phase === 'wartend').length,
    bereit:  enriched.filter(e => e.phase === 'bereit').length,
    kritisch: enriched.filter(e => e.urgency === 'kritisch').length,
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Batch-Übersicht · {active.length} Aktiv
        </span>
        <div className="ml-auto flex items-center gap-2">
          {counts.kritisch > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 animate-pulse">
              {counts.kritisch} überfällig
            </span>
          )}
          <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {counts.kochend} kochend
          </span>
        </div>
      </div>

      {/* Phase Summary */}
      <div className="grid grid-cols-3 divide-x border-b border-stone-100">
        {([
          { label: 'Kochend', count: counts.kochend, color: 'text-amber-600 bg-amber-50' },
          { label: 'Wartend', count: counts.wartend, color: 'text-blue-600 bg-blue-50' },
          { label: 'Bereit',  count: counts.bereit,  color: 'text-matcha-700 bg-matcha-50' },
        ] as const).map(({ label, count, color }) => (
          <div key={label} className={cn('flex flex-col items-center py-2', color)}>
            <span className="text-lg font-black tabular-nums">{count}</span>
            <span className="text-[9px] font-semibold uppercase tracking-wide">{label}</span>
          </div>
        ))}
      </div>

      {/* Order List */}
      <div className="divide-y divide-stone-100 max-h-64 overflow-y-auto">
        {sorted.map(({ order, timing, phase, urgency, secsLeft }) => {
          const st = URGENCY_STYLE[urgency];
          const Icon = PHASE_ICON[phase];
          const totalSecs = (timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15) * 60;
          const elapsed = secsLeft !== null ? totalSecs - secsLeft : 0;
          const progress = totalSecs > 0 ? Math.min(100, Math.max(0, (elapsed / totalSecs) * 100)) : 0;

          return (
            <div key={order.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className={cn('shrink-0 rounded-full p-1.5', st.badge)}>
                <Icon className="h-3 w-3" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold truncate">{order.kunde_name}</span>
                  <span className="shrink-0 font-mono text-[9px] text-muted-foreground">
                    #{order.bestellnummer}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', st.bar)}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="shrink-0 text-right">
                {secsLeft !== null ? (
                  <>
                    <div className={cn('font-mono text-sm font-black tabular-nums', st.text)}>
                      {fmt(secsLeft)}
                    </div>
                    <div className="text-[8px] text-muted-foreground">
                      {secsLeft < 0 ? 'überfällig' : 'verbleibend'}
                    </div>
                  </>
                ) : (
                  <div className="text-xs font-semibold text-muted-foreground capitalize">{phase}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
