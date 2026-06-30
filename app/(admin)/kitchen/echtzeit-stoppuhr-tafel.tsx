'use client';

/**
 * Phase 517 — KitchenEchtzeitStoppuhrTafel
 *
 * Echtzeit-Stoppuhr-Tafel: Alle aktiven Bestellungen (bestätigt/in_zubereitung/fertig)
 * als farbkodierte Kacheln mit laufender Stoppuhr seit Bestelleingang.
 *
 * Farbkodierung:
 *   grün   ≤ 15 Min  → im Zeitplan
 *   amber  16–25 Min → Vorsicht
 *   rot    > 25 Min  → kritisch
 *
 * Aktualisiert jede Sekunde clientseitig (keine API nötig — Props-basiert).
 */

import { useEffect, useState } from 'react';
import { Clock, ChefHat, Package, Bell, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
}

interface Props {
  orders: Order[];
}

const TARGET_MIN = 20;

function getColor(elapsedMin: number, targetMin: number) {
  if (elapsedMin <= targetMin * 0.75) return 'green';
  if (elapsedMin <= targetMin) return 'amber';
  return 'red';
}

function fmtTime(seconds: number) {
  const m = Math.floor(Math.abs(seconds) / 60);
  const s = Math.abs(seconds) % 60;
  const prefix = seconds < 0 ? '-' : '';
  return `${prefix}${m}:${s.toString().padStart(2, '0')}`;
}

const STATUS_ICON: Record<string, React.ElementType> = {
  'bestätigt': Bell,
  'in_zubereitung': ChefHat,
  'fertig': Package,
};

const COLOR_CLASSES: Record<string, { bg: string; border: string; text: string; badge: string; label: string }> = {
  green: {
    bg: 'bg-matcha-50',
    border: 'border-matcha-300',
    text: 'text-matcha-800',
    badge: 'bg-matcha-100 text-matcha-700',
    label: 'Im Plan',
  },
  amber: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-800',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Vorsicht',
  },
  red: {
    bg: 'bg-red-50',
    border: 'border-red-400',
    text: 'text-red-800',
    badge: 'bg-red-100 text-red-700',
    label: 'Kritisch',
  },
};

export function KitchenEchtzeitStoppuhrTafel({ orders }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const activeOrders = orders.filter(o =>
    ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status) && o.bestellt_am,
  );

  if (activeOrders.length === 0) return null;

  const now = Date.now();

  const enriched = activeOrders.map(o => {
    const elapsedSec = o.bestellt_am ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 1000) : 0;
    const elapsedMin = elapsedSec / 60;
    const targetMin = o.geschaetzte_zubereitung_min ?? TARGET_MIN;
    const color = getColor(elapsedMin, targetMin);
    const remainingSec = Math.floor(targetMin * 60) - elapsedSec;
    return { ...o, elapsedSec, elapsedMin, color, remainingSec, targetMin };
  }).sort((a, b) => b.elapsedSec - a.elapsedSec);

  const criticalCount = enriched.filter(e => e.color === 'red').length;
  const amberCount = enriched.filter(e => e.color === 'amber').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-stone-100 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full',
            criticalCount > 0 ? 'bg-red-100 text-red-600 animate-pulse' : amberCount > 0 ? 'bg-amber-100 text-amber-600' : 'bg-matcha-100 text-matcha-700',
          )}>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-800">Echtzeit-Stoppuhr</div>
            <div className="text-[11px] text-stone-400">
              {activeOrders.length} Bestellung{activeOrders.length !== 1 ? 'en' : ''} aktiv
              {criticalCount > 0 && ` · ${criticalCount} kritisch`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
              <Flame className="h-3 w-3" />{criticalCount}
            </span>
          )}
          {amberCount > 0 && (
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              {amberCount}
            </span>
          )}
          <span className="text-stone-300 text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {enriched.map(order => {
              const Icon = STATUS_ICON[order.status] ?? Clock;
              const cls = COLOR_CLASSES[order.color];
              const isOverdue = order.remainingSec < 0;

              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-xl border p-3 flex flex-col gap-1.5',
                    cls.bg,
                    cls.border,
                    order.color === 'red' && order.elapsedMin > order.targetMin + 5 && 'animate-pulse',
                  )}
                >
                  {/* Top row: Bestellnummer + Status-Icon */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">
                      #{order.bestellnummer}
                    </span>
                    <div className={cn('flex h-5 w-5 items-center justify-center rounded-full', cls.badge)}>
                      <Icon className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Name */}
                  <div className={cn('text-xs font-semibold truncate', cls.text)}>
                    {order.kunde_name}
                  </div>

                  {/* Stoppuhr */}
                  <div className={cn('text-2xl font-black tabular-nums leading-none', cls.text)}>
                    {fmtTime(order.elapsedSec)}
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        order.color === 'green' ? 'bg-matcha-500' :
                        order.color === 'amber' ? 'bg-amber-400' : 'bg-red-500',
                      )}
                      style={{ width: `${Math.min(100, (order.elapsedMin / order.targetMin) * 100)}%` }}
                    />
                  </div>

                  {/* Footer: Status-Label + Ziel */}
                  <div className="flex items-center justify-between">
                    <span className={cn('text-[9px] font-bold uppercase', cls.text)}>
                      {cls.label}
                    </span>
                    <span className="text-[9px] text-stone-400">
                      {isOverdue ? (
                        <span className="text-red-500 font-bold">+{Math.floor(-order.remainingSec / 60)}m überfällig</span>
                      ) : (
                        `Ziel: ${order.targetMin}m`
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100">
            {Object.entries(COLOR_CLASSES).map(([key, cls]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className={cn('h-2.5 w-2.5 rounded-sm border', cls.bg, cls.border)} />
                <span className="text-[10px] text-stone-400">
                  {key === 'green' ? '≤75% Ziel' : key === 'amber' ? '≤100% Ziel' : '>Ziel'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
