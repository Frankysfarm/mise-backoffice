'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

type SignalLevel = 'ok' | 'soon' | 'critical' | 'overdue';

interface EnrichedSignal {
  order: Order;
  timing: Timing | null;
  secondsRemaining: number | null;
  level: SignalLevel;
}

function getSecondsRemaining(timing: Timing | null, now: Date): number | null {
  if (!timing) return null;
  if (timing.ready_target) {
    return Math.round((new Date(timing.ready_target).getTime() - now.getTime()) / 1000);
  }
  if (timing.cook_start_at && timing.prep_min !== null) {
    const readyAt = new Date(
      new Date(timing.cook_start_at).getTime() + timing.prep_min * 60 * 1000,
    );
    return Math.round((readyAt.getTime() - now.getTime()) / 1000);
  }
  return null;
}

function getLevel(seconds: number | null): SignalLevel {
  if (seconds === null) return 'ok';
  if (seconds < 0) return 'overdue';
  if (seconds < 300) return 'critical';
  if (seconds < 600) return 'soon';
  return 'ok';
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = seconds < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

const levelConfig: Record<
  SignalLevel,
  {
    bg: string;
    ring: string;
    text: string;
    label: string;
    summaryLabel: string;
    pulse: boolean;
  }
> = {
  ok: {
    bg: 'bg-[#4a7c59]',
    ring: 'ring-[#4a7c59]/40',
    text: 'text-white',
    label: 'OK',
    summaryLabel: 'OK',
    pulse: false,
  },
  soon: {
    bg: 'bg-yellow-400',
    ring: 'ring-yellow-300',
    text: 'text-yellow-900',
    label: 'Knapp',
    summaryLabel: 'Knapp',
    pulse: false,
  },
  critical: {
    bg: 'bg-orange-500',
    ring: 'ring-orange-400',
    text: 'text-white',
    label: 'Kritisch',
    summaryLabel: 'Kritisch',
    pulse: true,
  },
  overdue: {
    bg: 'bg-red-600',
    ring: 'ring-red-400',
    text: 'text-white',
    label: 'Überfällig',
    summaryLabel: 'Überfällig',
    pulse: true,
  },
};

interface DetailPanelProps {
  signal: EnrichedSignal;
}

function DetailPanel({ signal }: DetailPanelProps) {
  const cfg = levelConfig[signal.level];

  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm transition-all',
        signal.level === 'overdue' && 'border-red-300 bg-red-50',
        signal.level === 'critical' && 'border-orange-300 bg-orange-50',
        signal.level === 'soon' && 'border-yellow-300 bg-yellow-50',
        signal.level === 'ok' && 'border-green-200 bg-green-50',
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <span className="font-bold text-gray-900">#{signal.order.bestellnummer}</span>
          <span className="ml-2 text-gray-500 text-xs capitalize">{signal.order.typ}</span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-semibold border',
            signal.level === 'ok' && 'bg-green-100 text-green-800 border-green-200',
            signal.level === 'soon' && 'bg-yellow-100 text-yellow-800 border-yellow-200',
            signal.level === 'critical' && 'bg-orange-100 text-orange-800 border-orange-300',
            signal.level === 'overdue' && 'bg-red-100 text-red-800 border-red-300',
          )}
        >
          {cfg.label}
        </Badge>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        <div>
          <span className="text-gray-400">Status:</span>{' '}
          <span className="font-medium capitalize">{signal.order.status.replace('_', ' ')}</span>
        </div>
        <div>
          <span className="text-gray-400">Typ:</span>{' '}
          <span className="font-medium capitalize">{signal.order.typ}</span>
        </div>
        {signal.timing?.cook_start_at && (
          <div>
            <span className="text-gray-400">Gestartet:</span>{' '}
            <span className="font-medium">
              {new Date(signal.timing.cook_start_at).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
        {signal.timing?.ready_target && (
          <div>
            <span className="text-gray-400">Fertig um:</span>{' '}
            <span className="font-medium">
              {new Date(signal.timing.ready_target).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        )}
        {signal.secondsRemaining !== null && (
          <div className="col-span-2">
            <span className="text-gray-400">Verbleibend:</span>{' '}
            <span
              className={cn(
                'font-mono font-bold',
                signal.level === 'ok' && 'text-green-700',
                signal.level === 'soon' && 'text-yellow-700',
                signal.level === 'critical' && 'text-orange-700',
                signal.level === 'overdue' && 'text-red-700',
              )}
            >
              {formatCountdown(signal.secondsRemaining)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function KitchenLiveCookSignal({ orders, timings }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const signals: EnrichedSignal[] = useCallback(() => {
    const activeOrders = orders.filter(
      (o) => o.status === 'in_zubereitung' || o.status === 'bestätigt',
    );

    return activeOrders.map((order): EnrichedSignal => {
      const timing = timings.find((t) => t.order_id === order.id) ?? null;
      const secondsRemaining = getSecondsRemaining(timing, now);
      const level = getLevel(secondsRemaining);
      return { order, timing, secondsRemaining, level };
    });
  }, [orders, timings, now])();

  // Sort: overdue first, then critical, soon, ok
  const levelOrder: Record<SignalLevel, number> = {
    overdue: 0,
    critical: 1,
    soon: 2,
    ok: 3,
  };
  const sorted = [...signals].sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  // Counts
  const counts: Record<SignalLevel, number> = { ok: 0, soon: 0, critical: 0, overdue: 0 };
  for (const s of sorted) counts[s.level]++;

  const selectedSignal = sorted.find((s) => s.order.id === selectedOrderId) ?? null;

  function handleCircleClick(orderId: string) {
    setSelectedOrderId((prev) => (prev === orderId ? null : orderId));
  }

  if (sorted.length === 0) {
    return (
      <Card className="w-full border border-gray-200 shadow-sm">
        <CardContent className="py-4 px-4">
          <p className="text-sm text-gray-400 text-center">Keine Bestellungen in Zubereitung</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border border-gray-200 shadow-sm overflow-hidden">
      <CardContent className="p-3 space-y-3">
        {/* Summary bar */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs font-medium text-gray-600">
          {counts.ok > 0 && (
            <span className="flex items-center gap-1 text-green-700">
              <span className="inline-block w-2 h-2 rounded-full bg-[#4a7c59]" />
              {counts.ok} OK
            </span>
          )}
          {counts.ok > 0 && (counts.soon > 0 || counts.critical > 0 || counts.overdue > 0) && (
            <span className="text-gray-300">·</span>
          )}
          {counts.soon > 0 && (
            <span className="flex items-center gap-1 text-yellow-700">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
              {counts.soon} Knapp
            </span>
          )}
          {counts.soon > 0 && (counts.critical > 0 || counts.overdue > 0) && (
            <span className="text-gray-300">·</span>
          )}
          {counts.critical > 0 && (
            <span className="flex items-center gap-1 text-orange-700">
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
              {counts.critical} Kritisch
            </span>
          )}
          {counts.critical > 0 && counts.overdue > 0 && (
            <span className="text-gray-300">·</span>
          )}
          {counts.overdue > 0 && (
            <span className="flex items-center gap-1 text-red-700">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              {counts.overdue} Überfällig
            </span>
          )}
        </div>

        {/* Signal circles — horizontal scroll on mobile */}
        <div className="overflow-x-auto -mx-1 px-1">
          <div className="flex items-center gap-2 min-w-max pb-1">
            {sorted.map((signal) => {
              const cfg = levelConfig[signal.level];
              const isSelected = signal.order.id === selectedOrderId;

              return (
                <button
                  key={signal.order.id}
                  type="button"
                  onClick={() => handleCircleClick(signal.order.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1 group focus:outline-none',
                  )}
                  aria-label={`Bestellung ${signal.order.bestellnummer}: ${cfg.label}`}
                >
                  {/* Circle */}
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full flex flex-col items-center justify-center',
                      'ring-4 transition-all duration-200',
                      cfg.bg,
                      cfg.ring,
                      isSelected && 'ring-offset-2 scale-105',
                      !isSelected && 'group-hover:scale-105',
                      cfg.pulse && 'animate-pulse',
                    )}
                  >
                    <span className={cn('text-[10px] font-bold leading-none', cfg.text)}>
                      #{signal.order.bestellnummer}
                    </span>
                    {signal.secondsRemaining !== null && (
                      <span
                        className={cn(
                          'font-mono text-[10px] font-bold leading-none mt-0.5 tabular-nums',
                          cfg.text,
                        )}
                      >
                        {formatCountdown(signal.secondsRemaining)}
                      </span>
                    )}
                  </div>

                  {/* Label below */}
                  <span
                    className={cn(
                      'text-[10px] font-semibold leading-none',
                      signal.level === 'ok' && 'text-green-700',
                      signal.level === 'soon' && 'text-yellow-700',
                      signal.level === 'critical' && 'text-orange-700',
                      signal.level === 'overdue' && 'text-red-700',
                    )}
                  >
                    {cfg.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detail panel for selected order */}
        {selectedSignal && (
          <div className="pt-1">
            <DetailPanel signal={selectedSignal} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
