'use client';

import { useMemo, useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = { id: string; bestellt_am: string | null; status: string };

interface Props { orders: Order[] }

const PENDING_STATUSES = new Set(['neu', 'angenommen', 'bestätigt', 'in_zubereitung']);

export function KitchenAuftragsWarteschlangenZeit({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const stats = useMemo(() => {
    const pending = orders.filter(o => PENDING_STATUSES.has(o.status) && o.bestellt_am);
    if (pending.length === 0) return null;

    const waits = pending.map(o => (now - new Date(o.bestellt_am!).getTime()) / 60_000);
    const avgMin = waits.reduce((a, b) => a + b, 0) / waits.length;
    const maxMin = Math.max(...waits);

    const buckets = [
      { label: '<5 Min',    count: waits.filter(w => w < 5).length,              color: '#10b981' },
      { label: '5–10 Min', count: waits.filter(w => w >= 5 && w < 10).length,   color: '#f59e0b' },
      { label: '10–15 Min',count: waits.filter(w => w >= 10 && w < 15).length,  color: '#f97316' },
      { label: '15+ Min',  count: waits.filter(w => w >= 15).length,            color: '#ef4444' },
    ];

    return { total: pending.length, avgMin, maxMin, buckets };
  }, [orders, now]);

  if (!stats) return null;

  const critical = stats.maxMin >= 15;
  const warning  = stats.maxMin >= 10;

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3',
      critical ? 'border-red-200 bg-red-50'
        : warning ? 'border-amber-200 bg-amber-50'
        : 'border-stone-100 bg-white',
    )}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {critical
            ? <AlertTriangle className="h-4 w-4 text-red-500" />
            : <Clock className="h-4 w-4 text-stone-400" />}
          <span className="text-xs font-bold text-stone-700">Warteschlange</span>
        </div>
        <span className="text-[11px] font-semibold text-stone-500">
          {stats.total} {stats.total === 1 ? 'Auftrag' : 'Aufträge'}
        </span>
      </div>

      <div className="mb-2.5 grid grid-cols-3 gap-2 text-center">
        <div>
          <div className={cn(
            'text-lg font-black tabular-nums',
            critical ? 'text-red-600' : warning ? 'text-amber-600' : 'text-matcha-600',
          )}>
            {Math.round(stats.maxMin)}&apos;
          </div>
          <div className="text-[9px] font-semibold text-stone-400">Längste Wartezeit</div>
        </div>
        <div>
          <div className="text-lg font-black tabular-nums text-stone-700">
            {stats.avgMin.toFixed(1)}&apos;
          </div>
          <div className="text-[9px] font-semibold text-stone-400">Ø Wartezeit</div>
        </div>
        <div>
          <div className="text-lg font-black tabular-nums text-red-600">
            {stats.buckets[3].count}
          </div>
          <div className="text-[9px] font-semibold text-stone-400">Überfällig (15+)</div>
        </div>
      </div>

      <div className="space-y-1">
        {stats.buckets.map(b => (
          <div key={b.label} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-[9px] font-semibold text-stone-500">{b.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${stats.total > 0 ? (b.count / stats.total) * 100 : 0}%`,
                  background: b.color,
                }}
              />
            </div>
            <span className="w-4 shrink-0 text-right text-[9px] font-bold tabular-nums text-stone-600">
              {b.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
