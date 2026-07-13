'use client';

// Phase 1277 — Zubereitungs-Priorisierungs-Cockpit (Kitchen)
// Ordnet aktive Bestellungen nach Dringlichkeit (ETA - Zubereitungszeit) + kritische Reihenfolge farbkodiert
// Manuelle Prioritäts-Override-Taste; Props-basiert (orders); client-seitig via useMemo

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string | null;
  quantity?: number;
  item?: { name?: string | null; zubereitung_min?: number | null } | null;
}

interface Order {
  id: string;
  status?: string | null;
  customer_name?: string | null;
  items?: OrderItem[] | null;
  created_at?: string | null;
  estimated_delivery_at?: string | null;
}

interface Props {
  orders: Order[];
}

const AKTIV_STATUS = new Set(['new', 'confirmed', 'in_progress', 'preparing']);
const ZUBEREITUNG_DEFAULT_MIN = 12;

type Dringlichkeit = 'kritisch' | 'dringend' | 'normal' | 'entspannt';

interface PrioOrder {
  id: string;
  name: string;
  itemLabel: string;
  zubereitungMin: number;
  minutenBisEta: number;
  puffer: number;
  dringlichkeit: Dringlichkeit;
  manualPrio: boolean;
}

const DRING_STYLE: Record<Dringlichkeit, { row: string; badge: string; label: string }> = {
  kritisch:  { row: 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30',     badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',     label: 'Kritisch' },
  dringend:  { row: 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', label: 'Dringend' },
  normal:    { row: 'border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/10',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',     label: 'Normal' },
  entspannt: { row: 'border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-white/5',  badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', label: 'Entspannt' },
};

function dringFor(puffer: number): Dringlichkeit {
  if (puffer <= 0)  return 'kritisch';
  if (puffer <= 5)  return 'dringend';
  if (puffer <= 15) return 'normal';
  return 'entspannt';
}

export function KitchenPhase1277ZubereitungsPriorisierungsCockpit({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [manualPrios, setManualPrios] = useState<Set<string>>(new Set());

  const prioOrders = useMemo<PrioOrder[]>(() => {
    const now = Date.now();
    const active = orders.filter(o => o.status && AKTIV_STATUS.has(o.status));

    return active
      .map(o => {
        const itemCount = o.items?.reduce((s, i) => s + (i.quantity ?? 1), 0) ?? 1;
        const zubereitungMin = Math.max(ZUBEREITUNG_DEFAULT_MIN, itemCount * 2);

        let minutenBisEta = 30;
        if (o.estimated_delivery_at) {
          minutenBisEta = Math.max(0, (new Date(o.estimated_delivery_at).getTime() - now) / 60_000);
        } else if (o.created_at) {
          minutenBisEta = Math.max(0, 35 - (now - new Date(o.created_at).getTime()) / 60_000);
        }

        const puffer = minutenBisEta - zubereitungMin;
        const dringlichkeit = manualPrios.has(o.id) ? 'kritisch' : dringFor(puffer);

        const firstItem = o.items?.[0];
        const itemName = firstItem?.item?.name ?? firstItem?.name ?? 'Bestellung';
        const extra = (o.items?.length ?? 0) > 1 ? ` +${(o.items?.length ?? 1) - 1}` : '';

        return {
          id: o.id,
          name: o.customer_name ?? 'Gast',
          itemLabel: itemName + extra,
          zubereitungMin,
          minutenBisEta: Math.round(minutenBisEta),
          puffer: Math.round(puffer),
          dringlichkeit,
          manualPrio: manualPrios.has(o.id),
        };
      })
      .sort((a, b) => {
        if (a.manualPrio && !b.manualPrio) return -1;
        if (!a.manualPrio && b.manualPrio) return 1;
        return a.puffer - b.puffer;
      });
  }, [orders, manualPrios]);

  function togglePrio(id: string) {
    setManualPrios(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const kritisch = prioOrders.filter(o => o.dringlichkeit === 'kritisch').length;

  if (prioOrders.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <span className="font-semibold text-sm">Zubereitungs-Priorisierung</span>
          {kritisch > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-white/30 px-2 py-0.5 text-xs font-bold animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {kritisch} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-3 py-3 space-y-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
            {prioOrders.length} aktive Bestellungen sortiert nach Dringlichkeit (ETA − Zubereitungszeit)
          </p>

          {prioOrders.map((o, idx) => {
            const s = DRING_STYLE[o.dringlichkeit];
            return (
              <div key={o.id} className={cn('rounded-lg border px-3 py-2.5 flex items-center gap-3', s.row)}>
                {/* Rank */}
                <span className="shrink-0 w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{o.name}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.badge)}>{s.label}</span>
                    {o.manualPrio && (
                      <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 text-xs font-medium">
                        Manuell ↑
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{o.itemLabel}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 dark:text-slate-300">
                    <span>ETA: ~{o.minutenBisEta} Min</span>
                    <span>Zubereitung: ~{o.zubereitungMin} Min</span>
                    <span className={cn(
                      'font-semibold',
                      o.puffer <= 0 ? 'text-red-600 dark:text-red-400' :
                      o.puffer <= 5 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-500',
                    )}>
                      Puffer: {o.puffer > 0 ? `+${o.puffer}` : o.puffer} Min
                    </span>
                  </div>
                </div>

                {/* Manual prio toggle */}
                <button
                  onClick={() => togglePrio(o.id)}
                  className={cn(
                    'shrink-0 rounded-full p-1.5 transition-colors',
                    o.manualPrio
                      ? 'bg-purple-500 text-white hover:bg-purple-600'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600',
                  )}
                  title={o.manualPrio ? 'Manuelle Priorität entfernen' : 'Manuell priorisieren'}
                >
                  {o.manualPrio
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <ArrowUpCircle className="h-4 w-4" />
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
