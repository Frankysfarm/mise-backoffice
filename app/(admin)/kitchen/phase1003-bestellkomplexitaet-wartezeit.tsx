'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 1003 — Bestellungs-Komplexitäts-Wartezeit-Prognose (Kitchen)
 *
 * Zeigt je aktiver Bestellung eine geschätzte Restwartezeit
 * basierend auf Artikelanzahl + Komplexitäts-Keywords.
 * Rein client-seitig, kein API-Call.
 */

interface OrderItem {
  name?: string;
  title?: string;
  quantity?: number;
}

interface Order {
  id: string;
  order_number?: string | number;
  status: string;
  created_at?: string;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

const KOMPLEX_KEYWORDS = [
  'burger', 'steak', 'grill', 'auflauf', 'überbacken', 'gefüllt', 'gebacken',
  'schnitzel', 'roulade', 'risotto', 'ramen', 'curry', 'eintopf',
];
const EINFACH_KEYWORDS = [
  'salat', 'wrap', 'sandwich', 'brot', 'snack', 'getränk', 'dessert', 'eis', 'kuchen',
];

function schätzeWartezeit(order: Order): number {
  const items = order.items ?? [];
  const anzahl = items.reduce((s, i) => s + (i.quantity ?? 1), 0);
  const names = items.map(i => (i.name ?? i.title ?? '').toLowerCase()).join(' ');

  let basis = 8 + anzahl * 2;
  if (KOMPLEX_KEYWORDS.some(k => names.includes(k))) basis += 6;
  if (EINFACH_KEYWORDS.some(k => names.includes(k))) basis -= 3;

  const elapsed = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000)
    : 0;
  const rest = Math.max(0, basis - elapsed);
  return rest;
}

function statusColor(min: number): { ring: string; text: string; badge: string; label: string } {
  if (min <= 3) return { ring: 'ring-red-400', text: 'text-red-600', badge: 'bg-red-100 text-red-700 border-red-300', label: 'Dringend' };
  if (min <= 8) return { ring: 'ring-amber-400', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700 border-amber-300', label: 'Bald' };
  return { ring: 'ring-matcha-400', text: 'text-matcha-600', badge: 'bg-matcha-100 text-matcha-700 border-matcha-300', label: 'OK' };
}

export function KitchenPhase1003BestellkomplexitaetWartezeit({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const active = orders.filter(o =>
      ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'].includes(o.status)
    );
    return active
      .map(o => ({ order: o, restMin: schätzeWartezeit(o) }))
      .sort((a, b) => a.restMin - b.restMin)
      .slice(0, 12);
  }, [orders]);

  const dringend = rows.filter(r => r.restMin <= 3).length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-bold">Wartezeit-Prognose</span>
          {dringend > 0 && (
            <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-300 animate-pulse">
              <Zap className="h-2.5 w-2.5" />
              {dringend} dringend
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-3">Keine aktiven Bestellungen</p>
          )}
          {rows.map(({ order, restMin }) => {
            const col = statusColor(restMin);
            const nr = order.order_number ?? order.id.slice(0, 6).toUpperCase();
            const itemCount = (order.items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0);
            return (
              <div
                key={order.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-2.5 ring-1',
                  col.ring,
                )}
              >
                <div className={cn('shrink-0 text-xl font-black tabular-nums w-10 text-center', col.text)}>
                  {restMin}
                  <div className="text-[9px] font-medium text-muted-foreground">Min</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold truncate">#{nr}</div>
                  <div className="text-[10px] text-muted-foreground">{itemCount} Artikel</div>
                </div>
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold', col.badge)}>
                  {col.label}
                </span>
              </div>
            );
          })}
          {rows.length > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              Prognose basiert auf Artikel-Komplexität + vergangener Zeit
            </p>
          )}
        </div>
      )}
    </div>
  );
}
