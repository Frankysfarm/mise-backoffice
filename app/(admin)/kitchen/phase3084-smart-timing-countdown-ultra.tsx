'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface OrderEntry {
  order_id: string;
  order_number: string;
  customer_name: string;
  prep_started_at: string | null;
  target_ready_at: string;
  items_count: number;
  ampel: 'gruen' | 'gelb' | 'rot' | 'kritisch';
  seconds_remaining: number;
  kochstart_empfehlung: boolean;
}

interface ApiData {
  orders: OrderEntry[];
  on_time_rate: number;
  faellige_count: number;
  kritisch_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', order_number: '#1042', customer_name: 'Max M.', prep_started_at: null, target_ready_at: new Date(Date.now() + 14 * 60 * 1000).toISOString(), items_count: 3, ampel: 'gruen', seconds_remaining: 840, kochstart_empfehlung: true },
    { order_id: 'o2', order_number: '#1041', customer_name: 'Julia F.', prep_started_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(), target_ready_at: new Date(Date.now() + 4 * 60 * 1000).toISOString(), items_count: 2, ampel: 'gelb', seconds_remaining: 240, kochstart_empfehlung: false },
    { order_id: 'o3', order_number: '#1040', customer_name: 'Sara K.', prep_started_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(), target_ready_at: new Date(Date.now() + 1 * 60 * 1000).toISOString(), items_count: 4, ampel: 'rot', seconds_remaining: 65, kochstart_empfehlung: false },
    { order_id: 'o4', order_number: '#1039', customer_name: 'Tim B.', prep_started_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(), target_ready_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(), items_count: 1, ampel: 'kritisch', seconds_remaining: -120, kochstart_empfehlung: false },
  ],
  on_time_rate: 78,
  faellige_count: 1,
  kritisch_count: 1,
  gesamt: 4,
};

function ampelCls(a: string) {
  if (a === 'kritisch') return { bg: 'bg-red-100 border-red-400 dark:bg-red-900/30 dark:border-red-600', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-500 text-white', bar: 'bg-red-500' };
  if (a === 'rot')      return { bg: 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-400', badge: 'bg-orange-500 text-white', bar: 'bg-orange-500' };
  if (a === 'gelb')     return { bg: 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-400', badge: 'bg-amber-400 text-white', bar: 'bg-amber-400' };
  return                       { bg: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700', text: 'text-green-700 dark:text-green-400', badge: 'bg-green-500 text-white', bar: 'bg-green-500' };
}

function formatCountdown(secs: number): string {
  if (secs < 0) return `+${Math.abs(Math.floor(secs / 60))}m überfällig`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase3084SmartTimingCountdownUltra({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const loadData = () =>
      fetch(`/api/delivery/kitchen/queue?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (locationId) loadData();
    else setData(MOCK);
    const poll = setInterval(loadData, 15_000);
    return () => clearInterval(poll);
  }, [locationId]);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const orders = data?.orders ?? [];
  const kritisch = orders.filter(o => o.ampel === 'kritisch');

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">Smart-Timing Countdown Ultra</span>
          {(data?.kritisch_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 dark:bg-red-900/40 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {data?.kritisch_count} kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">On-Time Rate</div>
              <div className={`font-bold text-base ${(data?.on_time_rate ?? 0) >= 85 ? 'text-green-600' : (data?.on_time_rate ?? 0) >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {data?.on_time_rate ?? 0} %
              </div>
            </div>
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Überfällig</div>
              <div className={`font-bold text-base ${(data?.faellige_count ?? 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {data?.faellige_count ?? 0}
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-gray-500 dark:text-gray-400 font-medium">Aktiv</div>
              <div className="font-bold text-base text-gray-700 dark:text-gray-300">{data?.gesamt ?? 0}</div>
            </div>
          </div>

          {/* Alert */}
          {kritisch.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 text-xs font-semibold px-3 py-2">
              <AlertTriangle size={14} />
              {kritisch.map(o => o.order_number).join(', ')} — Überfällig! Sofort bearbeiten!
            </div>
          )}

          {/* Order Cards */}
          <div className="space-y-2">
            {orders.map(order => {
              const cls = ampelCls(order.ampel);
              const secsLeft = order.seconds_remaining - tick;
              const totalSecs = 20 * 60;
              const progressPct = Math.max(0, Math.min(100, 100 - (secsLeft / totalSecs) * 100));
              return (
                <div key={order.order_id} className={`rounded-lg border p-3 ${cls.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${cls.badge}`}>{order.order_number}</span>
                      <span className={`text-sm font-semibold ${cls.text}`}>{order.customer_name}</span>
                      <span className="text-xs text-gray-400">{order.items_count} Art.</span>
                    </div>
                    <div className={`font-mono font-bold text-sm tabular-nums ${cls.text}`}>
                      {formatCountdown(secsLeft)}
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-1">
                    <div className={`h-1.5 rounded-full transition-all ${cls.bar}`} style={{ width: `${progressPct}%` }} />
                  </div>
                  {order.kochstart_empfehlung && (
                    <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 font-semibold mt-1">
                      <Zap size={10} /> Jetzt Kochen starten!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
