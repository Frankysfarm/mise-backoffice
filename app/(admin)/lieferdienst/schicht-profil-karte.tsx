'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Activity, RefreshCw } from 'lucide-react';

interface HourBucket {
  hour: string;
  orders: number;
  revenue: number;
  avgEta: number | null;
}

interface ShiftKpi {
  totalOrders: number;
  totalRevenue: number;
  avgEtaMin: number | null;
  onTimePct: number | null;
  peakHour: string | null;
}

const CHART_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'];

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function KpiMini({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral' }) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const color = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-stone-400';
  return (
    <div className="bg-stone-50 rounded-xl p-3 space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-stone-500 font-medium">{label}</span>
        {trend && <Icon className={`h-3 w-3 ${color}`} />}
      </div>
      <div className="text-xl font-black text-stone-800 tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-stone-400">{sub}</div>}
    </div>
  );
}

export function SchichtProfilKarte({ locationId }: { locationId: string }) {
  const [buckets, setBuckets] = useState<HourBucket[]>([]);
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'orders' | 'revenue'>('orders');
  const [refreshAt, setRefreshAt] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const supabase = createClient();

      // Today's shift start: 10:00 local
      const now = new Date();
      const shiftStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0, 0);
      if (now < shiftStart) shiftStart.setDate(shiftStart.getDate() - 1);

      const { data, error } = await supabase
        .from('customer_orders')
        .select('created_at, gesamtbetrag, status, promised_delivery_min, actual_delivery_min')
        .eq('location_id', locationId)
        .gte('created_at', shiftStart.toISOString())
        .in('status', ['geliefert', 'delivered', 'completed', 'abgeschlossen']);

      if (!error && Array.isArray(data)) {
        const bucketMap: Record<string, { count: number; revenue: number; etas: number[] }> = {};

        data.forEach((o: any) => {
          const d = new Date(o.created_at);
          const h = d.getHours();
          const label = `${h.toString().padStart(2, '0')}:00`;
          if (!bucketMap[label]) bucketMap[label] = { count: 0, revenue: 0, etas: [] };
          bucketMap[label].count += 1;
          bucketMap[label].revenue += Number(o.gesamtbetrag ?? 0);
          if (o.actual_delivery_min) bucketMap[label].etas.push(Number(o.actual_delivery_min));
        });

        const sorted = Object.entries(bucketMap)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([hour, v]) => ({
            hour,
            orders: v.count,
            revenue: v.revenue,
            avgEta: v.etas.length > 0 ? Math.round(v.etas.reduce((a, b) => a + b, 0) / v.etas.length) : null,
          }));

        setBuckets(sorted);

        const totalOrders = data.length;
        const totalRevenue = data.reduce((s: number, o: any) => s + Number(o.gesamtbetrag ?? 0), 0);
        const allEtas = data.filter((o: any) => o.actual_delivery_min).map((o: any) => Number(o.actual_delivery_min));
        const avgEtaMin = allEtas.length > 0 ? Math.round(allEtas.reduce((a, b) => a + b, 0) / allEtas.length) : null;
        const onTime = data.filter((o: any) => o.actual_delivery_min && o.promised_delivery_min && o.actual_delivery_min <= o.promised_delivery_min).length;
        const onTimePct = totalOrders > 0 ? Math.round((onTime / totalOrders) * 100) : null;
        const peakBucket = sorted.length > 0 ? sorted.reduce((max, b) => b.orders > max.orders ? b : max, sorted[0]) : null;

        setKpi({ totalOrders, totalRevenue, avgEtaMin, onTimePct, peakHour: peakBucket?.hour ?? null });
      }
    } catch {
      // keep existing
    } finally {
      setLoading(false);
      setRefreshAt(Date.now());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-36 bg-stone-100 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
        <div className="h-28 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Schicht-Profil</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-stone-400">
            ab {new Date(Date.now()).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr Schicht
          </span>
          <button onClick={load} className="p-1 rounded-lg hover:bg-stone-200 transition text-stone-400">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI grid */}
        {kpi && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiMini
              label="Bestellungen"
              value={kpi.totalOrders.toString()}
              sub="heute abgeschl."
              trend={kpi.totalOrders > 20 ? 'up' : kpi.totalOrders > 5 ? 'neutral' : 'down'}
            />
            <KpiMini
              label="Umsatz"
              value={fmtEur(kpi.totalRevenue)}
              sub="abgeschl. Bes."
              trend={kpi.totalRevenue > 500 ? 'up' : 'neutral'}
            />
            <KpiMini
              label="Ø Lieferzeit"
              value={kpi.avgEtaMin !== null ? `${kpi.avgEtaMin} min` : '—'}
              sub="tatsächlich"
              trend={kpi.avgEtaMin !== null ? (kpi.avgEtaMin <= 35 ? 'up' : kpi.avgEtaMin <= 45 ? 'neutral' : 'down') : undefined}
            />
            <KpiMini
              label="Pünktlichkeit"
              value={kpi.onTimePct !== null ? `${kpi.onTimePct}%` : '—'}
              sub={kpi.peakHour ? `Peak: ${kpi.peakHour}` : 'heute'}
              trend={kpi.onTimePct !== null ? (kpi.onTimePct >= 80 ? 'up' : kpi.onTimePct >= 60 ? 'neutral' : 'down') : undefined}
            />
          </div>
        )}

        {/* Chart */}
        {buckets.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Stündliche Verteilung</span>
              <div className="flex items-center gap-1">
                {(['orders', 'revenue'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setChartMode(m)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${chartMode === m ? 'bg-matcha-600 text-white' : 'bg-stone-100 text-stone-500'}`}
                  >
                    {m === 'orders' ? 'Bestellungen' : 'Umsatz'}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={buckets} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} barSize={16}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => chartMode === 'revenue' ? fmtEur(v) : `${v} Bestellungen`}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                  />
                  <Bar dataKey={chartMode} radius={[4, 4, 0, 0]}>
                    {buckets.map((b, i) => (
                      <Cell key={b.hour} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {buckets.length === 0 && (
          <div className="h-16 flex items-center justify-center text-sm text-stone-400">
            Noch keine abgeschlossenen Bestellungen heute.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-stone-100 bg-stone-50">
        <span className="text-[10px] text-stone-400">
          Zuletzt aktualisiert: {new Date(refreshAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}
