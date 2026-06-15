'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, Bike, CheckCircle2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  fertig_am: string | null;
  kunde_name: string;
  delivery_zone: string | null;
};

interface Props {
  orders: Order[];
}

function waitMin(fertigAm: string): number {
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

function useNow() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

function urgencyLevel(min: number): 'ok' | 'warn' | 'critical' {
  if (min >= 15) return 'critical';
  if (min >= 7) return 'warn';
  return 'ok';
}

export function KitchenHandoffDelayAlert({ orders }: Props) {
  useNow();

  const readyDeliveries = orders.filter(
    o => o.status === 'fertig' && o.typ === 'lieferung' && o.fertig_am,
  );

  if (readyDeliveries.length === 0) return null;

  const withWait = readyDeliveries.map(o => ({
    ...o,
    waitMin: waitMin(o.fertig_am!),
  })).sort((a, b) => b.waitMin - a.waitMin);

  const critical = withWait.filter(o => o.waitMin >= 15);
  const warned = withWait.filter(o => o.waitMin >= 7 && o.waitMin < 15);
  const ok = withWait.filter(o => o.waitMin < 7);

  const worstMin = withWait[0]?.waitMin ?? 0;
  const level = urgencyLevel(worstMin);

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      level === 'critical'
        ? 'border-red-200 bg-red-50 animate-pulse'
        : level === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : 'border-green-200 bg-green-50',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 border-b',
        level === 'critical'
          ? 'border-red-200 bg-red-100'
          : level === 'warn'
          ? 'border-amber-200 bg-amber-100'
          : 'border-green-200 bg-green-100',
      )}>
        {level === 'critical'
          ? <AlertTriangle size={13} className="text-red-600 shrink-0" />
          : level === 'warn'
          ? <Clock size={13} className="text-amber-600 shrink-0" />
          : <CheckCircle2 size={13} className="text-green-600 shrink-0" />}
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider flex-1',
          level === 'critical' ? 'text-red-700' : level === 'warn' ? 'text-amber-700' : 'text-green-700',
        )}>
          {readyDeliveries.length} {readyDeliveries.length === 1 ? 'Lieferung' : 'Lieferungen'} warten auf Fahrer
        </span>
        <Bike size={13} className={cn(
          'shrink-0',
          level === 'critical' ? 'text-red-500' : level === 'warn' ? 'text-amber-500' : 'text-green-500',
        )} />
      </div>

      {/* Order rows */}
      <div className="divide-y divide-black/5">
        {withWait.slice(0, 5).map(o => {
          const lvl = urgencyLevel(o.waitMin);
          return (
            <div key={o.id} className="flex items-center gap-3 px-3 py-2">
              {/* Wait indicator */}
              <div className={cn(
                'h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0',
                lvl === 'critical' ? 'bg-red-100 text-red-700'
                  : lvl === 'warn' ? 'bg-amber-100 text-amber-700'
                  : 'bg-green-100 text-green-700',
              )}>
                {o.waitMin}m
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 truncate">{o.kunde_name}</div>
                <div className="text-[10px] text-gray-500">#{o.bestellnummer}{o.delivery_zone ? ` · ${o.delivery_zone}` : ''}</div>
              </div>
              {/* Status chip */}
              {lvl === 'critical' && (
                <div className="flex items-center gap-0.5 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 shrink-0">
                  <Zap size={8} />
                  Kritisch
                </div>
              )}
              {lvl === 'warn' && (
                <div className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 shrink-0">
                  Bald
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer */}
      {(critical.length > 0 || warned.length > 0) && (
        <div className={cn(
          'px-3 py-2 border-t text-[10px] font-semibold flex items-center gap-2',
          level === 'critical' ? 'border-red-200 text-red-700' : 'border-amber-200 text-amber-700',
        )}>
          <AlertTriangle size={10} />
          {critical.length > 0 && `${critical.length} kritisch (≥15 min)`}
          {critical.length > 0 && warned.length > 0 && ' · '}
          {warned.length > 0 && `${warned.length} bald kritisch`}
          {ok.length > 0 && ` · ${ok.length} in Ordnung`}
        </div>
      )}
    </div>
  );
}
