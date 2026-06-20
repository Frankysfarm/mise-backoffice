'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, Minus, RefreshCw, Target, Award, Clock } from 'lucide-react';

interface WeekDay {
  label: string;
  date: string;
  orders: number;
  revenue: number;
  onTimePct: number | null;
  avgMin: number | null;
}

interface WeekSummary {
  days: WeekDay[];
  totalOrders: number;
  totalRevenue: number;
  avgOnTimePct: number | null;
  peakDay: string | null;
  vs7dAgoOrders: number | null;
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function LieferdienstWochenKpiVergleich({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<WeekSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'umsatz' | 'bestellungen' | 'pünktlichkeit'>('umsatz');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const sb = createClient();
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1));
      startOfWeek.setHours(0, 0, 0, 0);

      const prev7Start = new Date(startOfWeek.getTime() - 7 * 86_400_000);

      const [{ data: thisWeek }, { data: lastWeek }] = await Promise.all([
        sb.from('customer_orders')
          .select('bestellt_am, gesamtbetrag, geliefert_am, eta_latest, status')
          .eq('location_id', locationId)
          .gte('bestellt_am', startOfWeek.toISOString())
          .not('status', 'in', '("storniert","abgebrochen")'),
        sb.from('customer_orders')
          .select('bestellt_am, gesamtbetrag')
          .eq('location_id', locationId)
          .gte('bestellt_am', prev7Start.toISOString())
          .lt('bestellt_am', startOfWeek.toISOString())
          .not('status', 'in', '("storniert","abgebrochen")'),
      ]);

      const rows = (thisWeek ?? []) as any[];
      const prevRows = (lastWeek ?? []) as any[];

      // Aggregate by weekday
      const byDay: Record<number, { orders: number; revenue: number; onTimeCount: number; totalOnTime: number; sumMin: number; minCount: number }> = {};
      for (let d = 0; d < 7; d++) byDay[d] = { orders: 0, revenue: 0, onTimeCount: 0, totalOnTime: 0, sumMin: 0, minCount: 0 };

      for (const r of rows) {
        const dow = new Date(r.bestellt_am).getDay();
        const idx = dow === 0 ? 6 : dow - 1;
        byDay[idx].orders++;
        byDay[idx].revenue += Number(r.gesamtbetrag ?? 0);
        if (r.geliefert_am && r.eta_latest) {
          byDay[idx].totalOnTime++;
          if (new Date(r.geliefert_am) <= new Date(r.eta_latest)) byDay[idx].onTimeCount++;
        }
      }

      const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
        const d = byDay[i];
        const dayDate = new Date(startOfWeek.getTime() + i * 86_400_000);
        return {
          label: DAY_LABELS[i],
          date: dayDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
          orders: d.orders,
          revenue: d.revenue,
          onTimePct: d.totalOnTime > 0 ? Math.round((d.onTimeCount / d.totalOnTime) * 100) : null,
          avgMin: d.minCount > 0 ? Math.round(d.sumMin / d.minCount) : null,
        };
      });

      const totalOrders = rows.length;
      const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.gesamtbetrag ?? 0), 0);
      const onTimeRows = rows.filter((r: any) => r.geliefert_am && r.eta_latest);
      const onTimeCount = onTimeRows.filter((r: any) => new Date(r.geliefert_am) <= new Date(r.eta_latest)).length;
      const avgOnTimePct = onTimeRows.length > 0 ? Math.round((onTimeCount / onTimeRows.length) * 100) : null;
      const peakDayIdx = days.reduce((maxIdx, d, i, arr) => d.orders > arr[maxIdx].orders ? i : maxIdx, 0);
      const peakDay = days[peakDayIdx].orders > 0 ? DAY_LABELS[peakDayIdx] : null;

      const vs7dAgoOrders = prevRows.length > 0
        ? Math.round(((totalOrders - prevRows.length) / prevRows.length) * 100)
        : null;

      setData({ days, totalOrders, totalRevenue, avgOnTimePct, peakDay, vs7dAgoOrders });
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  if (!locationId) return null;

  const chartData = data?.days.map((d) => ({
    label: d.label,
    date: d.date,
    value: tab === 'umsatz' ? d.revenue : tab === 'bestellungen' ? d.orders : (d.onTimePct ?? 0),
  })) ?? [];

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const today = new Date().getDay();
  const todayIdx = today === 0 ? 6 : today - 1;

  const TrendIcon = data?.vs7dAgoOrders == null ? Minus :
    data.vs7dAgoOrders > 0 ? TrendingUp : TrendingDown;
  const trendColor = data?.vs7dAgoOrders == null ? 'text-white/40' :
    data.vs7dAgoOrders > 0 ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Wochen-KPI</span>
        </div>
        <div className="flex items-center gap-2">
          {data?.vs7dAgoOrders != null && (
            <span className={cn('flex items-center gap-0.5 text-xs font-bold', trendColor)}>
              <TrendIcon className="h-3.5 w-3.5" />
              {Math.abs(data.vs7dAgoOrders)}% vs. Vorwoche
            </span>
          )}
          <button onClick={load} disabled={loading} className="text-muted-foreground hover:text-foreground transition">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Summary KPIs */}
        {data && (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Bestellungen', value: data.totalOrders, icon: Target, sub: data.peakDay ? `Peak: ${data.peakDay}` : '' },
              { label: 'Umsatz', value: euro(data.totalRevenue), icon: Award, sub: `ø ${euro(data.totalOrders > 0 ? data.totalRevenue / data.totalOrders : 0)} / Bestell.` },
              { label: 'Pünktlich', value: data.avgOnTimePct != null ? `${data.avgOnTimePct}%` : '–', icon: Clock, sub: data.avgOnTimePct != null && data.avgOnTimePct >= 80 ? 'Sehr gut' : 'Verbesserbar' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border bg-muted/30 p-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <kpi.icon className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                </div>
                <div className="font-display text-base font-black text-foreground">{kpi.value}</div>
                <div className="text-[9px] text-muted-foreground">{kpi.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex rounded-lg border p-0.5 bg-muted/30 gap-0.5">
          {(['umsatz', 'bestellungen', 'pünktlichkeit'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t === 'umsatz' ? 'Umsatz' : t === 'bestellungen' ? 'Bestellungen' : 'Pünktlich'}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                formatter={(v) => { const n = Number(v); return tab === 'umsatz' ? euro(n) : tab === 'pünktlichkeit' ? `${n}%` : n; }}
                labelFormatter={(l, payload) => payload?.[0]?.payload?.date ?? l}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={i === todayIdx ? 'var(--matcha-600, #4a7c59)' : tab === 'pünktlichkeit' && entry.value > 0 && entry.value < 80 ? '#f59e0b' : 'var(--matcha-400, #6a9b77)'}
                    opacity={entry.value === 0 ? 0.3 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {!data && !loading && (
          <div className="text-sm text-muted-foreground text-center py-4">Keine Daten für diese Woche.</div>
        )}
      </div>
    </div>
  );
}
