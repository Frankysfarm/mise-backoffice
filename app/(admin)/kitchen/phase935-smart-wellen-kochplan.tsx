'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Waves, Clock, Flame, CheckCircle2, AlertTriangle, Zap, ChefHat } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ?: string;
  items?: { name: string; menge: number }[];
}

interface KitchenTiming {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings?: KitchenTiming[];
}

type WaveStatus = 'jetzt' | 'bald' | 'geplant';

interface Wave {
  label: string;
  status: WaveStatus;
  orders: Array<{ order: Order; secLeft: number | null; urgency: 'ok' | 'bald' | 'kritisch' | 'ueberfaellig' }>;
  batchEfficiency: number;
}

function getSecLeft(order: Order, timings: KitchenTiming[]): number | null {
  const timing = timings.find(t => t.order_id === order.id);
  const now = Date.now();
  if (timing?.ready_target) {
    return Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  }
  if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
    const target = new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000;
    return Math.floor((target - now) / 1000);
  }
  return null;
}

function urgencyOf(sec: number | null): 'ok' | 'bald' | 'kritisch' | 'ueberfaellig' {
  if (sec === null) return 'ok';
  if (sec < 0) return 'ueberfaellig';
  if (sec < 120) return 'kritisch';
  if (sec < 300) return 'bald';
  return 'ok';
}

function fmtSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '+' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

const urgencyStyle = {
  ok: { bg: 'bg-matcha-50', border: 'border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500', pulse: false },
  bald: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', pulse: false },
  kritisch: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', pulse: true },
  ueberfaellig: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', pulse: true },
};

const waveStyle: Record<WaveStatus, { badge: string; headerBg: string }> = {
  jetzt: { badge: 'bg-matcha-600 text-white', headerBg: 'bg-matcha-50 border-matcha-200' },
  bald: { badge: 'bg-amber-500 text-white', headerBg: 'bg-amber-50 border-amber-200' },
  geplant: { badge: 'bg-stone-400 text-white', headerBg: 'bg-stone-50 border-stone-200' },
};

export function KitchenPhase935SmartWellenKochplan({ orders, timings = [] }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const active = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (active.length === 0) return null;

  const enriched = active.map(order => {
    const sec = getSecLeft(order, timings);
    return { order, secLeft: sec, urgency: urgencyOf(sec) };
  });

  // Group into waves by time-urgency
  const now: Array<typeof enriched[0]> = [];
  const soon: Array<typeof enriched[0]> = [];
  const planned: Array<typeof enriched[0]> = [];

  for (const item of enriched) {
    if (item.urgency === 'ueberfaellig' || item.urgency === 'kritisch') now.push(item);
    else if (item.urgency === 'bald') soon.push(item);
    else planned.push(item);
  }

  const waves: Wave[] = [
    { label: 'Jetzt fertigstellen', status: 'jetzt', orders: now, batchEfficiency: Math.max(60, Math.min(100, 60 + now.length * 8)) },
    { label: 'Bald bereit', status: 'bald', orders: soon, batchEfficiency: Math.max(70, Math.min(100, 70 + soon.length * 5)) },
    { label: 'In Vorbereitung', status: 'geplant', orders: planned, batchEfficiency: Math.max(80, Math.min(100, 80 + planned.length * 3)) },
  ].filter(w => w.orders.length > 0);

  const totalOverdue = enriched.filter(e => e.urgency === 'ueberfaellig').length;
  const overallHealth = totalOverdue === 0
    ? (now.length === 0 ? 'gut' : 'angespannt')
    : 'kritisch';

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-800">Wellen-Kochplan</span>
          <span className="text-xs text-stone-400">· Smart Batch-Timing</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full',
            overallHealth === 'gut' ? 'bg-matcha-100 text-matcha-700' :
            overallHealth === 'angespannt' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          )}>
            {overallHealth === 'gut' ? '✓ Gut im Plan' : overallHealth === 'angespannt' ? '⚡ Angespannt' : '🔴 Kritisch'}
          </span>
          <span className="text-xs text-stone-400 tabular-nums">{active.length} aktiv</span>
        </div>
      </div>

      {/* Waves */}
      <div className="divide-y divide-stone-100">
        {waves.map((wave) => {
          const ws = waveStyle[wave.status];
          return (
            <div key={wave.status} className="p-3">
              {/* Wave header */}
              <div className={cn('flex items-center justify-between rounded-lg border px-3 py-2 mb-2', ws.headerBg)}>
                <div className="flex items-center gap-2">
                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', ws.badge)}>
                    {wave.status === 'jetzt' ? 'JETZT' : wave.status === 'bald' ? 'BALD' : 'GEPLANT'}
                  </span>
                  <span className="text-xs font-semibold text-stone-700">{wave.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-500">
                  <span className="flex items-center gap-1">
                    <ChefHat className="w-3 h-3" />
                    {wave.orders.length} Bestellung{wave.orders.length !== 1 ? 'en' : ''}
                  </span>
                  {/* Batch efficiency mini-bar */}
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-500" />
                    <div className="w-16 h-1.5 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full',
                          wave.batchEfficiency >= 85 ? 'bg-matcha-500' :
                          wave.batchEfficiency >= 70 ? 'bg-amber-500' : 'bg-orange-500'
                        )}
                        style={{ width: `${wave.batchEfficiency}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums">{wave.batchEfficiency}%</span>
                  </div>
                </div>
              </div>

              {/* Order cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {wave.orders.map(({ order, secLeft, urgency }) => {
                  const us = urgencyStyle[urgency];
                  return (
                    <div key={order.id} className={cn('relative rounded-lg border p-2.5 flex flex-col gap-1', us.bg, us.border)}>
                      <div className={cn('absolute top-2 right-2 w-2 h-2 rounded-full', us.dot, us.pulse ? 'animate-pulse' : '')} />

                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-stone-700 truncate">
                          #{order.bestellnummer}
                        </span>
                        {order.typ === 'lieferung' && (
                          <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-1">Lief</span>
                        )}
                      </div>

                      <div className={cn('text-xl font-black tabular-nums leading-none', us.text)}>
                        {secLeft !== null ? fmtSec(secLeft) : '--:--'}
                      </div>

                      <div className="text-[10px] text-stone-500">
                        {order.status === 'in_zubereitung' ? '🍳 In Zubereitung' : '📋 Angenommen'}
                      </div>

                      {urgency === 'ueberfaellig' && (
                        <div className="flex items-center gap-1 text-[9px] font-bold text-red-600">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          Überfällig
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-50 border-t border-stone-100 text-xs text-stone-500">
        <div className="flex items-center gap-3">
          {totalOverdue > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <Flame className="w-3 h-3" /> {totalOverdue} überfällig
            </span>
          )}
          <span className="flex items-center gap-1 text-stone-400">
            <Clock className="w-3 h-3" /> {active.length} aktive Bestellungen
          </span>
        </div>
        <span className="text-[10px] text-stone-400">
          {waves.length} Welle{waves.length !== 1 ? 'n' : ''}
        </span>
      </div>
    </div>
  );
}
