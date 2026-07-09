'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, ChefHat, TrendingUp, Zap } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  fertig_am?: string | null;
}

interface Props {
  orders: Order[];
  /** Max parallel orders the kitchen can handle */
  kapazitaet?: number;
}

function ordersInProgress(orders: Order[]): number {
  return orders.filter((o) => o.status === 'in_zubereitung').length;
}

function ordersQueued(orders: Order[]): number {
  return orders.filter((o) => o.status === 'neu' || o.status === 'bestätigt').length;
}

function avgPrepSecs(orders: Order[]): number {
  const timed = orders
    .filter((o) => o.fertig_am && o.bestellt_am)
    .map((o) => (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 1000);
  if (timed.length === 0) return 25 * 60; // default 25 min
  return timed.reduce((a, b) => a + b, 0) / timed.length;
}

export function KitchenUeberlastungsFruehwarnung({ orders, kapazitaet = 8 }: Props) {
  const inProgress = ordersInProgress(orders);
  const queued = ordersQueued(orders);
  const totalLoad = inProgress + queued;

  const loadPct = Math.min(1, totalLoad / kapazitaet);
  const avgSecs = avgPrepSecs(orders);
  const etaMinToEmpty = queued > 0 ? Math.round((queued * avgSecs) / 60) : 0;

  // Severity
  const severity: 'ok' | 'warn' | 'critical' =
    loadPct >= 1 ? 'critical' : loadPct >= 0.75 ? 'warn' : 'ok';

  if (severity === 'ok') return null;

  const cfg = {
    warn: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      title: 'Küche nähert sich Kapazitätsgrenze',
      titleColor: 'text-amber-800',
      barColor: 'bg-amber-400',
    },
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600',
      title: 'ACHTUNG: Küche überlastet!',
      titleColor: 'text-red-800',
      barColor: 'bg-red-500',
    },
  }[severity];

  return (
    <div className={cn('rounded-2xl border-2 overflow-hidden', cfg.border, cfg.bg)}>
      {/* Alert header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100/50">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-full shrink-0', cfg.iconBg)}>
          {severity === 'critical' ? (
            <AlertTriangle className={cn('h-5 w-5 animate-pulse', cfg.iconColor)} />
          ) : (
            <TrendingUp className={cn('h-5 w-5', cfg.iconColor)} />
          )}
        </div>
        <div className="flex-1">
          <div className={cn('text-xs font-black', cfg.titleColor)}>{cfg.title}</div>
          <div className="text-[10px] text-stone-500">
            {totalLoad} von {kapazitaet} Bestellungen in der Pipeline
          </div>
        </div>
        {severity === 'critical' && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-black text-red-700 animate-pulse">
            KRITISCH
          </span>
        )}
      </div>

      {/* Load bar */}
      <div className="px-4 py-3 space-y-3">
        <div>
          <div className="flex justify-between text-[9px] text-stone-400 mb-1">
            <span>Auslastung</span>
            <span className="font-bold" style={{ color: severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
              {Math.round(loadPct * 100)}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
              style={{ width: `${Math.min(100, loadPct * 100)}%` }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Zap, label: 'In Arbeit', value: inProgress, color: 'text-blue-600' },
            { icon: ChefHat, label: 'Wartend', value: queued, color: queued > 3 ? 'text-red-500' : 'text-amber-600' },
            { icon: AlertTriangle, label: 'Ø Restzeit', value: etaMinToEmpty > 0 ? `${etaMinToEmpty} Min` : '—', color: 'text-stone-600' },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="flex flex-col items-center rounded-xl bg-white/70 py-2">
              <Icon className={cn('h-3.5 w-3.5 mb-0.5', color)} />
              <div className={cn('text-sm font-black', color)}>{value}</div>
              <div className="text-[8px] text-stone-400 text-center">{label}</div>
            </div>
          ))}
        </div>

        {severity === 'critical' && (
          <div className="rounded-lg bg-red-100 px-3 py-2 text-[10px] text-red-700 font-semibold">
            Empfehlung: Kochstart für wartende Bestellungen priorisieren
            {queued > 0 && ` — ${queued} Bestellungen noch in der Warteschlange`}
          </div>
        )}
      </div>
    </div>
  );
}
