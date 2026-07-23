'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { AlertTriangle, CheckCircle2, Clock, Flame, Timer, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 3348 — Smart-Timing Countdown Master Pro
 * Sekundengenauer Countdown je Bestellung; 4-stufige Farbkodierung;
 * On-Time-Rate-Gauge; Kochstart-Empfehlung-Badge; Überfällig-Strip;
 * KPI-Grid Aktiv/Fertig/Ø-Prep; Fortschrittsbalken; 1-Sek-Tick + 15-Sek-Polling
 */

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

function colorFor(secsLeft: number) {
  if (secsLeft < 0)   return { ring: 'ring-red-500',    bg: 'bg-red-50 dark:bg-red-950',     text: 'text-red-700 dark:text-red-300',     bar: 'bg-red-500',    label: 'Überfällig',  badge: 'bg-red-100 text-red-800' };
  if (secsLeft < 120) return { ring: 'ring-orange-500', bg: 'bg-orange-50 dark:bg-orange-950', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-400', label: 'Kritisch',    badge: 'bg-orange-100 text-orange-800' };
  if (secsLeft < 300) return { ring: 'ring-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950',  text: 'text-amber-700 dark:text-amber-300',  bar: 'bg-amber-400',  label: 'Dringend',    badge: 'bg-amber-100 text-amber-800' };
  return               { ring: 'ring-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500', label: 'Im Plan', badge: 'bg-emerald-100 text-emerald-800' };
}

function fmt(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPhase3348SmartTimingCountdownMasterPro({ locationId }: { locationId: string | null }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [timings, setTimings] = useState<TimingRow[]>([]);
  const [tick, setTick] = useState(0);
  const [onTimeRate, setOnTimeRate] = useState<number | null>(null);
  const [avgPrepMin, setAvgPrepMin] = useState<number | null>(null);
  const [finishedCount, setFinishedCount] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const load = async () => {
      const [{ data: ord }, { data: tim }] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('id, bestellnummer, status, bestellt_am, geschaetzte_zubereitung_min, kunde_name')
          .in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig'])
          .order('bestellt_am', { ascending: true })
          .limit(16),
        supabase
          .from('kitchen_timings')
          .select('order_id, cook_start_at, ready_target, prep_min, status')
          .in('status', ['scheduled', 'cooking', 'ready']),
      ]);
      if (ord) setOrders(ord as OrderRow[]);
      if (tim) setTimings(tim as TimingRow[]);

      // On-Time-Rate letzter 2h
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const { data: recent } = await supabase
        .from('kitchen_timings')
        .select('ready_target, prep_min, status')
        .eq('status', 'ready')
        .gte('cook_start_at', since);

      if (recent && recent.length > 0) {
        const now = Date.now();
        const onTime = (recent as { ready_target: string | null; prep_min: number | null }[]).filter(r =>
          r.ready_target && new Date(r.ready_target).getTime() >= now - 3 * 60_000
        ).length;
        setOnTimeRate(Math.round((onTime / recent.length) * 100));
        const preps = (recent as { prep_min: number | null }[]).map(r => r.prep_min ?? 0).filter(Boolean);
        if (preps.length) setAvgPrepMin(Math.round(preps.reduce((a, b) => a + b, 0) / preps.length));
        setFinishedCount(recent.length);
      }
    };
    load();
    const iv = setInterval(load, 15_000);
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
      const prepMin = t?.prep_min ?? o.geschaetzte_zubereitung_min ?? 15;
      const elapsed = o.bestellt_am ? Math.floor((now - new Date(o.bestellt_am).getTime()) / 60_000) : 0;
      const progress = Math.min(100, Math.round((elapsed / prepMin) * 100));
      const cookNow = !t?.cook_start_at && secsLeft !== null && secsLeft <= 300 && secsLeft > 0;
      return { ...o, secsLeft, timing: t, prepMin, elapsed, progress, cookNow };
    })
    .sort((a, b) => (a.secsLeft ?? 9999) - (b.secsLeft ?? 9999));

  const overdue  = active.filter(o => o.secsLeft !== null && o.secsLeft < 0).length;
  const critical = active.filter(o => o.secsLeft !== null && o.secsLeft >= 0 && o.secsLeft < 120).length;
  const cookNowCount = active.filter(o => o.cookNow).length;

  if (active.length === 0 && finishedCount === 0) return null;

  const gaugeColor = onTimeRate === null ? 'text-stone-400' : onTimeRate >= 90 ? 'text-emerald-600' : onTimeRate >= 75 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border bg-white dark:bg-stone-950 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-gradient-to-r from-stone-50 to-white dark:from-stone-900 dark:to-stone-950">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-[11px] font-black uppercase tracking-widest text-stone-500">Countdown Master Pro</span>
          <span className="text-[10px] bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-300 rounded-full px-2 py-0.5 font-bold">
            {active.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-3">
          {cookNowCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded-full">
              <Flame className="h-3 w-3" />
              {cookNowCount}× jetzt kochen
            </span>
          )}
          {onTimeRate !== null && (
            <span className={`flex items-center gap-1 text-[10px] font-bold ${gaugeColor}`}>
              <TrendingUp className="h-3 w-3" />
              {onTimeRate}% pünktlich
            </span>
          )}
        </div>
      </div>

      {/* Alert strip */}
      {overdue > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 text-[10px] font-bold border-b border-red-100 dark:border-red-900">
          <AlertTriangle className="h-3.5 w-3.5" />
          {overdue} Bestellung{overdue > 1 ? 'en' : ''} überfällig — sofort handeln!
        </div>
      )}
      {!overdue && critical > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300 text-[10px] font-bold border-b border-orange-100 dark:border-orange-900">
          <Zap className="h-3.5 w-3.5" />
          {critical} Bestellung{critical > 1 ? 'en' : ''} kritisch — Kochstart empfohlen
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-3 divide-x border-b bg-stone-50 dark:bg-stone-900">
        {[
          { icon: <Clock className="h-3 w-3" />, label: 'Aktiv', value: active.length, sub: 'Bestellungen' },
          { icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" />, label: 'Fertig', value: finishedCount, sub: 'heute' },
          { icon: <Timer className="h-3 w-3 text-matcha-600" />, label: 'Ø Prep', value: avgPrepMin !== null ? `${avgPrepMin}min` : '—', sub: 'letzte 2h' },
        ].map((k, i) => (
          <div key={i} className="flex flex-col items-center py-2 gap-0.5">
            <div className="flex items-center gap-1 text-[9px] text-stone-400 uppercase tracking-wider">
              {k.icon}{k.label}
            </div>
            <span className="text-lg font-black text-stone-800 dark:text-stone-100 leading-none">{k.value}</span>
            <span className="text-[8px] text-stone-400">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Order countdown grid */}
      {active.length > 0 && (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {active.map(order => {
            const { secsLeft, progress, cookNow } = order;
            const col = secsLeft !== null ? colorFor(secsLeft) : colorFor(999);
            return (
              <div
                key={order.id}
                className={`rounded-xl ring-2 p-2.5 flex flex-col gap-1.5 ${col.bg} ${col.ring}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                    #{(order.bestellnummer ?? '').replace('FF-', '').slice(-4)}
                  </span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${col.badge}`}>
                    {col.label}
                  </span>
                </div>
                <div className={`text-2xl font-black tabular-nums leading-none ${col.text}`}>
                  {secsLeft !== null ? fmt(secsLeft) : '—'}
                </div>
                {cookNow && (
                  <span className="flex items-center gap-1 text-[8px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full w-fit">
                    <Flame className="h-2.5 w-2.5" /> Jetzt kochen!
                  </span>
                )}
                <div className="text-[8px] text-stone-500 truncate">{order.kunde_name}</div>
                <div className="h-1 bg-white/60 dark:bg-black/20 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${col.bar}`} style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-[7px] text-stone-400">
                  <span>Ziel: {order.prepMin}min</span>
                  <span>{order.elapsed}min</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
