'use client';

import { useEffect, useState } from 'react';
import { Clock, ChefHat, AlertTriangle, CheckCircle2, Zap, Timer, TrendingUp, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { name: string; menge: number }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type UrgencyLevel = 'ok' | 'warn' | 'urgent' | 'overdue';

function getUrgency(secsLeft: number): UrgencyLevel {
  if (secsLeft <= 0) return 'overdue';
  if (secsLeft <= 120) return 'urgent';
  if (secsLeft <= 300) return 'warn';
  return 'ok';
}

function formatCountdown(secsLeft: number): string {
  const abs = Math.abs(secsLeft);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secsLeft < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function getSecsLeft(order: Order, timing: KitchenTiming | undefined): number {
  const now = Date.now();
  if (timing?.ready_target) {
    return Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  }
  if (order.bestellt_am) {
    const elapsed = Math.floor((now - new Date(order.bestellt_am).getTime()) / 1000);
    return (order.geschaetzte_zubereitung_min ?? 15) * 60 - elapsed;
  }
  return (order.geschaetzte_zubereitung_min ?? 15) * 60;
}

const URGENCY_STYLE: Record<UrgencyLevel, { border: string; bg: string; text: string; badge: string; label: string }> = {
  ok:      { border: 'border-matcha-300',  bg: 'bg-matcha-50',  text: 'text-matcha-700',  badge: 'bg-matcha-100 text-matcha-700',  label: 'Im Plan' },
  warn:    { border: 'border-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-800',    label: 'Bald fertig' },
  urgent:  { border: 'border-orange-500',  bg: 'bg-orange-50',  text: 'text-orange-700',  badge: 'bg-orange-100 text-orange-700',  label: 'Jetzt fertigmachen!' },
  overdue: { border: 'border-red-500',     bg: 'bg-red-50',     text: 'text-red-700',     badge: 'bg-red-100 text-red-700',        label: 'Überfällig!' },
};

function MiniOrderRow({ order, timing }: { order: Order; timing: KitchenTiming | undefined }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const secsLeft = getSecsLeft(order, timing);
  const urgency = getUrgency(secsLeft);
  const style = URGENCY_STYLE[urgency];

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-lg border px-2 py-1.5 transition-all',
      style.border, style.bg,
      urgency === 'overdue' && 'animate-pulse',
    )}>
      <div className={cn('font-mono text-sm font-black tabular-nums shrink-0 w-10 text-right', style.text)}>
        {formatCountdown(secsLeft)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-black truncate">{order.bestellnummer} · {order.kunde_name}</div>
        <div className="text-[9px] text-muted-foreground truncate">
          {order.items.slice(0, 2).map(i => `${i.menge}× ${i.name}`).join(', ')}
          {order.items.length > 2 && ` +${order.items.length - 2}`}
        </div>
      </div>
      <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0', style.badge)}>
        {style.label}
      </span>
    </div>
  );
}

export function KitchenSmartKochzeitBoard({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const active = orders.filter(o => ['bestätigt', 'in_zubereitung', 'neu'].includes(o.status));
  if (active.length === 0) return null;

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const withSecs = active.map(o => ({ order: o, secsLeft: getSecsLeft(o, timingMap.get(o.id)) }));
  const sorted = [...withSecs].sort((a, b) => a.secsLeft - b.secsLeft);

  const overdueCount = sorted.filter(x => x.secsLeft <= 0).length;
  const urgentCount  = sorted.filter(x => x.secsLeft > 0 && x.secsLeft <= 120).length;
  const warnCount    = sorted.filter(x => x.secsLeft > 120 && x.secsLeft <= 300).length;
  const okCount      = active.length - overdueCount - urgentCount - warnCount;

  const healthScore = active.length === 0 ? 100
    : Math.round((okCount * 100 + warnCount * 65 + urgentCount * 25 + overdueCount * 0) / active.length);

  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 55 ? '#f59e0b' : healthScore >= 30 ? '#f97316' : '#ef4444';

  const avgWaitSec = withSecs.length === 0 ? 0
    : withSecs.reduce((s, x) => s + Math.max(0, x.secsLeft), 0) / withSecs.length;
  const avgWaitMin = Math.round(avgWaitSec / 60);

  const nextDoneSecs = sorted.find(x => x.secsLeft > 0)?.secsLeft ?? null;

  // Split by urgency for display
  const overdueOrders = sorted.filter(x => x.secsLeft <= 0);
  const urgentOrders  = sorted.filter(x => x.secsLeft > 0 && x.secsLeft <= 120);
  const warnOrders    = sorted.filter(x => x.secsLeft > 120 && x.secsLeft <= 300);
  const okOrders      = sorted.filter(x => x.secsLeft > 300);

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-sm font-bold">Smart-Kochzeit-Board</span>
        <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
          {active.length} aktiv
        </span>
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            ⚠ {overdueCount} überfällig
          </span>
        )}
        {urgentCount > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
            ⚡ {urgentCount} dringend
          </span>
        )}
      </div>

      {/* Health Bar + KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2 space-y-1">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-muted-foreground">
            <span>Küchen-Gesundheit</span>
            <span style={{ color: healthColor }}>{healthScore}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${healthScore}%`, backgroundColor: healthColor }}
            />
          </div>
          <div className="flex gap-2 flex-wrap text-[9px] text-muted-foreground">
            {okCount > 0 && <span className="text-matcha-600 font-bold">{okCount} ✓ Ok</span>}
            {warnCount > 0 && <span className="text-amber-600 font-bold">{warnCount} ⚠ Bald</span>}
            {urgentCount > 0 && <span className="text-orange-600 font-bold">{urgentCount} ⚡ Dringend</span>}
            {overdueCount > 0 && <span className="text-red-600 font-bold animate-pulse">{overdueCount} ✕ Überfällig</span>}
          </div>
        </div>
        <div className="space-y-1">
          {nextDoneSecs != null && (
            <div className="flex flex-col items-center justify-center rounded-lg bg-matcha-50 border border-matcha-200 px-2 py-1.5">
              <div className="text-[9px] font-bold text-muted-foreground uppercase">Nächste fertig</div>
              <div className="font-mono text-base font-black text-matcha-700 tabular-nums">
                {formatCountdown(nextDoneSecs)}
              </div>
            </div>
          )}
          {avgWaitMin > 0 && (
            <div className="text-center text-[9px] text-muted-foreground">
              ⌀ {avgWaitMin} Min verbleibend
            </div>
          )}
        </div>
      </div>

      {/* Critical Orders */}
      {(overdueOrders.length > 0 || urgentOrders.length > 0) && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-red-600">
            <AlertTriangle className="h-3 w-3" />
            Sofortige Aufmerksamkeit
          </div>
          {[...overdueOrders, ...urgentOrders].map(({ order }) => (
            <MiniOrderRow key={order.id} order={order} timing={timingMap.get(order.id)} />
          ))}
        </div>
      )}

      {/* Warn Orders */}
      {warnOrders.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-600">
            <Timer className="h-3 w-3" />
            Bald fertig ({warnOrders.length})
          </div>
          {warnOrders.map(({ order }) => (
            <MiniOrderRow key={order.id} order={order} timing={timingMap.get(order.id)} />
          ))}
        </div>
      )}

      {/* OK Orders - collapsed by default if many */}
      {okOrders.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-[9px] font-black uppercase text-matcha-600 flex items-center gap-1 list-none">
            <TrendingUp className="h-3 w-3" />
            Im Plan: {okOrders.length} Bestellungen
            <span className="ml-auto text-[8px] text-muted-foreground group-open:hidden">▼ Zeigen</span>
            <span className="ml-auto text-[8px] text-muted-foreground hidden group-open:inline">▲ Ausblenden</span>
          </summary>
          <div className="mt-1.5 space-y-1">
            {okOrders.map(({ order }) => (
              <MiniOrderRow key={order.id} order={order} timing={timingMap.get(order.id)} />
            ))}
          </div>
        </details>
      )}

      {/* Optimization Tips */}
      {overdueCount > 1 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-[10px] text-red-700">
          <Flame className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-500" />
          <span>
            <strong>{overdueCount} Bestellungen überfällig!</strong> Priorisierung erforderlich — höchste Dringlichkeit zuerst abarbeiten.
          </span>
        </div>
      )}
      {overdueCount === 0 && urgentCount >= 3 && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-[10px] text-orange-700">
          <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-500" />
          <span>
            <strong>{urgentCount} Bestellungen unter 2 Minuten!</strong> Alle verfügbaren Stationen aktivieren.
          </span>
        </div>
      )}
      {healthScore >= 90 && overdueCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-matcha-200 bg-matcha-50 px-2 py-1.5 text-[10px] text-matcha-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-matcha-500" />
          <span><strong>Küche läuft optimal!</strong> Alle Bestellungen im Zeitplan.</span>
        </div>
      )}
    </div>
  );
}
