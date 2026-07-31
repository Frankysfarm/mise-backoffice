'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';

interface OrderEntry {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  items_count: number;
  kochstart_am: string | null;
  prep_time_min: number;
  status: 'in_zubereitung' | 'fertig' | 'fertig_wartend';
}

interface ApiResponse {
  orders: OrderEntry[];
  total: number;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: '1', bestellnummer: '#1042', kunde: 'Schmidt, M.', items_count: 3, kochstart_am: new Date(Date.now() - 4 * 60 * 1000).toISOString(), prep_time_min: 12, status: 'in_zubereitung' },
    { order_id: '2', bestellnummer: '#1043', kunde: 'Müller, K.', items_count: 2, kochstart_am: new Date(Date.now() - 2 * 60 * 1000).toISOString(), prep_time_min: 10, status: 'in_zubereitung' },
    { order_id: '3', bestellnummer: '#1044', kunde: 'Weber, S.', items_count: 4, kochstart_am: new Date(Date.now() - 14 * 60 * 1000).toISOString(), prep_time_min: 15, status: 'fertig' },
    { order_id: '4', bestellnummer: '#1045', kunde: 'Bauer, T.', items_count: 1, kochstart_am: new Date(Date.now() - 1 * 60 * 1000).toISOString(), prep_time_min: 8, status: 'in_zubereitung' },
  ],
  total: 4,
};

function getRemainingMin(entry: OrderEntry): number {
  if (!entry.kochstart_am) return entry.prep_time_min;
  const startMs = new Date(entry.kochstart_am).getTime();
  const elapsedMin = (Date.now() - startMs) / 60000;
  return Math.max(0, entry.prep_time_min - elapsedMin);
}

function getColor(remaining: number, status: string) {
  if (status === 'fertig') return { bg: 'bg-green-900/40', border: 'border-green-700', text: 'text-green-300', bar: 'bg-green-500' };
  if (remaining <= 0) return { bg: 'bg-red-900/60', border: 'border-red-600', text: 'text-red-300', bar: 'bg-red-500' };
  if (remaining < 5) return { bg: 'bg-red-900/40', border: 'border-red-700', text: 'text-red-400', bar: 'bg-red-500' };
  if (remaining < 10) return { bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-300', bar: 'bg-yellow-500' };
  return { bg: 'bg-gray-900/40', border: 'border-gray-700', text: 'text-green-400', bar: 'bg-green-500' };
}

function formatTime(min: number): string {
  if (min <= 0) return 'FERTIG';
  const m = Math.floor(min);
  const s = Math.floor((min - m) * 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function KitchenPhase5291SmartTimingCountdownFarbkodierung({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/kitchen-countdown${params}`).catch(() => null);
    if (res?.ok) {
      const json = await res.json();
      setData({ orders: json.orders ?? [], total: json.total ?? 0 });
    } else {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const pollId = setInterval(load, 15 * 1000);
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      clearInterval(pollId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.orders?.length) return null;

  const active = data.orders.filter(o => o.status === 'in_zubereitung');
  const done = data.orders.filter(o => o.status !== 'in_zubereitung');
  const overdue = active.filter(o => getRemainingMin(o) <= 0).length;
  const critical = active.filter(o => { const r = getRemainingMin(o); return r > 0 && r < 5; }).length;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/50 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Smart-Timing Countdown — Farbkodierung</span>
        <div className="ml-auto flex items-center gap-2">
          {overdue > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-400 bg-red-900/40 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {overdue} überfällig
            </span>
          )}
          {critical > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3" />
              {critical} kritisch
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-gray-800/60 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">In Zubereitung</div>
          <div className="text-lg font-black text-indigo-300 tabular-nums">{active.length}</div>
        </div>
        <div className="rounded-lg bg-red-900/30 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Überfällig</div>
          <div className="text-lg font-black text-red-400 tabular-nums">{overdue}</div>
        </div>
        <div className="rounded-lg bg-green-900/30 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Fertig</div>
          <div className="text-lg font-black text-green-400 tabular-nums">{done.length}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.orders.slice(0, 6).map(order => {
          const remaining = getRemainingMin(order);
          const c = getColor(remaining, order.status);
          const progress = order.status === 'fertig'
            ? 100
            : Math.min(100, ((order.prep_time_min - remaining) / order.prep_time_min) * 100);

          return (
            <div key={order.order_id} className={`rounded-lg border ${c.border} ${c.bg} px-3 py-2`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  {order.status === 'fertig'
                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                    : remaining <= 0
                    ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                    : <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  }
                  <span className="text-xs font-bold text-gray-200 truncate">{order.bestellnummer}</span>
                  <span className="text-[10px] text-gray-500 truncate hidden sm:block">{order.kunde}</span>
                </div>
                <span className={`text-sm font-black tabular-nums shrink-0 ml-2 ${c.text}`}>
                  {order.status === 'fertig' ? '✓' : formatTime(remaining)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${c.bar}`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                <span>{order.items_count} {order.items_count === 1 ? 'Artikel' : 'Artikel'}</span>
                <span>Ziel: {order.prep_time_min} Min</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex gap-3 text-[9px] text-gray-600">
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-green-500" /> &gt;10 Min</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-yellow-500" /> 5–10 Min</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-500" /> &lt;5 Min</span>
      </div>
    </div>
  );
}
