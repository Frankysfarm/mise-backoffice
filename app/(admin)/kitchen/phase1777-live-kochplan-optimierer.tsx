'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, GripVertical, Star } from 'lucide-react';

/**
 * Phase 1777 — Live-Kochplan-Optimierer (Kitchen)
 *
 * Sortiert aktive Bestellungen nach Dringlichkeit (ETA + Artikel-Komplexität).
 * Überfällige Bestellungen erhalten Alert-Badge; Drag-Hinweis; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  menu_item_name?: string;
  product_name?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id?: string;
  bestellnummer?: string;
  order_number?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
  liefer_typ?: string;
  delivery_type?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface KochplanEintrag {
  id: string;
  bestellnummer: string;
  wartezeit_min: number;
  artikelanzahl: number;
  komplexitaet: number;
  dringlichkeit_score: number;
  ueberfaellig: boolean;
  istLieferung: boolean;
}

const UEBERFAELLIG_SCHWELLE_MIN = 20;

function getItems(order: Order): OrderItem[] {
  return order.items ?? order.order_items ?? [];
}

function getOrderTimestamp(order: Order): number {
  const raw = order.created_at ?? order.createdAt;
  if (!raw) return Date.now();
  return new Date(raw).getTime();
}

function calcKomplexitaet(items: OrderItem[]): number {
  let score = 0;
  for (const item of items) {
    const name = (item.name ?? item.menu_item_name ?? item.product_name ?? '').toLowerCase();
    const menge = item.menge ?? item.quantity ?? 1;
    // Heuristic: longer name = more complex item; extra weight for multiples
    score += Math.min(3, Math.ceil(name.length / 10)) * menge;
  }
  return Math.min(10, score);
}

export function KitchenPhase1777LiveKochplanOptimierer({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const kochplan = useMemo<KochplanEintrag[]>(() => {
    const now = Date.now();
    return orders
      .filter(o => ['accepted', 'preparing', 'in_progress', 'pending'].includes(o.status ?? ''))
      .map(o => {
        const items = getItems(o);
        const wartezeit_min = Math.round((now - getOrderTimestamp(o)) / 60000);
        const artikelanzahl = items.reduce((s, it) => s + (it.menge ?? it.quantity ?? 1), 0);
        const komplexitaet = calcKomplexitaet(items);
        const ueberfaellig = wartezeit_min > UEBERFAELLIG_SCHWELLE_MIN;
        const istLieferung = (o.liefer_typ ?? o.delivery_type ?? '') !== 'abholung';
        // Higher score = needs to be cooked sooner
        const dringlichkeit_score = wartezeit_min * 2 + komplexitaet * 3 + (ueberfaellig ? 50 : 0) + (istLieferung ? 10 : 0);
        return {
          id: o.id ?? Math.random().toString(),
          bestellnummer: o.bestellnummer ?? o.order_number ?? '—',
          wartezeit_min,
          artikelanzahl,
          komplexitaet,
          dringlichkeit_score,
          ueberfaellig,
          istLieferung,
        };
      })
      .sort((a, b) => b.dringlichkeit_score - a.dringlichkeit_score);
  }, [orders]);

  const ueberfaelligeAnzahl = kochplan.filter(e => e.ueberfaellig).length;

  if (kochplan.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Live-Kochplan</span>
          {ueberfaelligeAnzahl > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {ueberfaelligeAnzahl} Überfällig
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{kochplan.length} aktiv</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {ueberfaelligeAnzahl > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-xs font-bold text-red-800 dark:text-red-200">
                {ueberfaelligeAnzahl} Bestellung{ueberfaelligeAnzahl > 1 ? 'en' : ''} warten länger als {UEBERFAELLIG_SCHWELLE_MIN} Min — sofort priorisieren!
              </p>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <GripVertical className="h-3 w-3" />
            Dringlichkeits-Reihenfolge: Oben = sofort kochen
          </p>

          <div className="space-y-1.5">
            {kochplan.map((entry, i) => (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 border',
                  entry.ueberfaellig
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : i === 0
                    ? 'bg-saffron/5 border-saffron/30'
                    : 'bg-muted/40 border-transparent',
                )}
              >
                {/* Rang */}
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  entry.ueberfaellig
                    ? 'bg-red-500 text-white'
                    : i === 0
                    ? 'bg-saffron text-white'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {i + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn(
                      'text-xs font-bold',
                      entry.ueberfaellig ? 'text-red-800 dark:text-red-200' : 'text-foreground',
                    )}>
                      #{entry.bestellnummer}
                    </p>
                    {entry.istLieferung && (
                      <span className="text-[9px] rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1 font-bold">
                        Lieferung
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{entry.artikelanzahl} Artikel</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <div className="flex items-center gap-0.5">
                      <Star className="h-2.5 w-2.5 text-saffron" />
                      <span className="text-[10px] text-muted-foreground">Kompl. {entry.komplexitaet}/10</span>
                    </div>
                  </div>
                </div>

                {/* Wartezeit */}
                <div className="flex items-center gap-1 shrink-0">
                  <Clock className={cn('h-3.5 w-3.5', entry.ueberfaellig ? 'text-red-500' : 'text-muted-foreground')} />
                  <span className={cn(
                    'text-xs font-black tabular-nums',
                    entry.ueberfaellig ? 'text-red-700 dark:text-red-300' : 'text-foreground',
                  )}>
                    {entry.wartezeit_min} Min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
