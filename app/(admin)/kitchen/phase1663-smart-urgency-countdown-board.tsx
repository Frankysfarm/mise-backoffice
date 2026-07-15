'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertCircle, Clock, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

type UrgencyLevel = 'ok' | 'tight' | 'critical';

type OrderRow = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  in_zubereitung_seit: string | null;
  items: { name: string }[];
  estimated_prep_min?: number | null;
};

function calcUrgency(row: OrderRow): { level: UrgencyLevel; remainSec: number; progressPct: number } {
  const startTs = row.in_zubereitung_seit ?? row.bestellt_am;
  const prepMin = row.estimated_prep_min ?? 20;
  if (!startTs) return { level: 'ok', remainSec: prepMin * 60, progressPct: 0 };
  const elapsedSec = (Date.now() - new Date(startTs).getTime()) / 1000;
  const totalSec = prepMin * 60;
  const remainSec = Math.round(totalSec - elapsedSec);
  const progressPct = Math.min(100, Math.max(0, (elapsedSec / totalSec) * 100));
  let level: UrgencyLevel = 'ok';
  if (remainSec < 0) level = 'critical';
  else if (remainSec < 180) level = 'tight';
  return { level, remainSec, progressPct };
}

function Countdown({ secs, level }: { secs: number; level: UrgencyLevel }) {
  const abs = Math.abs(secs);
  const mm = Math.floor(abs / 60);
  const ss = abs % 60;
  const over = secs < 0;
  return (
    <span className={cn(
      'font-mono font-black tabular-nums text-2xl leading-none',
      level === 'critical' ? 'text-red-700' : level === 'tight' ? 'text-amber-700' : 'text-matcha-700',
    )}>
      {over && <span className="text-base mr-0.5">+</span>}{mm}:{String(ss).padStart(2, '0')}
    </span>
  );
}

const URGENCY_CFG = {
  critical: {
    card: 'bg-red-50 border-red-300',
    bar:  'bg-red-500',
    badge: 'bg-red-500 text-white',
    label: 'ÜBERFÄLLIG',
    Icon: Flame,
    pulse: true,
  },
  tight: {
    card: 'bg-amber-50 border-amber-300',
    bar:  'bg-amber-500',
    badge: 'bg-amber-500 text-white',
    label: 'KNAPP',
    Icon: AlertCircle,
    pulse: false,
  },
  ok: {
    card: 'bg-matcha-50 border-matcha-200',
    bar:  'bg-matcha-500',
    badge: 'bg-matcha-600 text-white',
    label: 'IN ZEIT',
    Icon: Clock,
    pulse: false,
  },
};

export function KitchenPhase1663SmartUrgencyCountdownBoard() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    const sb = createClient();
    const load = async () => {
      const { data } = await sb
        .from('customer_orders')
        .select('id, bestellnummer, status, bestellt_am, in_zubereitung_seit, estimated_prep_min, items:order_items(name)')
        .in('status', ['bestätigt', 'in_zubereitung'])
        .order('bestellt_am', { ascending: true });
      setOrders((data as any[]) ?? []);
    };
    load();
    const ch = sb.channel('ph1663-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const rows = orders
    .map(o => ({ ...o, ...calcUrgency(o) }))
    .sort((a, b) => a.remainSec - b.remainSec);

  if (rows.length === 0) return null;

  const criticalCount = rows.filter(r => r.level === 'critical').length;
  const tightCount = rows.filter(r => r.level === 'tight').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-stone-50">
        <Clock className="h-4 w-4 text-saffron shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-700">
          Smart Countdown · Farbkodierung
        </span>
        <div className="ml-auto flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="animate-pulse text-[9px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full">
              {criticalCount} ÜBERFÄLLIG
            </span>
          )}
          {tightCount > 0 && (
            <span className="text-[9px] font-black bg-amber-500 text-white px-2 py-0.5 rounded-full">
              {tightCount} KNAPP
            </span>
          )}
          <span className="text-[10px] font-bold text-stone-400 tabular-nums">{rows.length} aktiv</span>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 p-3">
        {rows.map(row => {
          const cfg = URGENCY_CFG[row.level];
          const Icon = cfg.Icon;
          return (
            <div
              key={row.id}
              className={cn(
                'rounded-xl border-2 p-3 flex flex-col gap-1.5 transition-all',
                cfg.card,
                cfg.pulse && 'animate-pulse',
              )}
            >
              {/* Badge + number */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[9px] font-mono font-bold text-stone-500 truncate">
                  #{row.bestellnummer}
                </span>
                <span className={cn('text-[8px] font-black px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
                  {cfg.label}
                </span>
              </div>

              {/* Countdown */}
              <Countdown secs={row.remainSec} level={row.level} />

              {/* Item preview */}
              <div className="flex items-center gap-1 text-[10px] text-stone-500 min-w-0">
                <Icon className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {row.items?.slice(0, 2).map(i => i.name).join(', ') || '—'}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                  style={{ width: `${row.progressPct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
