'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldAlert, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

interface OrderItem {
  name?: string;
  product_name?: string;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

interface ItemQuality {
  name: string;
  total: number;
  storno: number;
  rate: number;
}

const STORNO_STATUSES = new Set(['cancelled', 'storniert', 'canceled']);
const ALERT_THRESHOLD = 10;

export function KitchenPhase2040ZubereitungsQualitaetsMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { items, alertCount } = useMemo(() => {
    const map = new Map<string, { total: number; storno: number }>();

    for (const order of orders) {
      const isStorno = STORNO_STATUSES.has(order.status ?? '');
      for (const item of order.items ?? []) {
        const name = item.product_name ?? item.name ?? 'Unbekannt';
        if (!map.has(name)) map.set(name, { total: 0, storno: 0 });
        const entry = map.get(name)!;
        entry.total++;
        if (isStorno) entry.storno++;
      }
    }

    const list: ItemQuality[] = Array.from(map.entries())
      .filter(([, v]) => v.total >= 3)
      .map(([name, v]) => ({
        name,
        total: v.total,
        storno: v.storno,
        rate: Math.round((v.storno / v.total) * 100),
      }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 8);

    return { items: list, alertCount: list.filter(i => i.rate > ALERT_THRESHOLD).length };
  }, [orders]);

  function rateColor(rate: number) {
    if (rate > ALERT_THRESHOLD) return 'text-red-400';
    if (rate > 5) return 'text-amber-400';
    return 'text-green-400';
  }

  function barColor(rate: number) {
    if (rate > ALERT_THRESHOLD) return 'bg-red-500';
    if (rate > 5) return 'bg-amber-400';
    return 'bg-green-500';
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-100 hover:bg-gray-800 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-orange-400" />
          Zubereitungs-Qualitäts-Monitor
          {alertCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-900 text-red-300">
              {alertCount} Artikel
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {alertCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              {alertCount} Artikel mit Storno-Quote &gt;{ALERT_THRESHOLD}% — Qualität prüfen!
            </div>
          )}

          {items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Zu wenig Daten — mindestens 3 Bestellungen je Artikel nötig</p>
          ) : (
            <div className="space-y-2">
              {items.map(item => (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-200 truncate max-w-[60%]">{item.name}</span>
                    <span className={cn('font-semibold', rateColor(item.rate))}>
                      {item.rate}%
                      <span className="text-gray-500 font-normal ml-1">({item.storno}/{item.total})</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(item.rate))}
                      style={{ width: `${Math.min(item.rate * 5, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-gray-200">{orders.length}</div>
              <div className="text-[10px] text-gray-500">Gesamt</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-red-400">
                {orders.filter(o => STORNO_STATUSES.has(o.status ?? '')).length}
              </div>
              <div className="text-[10px] text-gray-500">Storniert</div>
            </div>
            <div className="rounded-lg bg-gray-800 px-2 py-1.5 text-center">
              <div className="text-sm font-bold text-orange-400">{alertCount}</div>
              <div className="text-[10px] text-gray-500">Alarm-Artikel</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
