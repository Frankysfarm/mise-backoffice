'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, AlertTriangle, CheckCircle2, Clock, Flame, Loader2 } from 'lucide-react';

interface OrderSummary {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface TimingSummary {
  order_id: string;
  status: string;
  cook_start: string | null;
  ready_target: string | null;
}

interface Props {
  orders: OrderSummary[];
  timings?: TimingSummary[];
  locationId?: string | null;
}

type LoadLevel = 'idle' | 'normal' | 'busy' | 'critical';

interface QueueSlot {
  label: string;
  count: number;
  fill: number; // 0-100
  color: string;
}

export function KitchenQueueKapazitaetsBoard({ orders, timings = [], locationId }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const active = orders.filter(o =>
    ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)
  );
  const cooking = orders.filter(o => o.status === 'in_zubereitung');
  const waiting = orders.filter(o => ['neu', 'bestätigt'].includes(o.status));

  // Compute overdue count (waiting > 5 min without cooking)
  const overdue = waiting.filter(o => {
    if (!o.bestellt_am) return false;
    const ageMin = (now - new Date(o.bestellt_am).getTime()) / 60_000;
    return ageMin > 5;
  }).length;

  // Compute avg wait time for active orders
  const waitMins = active
    .filter(o => o.bestellt_am)
    .map(o => (now - new Date(o.bestellt_am!).getTime()) / 60_000);
  const avgWait = waitMins.length ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0;

  // Load level
  const total = active.length;
  const load: LoadLevel =
    total === 0 ? 'idle' :
    total <= 3 ? 'normal' :
    total <= 6 ? 'busy' : 'critical';

  const loadConfig: Record<LoadLevel, { label: string; bg: string; badge: string; icon: React.ReactNode; bar: string }> = {
    idle: {
      label: 'Ruhig', bg: 'bg-matcha-50 border-matcha-200',
      badge: 'bg-matcha-100 text-matcha-700',
      icon: <CheckCircle2 className="h-4 w-4 text-matcha-600" />,
      bar: 'bg-matcha-400',
    },
    normal: {
      label: 'Normal', bg: 'bg-blue-50 border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      icon: <Activity className="h-4 w-4 text-blue-600" />,
      bar: 'bg-blue-400',
    },
    busy: {
      label: 'Ausgelastet', bg: 'bg-amber-50 border-amber-200',
      badge: 'bg-amber-100 text-amber-700',
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      bar: 'bg-amber-400',
    },
    critical: {
      label: 'Kritisch', bg: 'bg-red-50 border-red-200',
      badge: 'bg-red-100 text-red-700',
      icon: <Flame className="h-4 w-4 text-red-600" />,
      bar: 'bg-red-400',
    },
  };

  const cfg = loadConfig[load];

  // Queue slots: 0-2/3-5/6-8/9+
  const slots: QueueSlot[] = [
    { label: 'Wartend', count: waiting.length, fill: Math.min(100, (waiting.length / 8) * 100), color: overdue > 0 ? 'bg-amber-400' : 'bg-blue-400' },
    { label: 'In Zubereitung', count: cooking.length, fill: Math.min(100, (cooking.length / 6) * 100), color: 'bg-matcha-400' },
    { label: 'Überfällig', count: overdue, fill: Math.min(100, (overdue / 4) * 100), color: overdue > 0 ? 'bg-red-400' : 'bg-stone-200' },
  ];

  const capacityPct = Math.min(100, Math.round((total / 8) * 100));

  if (active.length === 0 && load === 'idle') return null;

  return (
    <Card className={cn('border p-4 space-y-3', cfg.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {cfg.icon}
          <span className="text-sm font-bold text-foreground">Warteschlangen-Status</span>
        </div>
        <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', cfg.badge)}>
          {cfg.label}
        </span>
      </div>

      {/* Capacity bar */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-muted-foreground">Küchen-Auslastung</span>
          <span className="text-[11px] font-bold tabular-nums">{total} Aufträge</span>
        </div>
        <div className="h-3 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
            style={{ width: `${capacityPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[9px] text-muted-foreground">
          <span>0</span>
          <span>4</span>
          <span>8 Max</span>
        </div>
      </div>

      {/* Queue slots */}
      <div className="grid grid-cols-3 gap-2">
        {slots.map(s => (
          <div key={s.label} className="rounded-xl bg-white/60 p-2.5 space-y-1.5">
            <div className="text-[10px] text-muted-foreground font-medium truncate">{s.label}</div>
            <div className="text-xl font-black tabular-nums leading-none">{s.count}</div>
            <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-700', s.color)} style={{ width: `${s.fill}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-black/5">
        <span className="text-muted-foreground">
          Ø Wartezeit: <strong className="text-foreground">{avgWait} Min</strong>
        </span>
        {overdue > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-bold">
            <AlertTriangle className="h-3 w-3" />
            {overdue} überfällig
          </span>
        )}
        {overdue === 0 && (
          <span className="text-matcha-600 font-medium">Alles im Plan</span>
        )}
      </div>
    </Card>
  );
}
