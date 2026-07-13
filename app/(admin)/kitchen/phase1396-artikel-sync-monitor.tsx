'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Phase 1396 — Artikel-Sync-Monitor (Kitchen)
 *
 * Zeigt, welche Artikel gerade in mehreren aktiven Bestellungen gleichzeitig
 * zubereitet werden müssen — potenzielles Chaos / Koordinationsbedarf:
 *   • Top-10 gleichzeitig benötigte Artikel
 *   • Ampel: Grün (1 Bestellung), Gelb (2-3), Rot (≥4)
 *   • Letzte Bestellnummer je Artikel angezeigt
 *   • Props-basiert, kein API-Aufruf
 *
 * Nach Phase1391 in kitchen/client.tsx einbinden.
 */

type OrderStatus = 'neu' | 'angenommen' | 'in_zubereitung' | 'fertig' | string;

interface OrderItem {
  name?: string | null;
  titel?: string | null;
  menge?: number | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: OrderStatus;
  items?: OrderItem[] | null;
  positionen?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

interface ArtikelSyncRow {
  name: string;
  totalMenge: number;
  bestellungen: number;
  nummern: string[];
  stufe: 'gruen' | 'gelb' | 'rot';
}

const STUFE = {
  gruen: { bg: 'bg-green-50 dark:bg-green-950/20',   border: 'border-green-200 dark:border-green-800',   text: 'text-green-700 dark:text-green-300',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',   dot: 'bg-green-500'   },
  gelb:  { bg: 'bg-yellow-50 dark:bg-yellow-950/20', border: 'border-yellow-200 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dot: 'bg-yellow-500' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950/25',       border: 'border-red-300 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',         dot: 'bg-red-500 animate-pulse'   },
};

export function KitchenPhase1396ArtikelSyncMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo<ArtikelSyncRow[]>(() => {
    const ACTIVE = new Set(['neu', 'angenommen', 'in_zubereitung']);
    const map = new Map<string, { totalMenge: number; bestellungen: Set<string>; nummern: string[] }>();

    for (const order of orders) {
      if (!ACTIVE.has(order.status)) continue;
      const itemList = order.items ?? order.positionen ?? [];
      const nr = order.bestellnummer ?? order.id.slice(0, 6);
      for (const item of itemList) {
        const name = item.name ?? item.titel ?? 'Unbekannt';
        const menge = item.menge ?? item.quantity ?? 1;
        if (!map.has(name)) map.set(name, { totalMenge: 0, bestellungen: new Set(), nummern: [] });
        const entry = map.get(name)!;
        entry.totalMenge += menge;
        if (!entry.bestellungen.has(order.id)) {
          entry.bestellungen.add(order.id);
          entry.nummern.push(`#${nr}`);
        }
      }
    }

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        totalMenge: data.totalMenge,
        bestellungen: data.bestellungen.size,
        nummern: data.nummern.slice(0, 4),
        stufe: data.bestellungen.size >= 4 ? 'rot' : data.bestellungen.size >= 2 ? 'gelb' : 'gruen' as 'gruen' | 'gelb' | 'rot',
      }))
      .sort((a, b) => b.bestellungen - a.bestellungen || b.totalMenge - a.totalMenge)
      .slice(0, 10);
  }, [orders]);

  if (rows.length === 0) return null;

  const hasRot = rows.some((r) => r.stufe === 'rot');
  const hasGelb = rows.some((r) => r.stufe === 'gelb');

  return (
    <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <Package className={cn('h-4 w-4', hasRot ? 'text-red-500' : hasGelb ? 'text-yellow-500' : 'text-green-500')} />
        <span className="font-semibold text-sm">Artikel-Sync-Monitor</span>
        <span className="ml-1 text-xs text-muted-foreground">{rows.length} Artikel gleichzeitig</span>
        {hasRot && <AlertTriangle className="h-3.5 w-3.5 text-red-500 ml-1" />}
        <span className="ml-auto">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-1.5">
          {rows.map((row) => {
            const s = STUFE[row.stufe];
            return (
              <div
                key={row.name}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', s.bg, s.border)}
              >
                <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                <div className="flex-1 min-w-0">
                  <div className={cn('font-medium text-sm truncate', s.text)}>{row.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {row.nummern.join(', ')}{row.bestellungen > 4 ? ' …' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', s.badge)}>
                    ×{row.totalMenge}
                  </span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {row.bestellungen}B
                  </span>
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-3 pt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> 1 Bestellung</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-yellow-500" /> 2–3 Bestellungen</span>
            <span className="flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> ≥4 Bestellungen</span>
          </div>
        </div>
      )}
    </div>
  );
}
