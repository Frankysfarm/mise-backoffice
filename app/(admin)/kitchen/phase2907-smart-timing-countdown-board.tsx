'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, Zap } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  order_ref: string;
  prep_start: string;
  target_ready: string;
  seconds_remaining: number;
  status: 'on_track' | 'warning' | 'late';
}

const MOCK: OrderTiming[] = [
  { order_id: 'o1', order_ref: '#1042', prep_start: '', target_ready: '', seconds_remaining: 420, status: 'on_track' },
  { order_id: 'o2', order_ref: '#1043', prep_start: '', target_ready: '', seconds_remaining: 95,  status: 'warning'  },
  { order_id: 'o3', order_ref: '#1044', prep_start: '', target_ready: '', seconds_remaining: -45, status: 'late'     },
  { order_id: 'o4', order_ref: '#1045', prep_start: '', target_ready: '', seconds_remaining: 680, status: 'on_track' },
];

function statusCls(s: string) {
  if (s === 'late')    return { bg: 'bg-red-100 border-red-300',    text: 'text-red-700',   ring: 'ring-red-400',   bar: 'bg-red-500'   };
  if (s === 'warning') return { bg: 'bg-amber-100 border-amber-300', text: 'text-amber-700', ring: 'ring-amber-400', bar: 'bg-amber-400' };
  return                      { bg: 'bg-green-50 border-green-200',  text: 'text-green-700', ring: 'ring-green-400', bar: 'bg-green-500' };
}

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const sign = s < 0 ? '-' : '';
  return `${sign}${m}:${sec.toString().padStart(2, '0')}`;
}

function CountdownRing({ secs, status }: { secs: number; status: string }) {
  const cls = statusCls(status);
  const size = 52;
  const r = 20;
  const circ = 2 * Math.PI * r;
  const pct = status === 'late' ? 0 : Math.min(Math.max(secs / 600, 0), 1);
  const dash = pct * circ;

  return (
    <div className={`relative flex items-center justify-center rounded-full ring-2 ${cls.ring}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute top-0 left-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={4} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={status === 'late' ? '#ef4444' : status === 'warning' ? '#f59e0b' : '#22c55e'}
          strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={`text-[10px] font-bold z-10 ${cls.text}`}>{fmtSecs(secs)}</span>
    </div>
  );
}

export function KitchenPhase2907SmartTimingCountdownBoard({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [orders, setOrders] = useState<OrderTiming[]>(MOCK);
  const [tick, setTick] = useState(0);

  // Decrement countdown every second
  useEffect(() => {
    const t = setInterval(() => {
      setOrders(prev => prev.map(o => ({
        ...o,
        seconds_remaining: o.seconds_remaining - 1,
        status: o.seconds_remaining - 1 < 0 ? 'late' : o.seconds_remaining - 1 < 120 ? 'warning' : 'on_track',
      })));
      setTick(n => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Reload from API every 2 min
  useEffect(() => {
    if (!locationId) return;
    const reload = () =>
      fetch(`/api/delivery/kitchen/timing?location_id=${locationId}`)
        .then(r => r.json())
        .then((d: { orders: OrderTiming[] }) => setOrders(d.orders))
        .catch(() => {});
    const t = setInterval(reload, 2 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  void tick;

  const lateCount    = orders.filter(o => o.status === 'late').length;
  const warningCount = orders.filter(o => o.status === 'warning').length;
  const hasAlert     = lateCount > 0 || warningCount > 0;

  return (
    <div className={`rounded-xl border p-3 mb-3 ${lateCount > 0 ? 'border-red-300 bg-red-50' : hasAlert ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-indigo-500" />
          <span className="font-semibold text-xs text-gray-800">Smart-Timing Countdown</span>
          {lateCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full">
              <AlertTriangle size={10} /> {lateCount} zu spät
            </span>
          )}
          {warningCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
              <Zap size={10} /> {warningCount} Warnung
            </span>
          )}
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {orders.map(o => {
            const cls = statusCls(o.status);
            return (
              <div key={o.order_id} className={`rounded-lg border p-2 flex items-center gap-2 ${cls.bg}`}>
                <CountdownRing secs={o.seconds_remaining} status={o.status} />
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${cls.text}`}>{o.order_ref}</div>
                  <div className={`text-[10px] ${cls.text} opacity-75`}>
                    {o.status === 'late' ? 'Überfällig!' : o.status === 'warning' ? 'Fast fertig?' : 'Läuft ✓'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
