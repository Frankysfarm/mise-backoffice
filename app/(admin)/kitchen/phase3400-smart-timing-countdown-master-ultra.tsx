'use client';
import { useEffect, useState } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

interface OrderRow {
  order_id: string;
  order_nr: string;
  customer_name: string;
  deadline_ts: number; // unix ms
  prep_time_min: number;
  driver_eta_min: number | null;
  kochstart_now: boolean;
}

interface ApiData {
  orders: OrderRow[];
  on_time_rate_pct: number;
}

const now = () => Date.now();

const MOCK: ApiData = {
  on_time_rate_pct: 83,
  orders: [
    {
      order_id: 'o1',
      order_nr: '#1042',
      customer_name: 'Petra S.',
      deadline_ts: now() + 12 * 60 * 1000,
      prep_time_min: 15,
      driver_eta_min: 18,
      kochstart_now: false,
    },
    {
      order_id: 'o2',
      order_nr: '#1043',
      customer_name: 'Jonas K.',
      deadline_ts: now() + 7 * 60 * 1000,
      prep_time_min: 10,
      driver_eta_min: 8,
      kochstart_now: true,
    },
    {
      order_id: 'o3',
      order_nr: '#1044',
      customer_name: 'Sarah M.',
      deadline_ts: now() - 1 * 60 * 1000,
      prep_time_min: 12,
      driver_eta_min: null,
      kochstart_now: true,
    },
  ],
};

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) {
    const overMs = Math.abs(msLeft);
    const m = Math.floor(overMs / 60000);
    const s = Math.floor((overMs % 60000) / 1000);
    return `-${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const m = Math.floor(msLeft / 60000);
  const s = Math.floor((msLeft % 60000) / 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function countdownColor(msLeft: number): string {
  if (msLeft < 0)            return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (msLeft < 2 * 60 * 1000) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (msLeft < 5 * 60 * 1000) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
  if (msLeft < 10 * 60 * 1000) return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
  return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
}

function OnTimeGauge({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#22c55e' : pct >= 75 ? '#eab308' : '#ef4444';
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex items-center gap-2">
      <svg width={44} height={44} viewBox="0 0 44 44">
        <circle cx={22} cy={22} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={22} cy={22} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 22 22)"
        />
        <text x={22} y={27} textAnchor="middle" fontSize={11} fontWeight="bold" fill={color}>{pct}%</text>
      </svg>
      <div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200">On-Time-Rate</div>
        <div className="text-xs text-gray-400">heute</div>
      </div>
    </div>
  );
}

export function KitchenPhase3400SmartTimingCountdownMasterUltra({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!locationId) { setData(MOCK); return; }
      try {
        const res = await fetch(`/api/delivery/admin/smart-timing-live?location_id=${locationId}`);
        if (res.ok && active) setData(await res.json());
      } catch {
        if (active) setData(MOCK);
      }
    };
    load();
    const iv = setInterval(load, 15 * 1000);
    return () => { active = false; clearInterval(iv); };
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const d = data ?? MOCK;
  const critical = d.orders.filter(o => Date.now() - o.deadline_ts > 0 || o.kochstart_now);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm mb-4 overflow-hidden bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-emerald-600" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
            Smart-Timing Countdown Master Ultra
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
            {d.orders.length} Bestellungen aktiv
          </span>
          {critical.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 rounded-full px-2 py-0.5">
              <AlertTriangle size={10} /> {critical.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <OnTimeGauge pct={d.on_time_rate_pct} />
            <div className="text-xs text-gray-400 text-right">
              <div>{d.orders.length} aktive Bestellungen</div>
              <div className="mt-0.5">Tick #{tick}</div>
            </div>
          </div>

          <div className="space-y-2">
            {d.orders.map(order => {
              const msLeft = order.deadline_ts - Date.now();
              const cdColor = countdownColor(msLeft);
              const overdue = msLeft < 0;
              return (
                <div key={order.order_id} className="rounded-lg border border-gray-100 dark:border-gray-700 p-2.5 flex items-center gap-3">
                  <div className={`rounded-lg px-2.5 py-1.5 font-mono font-bold text-base tabular-nums flex-shrink-0 ${cdColor}`}>
                    {formatCountdown(msLeft)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">{order.order_nr}</span>
                      <span className="text-gray-500 dark:text-gray-400 truncate">{order.customer_name}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-0.5 text-xs text-gray-400">
                      <span>Zubereitung: {order.prep_time_min} min</span>
                      {order.driver_eta_min !== null && <span>Fahrer ETA: {order.driver_eta_min} min</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    {overdue && (
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-1.5 py-0.5">
                        ÜBERFÄLLIG
                      </span>
                    )}
                    {order.kochstart_now && !overdue && (
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded px-1.5 py-0.5">
                        Jetzt kochen!
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-1 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-400 text-right">
            Daten alle 15 Sek. · Countdown sekündlich
          </div>
        </div>
      )}
    </div>
  );
}
