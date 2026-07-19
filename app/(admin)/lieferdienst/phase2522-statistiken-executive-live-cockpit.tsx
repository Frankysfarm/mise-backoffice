'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, BarChart3, ChevronDown, ChevronUp,
  CheckCircle2, Clock, TrendingUp, Users, Euro,
} from 'lucide-react';

/**
 * Phase 2522 — Statistiken Executive Live-Cockpit (Lieferdienst)
 *
 * Kompakte Executive-Übersicht mit 10 KPI-Kacheln (Ampel),
 * Stunden-Chart (Umsatz/Bestellungen), Zonen-Top-3, Alert-Strip.
 * 2-Minuten-Polling via Supabase.
 */

interface KpiRow {
  label: string;
  value: string;
  sub?: string;
  color: 'green' | 'amber' | 'red' | 'neutral';
  icon: React.ElementType;
}

interface HourBucket {
  h: string;
  orders: number;
  umsatz: number;
}

interface ZoneRow {
  zone: string;
  orders: number;
  ontime_pct: number;
}

interface Props {
  locationId?: string | null;
}

function ampel(val: number, green: number, amber: number, direction: 'asc' | 'desc' = 'desc'): 'green' | 'amber' | 'red' {
  if (direction === 'desc') {
    if (val >= green) return 'green';
    if (val >= amber) return 'amber';
    return 'red';
  } else {
    if (val <= green) return 'green';
    if (val <= amber) return 'amber';
    return 'red';
  }
}

const AMPEL_BG: Record<string, string> = {
  green:   'bg-matcha-50  dark:bg-matcha-950/30  border-matcha-200 dark:border-matcha-800',
  amber:   'bg-amber-50   dark:bg-amber-950/30   border-amber-200  dark:border-amber-800',
  red:     'bg-red-50     dark:bg-red-950/30     border-red-200    dark:border-red-800',
  neutral: 'bg-muted/30   border-border',
};

const AMPEL_TEXT: Record<string, string> = {
  green:   'text-matcha-700 dark:text-matcha-300',
  amber:   'text-amber-700  dark:text-amber-300',
  red:     'text-red-700    dark:text-red-300',
  neutral: 'text-foreground',
};

const AMPEL_SUB: Record<string, string> = {
  green:   'text-matcha-500 dark:text-matcha-400',
  amber:   'text-amber-500  dark:text-amber-400',
  red:     'text-red-500    dark:text-red-400',
  neutral: 'text-muted-foreground',
};

export function LieferdienstPhase2522StatistikenExecutiveLiveCockpit({ locationId }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(true);
  const [chartMode, setChartMode] = useState<'orders' | 'umsatz'>('orders');
  const [kpis, setKpis] = useState<KpiRow[]>([]);
  const [hours, setHours] = useState<HourBucket[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      let q = supabase
        .from('customer_orders')
        .select('id,status,gesamtbetrag,bestellt_am,delivery_zone,eta_earliest,geliefert_am,storniert_am', { count: 'exact' })
        .gte('bestellt_am', todayIso);
      if (locationId) q = q.eq('location_id', locationId);
      const { data: rawOrders } = await q;
      const orders = rawOrders ?? [];

      const total = orders.length;
      const delivered = orders.filter(o => ['geliefert', 'abgeschlossen'].includes(o.status)).length;
      const storniert = orders.filter(o => o.status === 'storniert').length;
      const umsatzCt = orders.filter(o => !['storniert'].includes(o.status)).reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
      const stornoPct = total > 0 ? Math.round((storniert / total) * 100) : 0;

      // Pünktlichkeit
      const mitEta = orders.filter(o => o.geliefert_am && o.eta_earliest);
      const puenktlich = mitEta.filter(o => {
        const diff = new Date(o.geliefert_am!).getTime() - new Date(o.eta_earliest!).getTime();
        return diff <= 5 * 60_000;
      }).length;
      const puentPct = mitEta.length > 0 ? Math.round((puenktlich / mitEta.length) * 100) : null;

      // Ø Lieferzeit
      const withTimes = orders.filter(o => o.geliefert_am && o.bestellt_am);
      const avgMinArr = withTimes.map(o =>
        (new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000
      );
      const avgMin = avgMinArr.length > 0 ? Math.round(avgMinArr.reduce((a, b) => a + b, 0) / avgMinArr.length) : null;

      // Aktive Fahrer
      let activeDrivers = 0;
      try {
        const { count } = await supabase
          .from('mise_drivers')
          .select('id', { count: 'exact', head: true })
          .eq('is_online', true);
        activeDrivers = count ?? 0;
      } catch {}

      // Stündliche Verteilung
      const buckets: Record<number, { orders: number; umsatz: number }> = {};
      for (const o of orders) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        buckets[h] = buckets[h] ?? { orders: 0, umsatz: 0 };
        buckets[h].orders += 1;
        if (!['storniert'].includes(o.status)) buckets[h].umsatz += (o.gesamtbetrag ?? 0);
      }
      const nowH = new Date().getHours();
      const hourBuckets: HourBucket[] = [];
      for (let h = 10; h <= Math.max(nowH, 22); h++) {
        hourBuckets.push({ h: `${h}h`, orders: buckets[h]?.orders ?? 0, umsatz: Math.round((buckets[h]?.umsatz ?? 0) / 100) });
      }
      setHours(hourBuckets);

      // Zonen-Ranking
      const zoneMap: Record<string, { orders: number; puenktlich: number; mit: number }> = {};
      for (const o of orders) {
        const z = o.delivery_zone ?? 'Unbekannt';
        zoneMap[z] = zoneMap[z] ?? { orders: 0, puenktlich: 0, mit: 0 };
        zoneMap[z].orders += 1;
        if (o.geliefert_am && o.eta_earliest) {
          zoneMap[z].mit += 1;
          const diff = new Date(o.geliefert_am).getTime() - new Date(o.eta_earliest).getTime();
          if (diff <= 5 * 60_000) zoneMap[z].puenktlich += 1;
        }
      }
      const zoneRows: ZoneRow[] = Object.entries(zoneMap)
        .map(([zone, d]) => ({
          zone,
          orders: d.orders,
          ontime_pct: d.mit > 0 ? Math.round((d.puenktlich / d.mit) * 100) : 0,
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);
      setZones(zoneRows);

      // KPIs
      const kpiList: KpiRow[] = [
        {
          label: 'Bestellungen',
          value: total.toString(),
          sub: `${delivered} geliefert`,
          color: total >= 20 ? 'green' : total >= 10 ? 'amber' : 'neutral',
          icon: BarChart3,
        },
        {
          label: 'Umsatz',
          value: (umsatzCt / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }),
          sub: `Ø ${total > 0 ? Math.round((umsatzCt / 100) / total * 100) / 100 : 0} € / Bestellung`,
          color: umsatzCt / 100 >= 500 ? 'green' : umsatzCt / 100 >= 200 ? 'amber' : 'neutral',
          icon: Euro,
        },
        {
          label: 'Pünktlichkeit',
          value: puentPct !== null ? `${puentPct}%` : '—',
          sub: `${puenktlich}/${mitEta.length} pünktlich`,
          color: puentPct !== null ? ampel(puentPct, 90, 75) : 'neutral',
          icon: CheckCircle2,
        },
        {
          label: 'Ø Lieferzeit',
          value: avgMin !== null ? `${avgMin} min` : '—',
          sub: `${withTimes.length} gemessen`,
          color: avgMin !== null ? ampel(avgMin, 30, 45, 'asc') : 'neutral',
          icon: Clock,
        },
        {
          label: 'Storno-Quote',
          value: `${stornoPct}%`,
          sub: `${storniert} storniert`,
          color: ampel(stornoPct, 5, 10, 'asc'),
          icon: AlertTriangle,
        },
        {
          label: 'Aktive Fahrer',
          value: activeDrivers.toString(),
          sub: `Online jetzt`,
          color: activeDrivers >= 3 ? 'green' : activeDrivers >= 1 ? 'amber' : 'red',
          icon: Users,
        },
        {
          label: 'Lieferungen/h',
          value: (() => {
            const activeH = Math.max(1, nowH - 10);
            return (delivered / activeH).toFixed(1);
          })(),
          sub: `${delivered} gesamt`,
          color: delivered >= 5 ? 'green' : delivered >= 2 ? 'amber' : 'neutral',
          icon: TrendingUp,
        },
        {
          label: 'Aktiv',
          value: orders.filter(o => !['geliefert', 'storniert', 'abgeschlossen'].includes(o.status)).length.toString(),
          sub: `Offene Bestellungen`,
          color: 'neutral',
          icon: TrendingUp,
        },
      ];
      setKpis(kpiList);

      // Alerts
      const a: string[] = [];
      if (stornoPct > 10) a.push(`Storno-Quote ${stornoPct}% — über 10%`);
      if (avgMin !== null && avgMin > 45) a.push(`Ø Lieferzeit ${avgMin} min — über 45 Min`);
      if (puentPct !== null && puentPct < 75) a.push(`Pünktlichkeit ${puentPct}% — unter 75%`);
      if (activeDrivers === 0 && total > 0) a.push('Kein Fahrer online');
      setAlerts(a);
    } catch {}
    finally { setLoading(false); }
  }, [locationId, supabase]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const iv = setInterval(load, 2 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && kpis.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="h-4 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-2">
          {[1,2,3,4].map(i => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  const chartData = hours;
  const maxBar = Math.max(...chartData.map(d => chartMode === 'orders' ? d.orders : d.umsatz), 1);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold uppercase tracking-wider">Executive Live-Cockpit</span>
          {alerts.length > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-black flex items-center gap-1 animate-pulse">
              <AlertTriangle className="h-3 w-3" /> {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 pb-4 space-y-4 pt-3">
          {/* Alert-Strip */}
          {alerts.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3 py-2 space-y-1">
              {alerts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-bold text-red-700 dark:text-red-300">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {a}
                </div>
              ))}
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {kpis.map(kpi => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className={cn('rounded-xl border px-3 py-2.5', AMPEL_BG[kpi.color])}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn('h-3 w-3 shrink-0', AMPEL_TEXT[kpi.color])} />
                    <span className={cn('text-[9px] font-bold uppercase tracking-wider', AMPEL_SUB[kpi.color])}>
                      {kpi.label}
                    </span>
                  </div>
                  <div className={cn('text-base font-black tabular-nums leading-none', AMPEL_TEXT[kpi.color])}>
                    {kpi.value}
                  </div>
                  {kpi.sub && (
                    <div className={cn('text-[9px] mt-0.5', AMPEL_SUB[kpi.color])}>{kpi.sub}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stunden-Chart */}
          {chartData.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stundenverlauf</span>
                <div className="flex rounded-full border overflow-hidden ml-auto">
                  {(['orders', 'umsatz'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setChartMode(mode)}
                      className={cn(
                        'px-2 py-0.5 text-[9px] font-bold transition',
                        chartMode === mode
                          ? 'bg-matcha-600 text-white'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {mode === 'orders' ? 'Bestellungen' : 'Umsatz €'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <XAxis dataKey="h" tick={{ fontSize: 8 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(v: number) => chartMode === 'umsatz' ? [`${v} €`, 'Umsatz'] : [v, 'Bestellungen']}
                      contentStyle={{ fontSize: 10 }}
                    />
                    <Bar dataKey={chartMode} radius={[3, 3, 0, 0]} maxBarSize={24}>
                      {chartData.map((d, i) => {
                        const val = chartMode === 'orders' ? d.orders : d.umsatz;
                        const pct = val / maxBar;
                        const fill = pct >= 0.7 ? '#4ade80' : pct >= 0.4 ? '#fbbf24' : '#6b7280';
                        return <Cell key={i} fill={fill} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Zonen-Ranking */}
          {zones.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Top-Zonen</div>
              <div className="space-y-1.5">
                {zones.map(z => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[10px] font-bold text-foreground truncate">{z.zone}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          z.ontime_pct >= 90 ? 'bg-matcha-500' : z.ontime_pct >= 75 ? 'bg-amber-400' : 'bg-red-400'
                        )}
                        style={{ width: `${z.ontime_pct}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-[10px] font-bold text-muted-foreground tabular-nums">{z.orders}</span>
                    <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums text-foreground">{z.ontime_pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
