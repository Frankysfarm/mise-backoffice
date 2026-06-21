'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingDown, TrendingUp, Minus, BarChart2, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface DayKpi {
  orders: number;
  revenue: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  activeDrivers: number;
}

interface Props {
  locationId: string | null;
}

function TrendIcon({ val, inverted = false }: { val: number; inverted?: boolean }) {
  const positive = inverted ? val < 0 : val > 0;
  const neutral = val === 0;
  if (neutral) return <Minus size={12} className="text-muted-foreground" />;
  return positive
    ? <TrendingUp size={12} className="text-matcha-600" />
    : <TrendingDown size={12} className="text-red-500" />;
}

function fmt(n: number, decimals = 0): string {
  return n.toFixed(decimals).replace('.', ',');
}

function fmtEur(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function pctDiff(today: number, yesterday: number): number {
  if (yesterday === 0) return 0;
  return Math.round(((today - yesterday) / yesterday) * 100);
}

export function LieferdienstTagesExecutive({ locationId }: Props) {
  const supabase = createClient();
  const [today, setToday] = useState<DayKpi | null>(null);
  const [yesterday, setYesterday] = useState<DayKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  useEffect(() => {
    load();
    const iv = setInterval(load, 3 * 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function load() {
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);

      async function fetchKpi(from: Date, to: Date): Promise<DayKpi> {
        let q = supabase
          .from('customer_orders')
          .select('gesamtbetrag, bestellt_am, fertig_am, typ, status, location_id, delivery_zone')
          .gte('bestellt_am', from.toISOString())
          .lt('bestellt_am', to.toISOString())
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen', 'unterwegs']);
        if (locationId) q = q.eq('location_id', locationId);
        const { data: orders } = await q;
        if (!orders) return { orders: 0, revenue: 0, avgDeliveryMin: 0, onTimeRatePct: 0, activeDrivers: 0 };

        const revenue = (orders as any[]).reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
        const deliveries = (orders as any[]).filter((o: any) => o.typ === 'lieferung');
        const deliveredWithTimes = deliveries.filter((o: any) => o.bestellt_am && o.fertig_am);
        const avgDeliveryMin = deliveredWithTimes.length
          ? deliveredWithTimes.reduce((s: number, o: any) => {
              return s + (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
            }, 0) / deliveredWithTimes.length
          : 0;
        const onTimePct = deliveredWithTimes.length
          ? (deliveredWithTimes.filter((o: any) => {
              const min = (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
              return min <= 45;
            }).length / deliveredWithTimes.length) * 100
          : 0;

        const { count: driverCount } = await supabase
          .from('driver_status')
          .select('employee_id', { count: 'exact', head: true })
          .eq('ist_online', true);

        return {
          orders: (orders as any[]).length,
          revenue,
          avgDeliveryMin,
          onTimeRatePct: onTimePct,
          activeDrivers: driverCount ?? 0,
        };
      }

      const [t, y] = await Promise.all([
        fetchKpi(todayStart, now),
        fetchKpi(yesterdayStart, yesterdayEnd),
      ]);
      setToday(t);
      setYesterday(y);
      setLastRefresh(Date.now());
    } catch { } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-5 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!today) return null;

  const kpis = [
    {
      label: 'Bestellungen',
      today: today.orders,
      yesterday: yesterday?.orders ?? 0,
      display: today.orders.toString(),
      diff: pctDiff(today.orders, yesterday?.orders ?? 0),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
    },
    {
      label: 'Umsatz',
      today: today.revenue,
      yesterday: yesterday?.revenue ?? 0,
      display: fmtEur(today.revenue),
      diff: pctDiff(today.revenue, yesterday?.revenue ?? 0),
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
    },
    {
      label: 'Ø Lieferzeit',
      today: today.avgDeliveryMin,
      yesterday: yesterday?.avgDeliveryMin ?? 0,
      display: today.avgDeliveryMin > 0 ? `${fmt(today.avgDeliveryMin)} Min` : '—',
      diff: pctDiff(today.avgDeliveryMin, yesterday?.avgDeliveryMin ?? 0),
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      inverted: true,
    },
    {
      label: 'Pünktlichkeit',
      today: today.onTimeRatePct,
      yesterday: yesterday?.onTimeRatePct ?? 0,
      display: today.onTimeRatePct > 0 ? `${fmt(today.onTimeRatePct)} %` : '—',
      diff: pctDiff(today.onTimeRatePct, yesterday?.onTimeRatePct ?? 0),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Online-Fahrer',
      today: today.activeDrivers,
      yesterday: yesterday?.activeDrivers ?? 0,
      display: today.activeDrivers.toString(),
      diff: pctDiff(today.activeDrivers, yesterday?.activeDrivers ?? 0),
      color: 'text-purple-700',
      bg: 'bg-purple-50',
    },
  ];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <BarChart2 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-black text-stone-900">Tages-Executive-Brief</div>
          <div className="text-[10px] text-stone-400">Heute vs. Gestern · Alle KPIs</div>
        </div>
        <button
          onClick={load}
          className="ml-auto flex items-center gap-1.5 text-[10px] text-stone-400 hover:text-stone-600 transition"
        >
          <RefreshCw size={10} />
          {new Date(lastRefresh).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-5">
        {kpis.map(kpi => {
          const diffAbs = kpi.diff;
          const diffColor = kpi.inverted
            ? diffAbs < 0 ? 'text-matcha-600' : diffAbs > 0 ? 'text-red-500' : 'text-stone-400'
            : diffAbs > 0 ? 'text-matcha-600' : diffAbs < 0 ? 'text-red-500' : 'text-stone-400';

          return (
            <div key={kpi.label} className={cn('rounded-xl p-3.5', kpi.bg)}>
              <div className={cn('text-xl font-black tabular-nums leading-tight', kpi.color)}>
                {kpi.display}
              </div>
              <div className="text-[9px] font-bold text-stone-500 mt-1 uppercase tracking-wide">
                {kpi.label}
              </div>
              <div className={cn('flex items-center gap-1 mt-1.5 text-[10px] font-bold', diffColor)}>
                <TrendIcon val={diffAbs} inverted={kpi.inverted ?? false} />
                {diffAbs !== 0 ? `${diffAbs > 0 ? '+' : ''}${diffAbs}% ggü. gestern` : 'wie gestern'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
