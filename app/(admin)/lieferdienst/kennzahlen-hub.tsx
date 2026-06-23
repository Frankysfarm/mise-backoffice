'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  TrendingUp, TrendingDown, Minus, Euro, Clock, Package,
  Bike, Star, Target, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPI {
  label: string;
  value: string;
  subValue?: string;
  trend: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  color: 'green' | 'amber' | 'red' | 'neutral';
  icon: React.ElementType;
}

interface DriverKPI {
  name: string;
  deliveries: number;
  avgMin: number;
  onTimePct: number;
}

interface HourBucket {
  hour: string;
  count: number;
  revenue: number;
}

function trendColor(trend: KPI['trend']) {
  if (trend === 'up') return 'text-matcha-600';
  if (trend === 'down') return 'text-red-500';
  return 'text-muted-foreground';
}

function TrendIcon({ trend }: { trend: KPI['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
}

const SECTION_BG: Record<KPI['color'], string> = {
  green:   'bg-matcha-50 border-matcha-200',
  amber:   'bg-amber-50 border-amber-200',
  red:     'bg-red-50 border-red-200',
  neutral: 'bg-muted/20 border-border',
};

export function LieferdienstKennzahlenHub({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [drivers, setDrivers] = useState<DriverKPI[]>([]);
  const [hourBuckets, setHourBuckets] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    // Today's orders
    let todayQ = sb
      .from('customer_orders')
      .select('id, gesamtbetrag, bestellt_am, status')
      .gte('bestellt_am', today.toISOString())
      .not('status', 'in', '("storniert","cancelled")');
    if (locationId) todayQ = todayQ.eq('location_id', locationId) as typeof todayQ;
    const { data: todayOrders } = await todayQ;

    // Yesterday for trend
    let yestQ = sb
      .from('customer_orders')
      .select('id, gesamtbetrag')
      .gte('bestellt_am', yesterday.toISOString())
      .lt('bestellt_am', today.toISOString())
      .not('status', 'in', '("storniert","cancelled")');
    if (locationId) yestQ = yestQ.eq('location_id', locationId) as typeof yestQ;
    const { data: yestOrders } = await yestQ;

    // Delivery stats
    let stopsQ = sb
      .from('delivery_batch_stops')
      .select('id, geliefert_am, angekommen_am, batch_id')
      .gte('angekommen_am', today.toISOString())
      .not('geliefert_am', 'is', null);
    const { data: stops } = await stopsQ;

    // Online drivers
    const { data: driversData } = await sb
      .from('driver_statuses')
      .select('employee_id, ist_online, aktueller_batch_id')
      .eq('ist_online', true);

    // Active batches
    let batchQ = sb
      .from('delivery_batches')
      .select('id, fahrer_id, total_eta_min, status, started_at, completed_at')
      .gte('created_at', today.toISOString())
      .not('status', 'in', '("cancelled","storniert")');
    if (locationId) batchQ = batchQ.eq('location_id', locationId) as typeof batchQ;
    const { data: batches } = await batchQ;

    const todayArr = (todayOrders ?? []) as { id: string; gesamtbetrag: number | null; bestellt_am: string; status: string }[];
    const yestArr = (yestOrders ?? []) as { id: string; gesamtbetrag: number | null }[];
    const stopsArr = (stops ?? []) as { id: string; geliefert_am: string | null; angekommen_am: string | null }[];
    const batchArr = (batches ?? []) as {
      id: string; fahrer_id: string | null; total_eta_min: number | null;
      status: string; started_at: string | null; completed_at: string | null;
    }[];

    const todayRevenue = todayArr.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
    const yestRevenue = yestArr.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
    const revTrend: KPI['trend'] = todayRevenue > yestRevenue ? 'up' : todayRevenue < yestRevenue ? 'down' : 'neutral';

    const deliveredOrders = todayArr.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
    const pendingOrders = todayArr.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'assigned', 'unterwegs'].includes(o.status));
    const deliveryRate = todayArr.length > 0 ? Math.round((deliveredOrders.length / todayArr.length) * 100) : 0;

    const avgOrderValue = deliveredOrders.length > 0
      ? deliveredOrders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0) / deliveredOrders.length
      : 0;

    // Avg delivery time from completed batches
    const completedBatches = batchArr.filter(b => b.completed_at && b.started_at && b.total_eta_min != null);
    const avgDeliveryMin = completedBatches.length > 0
      ? Math.round(completedBatches.reduce((s, b) => s + (b.total_eta_min ?? 0), 0) / completedBatches.length)
      : null;

    const onlineDriverCount = (driversData ?? []).length;
    const activeBatches = batchArr.filter(b => ['aktiv', 'unterwegs', 'pickup'].includes(b.status)).length;

    // Hourly distribution
    const hourCounts: Record<number, { count: number; revenue: number }> = {};
    for (const o of todayArr) {
      const h = new Date(o.bestellt_am).getHours();
      if (!hourCounts[h]) hourCounts[h] = { count: 0, revenue: 0 };
      hourCounts[h].count++;
      hourCounts[h].revenue += o.gesamtbetrag ?? 0;
    }
    const nowH = new Date().getHours();
    const buckets: HourBucket[] = [];
    for (let h = 10; h <= Math.min(nowH, 23); h++) {
      buckets.push({
        hour: `${h}:00`,
        count: hourCounts[h]?.count ?? 0,
        revenue: hourCounts[h]?.revenue ?? 0,
      });
    }
    setHourBuckets(buckets.slice(-8));

    const builtKpis: KPI[] = [
      {
        label: 'Umsatz heute',
        value: `€${todayRevenue.toFixed(2)}`,
        subValue: yestRevenue > 0 ? `Gestern: €${yestRevenue.toFixed(2)}` : undefined,
        trend: revTrend,
        trendLabel: yestRevenue > 0 ? `${revTrend === 'up' ? '+' : ''}${(((todayRevenue - yestRevenue) / yestRevenue) * 100).toFixed(0)}%` : undefined,
        color: revTrend === 'up' ? 'green' : revTrend === 'down' ? 'amber' : 'neutral',
        icon: Euro,
      },
      {
        label: 'Bestellungen',
        value: String(todayArr.length),
        subValue: `${pendingOrders.length} offen`,
        trend: 'neutral',
        color: pendingOrders.length > 10 ? 'amber' : 'green',
        icon: Package,
      },
      {
        label: 'Lieferquote',
        value: `${deliveryRate}%`,
        trend: deliveryRate >= 90 ? 'up' : deliveryRate >= 70 ? 'neutral' : 'down',
        color: deliveryRate >= 90 ? 'green' : deliveryRate >= 70 ? 'amber' : 'red',
        icon: CheckCircle2,
      },
      {
        label: 'Ø Ø-Bestellwert',
        value: `€${avgOrderValue.toFixed(2)}`,
        trend: 'neutral',
        color: avgOrderValue >= 20 ? 'green' : 'neutral',
        icon: Star,
      },
      {
        label: 'Fahrer online',
        value: String(onlineDriverCount),
        subValue: `${activeBatches} auf Tour`,
        trend: 'neutral',
        color: onlineDriverCount === 0 ? 'red' : onlineDriverCount < 2 ? 'amber' : 'green',
        icon: Bike,
      },
      ...(avgDeliveryMin != null ? [{
        label: 'Ø Lieferzeit',
        value: `${avgDeliveryMin} Min`,
        trend: avgDeliveryMin <= 30 ? 'up' as KPI['trend'] : avgDeliveryMin <= 45 ? 'neutral' as KPI['trend'] : 'down' as KPI['trend'],
        color: avgDeliveryMin <= 30 ? 'green' as KPI['color'] : avgDeliveryMin <= 45 ? 'amber' as KPI['color'] : 'red' as KPI['color'],
        icon: Clock,
      }] : []),
    ];

    setKpis(builtKpis);
    setLastUpdate(new Date());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 60_000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b hover:bg-muted/20 transition"
      >
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Kennzahlen-Hub</span>
        {lastUpdate && (
          <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">
            {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={e => { e.stopPropagation(); void load(); }}
          className="ml-2 rounded-md p-1 hover:bg-muted transition"
        >
          <RefreshCw className={cn('h-3 w-3 text-muted-foreground', loading && 'animate-spin')} />
        </button>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            {kpis.map(kpi => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className={cn('rounded-xl border p-3', SECTION_BG[kpi.color])}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {kpi.label}
                    </span>
                  </div>
                  <div className="text-xl font-black tabular-nums text-foreground">{kpi.value}</div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className={cn('flex items-center gap-0.5 text-[10px] font-bold', trendColor(kpi.trend))}>
                      <TrendIcon trend={kpi.trend} />
                      {kpi.trendLabel}
                    </span>
                    {kpi.subValue && (
                      <span className="text-[10px] text-muted-foreground">{kpi.subValue}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hourly chart */}
          {hourBuckets.length > 0 && (
            <div className="border-t px-4 pt-3 pb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Bestellungen je Stunde (heute)
              </div>
              <div className="flex items-end gap-1 h-16">
                {hourBuckets.map((b, i) => {
                  const maxCount = Math.max(...hourBuckets.map(x => x.count), 1);
                  const heightPct = (b.count / maxCount) * 100;
                  const isLast = i === hourBuckets.length - 1;
                  return (
                    <div key={b.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${b.hour}: ${b.count} Bestellungen`}>
                      <div className="w-full flex items-end" style={{ height: '52px' }}>
                        <div
                          className={cn(
                            'w-full rounded-t-sm transition-all duration-300',
                            isLast ? 'bg-matcha-500' : 'bg-matcha-200',
                          )}
                          style={{ height: `${Math.max(4, heightPct)}%` }}
                        />
                      </div>
                      <span className="text-[8px] text-muted-foreground tabular-nums">{b.hour.split(':')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
