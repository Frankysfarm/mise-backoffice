'use client';

/**
 * Phase 2360 — Statistiken-Dashboard Final
 *
 * Erweitertes Statistiken-Dashboard für Lieferdienst:
 * - 6 KPI-Kacheln (Bestellungen, Umsatz, Ø Lieferzeit, On-Time, Storno, Fahrer online)
 * - Stundenverlauf-Chart (Bestellungen + Umsatz umschaltbar)
 * - Top-5 Lieferzonen nach Auftragsvolumen
 * - Alert-Strip bei kritischen Werten
 * 5-Min-Polling
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  AlertTriangle, Bike, ChevronDown, ChevronUp, Clock, Euro,
  MapPin, Package, TrendingUp, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Types ─────────────────────────────────────────────────────────── */

type KpiKey = 'orders' | 'revenue' | 'avgDelivery' | 'onTime' | 'storno' | 'driversOnline';

interface Stats {
  todayOrders: number;
  todayRevenue: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  stornoPct: number;
  driversOnline: number;
  hourly: { hour: number; label: string; orders: number; revenue: number }[];
  topZones: { zone: string; orders: number; revenue: number }[];
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function fmt(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/* ── Alert Strip ─────────────────────────────────────────────────────── */

function AlertStrip({ stats }: { stats: Stats }) {
  const alerts: string[] = [];
  if (stats.stornoPct > 15) alerts.push(`Storno-Rate ${stats.stornoPct.toFixed(0)}% — über Schwelle von 15%`);
  if (stats.avgDeliveryMin !== null && stats.avgDeliveryMin > 45) alerts.push(`Ø Lieferzeit ${stats.avgDeliveryMin.toFixed(0)} Min — über 45-Min-Ziel`);
  if (stats.onTimePct !== null && stats.onTimePct < 80) alerts.push(`On-Time-Quote ${stats.onTimePct.toFixed(0)}% — unter 80%`);
  if (alerts.length === 0) return null;
  return (
    <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 px-4 py-2 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0 space-y-0.5">
        {alerts.map(a => (
          <div key={a} className="text-xs font-medium text-red-700 dark:text-red-300">{a}</div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI Card ─────────────────────────────────────────────────────────── */

function KpiCard({
  icon, label, value, sub, ok = true,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  ok?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-3',
      ok ? 'bg-stone-50 dark:bg-stone-900/30 border-stone-200 dark:border-stone-700'
         : 'bg-red-50  dark:bg-red-950/30  border-red-200  dark:border-red-800',
    )}>
      <div className={cn('flex items-center gap-1.5 mb-1 text-[10px] font-semibold', ok ? 'text-stone-500 dark:text-stone-400' : 'text-red-600 dark:text-red-400')}>
        {icon}{label}
      </div>
      <div className={cn('text-base font-black tabular-nums', ok ? 'text-stone-800 dark:text-stone-100' : 'text-red-700 dark:text-red-300')}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */

export function LieferdienstPhase2360StatistikDashboardFinal() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chartMode, setChartMode] = useState<'orders' | 'revenue'>('orders');
  const [open, setOpen] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState(false);

  const load = useCallback(async () => {
    const start = todayStart();

    // Fetch today's orders
    const { data: orders } = await supabase
      .from('customer_orders')
      .select('id, gesamtbetrag, status, bestellt_am, fertig_am, fahrer_abgeholt_am, delivery_zone, typ')
      .gte('bestellt_am', start)
      .not('bestellt_am', 'is', null);

    if (!orders) return;

    const total = orders.length;
    const storniert = orders.filter(o => o.status === 'storniert').length;
    const completed = orders.filter(o =>
      ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status),
    );
    const revenue = completed.reduce((sum, o) => sum + (o.gesamtbetrag ?? 0), 0);

    // On-Time (estimate: delivered within 45 min of order)
    const withTimes = completed.filter(o => o.bestellt_am && o.fertig_am);
    const onTimeCount = withTimes.filter(o => {
      const diff = (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
      return diff <= 45;
    }).length;
    const onTimePct = withTimes.length > 0 ? (onTimeCount / withTimes.length) * 100 : null;

    // Avg delivery time
    const avgMin = withTimes.length > 0
      ? withTimes.reduce((s, o) => {
          return s + (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000;
        }, 0) / withTimes.length
      : null;

    // Drivers online
    const { count: driversOnline } = await supabase
      .from('driver_status')
      .select('id', { count: 'exact', head: true })
      .eq('ist_online', true);

    // Hourly distribution
    const hourlyMap: Record<number, { orders: number; revenue: number }> = {};
    for (const o of completed) {
      const h = new Date(o.bestellt_am!).getHours();
      if (!hourlyMap[h]) hourlyMap[h] = { orders: 0, revenue: 0 };
      hourlyMap[h].orders += 1;
      hourlyMap[h].revenue += o.gesamtbetrag ?? 0;
    }
    const nowH = new Date().getHours();
    const hourly = [];
    for (let h = 10; h <= Math.max(nowH, 22); h++) {
      hourly.push({
        hour: h,
        label: `${h}`,
        orders: hourlyMap[h]?.orders ?? 0,
        revenue: hourlyMap[h]?.revenue ?? 0,
      });
    }

    // Top zones
    const zoneMap: Record<string, { orders: number; revenue: number }> = {};
    for (const o of completed) {
      const z = o.delivery_zone ?? o.typ ?? 'Unbekannt';
      if (!zoneMap[z]) zoneMap[z] = { orders: 0, revenue: 0 };
      zoneMap[z].orders += 1;
      zoneMap[z].revenue += o.gesamtbetrag ?? 0;
    }
    const topZones = Object.entries(zoneMap)
      .sort((a, b) => b[1].orders - a[1].orders)
      .slice(0, 5)
      .map(([zone, v]) => ({ zone, ...v }));

    setStats({
      todayOrders: total,
      todayRevenue: revenue,
      avgDeliveryMin: avgMin,
      onTimePct,
      stornoPct: total > 0 ? (storniert / total) * 100 : 0,
      driversOnline: driversOnline ?? 0,
      hourly,
      topZones,
    });
  }, [supabase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  const kpis = stats ? [
    { icon: <Package className="w-3 h-3" />, label: 'Bestellungen', value: String(stats.todayOrders), ok: true },
    { icon: <Euro className="w-3 h-3" />, label: 'Umsatz', value: fmt(stats.todayRevenue), ok: true },
    { icon: <Clock className="w-3 h-3" />, label: 'Ø Lieferzeit', value: stats.avgDeliveryMin !== null ? `${stats.avgDeliveryMin.toFixed(0)} Min` : '—', ok: stats.avgDeliveryMin === null || stats.avgDeliveryMin <= 45 },
    { icon: <TrendingUp className="w-3 h-3" />, label: 'On-Time', value: stats.onTimePct !== null ? `${stats.onTimePct.toFixed(0)}%` : '—', ok: stats.onTimePct === null || stats.onTimePct >= 80 },
    { icon: <X className="w-3 h-3" />, label: 'Storno-Rate', value: `${stats.stornoPct.toFixed(0)}%`, ok: stats.stornoPct <= 15 },
    { icon: <Bike className="w-3 h-3" />, label: 'Fahrer online', value: String(stats.driversOnline), ok: stats.driversOnline > 0 },
  ] : [];

  const barColor = chartMode === 'orders' ? '#6a9e5f' : '#f59e0b';
  const maxZoneOrders = stats?.topZones[0]?.orders ?? 1;

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900/40 shrink-0">
            <TrendingUp className="w-4 h-4 text-matcha-700 dark:text-matcha-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800 dark:text-stone-100">Statistiken-Dashboard</div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              Heute · Echtzeit-Überblick
              {stats && ` · ${stats.todayOrders} Bestellungen`}
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {/* Alert strip */}
      {open && stats && !dismissedAlerts && (
        <div onClick={() => setDismissedAlerts(true)}>
          <AlertStrip stats={stats} />
        </div>
      )}

      {open && stats && (
        <>
          {/* KPI Grid */}
          <div className="px-4 pt-3 pb-2 grid grid-cols-2 sm:grid-cols-3 gap-2 bg-white dark:bg-stone-900">
            {kpis.map(k => (
              <KpiCard key={k.label} icon={k.icon} label={k.label} value={k.value} ok={k.ok} />
            ))}
          </div>

          {/* Stunden-Chart */}
          <div className="px-4 pb-3 bg-white dark:bg-stone-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300">Stundenverlauf heute</span>
              <div className="flex rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 text-[10px]">
                {(['orders', 'revenue'] as const).map(mode => (
                  <button
                    key={mode}
                    className={cn(
                      'px-2 py-0.5 font-semibold transition-colors',
                      chartMode === mode
                        ? 'bg-matcha-600 text-white'
                        : 'bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400',
                    )}
                    onClick={() => setChartMode(mode)}
                  >
                    {mode === 'orders' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.hourly} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => chartMode === 'revenue' ? fmt(v) : String(v)}
                    labelFormatter={l => `${l}:00 Uhr`}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                    {stats.hourly.map((entry, i) => (
                      <Cell key={i} fill={entry.hour === new Date().getHours() ? '#c47a2f' : barColor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Zones */}
          {stats.topZones.length > 0 && (
            <div className="px-4 pb-4 bg-white dark:bg-stone-900 border-t border-stone-100 dark:border-stone-800">
              <div className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2 mt-3">Top Lieferzonen</div>
              <div className="space-y-1.5">
                {stats.topZones.map((z, i) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <div className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-black bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-stone-700 dark:text-stone-200 truncate">
                          <MapPin className="w-2.5 h-2.5 shrink-0 text-stone-400" />
                          {z.zone}
                        </div>
                        <span className="text-[10px] text-stone-500 shrink-0">{z.orders} · {fmt(z.revenue)}</span>
                      </div>
                      <div className="w-full h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                          style={{ width: `${(z.orders / maxZoneOrders) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!stats && open && (
        <div className="text-center py-8 text-stone-400 dark:text-stone-500 text-sm bg-white dark:bg-stone-900">
          Lade Statistiken…
        </div>
      )}
    </div>
  );
}
