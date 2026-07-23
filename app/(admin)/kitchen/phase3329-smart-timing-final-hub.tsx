'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Clock, Zap, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';

type OrderRow = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
};

type TimingRow = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

function getColorClass(secsLeft: number): { bg: string; text: string; label: string; ring: string } {
  if (secsLeft < 0)  return { bg: 'bg-red-100 border-red-400',    text: 'text-red-700',    label: 'Überfällig', ring: 'stroke-red-500' };
  if (secsLeft < 120) return { bg: 'bg-orange-100 border-orange-400', text: 'text-orange-700', label: 'Kritisch',  ring: 'stroke-orange-500' };
  if (secsLeft < 300) return { bg: 'bg-amber-100 border-amber-400',   text: 'text-amber-700',   label: 'Dringend',  ring: 'stroke-amber-500' };
  return { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', label: 'Im Plan', ring: 'stroke-emerald-500' };
}

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPhase3329SmartTimingFinalHub({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [timings, setTimings] = useState<TimingRow[]>([]);
  const [tick, setTick] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      const { data: orders } = await supabase
        .from('customer_orders')
        .select('id, bestellnummer, status, bestellt_am, geschaetzte_zubereitung_min, kunde_name')
        .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
        .order('bestellt_am', { ascending: true })
        .limit(12);
      if (orders) setOrders(orders as OrderRow[]);

      const { data: timings } = await supabase
        .from('kitchen_timings')
        .select('order_id, cook_start_at, ready_target, prep_min, status')
        .in('status', ['scheduled', 'cooking', 'ready']);
      if (timings) setTimings(timings as TimingRow[]);

      // On-Time Rate der letzten 2h
      const since = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
      const { data: recent } = await supabase
        .from('kitchen_timings')
        .select('ready_target, status')
        .eq('status', 'ready')
        .gte('cook_start_at', since);
      if (recent && recent.length > 0) {
        const now = Date.now();
        const onTime = (recent as { ready_target: string | null; status: string }[]).filter(r =>
          r.ready_target && new Date(r.ready_target).getTime() >= now - 5 * 60_000
        ).length;
        setOnTimeRate(Math.round((onTime / recent.length) * 100));
      }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const now = Date.now();

  const active = orders
    .filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
    .map(o => {
      const t = timings.find(t => t.order_id === o.id);
      const readyTarget = t?.ready_target
        ? new Date(t.ready_target).getTime()
        : o.bestellt_am
          ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 15) * 60_000
          : null;
      const secsLeft = readyTarget ? Math.floor((readyTarget - now) / 1000) : null;
      return { ...o, secsLeft, timing: t };
    })
    .sort((a, b) => (a.secsLeft ?? 9999) - (b.secsLeft ?? 9999));

  const overdue = active.filter(o => o.secsLeft !== null && o.secsLeft < 0).length;
  const critical = active.filter(o => o.secsLeft !== null && o.secsLeft >= 0 && o.secsLeft < 120).length;

  if (active.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-stone-50 to-white">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Smart-Timing Hub</span>
          <span className="text-[10px] bg-matcha-100 text-matcha-700 rounded-full px-2 py-0.5 font-bold">
            {active.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-3">
          {overdue > 0 && (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold">{overdue} überfällig</span>
            </div>
          )}
          {onTimeRate !== null && (
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-700">{onTimeRate}% pünktlich</span>
            </div>
          )}
        </div>
      </div>

      {/* Alert strip */}
      {(overdue > 0 || critical > 0) && (
        <div className={`px-4 py-2 text-[10px] font-bold flex items-center gap-2 ${overdue > 0 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          <Zap className="h-3.5 w-3.5" />
          {overdue > 0
            ? `${overdue} Bestellung${overdue > 1 ? 'en' : ''} überfällig — sofort handeln!`
            : `${critical} Bestellung${critical > 1 ? 'en' : ''} kritisch — Kochstart empfohlen`}
        </div>
      )}

      {/* Order grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {active.map(order => {
          const { secsLeft, timing } = order;
          const col = secsLeft !== null ? getColorClass(secsLeft) : getColorClass(999);
          const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;
          const elapsed = order.bestellt_am
            ? Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000)
            : 0;
          const progress = Math.min(100, Math.round((elapsed / prepMin) * 100));

          return (
            <div
              key={order.id}
              className={`rounded-xl border-2 p-3 flex flex-col gap-1.5 ${col.bg}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                  #{(order.bestellnummer ?? '').replace('FF-', '').slice(-4)}
                </span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  secsLeft !== null && secsLeft < 0 ? 'bg-red-200 text-red-800' :
                  secsLeft !== null && secsLeft < 120 ? 'bg-orange-200 text-orange-800' :
                  secsLeft !== null && secsLeft < 300 ? 'bg-amber-200 text-amber-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {col.label}
                </span>
              </div>
              <div className={`text-xl font-black tabular-nums leading-none ${col.text}`}>
                {secsLeft !== null ? fmtSecs(secsLeft) : '—'}
              </div>
              <div className="text-[9px] text-stone-500 truncate">
                {order.kunde_name}
              </div>
              {/* Progress bar */}
              <div className="h-1 bg-white/60 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    secsLeft !== null && secsLeft < 0 ? 'bg-red-500' :
                    secsLeft !== null && secsLeft < 120 ? 'bg-orange-400' :
                    secsLeft !== null && secsLeft < 300 ? 'bg-amber-400' :
                    'bg-emerald-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-[8px] text-stone-400">
                <Clock className="h-2.5 w-2.5" />
                <span>Ziel: {prepMin}min</span>
                <span className="ml-auto">{elapsed}min</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
