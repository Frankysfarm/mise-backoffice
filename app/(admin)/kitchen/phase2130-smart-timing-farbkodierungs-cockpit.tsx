'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Flame, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActiveOrder {
  order_id: string;
  bestellnummer: string;
  accepted_at: string;
  eta_minutes: number;
  fahrer_name?: string;
}

interface ApiData {
  orders: ActiveOrder[];
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'a', bestellnummer: '#1042', accepted_at: new Date(Date.now() - 8 * 60_000).toISOString(), eta_minutes: 12, fahrer_name: 'Max' },
    { order_id: 'b', bestellnummer: '#1043', accepted_at: new Date(Date.now() - 14 * 60_000).toISOString(), eta_minutes: 15, fahrer_name: 'Anna' },
    { order_id: 'c', bestellnummer: '#1044', accepted_at: new Date(Date.now() - 18 * 60_000).toISOString(), eta_minutes: 20, fahrer_name: 'Klaus' },
  ],
};

function getCountdownInfo(acceptedAt: string, etaMinutes: number) {
  const elapsedMin = (Date.now() - new Date(acceptedAt).getTime()) / 60_000;
  const remainMin = etaMinutes - elapsedMin;
  const pct = Math.min(100, Math.max(0, (elapsedMin / etaMinutes) * 100));

  let color: 'green' | 'amber' | 'red';
  if (remainMin > 5) color = 'green';
  else if (remainMin > 0) color = 'amber';
  else color = 'red';

  return { elapsedMin: Math.floor(elapsedMin), remainMin: Math.ceil(remainMin), pct, color };
}

interface Props { locationId?: string | null }

export function KitchenPhase2130SmartTimingFarbkodierungsCockpit({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/kitchen/active-orders?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  void tick;

  const orders = data.orders ?? [];
  const urgent = orders.filter(o => {
    const { color } = getCountdownInfo(o.accepted_at, o.eta_minutes);
    return color === 'red' || color === 'amber';
  });

  const colorStyles = {
    green: {
      card: 'bg-matcha-50 border-matcha-200',
      bar:  'bg-matcha-500',
      time: 'text-matcha-700',
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />,
      label: 'Pünktlich',
    },
    amber: {
      card: 'bg-amber-50 border-amber-200',
      bar:  'bg-amber-400',
      time: 'text-amber-700',
      icon: <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />,
      label: 'Knapp',
    },
    red: {
      card: 'bg-red-50 border-red-300',
      bar:  'bg-red-500',
      time: 'text-red-700',
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />,
      label: 'Überfällig',
    },
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Flame className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Smart-Timing · Farbkodierung
        </span>
        {urgent.length > 0 && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-700 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{urgent.length} dringend
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {orders.length === 0 ? (
            <p className="text-[11px] text-muted-foreground py-2 text-center">Keine aktiven Bestellungen</p>
          ) : (
            orders.map(order => {
              const { elapsedMin, remainMin, pct, color } = getCountdownInfo(order.accepted_at, order.eta_minutes);
              const s = colorStyles[color];
              return (
                <div key={order.order_id} className={cn('rounded-lg border p-2.5 space-y-1.5', s.card)}>
                  <div className="flex items-center gap-2">
                    {s.icon}
                    <span className="text-[11px] font-bold">{order.bestellnummer}</span>
                    {order.fahrer_name && (
                      <span className="text-[9px] text-muted-foreground bg-white/60 rounded-full px-1.5 py-0.5 border">
                        {order.fahrer_name}
                      </span>
                    )}
                    <span className={cn('ml-auto text-[10px] font-black tabular-nums', s.time)}>
                      {remainMin > 0 ? `${remainMin} Min` : `+${Math.abs(remainMin)} Min`}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                      {elapsedMin}/{order.eta_minutes} Min
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
