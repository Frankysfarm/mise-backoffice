'use client';

// Phase 1217 — Rezept-Zutaten-Countdown (Kitchen)
// Für die nächsten 5 pending Bestellungen: Welche Zutaten werden benötigt + Ampel ob genug vorhanden

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Package, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

type ZutatStatus = 'ok' | 'knapp' | 'fehlt';

interface Zutat {
  name: string;
  benoetigt: number;
  einheit: string;
  status: ZutatStatus;
}

const ZUTAT_MAP: Record<string, { einheit: string; pro_einheit: number; bestand: number }> = {
  'Pizzateig':     { einheit: 'Stk', pro_einheit: 1,   bestand: 8  },
  'Tomatensauce':  { einheit: 'EL',  pro_einheit: 3,   bestand: 40 },
  'Mozzarella':    { einheit: 'g',   pro_einheit: 120, bestand: 600 },
  'Basilikum':     { einheit: 'g',   pro_einheit: 5,   bestand: 30 },
  'Burgerbrötchen':{ einheit: 'Stk', pro_einheit: 1,   bestand: 5  },
  'Rinderhack':    { einheit: 'g',   pro_einheit: 150, bestand: 450 },
  'Salatblatt':    { einheit: 'Stk', pro_einheit: 2,   bestand: 12 },
  'Pommes':        { einheit: 'g',   pro_einheit: 200, bestand: 1200 },
  'Öl':            { einheit: 'ml',  pro_einheit: 50,  bestand: 800 },
};

function itemNameToZutaten(itemName: string): string[] {
  const n = itemName.toLowerCase();
  if (n.includes('pizza') || n.includes('margherita')) return ['Pizzateig', 'Tomatensauce', 'Mozzarella', 'Basilikum'];
  if (n.includes('burger')) return ['Burgerbrötchen', 'Rinderhack', 'Salatblatt'];
  if (n.includes('pommes') || n.includes('fries')) return ['Pommes', 'Öl'];
  return [];
}

function zutatenStatus(benoetigt: number, bestand: number): ZutatStatus {
  if (bestand >= benoetigt) return 'ok';
  if (bestand >= benoetigt * 0.5) return 'knapp';
  return 'fehlt';
}

const STATUS_STYLE: Record<ZutatStatus, { icon: React.FC<{ className?: string }>, color: string, bg: string, label: string }> = {
  ok:    { icon: CheckCircle,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/20', label: 'Genug' },
  knapp: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400',    bg: 'bg-amber-50 dark:bg-amber-950/20',    label: 'Knapp' },
  fehlt: { icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-400',      bg: 'bg-rose-50 dark:bg-rose-950/20',      label: 'Fehlt' },
};

export function KitchenPhase1217RezeptZutatenCountdown({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const pendingOrders = useMemo(() => {
    return orders
      .filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'neu')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 5);
  }, [orders]);

  const zutaten = useMemo((): Zutat[] => {
    const needed: Map<string, number> = new Map();
    for (const order of pendingOrders) {
      for (const item of order.items ?? []) {
        const zs = itemNameToZutaten(item.name);
        for (const z of zs) {
          const cfg = ZUTAT_MAP[z];
          if (!cfg) continue;
          needed.set(z, (needed.get(z) ?? 0) + cfg.pro_einheit * item.quantity);
        }
      }
    }
    return Array.from(needed.entries()).map(([name, benoetigt]) => {
      const cfg = ZUTAT_MAP[name];
      return {
        name,
        benoetigt,
        einheit: cfg?.einheit ?? '',
        status: zutatenStatus(benoetigt, cfg?.bestand ?? 0),
      };
    }).sort((a, b) => {
      const ord: Record<ZutatStatus, number> = { fehlt: 0, knapp: 1, ok: 2 };
      return ord[a.status] - ord[b.status];
    });
  }, [pendingOrders]);

  if (pendingOrders.length === 0) return null;

  const fehlendeZutaten = zutaten.filter(z => z.status === 'fehlt').length;
  const knappeZutaten   = zutaten.filter(z => z.status === 'knapp').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Package className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Zutaten-Countdown</span>
          <span className="text-[10px] rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 px-2 py-0.5 font-semibold">
            {pendingOrders.length} Bestellungen
          </span>
          {fehlendeZutaten > 0 && (
            <span className="text-[10px] rounded-full bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 px-2 py-0.5 font-bold animate-pulse">
              {fehlendeZutaten} Fehlt
            </span>
          )}
          {knappeZutaten > 0 && (
            <span className="text-[10px] rounded-full bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 font-semibold">
              {knappeZutaten} Knapp
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t p-4 space-y-3">
          {/* Pending-Bestellungen-Summary */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Nächste {pendingOrders.length} Bestellungen:</span>
            {pendingOrders.map(o => (
              <span key={o.id} className="text-[10px] rounded bg-muted px-1.5 py-0.5 font-mono">
                #{o.id.slice(-4)}
              </span>
            ))}
          </div>

          {/* Zutaten-Liste */}
          {zutaten.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">Keine Zutaten erkannt — Bestellungen ohne Artikel-Details.</div>
          ) : (
            <div className="space-y-1.5">
              {zutaten.map(z => {
                const s = STATUS_STYLE[z.status];
                const Icon = s.icon;
                return (
                  <div
                    key={z.name}
                    className={cn(
                      'flex items-center justify-between rounded-lg px-3 py-1.5 border',
                      z.status === 'fehlt' ? 'border-rose-200 dark:border-rose-800' :
                      z.status === 'knapp' ? 'border-amber-200 dark:border-amber-800' :
                      'border-transparent',
                      s.bg,
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', s.color)} />
                      <span className="text-xs font-medium">{z.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums font-mono text-muted-foreground">
                        {z.benoetigt} {z.einheit}
                      </span>
                      <span className={cn('text-[10px] font-bold rounded px-1.5 py-0.5', s.color)}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground pt-1 border-t">
            Bestandsdaten sind Richtwerte — bitte physisch prüfen.
          </p>
        </div>
      )}
    </div>
  );
}
