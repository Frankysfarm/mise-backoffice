'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Zap, TrendingUp } from 'lucide-react';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  started_at: string;
  target_ready_at: string;
  status: 'cooking' | 'ready' | 'picked_up';
  prep_time_min: number;
}

interface ApiResponse {
  orders: OrderTiming[];
  on_time_rate: number;
  ueberfaellig_count: number;
  kochstart_empfehlung: string | null;
  aktiv_count: number;
  fertig_count: number;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: 'o1', bestellnummer: '#1042', started_at: new Date(Date.now() - 12 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 3 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
    { order_id: 'o2', bestellnummer: '#1043', started_at: new Date(Date.now() - 18 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 2 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
    { order_id: 'o3', bestellnummer: '#1044', started_at: new Date(Date.now() - 5 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 10 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
    { order_id: 'o4', bestellnummer: '#1045', started_at: new Date(Date.now() - 20 * 60000).toISOString(), target_ready_at: new Date(Date.now() - 5 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
    { order_id: 'o5', bestellnummer: '#1046', started_at: new Date(Date.now() - 2 * 60000).toISOString(), target_ready_at: new Date(Date.now() + 13 * 60000).toISOString(), status: 'cooking', prep_time_min: 15 },
  ],
  on_time_rate: 74,
  ueberfaellig_count: 2,
  kochstart_empfehlung: 'Jetzt 2 weitere Bestellungen starten für optimale Fahrer-Sync',
  aktiv_count: 5,
  fertig_count: 12,
};

function getAmpel(secsLeft: number): { color: string; bg: string; label: string } {
  if (secsLeft > 5 * 60) return { color: 'text-emerald-700', bg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Grün' };
  if (secsLeft > 2 * 60) return { color: 'text-yellow-700', bg: 'bg-yellow-100 dark:bg-yellow-900/30', label: 'Gelb' };
  if (secsLeft > 0)      return { color: 'text-orange-700', bg: 'bg-orange-100 dark:bg-orange-900/30', label: 'Orange' };
  return { color: 'text-red-700', bg: 'bg-red-100 dark:bg-red-900/30', label: 'Rot' };
}

function formatCountdown(secsLeft: number): string {
  const abs = Math.abs(secsLeft);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secsLeft < 0 ? '-' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

function OnTimeGauge({ rate }: { rate: number }) {
  const color = rate >= 80 ? 'text-emerald-600' : rate >= 60 ? 'text-yellow-600' : 'text-red-600';
  const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 60 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <TrendingUp className={`w-3.5 h-3.5 ${color}`} />
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${rate}%` }} />
      </div>
      <span className={`text-xs font-bold tabular-nums ${color}`}>{rate}%</span>
    </div>
  );
}

export function KitchenPhase3485SmartTimingCountdownFarbkodierungUltra({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-timing-countdown?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const pollId = setInterval(load, 15 * 1000);
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => { clearInterval(pollId); if (tickRef.current) clearInterval(tickRef.current); };
  }, [load]);

  const now = Date.now();
  const activeOrders = data.orders.filter(o => o.status === 'cooking');
  const ueberfaellig = activeOrders.filter(o => now > new Date(o.target_ready_at).getTime());

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-2">
      <button
        className="w-full flex items-center justify-between p-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-xs">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          Smart-Timing Countdown · Farbkodierung Ultra
          {ueberfaellig.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold">
              {ueberfaellig.length} überfällig
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-2">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-1.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Aktiv</div>
              <div className="text-sm font-bold">{data.aktiv_count}</div>
            </div>
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-1.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">Fertig</div>
              <div className="text-sm font-bold text-emerald-600">{data.fertig_count}</div>
            </div>
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-1.5">
              <div className="text-[10px] text-gray-400 uppercase tracking-wide">On-Time</div>
              <div className={`text-sm font-bold ${data.on_time_rate >= 80 ? 'text-emerald-600' : data.on_time_rate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{data.on_time_rate}%</div>
            </div>
          </div>

          {/* On-Time Gauge */}
          <OnTimeGauge rate={data.on_time_rate} />

          {/* Überfällig Alert */}
          {ueberfaellig.length > 0 && (
            <div className="flex items-center gap-1.5 p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[10px]">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="font-bold">{ueberfaellig.length} Bestellung{ueberfaellig.length > 1 ? 'en' : ''} überfällig!</span>
              <span className="text-red-600/70">Sofort priorisieren</span>
            </div>
          )}

          {/* Order Countdown List */}
          {activeOrders.length === 0 ? (
            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Alle Bestellungen abgearbeitet
            </div>
          ) : (
            <div className="space-y-1">
              {activeOrders
                .sort((a, b) => new Date(a.target_ready_at).getTime() - new Date(b.target_ready_at).getTime())
                .map(order => {
                  const secsLeft = Math.round((new Date(order.target_ready_at).getTime() - now) / 1000);
                  const ampel = getAmpel(secsLeft);
                  const elapsed = Math.round((now - new Date(order.started_at).getTime()) / 1000);
                  const totalSecs = order.prep_time_min * 60;
                  const progress = Math.min(100, Math.round((elapsed / totalSecs) * 100));

                  return (
                    <div key={order.order_id} className={`flex items-center gap-1.5 rounded px-2 py-1 ${ampel.bg}`}>
                      <span className="text-[10px] font-bold text-gray-600 dark:text-gray-300 w-10 shrink-0">{order.bestellnummer}</span>
                      <div className="flex-1 bg-white/50 dark:bg-black/20 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full bg-current transition-all duration-1000" style={{ width: `${progress}%` }} />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums w-10 text-right ${ampel.color}`}>
                        {formatCountdown(secsLeft)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Kochstart Empfehlung */}
          {data.kochstart_empfehlung && (
            <div className="flex items-start gap-1.5 p-1.5 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-[10px]">
              <Zap className="w-3 h-3 flex-shrink-0 mt-px" />
              {data.kochstart_empfehlung}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-2 text-[9px] text-gray-400 pt-0.5">
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" />{'>'} 5 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block" />2–5 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-orange-400 inline-block" />{'<'} 2 Min</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-sm bg-red-400 inline-block" />Überfällig</span>
          </div>
        </div>
      )}
    </div>
  );
}
