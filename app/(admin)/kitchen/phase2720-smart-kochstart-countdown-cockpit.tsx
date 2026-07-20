'use client';
import { useEffect, useState } from 'react';
import { ChefHat, Clock, AlertTriangle, CheckCircle2, Flame, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderEntry {
  order_id: string;
  bestellnummer: string;
  kunde: string;
  items_count: number;
  kochstart_am: string | null;
  prep_time_min: number;
  status: 'in_zubereitung' | 'fertig' | 'fertig_wartend';
}

interface ApiData {
  orders: OrderEntry[];
  avg_prep_min: number;
  on_time_rate: number;
}

function calcSecsLeft(kochstartIso: string | null, prepMin: number): number | null {
  if (!kochstartIso) return null;
  const fertigAt = new Date(kochstartIso).getTime() + prepMin * 60_000;
  return Math.floor((fertigAt - Date.now()) / 1_000);
}

function fmtMmSs(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sec < 0 ? '-' : ''}${m}:${String(s).padStart(2, '0')}`;
}

function ampelColor(secs: number | null): 'gruen' | 'gelb' | 'rot' | 'fertig' {
  if (secs === null) return 'gelb';
  if (secs < 0) return 'rot';
  if (secs < 120) return 'gelb';
  return 'gruen';
}

const MOCK: ApiData = {
  orders: [
    { order_id: 'o1', bestellnummer: '#1042', kunde: 'Max M.', items_count: 3, kochstart_am: new Date(Date.now() - 8 * 60_000).toISOString(), prep_time_min: 12, status: 'in_zubereitung' },
    { order_id: 'o2', bestellnummer: '#1043', kunde: 'Sara K.', items_count: 2, kochstart_am: new Date(Date.now() - 14 * 60_000).toISOString(), prep_time_min: 15, status: 'in_zubereitung' },
    { order_id: 'o3', bestellnummer: '#1044', kunde: 'Tim B.', items_count: 4, kochstart_am: new Date(Date.now() - 3 * 60_000).toISOString(), prep_time_min: 10, status: 'in_zubereitung' },
    { order_id: 'o4', bestellnummer: '#1041', kunde: 'Julia F.', items_count: 1, kochstart_am: new Date(Date.now() - 18 * 60_000).toISOString(), prep_time_min: 8, status: 'fertig_wartend' },
  ],
  avg_prep_min: 11.2,
  on_time_rate: 87,
};

export function KitchenPhase2720SmartKochstartCountdownCockpit({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/admin/kitchen-countdown?location_id=${locationId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));

    if (!locationId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!data) return null;

  const activeOrders = data.orders.filter(o => o.status === 'in_zubereitung');
  const waitingOrders = data.orders.filter(o => o.status === 'fertig_wartend');
  const lateCount = activeOrders.filter(o => (calcSecsLeft(o.kochstart_am, o.prep_time_min) ?? 0) < 0).length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-matcha-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Timer size={16} className={lateCount > 0 ? 'text-red-500' : 'text-matcha-600'} />
          <span className="font-semibold text-sm text-gray-900">Kochstart Countdown</span>
          {lateCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
              <AlertTriangle size={10} /> {lateCount} verspätet
            </span>
          )}
          {waitingOrders.length > 0 && (
            <span className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              {waitingOrders.length} wartet auf Fahrer
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Ø {data.avg_prep_min.toFixed(1)} min</span>
          <span className={cn('font-semibold', data.on_time_rate >= 90 ? 'text-green-600' : data.on_time_rate >= 75 ? 'text-amber-600' : 'text-red-600')}>
            {data.on_time_rate}% pünktlich
          </span>
          <span className="text-gray-300">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-matcha-100 divide-y divide-matcha-50">
          {activeOrders.length === 0 && waitingOrders.length === 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">Keine aktiven Bestellungen</div>
          )}

          {activeOrders.map(order => {
            const secsLeft = calcSecsLeft(order.kochstart_am, order.prep_time_min);
            const ampel = ampelColor(secsLeft);
            const totalSecs = order.prep_time_min * 60;
            const elapsed = totalSecs - (secsLeft ?? 0);
            const pct = Math.min(100, Math.max(0, Math.round((elapsed / totalSecs) * 100)));

            return (
              <div key={order.order_id} className={cn(
                'px-4 py-2.5 flex items-center gap-3',
                ampel === 'rot' && 'bg-red-50',
                ampel === 'gelb' && 'bg-amber-50',
              )}>
                <div className={cn(
                  'flex-shrink-0 w-12 text-center',
                )}>
                  <div className={cn(
                    'text-lg font-black tabular-nums font-mono',
                    ampel === 'rot' && 'text-red-600 animate-pulse',
                    ampel === 'gelb' && 'text-amber-600',
                    ampel === 'gruen' && 'text-matcha-700',
                  )}>
                    {secsLeft !== null ? fmtMmSs(secsLeft) : '--:--'}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">verbleibend</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-gray-800">{order.bestellnummer}</span>
                    <span className="text-xs text-gray-500 truncate">{order.kunde}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{order.items_count} Pos.</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        ampel === 'rot' && 'bg-red-500',
                        ampel === 'gelb' && 'bg-amber-400',
                        ampel === 'gruen' && 'bg-matcha-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className={cn(
                  'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center',
                  ampel === 'rot' && 'bg-red-100',
                  ampel === 'gelb' && 'bg-amber-100',
                  ampel === 'gruen' && 'bg-matcha-100',
                )}>
                  {ampel === 'rot' ? <Flame size={11} className="text-red-500" /> :
                   ampel === 'gelb' ? <AlertTriangle size={11} className="text-amber-500" /> :
                   <ChefHat size={11} className="text-matcha-600" />}
                </div>
              </div>
            );
          })}

          {waitingOrders.map(order => (
            <div key={order.order_id} className="px-4 py-2.5 flex items-center gap-3 bg-blue-50/60">
              <div className="flex-shrink-0 w-12 text-center">
                <CheckCircle2 size={20} className="text-matcha-500 mx-auto" />
                <div className="text-[9px] text-gray-400 mt-0.5">fertig</div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-800">{order.bestellnummer}</span>
                  <span className="text-xs text-gray-500">{order.kunde}</span>
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5 font-medium flex items-center gap-0.5">
                  <Clock size={9} /> Wartet auf Fahrer-Abholung
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
