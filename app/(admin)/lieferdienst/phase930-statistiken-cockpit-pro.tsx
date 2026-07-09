'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Euro, Clock, Package, Star, Truck, BarChart2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Stats {
  ordersToday: number;
  revenueToday: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  activeDrivers: number;
  cancelledToday: number;
  avgRating: number | null;
}

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

function TrendIcon({ pct }: { pct: number | null }) {
  if (pct === null) return <Minus className="w-3 h-3 text-stone-400" />;
  if (pct > 0) return <TrendingUp className="w-3 h-3 text-matcha-500" />;
  if (pct < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-stone-400" />;
}

function KpiTile({ label, value, sub, trend, icon: Icon, color }: {
  label: string; value: string; sub?: string;
  trend?: number | null; icon: typeof Euro; color: string;
}) {
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', color)}>
      <div className="flex items-center justify-between">
        <Icon className="w-4 h-4 opacity-70" />
        {trend !== undefined && (
          <div className="flex items-center gap-0.5 text-[10px]">
            <TrendIcon pct={trend ?? null} />
            {trend !== null && <span className={trend >= 0 ? 'text-matcha-600' : 'text-red-600'}>{Math.abs(trend).toFixed(0)}%</span>}
          </div>
        )}
      </div>
      <div className="text-xl font-bold text-stone-900">{value}</div>
      <div className="text-[10px] text-stone-500 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-stone-400">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase930StatistikCockpitPro() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const [ordersRes, driverRes] = await Promise.all([
        supabase.from('customer_orders')
          .select('id, gesamtbetrag, status, fertig_am, bestellt_am, bewertung')
          .gte('bestellt_am', todayIso)
          .eq('location_id', LOCATION_ID),
        supabase.from('driver_status')
          .select('ist_online')
          .eq('ist_online', true),
      ]);

      const orders = (ordersRes.data ?? []) as any[];
      const deliveredOrders = orders.filter((o: any) => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
      const cancelledOrders = orders.filter((o: any) => o.status === 'storniert');

      const revenueToday = deliveredOrders.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

      // Avg delivery time
      const delivTimes: number[] = [];
      for (const o of deliveredOrders) {
        if (o.bestellt_am && o.fertig_am) {
          const mins = (new Date(o.fertig_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          if (mins > 0 && mins < 120) delivTimes.push(mins);
        }
      }
      const avgDeliveryMin = delivTimes.length > 0
        ? delivTimes.reduce((a, b) => a + b, 0) / delivTimes.length
        : null;

      // On-time (target: 30 min)
      const onTimeOrders = delivTimes.filter(t => t <= 30);
      const onTimePct = delivTimes.length > 0
        ? (onTimeOrders.length / delivTimes.length) * 100
        : null;

      // Avg rating
      const ratings = deliveredOrders.map((o: any) => o.bewertung).filter((r: any) => r !== null && r > 0);
      const avgRating = ratings.length > 0
        ? ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length
        : null;

      setStats({
        ordersToday: deliveredOrders.length,
        revenueToday,
        avgDeliveryMin,
        onTimePct,
        activeDrivers: (driverRes.data ?? []).length,
        cancelledToday: cancelledOrders.length,
        avgRating,
      });
      setLoading(false);
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <BarChart2 className="w-4 h-4 text-saffron" />
        <span className="text-sm font-semibold text-stone-800">Statistiken-Cockpit Pro</span>
        <span className="text-xs text-stone-400">· Heute Echtzeit</span>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-sm text-stone-400">Lade Statistiken…</div>
      ) : stats ? (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <KpiTile
            label="Bestellungen"
            value={stats.ordersToday.toString()}
            icon={Package}
            color="bg-matcha-50 border-matcha-200"
          />
          <KpiTile
            label="Umsatz Heute"
            value={`${stats.revenueToday.toFixed(0)} €`}
            icon={Euro}
            color="bg-saffron/5 border-saffron/20"
          />
          <KpiTile
            label="Ø Lieferzeit"
            value={stats.avgDeliveryMin !== null ? `${Math.round(stats.avgDeliveryMin)} Min` : '–'}
            sub="Ziel: 30 Min"
            icon={Clock}
            color={stats.avgDeliveryMin !== null && stats.avgDeliveryMin <= 30
              ? 'bg-matcha-50 border-matcha-200'
              : 'bg-amber-50 border-amber-200'
            }
          />
          <KpiTile
            label="Pünktlichkeit"
            value={stats.onTimePct !== null ? `${Math.round(stats.onTimePct)}%` : '–'}
            sub="In 30 Min geliefert"
            icon={TrendingUp}
            color={stats.onTimePct !== null && stats.onTimePct >= 80
              ? 'bg-matcha-50 border-matcha-200'
              : 'bg-amber-50 border-amber-200'
            }
          />
          <KpiTile
            label="Aktive Fahrer"
            value={stats.activeDrivers.toString()}
            icon={Truck}
            color="bg-blue-50 border-blue-200"
          />
          {stats.avgRating !== null ? (
            <KpiTile
              label="Ø Bewertung"
              value={stats.avgRating.toFixed(1)}
              sub="von 5 Sternen"
              icon={Star}
              color="bg-amber-50 border-amber-200"
            />
          ) : (
            <KpiTile
              label="Stornos"
              value={stats.cancelledToday.toString()}
              icon={Package}
              color={stats.cancelledToday > 0 ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}
            />
          )}
        </div>
      ) : null}

      {/* On-time gauge bar */}
      {stats?.onTimePct !== null && (
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between text-[10px] text-stone-500 mb-1">
            <span>Pünktlichkeitsrate heute</span>
            <span className="font-medium">{Math.round(stats!.onTimePct!)}% in 30 Min</span>
          </div>
          <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500',
                stats!.onTimePct! >= 80 ? 'bg-matcha-500' : stats!.onTimePct! >= 60 ? 'bg-amber-500' : 'bg-red-500'
              )}
              style={{ width: `${Math.min(100, stats!.onTimePct!)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
