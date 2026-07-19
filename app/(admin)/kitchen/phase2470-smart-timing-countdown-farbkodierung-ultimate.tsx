'use client';
import { useEffect, useState, useRef } from 'react';
import { AlertTriangle, Clock, CheckCircle2, Flame, Zap } from 'lucide-react';

interface OrderTimer {
  order_id: string;
  order_number: string;
  prep_started_at: string | null;
  target_ready_at: string | null;
  status: 'pending' | 'cooking' | 'ready';
  items_count: number;
  priority: 'normal' | 'high';
}

interface ApiData {
  orders: OrderTimer[];
  on_time_quote: number;
  avg_prep_time_min: number;
  batch_label?: string;
}

function getSecondsLeft(targetAt: string | null): number {
  if (!targetAt) return 0;
  return Math.floor((new Date(targetAt).getTime() - Date.now()) / 1000);
}

function ampelClass(secsLeft: number, status: string): string {
  if (status === 'ready') return 'border-emerald-300 bg-emerald-50';
  if (secsLeft > 120) return 'border-green-300 bg-green-50';
  if (secsLeft > 30) return 'border-amber-300 bg-amber-50';
  return 'border-red-300 bg-red-50';
}

function ampelTextClass(secsLeft: number, status: string): string {
  if (status === 'ready') return 'text-emerald-700';
  if (secsLeft > 120) return 'text-green-700';
  if (secsLeft > 30) return 'text-amber-700';
  return 'text-red-700';
}

function ampelBarClass(secsLeft: number, status: string): string {
  if (status === 'ready') return 'bg-emerald-500';
  if (secsLeft > 120) return 'bg-green-500';
  if (secsLeft > 30) return 'bg-amber-400';
  return 'bg-red-500';
}

function fmtSecs(s: number): string {
  if (s <= 0) return '0:00';
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}:${sec.toString().padStart(2, '0')}`;
}

function CountdownRing({ secsLeft, maxSecs, status }: { secsLeft: number; maxSecs: number; status: string }) {
  const pct = status === 'ready' ? 1 : Math.max(0, Math.min(1, secsLeft / maxSecs));
  const r = 18;
  const circ = 2 * Math.PI * r;
  const stroke = status === 'ready' ? '#10b981' : secsLeft > 120 ? '#22c55e' : secsLeft > 30 ? '#f59e0b' : '#ef4444';

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
    </svg>
  );
}

const MOCK_DATA: ApiData = {
  on_time_quote: 82,
  avg_prep_time_min: 14,
  batch_label: 'Batch A',
  orders: [
    { order_id: '1', order_number: '#1042', prep_started_at: new Date(Date.now() - 8 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 4 * 60000).toISOString(), status: 'cooking', items_count: 3, priority: 'normal' },
    { order_id: '2', order_number: '#1043', prep_started_at: new Date(Date.now() - 3 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 25000).toISOString(), status: 'cooking', items_count: 2, priority: 'high' },
    { order_id: '3', order_number: '#1041', prep_started_at: new Date(Date.now() - 15 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 2 * 60000).toISOString(), status: 'cooking', items_count: 4, priority: 'normal' },
    { order_id: '4', order_number: '#1040', prep_started_at: new Date(Date.now() - 18 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 5 * 60000).toISOString(), status: 'ready', items_count: 1, priority: 'normal' },
  ],
};

export function KitchenPhase2470SmartTimingCountdownFarbkodierungUltimate({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK_DATA);
  const [tick, setTick] = useState(0);

  async function load() {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/active-orders?location_id=${locationId}`);
      if (r.ok) {
        const json = await r.json();
        if (json?.orders?.length) setData(json);
      }
    } catch {}
  }

  useEffect(() => {
    load();
    const poll = setInterval(load, 30_000);
    const ticker = setInterval(() => setTick(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(ticker); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const activeOrders = data.orders.filter(o => o.status !== 'ready');
  const overdueCount = activeOrders.filter(o => getSecondsLeft(o.target_ready_at) < 0).length;
  const criticalCount = activeOrders.filter(o => { const s = getSecondsLeft(o.target_ready_at); return s >= 0 && s <= 30; }).length;

  return (
    <div className="rounded-xl border border-stone-200 bg-white mb-3 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-stone-600" />
          <span className="font-semibold text-sm text-stone-800">Smart-Timing Countdown</span>
          {data.batch_label && (
            <span className="text-xs bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">{data.batch_label}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 size={11} className="text-green-600" />
            {data.on_time_quote}% On-Time
          </span>
          <span>Ø {data.avg_prep_time_min} Min</span>
        </div>
      </div>

      {/* Alert Strip */}
      {(overdueCount > 0 || criticalCount > 0) && (
        <div className={`flex items-center gap-2 px-4 py-2 text-xs ${overdueCount > 0 ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
          <AlertTriangle size={12} className="shrink-0" />
          {overdueCount > 0
            ? `${overdueCount} Bestellung${overdueCount > 1 ? 'en' : ''} überfällig — sofort abschicken!`
            : `${criticalCount} Bestellung${criticalCount > 1 ? 'en' : ''} in den nächsten 30 Sek fertig`
          }
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-px bg-stone-100 border-b border-stone-100">
        {[
          { label: 'Aktiv', value: activeOrders.length, color: 'text-stone-700' },
          { label: 'Überfällig', value: overdueCount, color: overdueCount > 0 ? 'text-red-600 font-bold' : 'text-stone-700' },
          { label: 'Fertig', value: data.orders.filter(o => o.status === 'ready').length, color: 'text-emerald-700' },
        ].map(k => (
          <div key={k.label} className="bg-white px-3 py-2 text-center">
            <div className={`text-base font-black tabular-nums ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-stone-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Order Cards */}
      <div className="p-3 space-y-2">
        {data.orders.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-2">Keine aktiven Bestellungen</p>
        ) : (
          data.orders.map(order => {
            const secsLeft = getSecondsLeft(order.target_ready_at);
            const maxSecs = 15 * 60;
            return (
              <div
                key={order.order_id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${ampelClass(secsLeft, order.status)}`}
              >
                <CountdownRing secsLeft={secsLeft} maxSecs={maxSecs} status={order.status} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-stone-800">{order.order_number}</span>
                    {order.priority === 'high' && <Flame size={11} className="text-orange-500" />}
                    <span className="text-xs text-stone-500">{order.items_count} Artikel</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-white/60 overflow-hidden w-full">
                    <div
                      className={`h-full rounded-full transition-all ${ampelBarClass(secsLeft, order.status)}`}
                      style={{ width: order.status === 'ready' ? '100%' : `${Math.max(5, Math.min(100, (1 - secsLeft / maxSecs) * 100))}%` }}
                    />
                  </div>
                </div>

                <div className={`text-right font-black tabular-nums text-lg ${ampelTextClass(secsLeft, order.status)}`}>
                  {order.status === 'ready' ? (
                    <CheckCircle2 size={20} className="text-emerald-600" />
                  ) : (
                    <span>{secsLeft < 0 ? <span className="text-red-600">{fmtSecs(secsLeft)}</span> : fmtSecs(secsLeft)}</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legende */}
      <div className="flex gap-3 px-4 pb-3 text-[10px] text-stone-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> &gt;2 Min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> &lt;30 Sek</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Überfällig</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Fertig</span>
      </div>
    </div>
  );
}
