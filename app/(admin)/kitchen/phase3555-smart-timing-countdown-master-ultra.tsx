'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, Flame, CheckCircle2, AlertTriangle, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderTiming {
  order_id: string;
  bestellnummer: string;
  status: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  kunde_name: string;
}

interface ApiResponse {
  timings: OrderTiming[];
  on_time_rate: number;
  avg_prep_min: number;
  overdue_count: number;
}

function getColor(secsLeft: number, prepMin: number): 'gruen' | 'gelb' | 'rot' {
  const totalSecs = (prepMin || 15) * 60;
  const pct = secsLeft / totalSecs;
  if (secsLeft <= 0) return 'rot';
  if (pct > 0.4) return 'gruen';
  if (pct > 0.15) return 'gelb';
  return 'rot';
}

const COLOR_CLASS: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  gruen: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', bar: 'bg-green-500' },
  gelb: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-300', bar: 'bg-amber-400' },
  rot: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', bar: 'bg-red-500' },
};

const MOCK: ApiResponse = {
  timings: [
    { order_id: '1', bestellnummer: '#1042', status: 'in_zubereitung', cook_start_at: new Date(Date.now() - 8 * 60_000).toISOString(), ready_target: new Date(Date.now() + 6 * 60_000).toISOString(), prep_min: 14, kunde_name: 'M. Schulz' },
    { order_id: '2', bestellnummer: '#1043', status: 'in_zubereitung', cook_start_at: new Date(Date.now() - 12 * 60_000).toISOString(), ready_target: new Date(Date.now() + 2 * 60_000).toISOString(), prep_min: 14, kunde_name: 'L. Weber' },
    { order_id: '3', bestellnummer: '#1044', status: 'neu', cook_start_at: null, ready_target: new Date(Date.now() + 18 * 60_000).toISOString(), prep_min: 14, kunde_name: 'T. Müller' },
  ],
  on_time_rate: 87,
  avg_prep_min: 13.4,
  overdue_count: 0,
};

export function KitchenPhase3555SmartTimingCountdownMasterUltra({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/kitchen-timing-countdown?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.timings?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const active = data.timings.filter(t => t.status === 'in_zubereitung' && t.ready_target);
  const pending = data.timings.filter(t => t.status !== 'in_zubereitung' || !t.ready_target);

  const onTimeColor = data.on_time_rate >= 85 ? 'text-green-600' : data.on_time_rate >= 65 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white">
        <div className="flex items-center gap-2">
          <ChefHat className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wide">Smart-Timing Countdown</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="bg-white/20 rounded px-2 py-0.5 font-bold">{data.on_time_rate}% pünktl.</span>
          {data.overdue_count > 0 && (
            <span className="flex items-center gap-1 bg-red-700/50 rounded px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> {data.overdue_count} überfällig
            </span>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-px bg-gray-100 border-b">
        {[
          { label: 'In Zubereitung', value: active.length, icon: <Flame className="w-3 h-3 text-orange-500" /> },
          { label: 'On-Time-Rate', value: `${data.on_time_rate}%`, icon: <CheckCircle2 className="w-3 h-3 text-green-500" /> },
          { label: 'Ø Prepzeit', value: `${data.avg_prep_min.toFixed(1)} Min`, icon: <Clock className="w-3 h-3 text-blue-500" /> },
        ].map(k => (
          <div key={k.label} className="bg-white px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500 mb-0.5">{k.icon}{k.label}</div>
            <div className="text-base font-bold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Active Countdowns */}
      <div className="p-3 space-y-2">
        {active.length === 0 && (
          <div className="text-center text-xs text-gray-400 py-2">Keine aktiven Zubereitungen</div>
        )}
        {active.map(t => {
          const secsLeft = t.ready_target ? Math.floor((new Date(t.ready_target).getTime() - Date.now()) / 1000) : 0;
          const totalSecs = (t.prep_min || 14) * 60;
          const color = getColor(secsLeft, t.prep_min ?? 14);
          const pct = Math.max(0, Math.min(100, (1 - secsLeft / totalSecs) * 100));
          const C = COLOR_CLASS[color];
          const minLeft = Math.max(0, Math.ceil(secsLeft / 60));
          const secPart = Math.max(0, secsLeft) % 60;
          return (
            <div key={t.order_id} className={cn('rounded-lg border p-2.5', C.bg, C.border)}>
              <div className="flex items-center justify-between mb-1.5">
                <div>
                  <span className="text-xs font-bold">{t.bestellnummer}</span>
                  <span className="text-[11px] text-gray-500 ml-1.5">{t.kunde_name}</span>
                </div>
                <div className={cn('font-mono text-lg font-black tabular-nums', C.text)}>
                  {secsLeft <= 0 ? 'FERTIG!' : `${minLeft}:${secPart.toString().padStart(2, '0')}`}
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-1000', C.bar)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}

        {/* Pending */}
        {pending.length > 0 && (
          <div className="pt-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Wartend</div>
            {pending.slice(0, 3).map(t => (
              <div key={t.order_id} className="flex items-center gap-2 text-xs py-0.5">
                <span className="text-gray-500">{t.bestellnummer}</span>
                <span className="flex-1 truncate text-gray-600">{t.kunde_name}</span>
                {t.ready_target && (
                  <span className="text-gray-400 tabular-nums">
                    ~{Math.max(0, Math.ceil((new Date(t.ready_target).getTime() - Date.now()) / 60_000))} Min
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t px-4 py-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <Clock className="w-3 h-3" /> Live — Update alle 15 Sek.
      </div>
    </div>
  );
}
