'use client';

/**
 * SchichtPrognosePanel — Live-Umsatz- und Lieferprognose für den aktuellen Tag.
 * Berechnet auf Basis der bisherigen Schichtdaten eine Hochrechnung auf Tagesende.
 * Zeigt: Ist-Umsatz, prognostizierter End-Umsatz, Bestellungen/Stunde, Tagesziel.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Target, Clock, Package, Euro, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStats {
  totalOrders: number;
  deliveredOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersPerHour: number;
  elapsedH: number;
  projectedRevenue: number;
  projectedOrders: number;
  remainingH: number;
  paceVsTarget: number; // 0-100+ pct of daily target
}

const DAILY_REVENUE_TARGET = 800; // €
const DAILY_ORDERS_TARGET = 50;
const SHIFT_END_HOUR = 22; // 22:00 Uhr

function euro(n: number) {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function SchichtPrognosePanel() {
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data: orders } = await supabase
          .from('customer_orders')
          .select('status, gesamtbetrag, bestellt_am')
          .gte('bestellt_am', today.toISOString())
          .not('bestellt_am', 'is', null);

        if (!orders || cancelled) return;

        const now = new Date();
        const shiftStartH = 10; // Annahme: Schichtbeginn 10 Uhr
        const currentH = now.getHours() + now.getMinutes() / 60;
        const elapsedH = Math.max(0.1, currentH - shiftStartH);
        const remainingH = Math.max(0, SHIFT_END_HOUR - currentH);

        const allOrders = orders as { status: string; gesamtbetrag: number; bestellt_am: string }[];
        const activeOrders = allOrders.filter(o => !['storniert', 'rejected'].includes(o.status));
        const deliveredOrders = activeOrders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));

        const totalRevenue = activeOrders.reduce((s, o) => s + (o.gesamtbetrag || 0), 0);
        const avgOrderValue = activeOrders.length > 0 ? totalRevenue / activeOrders.length : 0;
        const ordersPerHour = activeOrders.length / elapsedH;

        const projectedOrders = Math.round(activeOrders.length + ordersPerHour * remainingH);
        const projectedRevenue = totalRevenue + ordersPerHour * avgOrderValue * remainingH;
        const paceVsTarget = (ordersPerHour / (DAILY_ORDERS_TARGET / (SHIFT_END_HOUR - shiftStartH))) * 100;

        if (!cancelled) {
          setStats({
            totalOrders: activeOrders.length,
            deliveredOrders: deliveredOrders.length,
            totalRevenue,
            avgOrderValue,
            ordersPerHour,
            elapsedH,
            projectedRevenue,
            projectedOrders,
            remainingH,
            paceVsTarget,
          });
          setLoading(false);
        }
      } catch { if (!cancelled) setLoading(false); }
    };

    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !stats) return null;

  const revenuePct = Math.min(100, (stats.totalRevenue / DAILY_REVENUE_TARGET) * 100);
  const projectedPct = Math.min(100, (stats.projectedRevenue / DAILY_REVENUE_TARGET) * 100);
  const ordersPct = Math.min(100, (stats.totalOrders / DAILY_ORDERS_TARGET) * 100);

  const isOnTrack = stats.paceVsTarget >= 85;
  const isBehind = stats.paceVsTarget < 60;

  const statusCls = isOnTrack
    ? 'bg-matcha-50 border-matcha-200'
    : isBehind
    ? 'bg-red-50 border-red-200'
    : 'bg-amber-50 border-amber-200';

  const paceLabel = isOnTrack
    ? 'Im Ziel-Tempo'
    : isBehind
    ? 'Unter Ziel-Tempo'
    : 'Fast im Tempo';

  const paceLabelCls = isOnTrack ? 'text-matcha-700' : isBehind ? 'text-red-700' : 'text-amber-700';

  return (
    <div className={cn('rounded-xl border px-4 py-4 space-y-4', statusCls)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
          Schicht-Prognose
        </span>
        <span className={cn('ml-auto text-[10px] font-bold rounded-full px-2 py-0.5', paceLabelCls,
          isOnTrack ? 'bg-matcha-100' : isBehind ? 'bg-red-100' : 'bg-amber-100')}>
          {paceLabel}
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Umsatz heute */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[9px] text-stone-400 font-bold uppercase">
            <Euro className="h-2.5 w-2.5" /> Umsatz heute
          </div>
          <div className="text-lg font-black text-stone-800 tabular-nums leading-none">
            {euro(stats.totalRevenue)}
          </div>
          <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${revenuePct}%` }} />
          </div>
          <div className="text-[9px] text-stone-500 tabular-nums">
            Ziel: {euro(DAILY_REVENUE_TARGET)} · {revenuePct.toFixed(0)}%
          </div>
        </div>

        {/* Prognose Tagesende */}
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-[9px] text-stone-400 font-bold uppercase">
            <Target className="h-2.5 w-2.5" /> Prognose 22 Uhr
          </div>
          <div className={cn('text-lg font-black tabular-nums leading-none', isOnTrack ? 'text-matcha-700' : isBehind ? 'text-red-700' : 'text-amber-700')}>
            {euro(stats.projectedRevenue)}
          </div>
          <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700',
                isOnTrack ? 'bg-matcha-500' : isBehind ? 'bg-red-400' : 'bg-amber-400')}
              style={{ width: `${projectedPct}%` }}
            />
          </div>
          <div className="text-[9px] text-stone-500 tabular-nums">
            ~{stats.projectedOrders} Bestellungen erwartet
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-white/60 border border-stone-200 px-2.5 py-2 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400 font-bold uppercase">Bestellungen</span>
          </div>
          <span className="text-sm font-black text-stone-700 tabular-nums">{stats.totalOrders}</span>
          <div className="text-[8px] text-stone-400">
            {ordersPct.toFixed(0)}% von {DAILY_ORDERS_TARGET}
          </div>
        </div>

        <div className="rounded-lg bg-white/60 border border-stone-200 px-2.5 py-2 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400 font-bold uppercase">Tempo</span>
          </div>
          <span className="text-sm font-black text-stone-700 tabular-nums">
            {stats.ordersPerHour.toFixed(1)}/h
          </span>
          <div className="text-[8px] text-stone-400">
            Ø {euro(stats.avgOrderValue)}/Best.
          </div>
        </div>

        <div className="rounded-lg bg-white/60 border border-stone-200 px-2.5 py-2 flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400 font-bold uppercase">Rest</span>
          </div>
          <span className="text-sm font-black text-stone-700 tabular-nums">
            {stats.remainingH.toFixed(1)}h
          </span>
          <div className="text-[8px] text-stone-400">
            bis 22:00 Uhr
          </div>
        </div>
      </div>

      {/* Pace bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[9px] text-stone-500">
          <span>Tempo vs. Tagesziel</span>
          <span className={cn('font-black', paceLabelCls)}>{stats.paceVsTarget.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              isOnTrack ? 'bg-matcha-500' : isBehind ? 'bg-red-400' : 'bg-amber-400',
            )}
            style={{ width: `${Math.min(100, stats.paceVsTarget)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
