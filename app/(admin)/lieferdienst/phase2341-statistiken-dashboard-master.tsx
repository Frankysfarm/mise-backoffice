'use client';

/**
 * Phase 2341 — Statistiken Dashboard Master
 * 10 KPI-Kacheln mit Ampel-Farbkodierung, Stunden-Chart (Umsatz/Bestellungen),
 * Zonen-Ranking, Alert-Strip. 2-Min-Polling.
 */

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle,
  Euro, Clock, Star, XCircle, Bike, Target, Package,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface KpiCard {
  key: string;
  label: string;
  value: string;
  sub: string;
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'up' | 'down' | 'flat';
  delta: string;
}

interface HourBucket {
  hour: string;
  umsatz: number;
  bestellungen: number;
}

interface ZoneRank {
  zone: string;
  orders: number;
  avgMin: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface DashData {
  kpis: KpiCard[];
  hours: HourBucket[];
  zones: ZoneRank[];
  alerts: string[];
}

const AMPEL_STYLES = {
  gruen: { bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200', val: 'text-emerald-700', dot: 'bg-emerald-500' },
  gelb:  { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200',   val: 'text-amber-700',   dot: 'bg-amber-400' },
  rot:   { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200',         val: 'text-red-700',     dot: 'bg-red-500' },
};

function TrendIcon({ trend }: { trend: KpiCard['trend'] }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

async function fetchDashData(sb: ReturnType<typeof createClient>): Promise<DashData> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: orders } = await sb
    .from('customer_orders')
    .select('id, status, total, bestellt_am, lieferzeit_min, bewertung, lieferzone')
    .gte('bestellt_am', todayStart.toISOString());

  const allOrders = (orders ?? []) as any[];
  const delivered = allOrders.filter((o: any) => o.status === 'geliefert');
  const cancelled = allOrders.filter((o: any) => o.status === 'storniert');
  const total = allOrders.length;

  const umsatz = delivered.reduce((a: number, o: any) => a + (o.total ?? 0), 0);
  const avgLieferzeit = delivered.length > 0
    ? Math.round(delivered.reduce((a: number, o: any) => a + (o.lieferzeit_min ?? 30), 0) / delivered.length)
    : 0;
  const avgBewertung = delivered.filter((o: any) => o.bewertung).length > 0
    ? (delivered.filter((o: any) => o.bewertung).reduce((a: number, o: any) => a + o.bewertung, 0) / delivered.filter((o: any) => o.bewertung).length)
    : 0;
  const stornoQuote = total > 0 ? Math.round((cancelled.length / total) * 100) : 0;
  const onTimeQuote = delivered.length > 0
    ? Math.round((delivered.filter((o: any) => (o.lieferzeit_min ?? 99) <= 30).length / delivered.length) * 100)
    : 100;

  const { data: drivers } = await sb
    .from('employees')
    .select('id, driver_status(ist_online)')
    .eq('rolle', 'fahrer')
    .eq('aktiv', true);

  const activeFahrer = (drivers ?? []).filter((d: any) => d.driver_status?.ist_online).length;
  const totalFahrer = (drivers ?? []).length;

  const kpis: KpiCard[] = [
    {
      key: 'umsatz', label: 'Umsatz heute', value: `€${umsatz.toFixed(0)}`,
      sub: `${delivered.length} Lieferungen`,
      ampel: umsatz >= 500 ? 'gruen' : umsatz >= 200 ? 'gelb' : 'rot',
      trend: 'up', delta: '',
    },
    {
      key: 'bestellungen', label: 'Bestellungen', value: `${total}`,
      sub: `${delivered.length} geliefert`,
      ampel: total >= 30 ? 'gruen' : total >= 10 ? 'gelb' : 'rot',
      trend: 'flat', delta: '',
    },
    {
      key: 'lieferzeit', label: 'Ø Lieferzeit', value: `${avgLieferzeit} min`,
      sub: 'Ziel: ≤30 min',
      ampel: avgLieferzeit <= 25 ? 'gruen' : avgLieferzeit <= 35 ? 'gelb' : 'rot',
      trend: avgLieferzeit <= 25 ? 'up' : 'down', delta: '',
    },
    {
      key: 'ontime', label: 'On-Time-Rate', value: `${onTimeQuote}%`,
      sub: 'Ziel: ≥90%',
      ampel: onTimeQuote >= 90 ? 'gruen' : onTimeQuote >= 75 ? 'gelb' : 'rot',
      trend: onTimeQuote >= 90 ? 'up' : 'down', delta: '',
    },
    {
      key: 'storno', label: 'Storno-Quote', value: `${stornoQuote}%`,
      sub: `${cancelled.length} storniert`,
      ampel: stornoQuote <= 3 ? 'gruen' : stornoQuote <= 8 ? 'gelb' : 'rot',
      trend: stornoQuote <= 3 ? 'up' : 'down', delta: '',
    },
    {
      key: 'bewertung', label: 'Ø Bewertung', value: avgBewertung > 0 ? `${avgBewertung.toFixed(1)}★` : '–',
      sub: 'Ziel: ≥4,5★',
      ampel: avgBewertung >= 4.5 ? 'gruen' : avgBewertung >= 3.5 ? 'gelb' : 'rot',
      trend: avgBewertung >= 4.5 ? 'up' : 'down', delta: '',
    },
    {
      key: 'fahrer', label: 'Fahrer online', value: `${activeFahrer}/${totalFahrer}`,
      sub: 'Aktive Fahrer',
      ampel: activeFahrer >= 3 ? 'gruen' : activeFahrer >= 1 ? 'gelb' : 'rot',
      trend: 'flat', delta: '',
    },
    {
      key: 'offene', label: 'Offene Orders', value: `${allOrders.filter((o: any) => ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'].includes(o.status)).length}`,
      sub: 'In Bearbeitung',
      ampel: 'gelb',
      trend: 'flat', delta: '',
    },
  ];

  // Stunden-Buckets
  const hours: HourBucket[] = [];
  for (let h = 0; h <= new Date().getHours(); h++) {
    const bucket = delivered.filter((o: any) => {
      const d = new Date(o.bestellt_am);
      return d.getHours() === h;
    });
    hours.push({
      hour: `${h}:00`,
      umsatz: Math.round(bucket.reduce((a: number, o: any) => a + (o.total ?? 0), 0)),
      bestellungen: bucket.length,
    });
  }

  // Zonen-Ranking
  const zoneMap = new Map<string, { orders: number; sumMin: number }>();
  delivered.forEach((o: any) => {
    const z = o.lieferzone ?? 'Sonstige';
    const cur = zoneMap.get(z) ?? { orders: 0, sumMin: 0 };
    zoneMap.set(z, { orders: cur.orders + 1, sumMin: cur.sumMin + (o.lieferzeit_min ?? 30) });
  });
  const zones: ZoneRank[] = Array.from(zoneMap.entries())
    .map(([zone, d]) => {
      const avgMin = Math.round(d.sumMin / d.orders);
      return {
        zone,
        orders: d.orders,
        avgMin,
        ampel: avgMin <= 25 ? 'gruen' : avgMin <= 35 ? 'gelb' : 'rot' as any,
      };
    })
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  const alerts: string[] = [];
  if (stornoQuote > 8) alerts.push(`Storno-Quote ${stornoQuote}% — über Ziel!`);
  if (avgLieferzeit > 35) alerts.push(`Ø Lieferzeit ${avgLieferzeit} min — Engpass?`);
  if (onTimeQuote < 75) alerts.push(`On-Time-Rate ${onTimeQuote}% — zu niedrig!`);
  if (avgBewertung > 0 && avgBewertung < 3.5) alerts.push(`Bewertung ${avgBewertung.toFixed(1)}★ — Qualitätsproblem!`);

  return { kpis, hours, zones, alerts };
}

type ChartMode = 'umsatz' | 'bestellungen';

export function LieferdienstPhase2341StatistikDashboardMaster() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<ChartMode>('umsatz');
  const [showZones, setShowZones] = useState(false);

  const load = useCallback(async () => {
    const sb = createClient();
    try {
      const d = await fetchDashData(sb);
      setData(d);
    } catch (e) {
      // silently handle
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading || !data) {
    return (
      <div className="rounded-xl border bg-card p-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
        <BarChart2 className="h-4 w-4 animate-pulse" /> Lade Statistiken…
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Statistiken · Dashboard</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Heute · 2-Min-Update</span>
      </div>

      {/* Alert strip */}
      {data.alerts.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto bg-red-50 dark:bg-red-950/30 px-4 py-2 border-b border-red-200">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <div className="flex gap-3 text-[10px] font-semibold text-red-700 whitespace-nowrap">
            {data.alerts.map((a, i) => <span key={i}>{a}</span>)}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
        {data.kpis.map(kpi => {
          const st = AMPEL_STYLES[kpi.ampel];
          return (
            <div key={kpi.key} className={cn('rounded-xl border p-3', st.bg)}>
              <div className="flex items-center justify-between mb-1">
                <div className={cn('h-2 w-2 rounded-full', st.dot)} />
                <TrendIcon trend={kpi.trend} />
              </div>
              <div className={cn('text-lg font-black tabular-nums', st.val)}>{kpi.value}</div>
              <div className="text-[10px] font-semibold text-muted-foreground">{kpi.label}</div>
              <div className="text-[9px] text-muted-foreground mt-0.5">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Chart */}
      <div className="px-4 pb-3 border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {chartMode === 'umsatz' ? 'Stundenumsatz heute' : 'Bestellungen/Stunde'}
          </span>
          <div className="flex gap-1">
            {(['umsatz', 'bestellungen'] as ChartMode[]).map(m => (
              <button
                key={m}
                onClick={() => setChartMode(m)}
                className={cn(
                  'text-[9px] px-2 py-0.5 rounded-full font-bold transition-colors',
                  chartMode === m
                    ? 'bg-matcha-600 text-white'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {m === 'umsatz' ? '€' : '#'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <BarChart data={data.hours} margin={{ top: 2, right: 2, left: -20, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 8 }} interval={2} />
            <Tooltip
              formatter={((v: number) => chartMode === 'umsatz' ? `€${v}` : `${v} Bestellungen`) as any}
              labelStyle={{ fontSize: 10 }}
              contentStyle={{ fontSize: 10 }}
            />
            <Bar dataKey={chartMode} radius={[2, 2, 0, 0]}>
              {data.hours.map((h, i) => (
                <Cell key={i} fill={h[chartMode] > 0 ? '#4d7c0f' : '#e5e7eb'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zones toggle */}
      {data.zones.length > 0 && (
        <div className="border-t">
          <button
            className="w-full flex items-center justify-between px-4 py-2 text-[11px] font-bold text-muted-foreground hover:bg-muted/30 transition-colors"
            onClick={() => setShowZones(v => !v)}
          >
            <span>Zonen-Ranking ({data.zones.length})</span>
            {showZones ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showZones && (
            <div className="divide-y border-t">
              {data.zones.map((z, i) => {
                const st = AMPEL_STYLES[z.ampel];
                return (
                  <div key={z.zone} className={cn('flex items-center gap-3 px-4 py-2', st.bg)}>
                    <span className="text-[10px] font-black text-muted-foreground w-4">{i + 1}.</span>
                    <div className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />
                    <span className="text-xs font-bold flex-1 truncate">{z.zone}</span>
                    <span className="text-[10px] font-semibold text-muted-foreground">{z.orders} Auftr.</span>
                    <span className={cn('text-[10px] font-bold tabular-nums', st.val)}>{z.avgMin} min</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
