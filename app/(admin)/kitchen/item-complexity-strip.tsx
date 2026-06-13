'use client';

/**
 * KitchenItemComplexityStrip
 *
 * Zeigt alle aktiven Bestellungen als kompakte Komplexitäts-Chips an.
 * Berechnet Komplexität aus Itemanzahl + Extras → einfach / mittel / komplex / ⚡ Alarm.
 * Hilft der Küche beim Priorisieren und Parallelisieren.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Layers, Package, ChefHat } from 'lucide-react';

type Item = {
  id: string;
  name: string;
  menge: number;
  einzelpreis: number;
  notiz: string | null;
  extras: unknown;
  gang?: number | null;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  items: Item[];
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type ComplexityLevel = 'einfach' | 'mittel' | 'komplex' | 'kritisch';

function computeComplexity(order: Order): { level: ComplexityLevel; score: number; itemCount: number; extrasCount: number; hasGangs: boolean } {
  const items = order.items ?? [];
  const totalItems = items.reduce((s, i) => s + i.menge, 0);

  let extrasCount = 0;
  for (const item of items) {
    if (Array.isArray(item.extras)) extrasCount += item.extras.length;
    else if (item.extras && typeof item.extras === 'object') {
      extrasCount += Object.keys(item.extras as Record<string, unknown>).length;
    }
    if (item.notiz) extrasCount += 1;
  }

  const hasGangs = items.some((i) => i.gang != null && i.gang > 1);

  // base score: items × 2 + extras + gang penalty
  let score = totalItems * 2 + extrasCount + (hasGangs ? 4 : 0);

  // Wait-time bonus: if order is overdue, bump score
  if (order.bestellt_am) {
    const waitMin = Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000);
    const estMin = order.geschaetzte_zubereitung_min ?? 15;
    if (waitMin > estMin) score += 8;
    else if (waitMin > estMin * 0.8) score += 3;
  }

  const level: ComplexityLevel =
    score >= 20 ? 'kritisch' :
    score >= 12 ? 'komplex' :
    score >= 6  ? 'mittel' :
    'einfach';

  return { level, score, itemCount: totalItems, extrasCount, hasGangs };
}

const LEVEL_STYLES: Record<ComplexityLevel, { card: string; badge: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  einfach:  { card: 'border-matcha-200 bg-matcha-50',        badge: 'bg-matcha-600 text-white',   label: 'Einfach',  icon: Package },
  mittel:   { card: 'border-amber-200 bg-amber-50',          badge: 'bg-amber-500 text-white',    label: 'Mittel',   icon: Layers },
  komplex:  { card: 'border-orange-300 bg-orange-50',        badge: 'bg-orange-600 text-white',   label: 'Komplex',  icon: ChefHat },
  kritisch: { card: 'border-red-400 bg-red-50 animate-pulse', badge: 'bg-red-600 text-white',     label: '⚡ Alarm', icon: Zap },
};

export function KitchenItemComplexityStrip({ orders }: { orders: Order[] }) {
  const active = useMemo(
    () => orders.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status)),
    [orders],
  );

  if (active.length === 0) return null;

  const analyzed = useMemo(
    () => active
      .map((o) => ({ order: o, ...computeComplexity(o) }))
      .sort((a, b) => b.score - a.score),
    [active],
  );

  const kritisch = analyzed.filter((x) => x.level === 'kritisch').length;
  const komplex  = analyzed.filter((x) => x.level === 'komplex').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-matcha-700" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-matcha-800">
            Bestellkomplexität
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {kritisch > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
              {kritisch} ⚡ Alarm
            </span>
          )}
          {komplex > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 font-bold text-orange-700">
              {komplex} Komplex
            </span>
          )}
          <span className="text-muted-foreground">{analyzed.length} aktiv</span>
        </div>
      </div>

      {/* Complexity Bar Overview */}
      <div className="mb-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {(['einfach', 'mittel', 'komplex', 'kritisch'] as ComplexityLevel[]).map((lvl) => {
          const cnt = analyzed.filter((x) => x.level === lvl).length;
          const pct = (cnt / analyzed.length) * 100;
          const colors: Record<ComplexityLevel, string> = {
            einfach: 'bg-matcha-500',
            mittel:  'bg-amber-400',
            komplex: 'bg-orange-500',
            kritisch: 'bg-red-600',
          };
          return pct > 0 ? (
            <div key={lvl} className={cn('h-full transition-all', colors[lvl])} style={{ width: `${pct}%` }} />
          ) : null;
        })}
      </div>

      {/* Order Chips */}
      <div className="flex flex-wrap gap-2">
        {analyzed.map(({ order, level, itemCount, extrasCount, hasGangs }) => {
          const style = LEVEL_STYLES[level];
          const Icon = style.icon;

          // Wait time
          const waitMin = order.bestellt_am
            ? Math.floor((Date.now() - new Date(order.bestellt_am).getTime()) / 60_000)
            : 0;
          const estMin = order.geschaetzte_zubereitung_min ?? 15;
          const isOverdue = waitMin > estMin;

          return (
            <div
              key={order.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-2',
                style.card,
              )}
            >
              {/* Level badge */}
              <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', style.badge)}>
                {style.label}
              </span>

              {/* Order info */}
              <div className="min-w-0">
                <div className="text-xs font-bold text-foreground">
                  #{order.bestellnummer.replace('FF-', '').replace(/^0+/, '')}
                </div>
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Icon className="h-2.5 w-2.5" />
                  <span>{itemCount} Item{itemCount !== 1 ? 's' : ''}</span>
                  {extrasCount > 0 && <span>+{extrasCount} Extra</span>}
                  {hasGangs && <span className="font-bold text-purple-600">Gänge</span>}
                </div>
              </div>

              {/* Wait indicator */}
              <div className={cn(
                'rounded-full px-2 py-0.5 text-[9px] font-black tabular-nums',
                isOverdue
                  ? 'bg-red-200 text-red-800'
                  : waitMin >= estMin * 0.8
                  ? 'bg-amber-200 text-amber-800'
                  : 'bg-matcha-100 text-matcha-700',
              )}>
                {waitMin}m
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center gap-3 text-[9px] text-muted-foreground">
        {(['einfach', 'mittel', 'komplex', 'kritisch'] as ComplexityLevel[]).map((lvl) => {
          const s = LEVEL_STYLES[lvl];
          return (
            <span key={lvl} className="flex items-center gap-1">
              <span className={cn('h-2 w-2 rounded-full', s.badge)} />
              {s.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
