'use client';

/**
 * Phase 553 — Echtzeit-Kennzahlen-Hub
 *
 * Live-Dashboard mit den wichtigsten Schicht-KPIs auf einen Blick:
 * - Aktive Fahrer / Online-Status
 * - Bestellungen heute (gesamt, geliefert, storniert)
 * - Umsatz heute vs. Ziel
 * - Ø Lieferzeit (letzte 10 Lieferungen)
 * - On-Time-Rate (%)
 * Polling alle 60s via /api/delivery/stats
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Activity, Bike, CheckCircle2, Clock, Euro, Package, Target, TrendingUp, XCircle,
} from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface LiveData {
  ordersToday: number;
  delivered: number;
  cancelled: number;
  revenueToday: number;
  revenueGoal?: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  driversOnline: number;
  activeOrders: number;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'stone',
  pulse = false,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  sub?: string;
  color?: 'stone' | 'matcha' | 'amber' | 'red' | 'blue';
  pulse?: boolean;
}) {
  const cls: Record<string, string> = {
    stone:  'text-stone-700 bg-stone-50  border-stone-200',
    matcha: 'text-matcha-700 bg-matcha-50 border-matcha-200',
    amber:  'text-amber-700  bg-amber-50  border-amber-200',
    red:    'text-red-600    bg-red-50    border-red-200',
    blue:   'text-blue-700   bg-blue-50   border-blue-200',
  };
  return (
    <div className={cn('rounded-xl border p-3 space-y-1', cls[color], pulse && 'animate-pulse')}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', `text-${color}-500`)} />
        <span className="text-[9px] font-bold uppercase tracking-wider text-stone-500">{label}</span>
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', `text-${color}-700`)}>{value}</div>
      {sub && <div className="text-[10px] text-stone-400">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase553EchtzeitKennzahlenHub({ locationId }: Props) {
  const supabase = createClient();
  const [data, setData] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      // Primary: fetch from delivery stats API
      const res = await fetch(`/api/delivery/stats?location_id=${encodeURIComponent(locationId)}&period=today`);
      if (res.ok) {
        const d = await res.json();
        setData({
          ordersToday: d.orders_today ?? d.total ?? 0,
          delivered: d.delivered ?? d.completed ?? 0,
          cancelled: d.cancelled ?? d.storniert ?? 0,
          revenueToday: d.revenue_today ?? d.umsatz_heute ?? 0,
          revenueGoal: d.revenue_goal ?? undefined,
          avgDeliveryMin: d.avg_delivery_min ?? d.avg_lieferzeit ?? null,
          onTimePct: d.on_time_pct ?? d.puenktlichkeit ?? null,
          driversOnline: d.drivers_online ?? d.fahrer_online ?? 0,
          activeOrders: d.active_orders ?? 0,
        });
        setLastUpdate(new Date());
        setLoading(false);
        return;
      }
    } catch {}

    // Fallback: query Supabase directly
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, gesamtbetrag, fertig_am, bestellt_am')
        .eq('location_id', locationId)
        .gte('bestellt_am', today.toISOString())
        .in('typ', ['lieferung', 'delivery']);

      if (orders) {
        const delivered = orders.filter(o => ['geliefert', 'abgeholt'].includes(o.status));
        const cancelled = orders.filter(o => ['storniert', 'abgebrochen'].includes(o.status));
        const revenue = delivered.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
        const activeCnt = orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)).length;

        setData({
          ordersToday: orders.length,
          delivered: delivered.length,
          cancelled: cancelled.length,
          revenueToday: revenue,
          avgDeliveryMin: null,
          onTimePct: null,
          driversOnline: 0,
          activeOrders: activeCnt,
        });
        setLastUpdate(new Date());
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (loading && !data) {
    return (
      <div className="rounded-2xl border bg-card p-4 animate-pulse">
        <div className="h-4 w-48 bg-muted rounded mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
        </div>
      </div>
    );
  }
  if (!data) return null;

  const deliveryPct = data.ordersToday > 0 ? Math.round((data.delivered / data.ordersToday) * 100) : 0;
  const cancelPct   = data.ordersToday > 0 ? Math.round((data.cancelled / data.ordersToday) * 100) : 0;
  const revenueStr  = data.revenueToday.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Echtzeit-Kennzahlen</span>
        {lastUpdate && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Aktualisiert {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={Package}
          label="Bestellungen heute"
          value={data.ordersToday.toString()}
          sub={`${data.activeOrders} aktiv`}
          color="stone"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Geliefert"
          value={data.delivered.toString()}
          sub={`${deliveryPct}% Quote`}
          color="matcha"
        />
        <KpiCard
          icon={Euro}
          label="Umsatz heute"
          value={revenueStr}
          sub={data.revenueGoal ? `Ziel: ${(data.revenueGoal).toLocaleString('de-DE')} €` : undefined}
          color="blue"
        />
        {data.driversOnline > 0 ? (
          <KpiCard
            icon={Bike}
            label="Fahrer online"
            value={data.driversOnline.toString()}
            color="matcha"
            pulse={data.driversOnline === 0}
          />
        ) : (
          <KpiCard
            icon={XCircle}
            label="Stornos"
            value={data.cancelled.toString()}
            sub={`${cancelPct}% Rate`}
            color={cancelPct > 10 ? 'red' : 'amber'}
          />
        )}
      </div>

      {/* Secondary row */}
      <div className="px-4 pb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 border-t pt-3">
        {data.avgDeliveryMin !== null && (
          <KpiCard
            icon={Clock}
            label="Ø Lieferzeit"
            value={`${Math.round(data.avgDeliveryMin)} Min`}
            color={data.avgDeliveryMin > 45 ? 'red' : data.avgDeliveryMin > 35 ? 'amber' : 'matcha'}
          />
        )}
        {data.onTimePct !== null && (
          <KpiCard
            icon={Target}
            label="Pünktlichkeit"
            value={`${Math.round(data.onTimePct)}%`}
            color={data.onTimePct < 70 ? 'red' : data.onTimePct < 85 ? 'amber' : 'matcha'}
          />
        )}
        {data.driversOnline > 0 && data.cancelled > 0 && (
          <KpiCard
            icon={XCircle}
            label="Stornos"
            value={data.cancelled.toString()}
            sub={`${cancelPct}% Rate`}
            color={cancelPct > 10 ? 'red' : 'amber'}
          />
        )}
      </div>
    </div>
  );
}
