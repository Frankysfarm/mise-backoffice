'use client';

/**
 * Phase 2527 — Statistiken-Kommandant (Lieferdienst)
 *
 * Umfassendes Statistik-Dashboard mit 8 KPI-Kacheln (Ampel-Farbkodierung),
 * Stundenverlauf-Chart (Bestellungen/Umsatz), Zonen-Ranking Top-5,
 * Trend-Vergleich VW, Alert-Strip. 5-Min-Polling.
 */

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronUp,
  Clock, Euro, MapPin, TrendingDown, TrendingUp, Users,
} from 'lucide-react';

interface HourBucket { h: string; orders: number; umsatz: number }
interface ZoneRow { zone: string; orders: number; ontime_pct: number }
interface KpiTile {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  ampel: 'green' | 'amber' | 'red' | 'neutral';
  icon: React.ElementType;
}

type Props = { locationId?: string | null };

function ampel(val: number, green: number, amber: number, dir: 'asc' | 'desc' = 'desc'): 'green' | 'amber' | 'red' {
  if (dir === 'desc') return val >= green ? 'green' : val >= amber ? 'amber' : 'red';
  return val <= green ? 'green' : val <= amber ? 'amber' : 'red';
}

const BG: Record<string, string> = {
  green:   'bg-matcha-50  dark:bg-matcha-950/30  border-matcha-200 dark:border-matcha-800',
  amber:   'bg-amber-50   dark:bg-amber-950/30   border-amber-200  dark:border-amber-800',
  red:     'bg-red-50     dark:bg-red-950/30     border-red-200    dark:border-red-800',
  neutral: 'bg-muted/30   border-border',
};
const TXT: Record<string, string> = {
  green:   'text-matcha-700 dark:text-matcha-300',
  amber:   'text-amber-700  dark:text-amber-300',
  red:     'text-red-700    dark:text-red-300',
  neutral: 'text-foreground',
};

function KpiCard({ tile }: { tile: KpiTile }) {
  const Icon = tile.icon;
  return (
    <div className={cn('rounded-xl border p-3', BG[tile.ampel])}>
      <div className="flex items-start justify-between mb-1.5">
        <Icon className={cn('h-4 w-4', TXT[tile.ampel])} />
        {tile.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-500" />}
        {tile.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
      </div>
      <div className={cn('text-lg font-black tabular-nums', TXT[tile.ampel])}>{tile.value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{tile.label}</div>
      {tile.sub && <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{tile.sub}</div>}
    </div>
  );
}

export function LieferdienstPhase2527StatistikKommandant({ locationId }: Props) {
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [chartMode, setChartMode] = useState<'orders' | 'umsatz'>('orders');
  const [kpis, setKpis] = useState<KpiTile[]>([]);
  const [hours, setHours] = useState<HourBucket[]>([]);
  const [zones, setZones] = useState<ZoneRow[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const supabase = createClient();

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

    const q = (from: Date, to: Date) => supabase
      .from('customer_orders')
      .select('id, gesamtbetrag, status, fertig_am, bestellt_am, zahlungsart, delivery_zone, storno_grund, lieferzeit_min')
      .eq('typ', 'lieferung')
      .gte('bestellt_am', from.toISOString())
      .lt('bestellt_am', to.toISOString());

    const [{ data: todayOrders }, { data: ystOrders }] = await Promise.all([
      q(today, new Date(today.getTime() + 86_400_000)),
      q(yesterday, today),
    ]);

    const now = new Date();
    const all = (todayOrders ?? []) as any[];
    const vw = (ystOrders ?? []) as any[];

    // KPIs
    const total = all.length;
    const totalVw = vw.length;
    const umsatz = all.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
    const umsatzVw = vw.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
    const storniert = all.filter((o: any) => o.status === 'storniert').length;
    const stornoVw = vw.filter((o: any) => o.status === 'storniert').length;
    const stornoQuote = total > 0 ? (storniert / total) * 100 : 0;
    const delivered = all.filter((o: any) => o.status === 'geliefert');
    const avgLieferzeit = delivered.length > 0
      ? delivered.reduce((s: number, o: any) => s + (o.lieferzeit_min ?? 35), 0) / delivered.length
      : 0;
    const ontime = delivered.filter((o: any) => (o.lieferzeit_min ?? 35) <= 45).length;
    const ontimeQuote = delivered.length > 0 ? (ontime / delivered.length) * 100 : 100;
    const avgUmsatz = total > 0 ? umsatz / total : 0;
    const barOrders = all.filter((o: any) => o.zahlungsart === 'bar').length;
    const barQuote = total > 0 ? (barOrders / total) * 100 : 0;
    const activeDrivers = new Set(all.filter((o: any) => o.status === 'unterwegs').map((o: any) => o.fahrer_id)).size;

    // Trend helpers
    const trend = (cur: number, prev: number): 'up' | 'down' | 'flat' =>
      cur > prev * 1.05 ? 'up' : cur < prev * 0.95 ? 'down' : 'flat';

    const tiles: KpiTile[] = [
      {
        label: 'Bestellungen', value: String(total),
        sub: `VW: ${totalVw}`, trend: trend(total, totalVw),
        ampel: ampel(total, 30, 15), icon: BarChart3,
      },
      {
        label: 'Umsatz', value: umsatz.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
        sub: `VW: ${umsatzVw.toFixed(0)} €`, trend: trend(umsatz, umsatzVw),
        ampel: ampel(umsatz, 500, 200), icon: Euro,
      },
      {
        label: 'Storno-Quote', value: `${stornoQuote.toFixed(1)} %`,
        sub: stornoQuote > 10 ? '⚠ Hoch' : 'OK', trend: trend(stornoVw, storniert),
        ampel: ampel(stornoQuote, 5, 10, 'asc'), icon: AlertTriangle,
      },
      {
        label: 'Ø Lieferzeit', value: avgLieferzeit > 0 ? `${avgLieferzeit.toFixed(0)} Min` : '—',
        sub: avgLieferzeit > 45 ? '⚠ Über Ziel' : '✓ Im Plan',
        ampel: avgLieferzeit === 0 ? 'neutral' : ampel(avgLieferzeit, 35, 45, 'asc'), icon: Clock,
      },
      {
        label: 'On-Time-Quote', value: `${ontimeQuote.toFixed(0)} %`,
        sub: `${ontime}/${delivered.length} pünktlich`,
        ampel: ampel(ontimeQuote, 85, 70), icon: CheckCircle2,
      },
      {
        label: 'Ø Bestellwert', value: avgUmsatz > 0 ? `${avgUmsatz.toFixed(2)} €` : '—',
        ampel: ampel(avgUmsatz, 18, 12), icon: TrendingUp,
      },
      {
        label: 'Bar-Quote', value: `${barQuote.toFixed(0)} %`,
        sub: `${barOrders} Baraufträge`,
        ampel: barQuote > 40 ? 'amber' : 'neutral', icon: Euro,
      },
      {
        label: 'Aktive Fahrer', value: String(activeDrivers > 0 ? activeDrivers : '—'),
        ampel: activeDrivers === 0 ? 'red' : activeDrivers < 2 ? 'amber' : 'green', icon: Users,
      },
    ];
    setKpis(tiles);

    // Hourly buckets (last 12h)
    const buckets: Record<string, HourBucket> = {};
    for (let h = 0; h < 24; h++) {
      const key = String(h).padStart(2, '0');
      buckets[key] = { h: `${key}h`, orders: 0, umsatz: 0 };
    }
    all.forEach((o: any) => {
      if (!o.bestellt_am) return;
      const key = String(new Date(o.bestellt_am).getHours()).padStart(2, '0');
      if (buckets[key]) {
        buckets[key].orders++;
        buckets[key].umsatz += o.gesamtbetrag ?? 0;
      }
    });
    const nowH = now.getHours();
    const hourArr = Object.values(buckets).slice(Math.max(0, nowH - 11), nowH + 1);
    setHours(hourArr);

    // Zones
    const zoneMap: Record<string, { orders: number; ontime: number; total: number }> = {};
    all.forEach((o: any) => {
      const z = o.delivery_zone ?? 'Unbekannt';
      if (!zoneMap[z]) zoneMap[z] = { orders: 0, ontime: 0, total: 0 };
      zoneMap[z].orders++;
      if (o.status === 'geliefert') {
        zoneMap[z].total++;
        if ((o.lieferzeit_min ?? 35) <= 45) zoneMap[z].ontime++;
      }
    });
    const zoneArr: ZoneRow[] = Object.entries(zoneMap)
      .map(([zone, d]) => ({ zone, orders: d.orders, ontime_pct: d.total > 0 ? (d.ontime / d.total) * 100 : 100 }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5);
    setZones(zoneArr);

    // Alerts
    const al: string[] = [];
    if (stornoQuote > 10) al.push(`⚠ Storno-Quote ${stornoQuote.toFixed(1)}% — über Ziel`);
    if (avgLieferzeit > 45) al.push(`⚠ Ø Lieferzeit ${avgLieferzeit.toFixed(0)} Min — über 45 Min`);
    if (ontimeQuote < 75) al.push(`⚠ On-Time-Quote ${ontimeQuote.toFixed(0)}% — unter Ziel`);
    if (activeDrivers === 0 && total > 0) al.push('⚠ Keine aktiven Fahrer bei laufenden Bestellungen');
    setAlerts(al);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-5 animate-pulse">
        <div className="h-5 w-56 bg-muted rounded mb-4" />
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
        </div>
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  const barColor = (b: HourBucket) => {
    const val = chartMode === 'orders' ? b.orders : b.umsatz;
    const max = Math.max(...hours.map(x => chartMode === 'orders' ? x.orders : x.umsatz), 1);
    const pct = val / max;
    return pct > 0.7 ? '#6a9e5f' : pct > 0.4 ? '#f59e0b' : '#d6d3d1';
  };

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 rounded-t-2xl transition"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 dark:bg-matcha-900">
            <BarChart3 className="h-3.5 w-3.5 text-matcha-700 dark:text-matcha-300" />
          </div>
          <span className="text-sm font-bold text-foreground">Statistiken-Kommandant</span>
          {alerts.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alerts.length} Alert{alerts.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-4">
          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 space-y-1">
              {alerts.map(a => (
                <div key={a} className="text-[11px] font-semibold text-red-700 dark:text-red-300">{a}</div>
              ))}
            </div>
          )}

          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {kpis.map(t => <KpiCard key={t.label} tile={t} />)}
          </div>

          {/* Chart */}
          {hours.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-muted-foreground">Stundenverlauf (letzte 12h)</span>
                <div className="flex gap-1">
                  {(['orders', 'umsatz'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setChartMode(m)}
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold transition',
                        chartMode === m ? 'bg-matcha-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                      )}
                    >
                      {m === 'orders' ? 'Bestellungen' : 'Umsatz'}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={hours} barSize={12} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="h" tick={{ fontSize: 9, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                    formatter={(v: any) => chartMode === 'umsatz' ? [`${Number(v).toFixed(2)} €`, 'Umsatz'] : [v, 'Bestellungen']}
                  />
                  <Bar dataKey={chartMode} radius={[3, 3, 0, 0]}>
                    {hours.map((b, i) => <Cell key={i} fill={barColor(b)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Zones */}
          {zones.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Top-Zonen
              </div>
              <div className="space-y-1.5">
                {zones.map((z, i) => (
                  <div key={z.zone} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2">
                    <span className="text-[10px] font-black text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <span className="text-[11px] font-semibold text-foreground flex-1 truncate">{z.zone}</span>
                    <span className="text-[11px] font-black text-foreground tabular-nums">{z.orders}</span>
                    <span className={cn(
                      'text-[10px] font-bold tabular-nums shrink-0',
                      z.ontime_pct >= 85 ? 'text-matcha-600' : z.ontime_pct >= 70 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      {z.ontime_pct.toFixed(0)}%
                    </span>
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
