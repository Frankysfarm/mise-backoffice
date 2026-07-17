'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Crown, ChevronDown, ChevronUp } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  customer_name?: string;
  customer_id?: string;
  order_count?: number;
  total?: number;
  items?: { name?: string; product_name?: string }[];
  created_at?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

const VIP_THRESHOLD = 5;
const ACTIVE_STATUSES = new Set(['accepted', 'new', 'angenommen', 'in_delivery', 'preparing']);

export function KitchenPhase2053StammkundenBestellungsHighlight({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [sortBy, setSortBy] = useState<'count' | 'time'>('count');

  const vipOrders = useMemo(() => {
    return orders
      .filter(o =>
        ACTIVE_STATUSES.has(o.status ?? '') &&
        (o.order_count ?? 0) >= VIP_THRESHOLD,
      )
      .sort((a, b) => {
        if (sortBy === 'count') return (b.order_count ?? 0) - (a.order_count ?? 0);
        return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      });
  }, [orders, sortBy]);

  return (
    <div className={cn('rounded-xl border border-gray-800 bg-gray-900 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          VIP-Bestellungen
          {vipOrders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs bg-yellow-900 text-yellow-300">
              {vipOrders.length}
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-2 text-[10px]">
            <button
              onClick={() => setSortBy('count')}
              className={cn(
                'px-2 py-1 rounded font-semibold transition-colors',
                sortBy === 'count' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
              )}
            >
              Nach Bestellungen
            </button>
            <button
              onClick={() => setSortBy('time')}
              className={cn(
                'px-2 py-1 rounded font-semibold transition-colors',
                sortBy === 'time' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-800 text-gray-400 hover:bg-gray-700',
              )}
            >
              Nach Zeit
            </button>
          </div>

          {vipOrders.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">
              Keine aktiven VIP-Bestellungen (≥{VIP_THRESHOLD} Bestellungen)
            </p>
          ) : (
            <div className="space-y-2">
              {vipOrders.map(o => {
                const firstItem = (o.items ?? [])[0];
                const label = firstItem?.product_name ?? firstItem?.name ?? `#${o.id.slice(-4)}`;
                const waitMin = o.created_at
                  ? Math.round((Date.now() - new Date(o.created_at).getTime()) / 60_000)
                  : null;

                return (
                  <div
                    key={o.id}
                    className="rounded-lg bg-yellow-950 border border-yellow-800 p-2.5 flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Crown className="w-3 h-3 text-yellow-400 shrink-0" />
                        <span className="text-xs font-bold text-yellow-200 truncate">
                          {o.customer_name ?? 'Stammkunde'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-yellow-700 text-yellow-100">
                          VIP
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-0.5 truncate">{label}</div>
                      {waitMin !== null && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{waitMin} Min. Wartezeit</div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-yellow-300">{o.order_count}×</div>
                      <div className="text-[10px] text-gray-500">Bestellungen</div>
                      {(o.total ?? 0) > 0 && (
                        <div className="text-[10px] text-gray-400">{o.total?.toFixed(2)} €</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
