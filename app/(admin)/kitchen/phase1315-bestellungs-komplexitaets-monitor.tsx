'use client';

// Phase 1315 — Bestellungs-Komplexitäts-Monitor (Kitchen)
// Score je Bestellung: Anzahl Items × Allergen-Faktor × Sonderwünsche
// Farbige Dringlichkeits-Badges, sortiert nach Score, Props-basiert.
// Nach Phase1311.

import { useMemo } from 'react';
import { AlertTriangle, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface OrderItem {
  name?: string;
  quantity?: number;
  allergens?: string[];
  notes?: string;
}

interface Order {
  id: string;
  order_number?: string | number;
  kunde_name?: string;
  items?: OrderItem[];
  status?: string;
  sonderwuensche?: string;
  geschaetzte_zubereitung_min?: number;
}

interface Props {
  orders: Order[];
}

type Komplexitaet = 'einfach' | 'mittel' | 'komplex' | 'sehr_komplex';

interface BestellungMitScore {
  order: Order;
  score: number;
  komplexitaet: Komplexitaet;
  itemAnzahl: number;
  allergenAnzahl: number;
  hatSonderwuensche: boolean;
}

const AKTIV_STATUS = new Set(['pending', 'preparing', 'accepted', 'confirmed']);

const KOMPLEXITAET_STYLE: Record<Komplexitaet, { label: string; bg: string; border: string; badge: string; dot: string }> = {
  einfach:     { label: 'Einfach',     bg: 'bg-matcha-50 dark:bg-matcha-950/20',   border: 'border-matcha-200 dark:border-matcha-800',   badge: 'bg-matcha-500 text-white',   dot: 'bg-matcha-500'  },
  mittel:      { label: 'Mittel',      bg: 'bg-amber-50 dark:bg-amber-950/20',     border: 'border-amber-200 dark:border-amber-800',     badge: 'bg-amber-400 text-white',    dot: 'bg-amber-400'   },
  komplex:     { label: 'Komplex',     bg: 'bg-orange-50 dark:bg-orange-950/20',   border: 'border-orange-200 dark:border-orange-800',   badge: 'bg-orange-500 text-white',   dot: 'bg-orange-500'  },
  sehr_komplex:{ label: 'Sehr komplex',bg: 'bg-red-50 dark:bg-red-950/20',         border: 'border-red-200 dark:border-red-800',         badge: 'bg-red-500 text-white',      dot: 'bg-red-500'     },
};

function berechneScore(order: Order): { score: number; komplexitaet: Komplexitaet; itemAnzahl: number; allergenAnzahl: number; hatSonderwuensche: boolean } {
  const items = order.items ?? [];
  const itemAnzahl = items.reduce((s, it) => s + Math.max(1, it.quantity ?? 1), 0);
  const allergenSet = new Set<string>();
  for (const it of items) {
    for (const a of it.allergens ?? []) allergenSet.add(a);
  }
  const allergenAnzahl = allergenSet.size;
  const hatSonderwuensche = Boolean(order.sonderwuensche?.trim()) ||
    items.some((it) => it.notes?.trim());

  const allergenFaktor = 1 + allergenAnzahl * 0.3;
  const sonderFaktor = hatSonderwuensche ? 1.5 : 1;
  const score = Math.round(itemAnzahl * allergenFaktor * sonderFaktor * 10) / 10;

  let komplexitaet: Komplexitaet;
  if (score >= 20) komplexitaet = 'sehr_komplex';
  else if (score >= 10) komplexitaet = 'komplex';
  else if (score >= 5) komplexitaet = 'mittel';
  else komplexitaet = 'einfach';

  return { score, komplexitaet, itemAnzahl, allergenAnzahl, hatSonderwuensche };
}

export function KitchenPhase1315BestellungsKomplexitaetsMonitor({ orders }: Props) {
  const rows = useMemo<BestellungMitScore[]>(() => {
    return orders
      .filter((o) => AKTIV_STATUS.has(o.status ?? ''))
      .map((order) => ({ order, ...berechneScore(order) }))
      .sort((a, b) => b.score - a.score);
  }, [orders]);

  if (rows.length === 0) return null;

  const hochkomplex = rows.filter((r) => r.komplexitaet === 'sehr_komplex' || r.komplexitaet === 'komplex').length;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Layers className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Komplexitäts-Monitor</span>
        {hochkomplex > 0 && (
          <Badge variant="destructive" className="ml-auto text-[9px] px-1.5 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5 mr-1" />
            {hochkomplex} aufwändig
          </Badge>
        )}
        {hochkomplex === 0 && (
          <Badge variant="secondary" className="ml-auto text-[9px]">{rows.length} aktiv</Badge>
        )}
      </div>

      <div className="divide-y max-h-72 overflow-y-auto">
        {rows.map((r) => {
          const ks = KOMPLEXITAET_STYLE[r.komplexitaet];
          return (
            <div
              key={r.order.id}
              className={cn('flex items-center gap-3 px-4 py-2.5', ks.bg)}
            >
              {/* Dot */}
              <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', ks.dot)} />

              {/* Order info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold truncate">
                    #{r.order.order_number ?? r.order.id.slice(0, 6)}
                  </span>
                  {r.order.kunde_name && (
                    <span className="text-[10px] text-muted-foreground truncate">{r.order.kunde_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">
                    {r.itemAnzahl} Item{r.itemAnzahl !== 1 ? 's' : ''}
                  </span>
                  {r.allergenAnzahl > 0 && (
                    <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
                      {r.allergenAnzahl} Allergen{r.allergenAnzahl !== 1 ? 'e' : ''}
                    </span>
                  )}
                  {r.hatSonderwuensche && (
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">Sonderwunsch</span>
                  )}
                </div>
              </div>

              {/* Score + Badge */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', ks.badge)}>
                  {ks.label}
                </span>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                  Score {r.score.toFixed(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
