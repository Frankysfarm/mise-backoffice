'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Layers, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 1877 — Zonen-Auslastungs-Balken (Kitchen)
 *
 * Balken je Zone A/B/C/D: Offene Bestellungen vs. Kapazität.
 * Ampel grün (<50%) / gelb (50–80%) / rot (>80%). useMemo. Collapsible.
 * Echtzeit aus props orders.
 */

interface Order {
  id: string;
  status?: string | null;
  delivery_zone?: string | null;
}

interface Props {
  orders: Order[];
  kapazitaetProZone?: number;
  className?: string;
}

const DEFAULT_KAPAZITAET = 8;
const ZONEN = ['A', 'B', 'C', 'D'] as const;

interface ZonenAuslastung {
  zone: string;
  offen: number;
  kapazitaet: number;
  auslastungPct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const FARB = {
  gruen: {
    bar:    'bg-matcha-500',
    text:   'text-matcha-700 dark:text-matcha-300',
    badge:  'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
    border: 'border-matcha-200 dark:border-matcha-800',
    bg:     'bg-matcha-50/50 dark:bg-matcha-950/10',
  },
  gelb: {
    bar:    'bg-amber-400',
    text:   'text-amber-700 dark:text-amber-300',
    badge:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
    bg:     'bg-amber-50/50 dark:bg-amber-950/10',
  },
  rot: {
    bar:    'bg-red-500',
    text:   'text-red-700 dark:text-red-300',
    badge:  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
    bg:     'bg-red-50/50 dark:bg-red-950/10',
  },
} as const;

const OFFENE_STATUS = ['pending', 'confirmed', 'preparing', 'ready'];

export function KitchenPhase1877ZonenAuslastungsBalken({ orders, kapazitaetProZone = DEFAULT_KAPAZITAET, className }: Props) {
  const [offen, setOffen] = useState(true);

  const zonenAuslastung = useMemo<ZonenAuslastung[]>(() => {
    const zaehler = new Map<string, number>(ZONEN.map((z) => [z, 0]));

    for (const o of orders) {
      if (!OFFENE_STATUS.includes(o.status ?? '')) continue;
      const zone = (o.delivery_zone ?? 'A').toUpperCase();
      if (zaehler.has(zone)) zaehler.set(zone, zaehler.get(zone)! + 1);
    }

    return ZONEN.map((z) => {
      const offenAnzahl = zaehler.get(z) ?? 0;
      const pct = Math.round((offenAnzahl / kapazitaetProZone) * 100);
      const ampel: 'gruen' | 'gelb' | 'rot' = pct > 80 ? 'rot' : pct > 50 ? 'gelb' : 'gruen';
      return { zone: z, offen: offenAnzahl, kapazitaet: kapazitaetProZone, auslastungPct: pct, ampel };
    });
  }, [orders, kapazitaetProZone]);

  const ueberlastetCount = zonenAuslastung.filter((z) => z.ampel === 'rot').length;
  const maxPct = Math.max(...zonenAuslastung.map((z) => z.auslastungPct));

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Layers className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zonen-Auslastung</span>
        {ueberlastetCount > 0 ? (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {ueberlastetCount} überlastet
          </span>
        ) : maxPct > 0 && (
          <span className="ml-1 rounded-full bg-matcha-100 dark:bg-matcha-900/30 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            OK
          </span>
        )}
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-2.5">
          {zonenAuslastung.map((z) => {
            const cfg = FARB[z.ampel];
            const barWidth = Math.min(100, z.auslastungPct);
            return (
              <div
                key={z.zone}
                className={cn('rounded-xl border px-3 py-2.5 space-y-1.5', cfg.border, cfg.bg)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white shrink-0',
                      z.ampel === 'rot' ? 'bg-red-500' : z.ampel === 'gelb' ? 'bg-amber-500' : 'bg-matcha-500',
                    )}>
                      {z.zone}
                    </span>
                    <span className="text-xs font-bold">Zone {z.zone}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-black tabular-nums', cfg.text)}>
                      {z.offen}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      / {z.kapazitaet} Bestellungen
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', cfg.badge)}>
                      {z.auslastungPct}%
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', cfg.bar)}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground text-right">
            Kapazität: {kapazitaetProZone} Bestellungen je Zone · grün &lt;50% · gelb &lt;80% · rot ≥80%
          </p>
        </div>
      )}
    </div>
  );
}
