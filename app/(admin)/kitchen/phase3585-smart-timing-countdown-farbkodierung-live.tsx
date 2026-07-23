'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertTriangle, CheckCircle2, Flame, Timer } from 'lucide-react';

interface OrderCountdown {
  order_id: string;
  bestellnummer: string;
  status: string;
  prep_start: string | null;
  target_ready: string | null;
  eta_min: number | null;
  driver_eta_min: number | null;
}

interface ApiResponse {
  orders: OrderCountdown[];
  on_time_rate: number;
  active_count: number;
  overdue_count: number;
  kochstart_empfehlung: string | null;
}

const MOCK: ApiResponse = {
  orders: [
    { order_id: '1', bestellnummer: '#4201', status: 'in_zubereitung', prep_start: new Date(Date.now() - 8 * 60_000).toISOString(), target_ready: new Date(Date.now() + 7 * 60_000).toISOString(), eta_min: 7, driver_eta_min: 10 },
    { order_id: '2', bestellnummer: '#4202', status: 'in_zubereitung', prep_start: new Date(Date.now() - 12 * 60_000).toISOString(), target_ready: new Date(Date.now() + 2 * 60_000).toISOString(), eta_min: 2, driver_eta_min: 4 },
    { order_id: '3', bestellnummer: '#4203', status: 'neu', prep_start: null, target_ready: new Date(Date.now() + 20 * 60_000).toISOString(), eta_min: 20, driver_eta_min: 25 },
    { order_id: '4', bestellnummer: '#4200', status: 'in_zubereitung', prep_start: new Date(Date.now() - 20 * 60_000).toISOString(), target_ready: new Date(Date.now() - 2 * 60_000).toISOString(), eta_min: -2, driver_eta_min: 3 },
  ],
  on_time_rate: 82,
  active_count: 4,
  overdue_count: 1,
  kochstart_empfehlung: '#4203 jetzt starten — Fahrer kommt in 25 Min.',
};

function getAmpel(minsLeft: number | null): { color: string; bg: string; label: string } {
  if (minsLeft === null) return { color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200', label: '—' };
  if (minsLeft < 0) return { color: 'text-red-700', bg: 'bg-red-50 border-red-300', label: 'ÜBERFÄLLIG' };
  if (minsLeft <= 3) return { color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', label: 'KRITISCH' };
  if (minsLeft <= 8) return { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-300', label: 'BALD' };
  return { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', label: 'OK' };
}

export function KitchenPhase3585SmartTimingCountdownFarbkodierungLive({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);

  // 1-Sek-Tick für Countdown
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/kitchen/smart-timing-countdown?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.orders) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15_000);
    return () => clearInterval(iv);
  }, [load]);

  const ordersWithCountdown = data.orders.map(o => {
    const minsLeft = o.target_ready
      ? Math.floor((new Date(o.target_ready).getTime() - Date.now()) / 60_000)
      : o.eta_min;
    return { ...o, minsLeft };
  });

  const sorted = [...ordersWithCountdown].sort((a, b) => (a.minsLeft ?? 999) - (b.minsLeft ?? 999));

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Timer className="w-4 h-4 text-blue-600" />
          Smart-Timing Countdown — Live Farbkodierung
          {data.overdue_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.overdue_count} überfällig
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Aktiv</div>
              <div className="text-lg font-bold text-gray-800 dark:text-gray-200">{data.active_count}</div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">On-Time</div>
              <div className={`text-lg font-bold ${data.on_time_rate >= 85 ? 'text-emerald-600' : data.on_time_rate >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.on_time_rate}%
              </div>
            </div>
            <div className="text-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Überfällig</div>
              <div className={`text-lg font-bold ${data.overdue_count > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {data.overdue_count}
              </div>
            </div>
          </div>

          {/* Überfällig-Alert */}
          {data.overdue_count > 0 && (
            <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 text-red-700 dark:text-red-400 text-xs">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{data.overdue_count} Bestellung(en) überfällig — sofort priorisieren!</span>
            </div>
          )}

          {/* Countdown-Kacheln */}
          <div className="space-y-1.5">
            {sorted.map(o => {
              const amp = getAmpel(o.minsLeft);
              const absMin = Math.abs(o.minsLeft ?? 0);
              const sec = tick % 60;
              return (
                <div key={o.order_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${amp.bg}`}>
                  <div className="flex-shrink-0">
                    {o.minsLeft !== null && o.minsLeft < 0 ? (
                      <Flame className="w-4 h-4 text-red-500" />
                    ) : o.minsLeft !== null && o.minsLeft <= 3 ? (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    ) : o.status === 'fertig' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">{o.bestellnummer}</div>
                    <div className="text-[10px] text-gray-500">{o.status}</div>
                  </div>
                  <div className={`text-right font-mono font-bold text-sm ${amp.color}`}>
                    {o.minsLeft === null ? '—' : o.minsLeft < 0
                      ? `+${absMin}:${String(59 - sec).padStart(2, '0')}`
                      : `${absMin}:${String(59 - sec).padStart(2, '0')}`}
                  </div>
                  <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${amp.color} bg-white/50`}>
                    {amp.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kochstart-Empfehlung */}
          {data.kochstart_empfehlung && (
            <div className="flex items-start gap-2 p-2.5 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 text-blue-700 dark:text-blue-400 text-xs">
              <Flame className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{data.kochstart_empfehlung}</span>
            </div>
          )}

          <div className="text-[10px] text-gray-400 text-right pt-1">
            Grün &gt;8 Min · Gelb 4–8 Min · Orange 0–3 Min · Rot überfällig
          </div>
        </div>
      )}
    </div>
  );
}
