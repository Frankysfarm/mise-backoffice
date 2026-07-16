'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Layers, AlertTriangle } from 'lucide-react';

/**
 * Phase 1812 — Parallele-Gericht-Übersicht (Kitchen)
 *
 * Zeigt wie viele gleiche Gerichte aktuell gleichzeitig zubereitet werden.
 * Ampel grün/gelb/rot je Station; Alert wenn Obergrenzen überschritten.
 * Props-basiert; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  title?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
  produkte?: OrderItem[];
}

interface Props {
  orders: Order[];
  maxParallelProGericht?: number;
  warnSchwelle?: number;
  className?: string;
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelVon(anzahl: number, warn: number, max: number): Ampel {
  if (anzahl >= max) return 'rot';
  if (anzahl >= warn) return 'gelb';
  return 'gruen';
}

const AMPEL_STYLE: Record<Ampel, { bg: string; border: string; badge: string; dot: string }> = {
  gruen: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    dot: 'bg-matcha-500',
  },
  gelb: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-400',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
};

const AKTIVE_STATUS = new Set(['new', 'confirmed', 'preparing', 'in_progress', 'in_zubereitung', 'accepted']);

export function KitchenPhase1812ParalleleGerichtUebersicht({
  orders,
  maxParallelProGericht = 5,
  warnSchwelle = 3,
  className,
}: Props) {
  const [open, setOpen] = useState(true);

  const gerichtMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.status || !AKTIVE_STATUS.has(o.status)) continue;
      const items = o.items ?? o.produkte ?? [];
      for (const item of items) {
        const name = item.name ?? item.title ?? 'Unbekannt';
        const menge = item.menge ?? item.quantity ?? 1;
        map.set(name, (map.get(name) ?? 0) + menge);
      }
    }
    return Array.from(map.entries())
      .map(([name, anzahl]) => ({ name, anzahl, ampel: ampelVon(anzahl, warnSchwelle, maxParallelProGericht) }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [orders, maxParallelProGericht, warnSchwelle]);

  const ueberschreitungen = useMemo(() => gerichtMap.filter(g => g.ampel === 'rot').length, [gerichtMap]);
  const warnungen = useMemo(() => gerichtMap.filter(g => g.ampel === 'gelb').length, [gerichtMap]);

  if (gerichtMap.length === 0) return null;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Parallele Gericht-Übersicht</span>
          {ueberschreitungen > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {ueberschreitungen} Limit
            </span>
          )}
          {ueberschreitungen === 0 && warnungen > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {warnungen} Warnung
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{gerichtMap.length} Gerichte aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {ueberschreitungen > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                {ueberschreitungen} Gericht{ueberschreitungen > 1 ? 'e' : ''} über Kapazitätsgrenze ({maxParallelProGericht}×)
              </span>
            </div>
          )}

          <div className="grid gap-2">
            {gerichtMap.map(({ name, anzahl, ampel }) => {
              const s = AMPEL_STYLE[ampel];
              const balken = Math.min(100, Math.round((anzahl / maxParallelProGericht) * 100));
              return (
                <div key={name} className={cn('rounded-xl border px-3 py-2', s.bg, s.border)}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                      <span className="text-xs font-semibold truncate">{name}</span>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ml-2', s.badge)}>
                      {anzahl}× parallel
                    </span>
                  </div>
                  {/* Balken */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', s.dot)}
                      style={{ width: `${balken}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-muted-foreground">0</span>
                    <span className="text-[9px] text-muted-foreground">Max {maxParallelProGericht}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> Normal (&lt;{warnSchwelle})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400 inline-block" /> Warn ({warnSchwelle}–{maxParallelProGericht - 1})</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Limit ({maxParallelProGericht}+)</span>
          </div>
        </div>
      )}
    </div>
  );
}
