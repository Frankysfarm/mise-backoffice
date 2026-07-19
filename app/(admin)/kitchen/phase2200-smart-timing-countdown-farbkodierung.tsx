'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

interface OrderCountdown {
  orderId: string;
  customerName: string;
  itemCount: number;
  startedAt: number; // unix ms
  targetMin: number;
  status: 'cooking' | 'waiting' | 'ready';
}

const MOCK_ORDERS: OrderCountdown[] = [
  { orderId: 'ORD-001', customerName: 'Maria S.', itemCount: 3, startedAt: Date.now() - 4 * 60 * 1000, targetMin: 8, status: 'cooking' },
  { orderId: 'ORD-002', customerName: 'Tom K.', itemCount: 2, startedAt: Date.now() - 7 * 60 * 1000, targetMin: 7, status: 'cooking' },
  { orderId: 'ORD-003', customerName: 'Lena B.', itemCount: 5, startedAt: Date.now() - 11 * 60 * 1000, targetMin: 10, status: 'ready' },
  { orderId: 'ORD-004', customerName: 'Kai M.', itemCount: 1, startedAt: Date.now() - 2 * 60 * 1000, targetMin: 9, status: 'cooking' },
  { orderId: 'ORD-005', customerName: 'Sana R.', itemCount: 4, startedAt: Date.now() - 9 * 60 * 1000, targetMin: 8, status: 'cooking' },
];

function getElapsedMin(startedAt: number) {
  return (Date.now() - startedAt) / 60000;
}

function getColorClass(elapsed: number, target: number, status: OrderCountdown['status']): string {
  if (status === 'ready') return 'bg-emerald-50 border-emerald-300 text-emerald-700';
  const ratio = elapsed / target;
  if (ratio >= 1) return 'bg-red-50 border-red-400 text-red-700';
  if (ratio >= 0.8) return 'bg-amber-50 border-amber-400 text-amber-700';
  return 'bg-matcha-50 border-matcha-300 text-matcha-700';
}

function formatCountdown(elapsed: number, target: number, status: OrderCountdown['status']): string {
  if (status === 'ready') return 'Fertig';
  const remaining = target - elapsed;
  if (remaining <= 0) {
    const over = Math.abs(remaining);
    return `+${Math.floor(over)}:${String(Math.floor((over % 1) * 60)).padStart(2, '0')} überfällig`;
  }
  const mins = Math.floor(remaining);
  const secs = Math.floor((remaining % 1) * 60);
  return `${mins}:${String(secs).padStart(2, '0')} verbleibend`;
}

export function KitchenPhase2200SmartTimingCountdownFarbkodierung() {
  const [orders, setOrders] = useState<OrderCountdown[]>(MOCK_ORDERS);
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('kitchen_orders')
        .select('id,customer_name,item_count,started_at,target_prep_min,status')
        .in('status', ['cooking', 'waiting', 'ready'])
        .order('started_at', { ascending: true })
        .limit(8);
      if (data && data.length > 0) {
        setOrders(data.map((d: any) => ({
          orderId: d.id,
          customerName: d.customer_name ?? 'Unbekannt',
          itemCount: d.item_count ?? 1,
          startedAt: new Date(d.started_at).getTime(),
          targetMin: d.target_prep_min ?? 10,
          status: d.status,
        })));
      }
    } catch {
      // keep mock
    }
  }, [supabase]);

  useEffect(() => {
    refresh();
    const refreshId = setInterval(refresh, 20000);
    const tickId = setInterval(() => setTick((t) => t + 1), 1000);
    return () => { clearInterval(refreshId); clearInterval(tickId); };
  }, [refresh]);

  const overdueCount = orders.filter(
    (o) => o.status !== 'ready' && getElapsedMin(o.startedAt) >= o.targetMin,
  ).length;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-semibold text-stone-800">Smart-Timing Countdown</span>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {overdueCount} überfällig
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-stone-400">
          <span className="w-2 h-2 rounded-full bg-matcha-400 inline-block" /> OK
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Bald
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Spät
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {orders.map((o) => {
          const elapsed = getElapsedMin(o.startedAt);
          const colorClass = getColorClass(elapsed, o.targetMin, o.status);
          const progressPct = Math.min((elapsed / o.targetMin) * 100, 100);
          const isOverdue = o.status !== 'ready' && elapsed >= o.targetMin;

          return (
            <div
              key={o.orderId}
              className={`rounded-lg border p-2.5 ${colorClass} transition-colors duration-500`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{o.customerName}</p>
                  <p className="text-[10px] opacity-70">{o.itemCount} Artikel · {o.orderId}</p>
                </div>
                {o.status === 'ready' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                ) : isOverdue ? (
                  <Flame className="w-4 h-4 shrink-0 text-red-500 animate-pulse" />
                ) : null}
              </div>

              <div className="mt-2">
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      o.status === 'ready' ? 'bg-emerald-500' :
                      isOverdue ? 'bg-red-500' :
                      progressPct >= 80 ? 'bg-amber-400' : 'bg-matcha-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-[10px] font-mono font-bold mt-1">
                  {formatCountdown(elapsed, o.targetMin, o.status)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-stone-400 text-center mt-3">
        Farbkodierung: Grün → Gelb → Rot · 1s Ticker · 20s Daten-Refresh
      </p>
    </div>
  );
}
