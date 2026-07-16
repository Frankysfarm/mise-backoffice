'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus, Users, Clock, Package, Euro,
  ChevronDown, ChevronUp, Star, Target, Zap, MapPin,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

/**
 * Phase 2000 — Statistiken Executive Dashboard (Lieferdienst)
 *
 * Kompaktes Executive-Dashboard mit:
 * - Heute: Umsatz, Lieferungen, ø Lieferzeit, Storno-Rate
 * - Vergleich Heute vs. Gestern (Trend-Pfeile)
 * - Fahrer-Rangliste (Top 3)
 * - Stunden-Balkendiagramm
 * Echtzeit-Laden alle 2 Minuten + Supabase-Subscription.
 */

interface Stats {
  umsatz: number;
  lieferungen: number;
  avgLieferzeitMin: number | null;
  stornoRate: number;
  onlineFahrer: number;
}

interface HourBucket { hour: string; count: number }
interface TopFahrer { name: string; lieferungen: number; avgMin: number | null }

function TrendIcon({ delta }: { delta: number | null }) {
  if (delta === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (delta > 0.05) return <TrendingUp className="h-3 w-3 text-green-500" />;
  if (delta < -0.05) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function formatEuro(v: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);
}

export function LieferdienstPhase2000StatistikenExecutiveDashboard({
  locationId,
  className,
}: {
  locationId?: string | null;
  className?: string;
}) {
  const supabase = createClient();
  const [today, setToday] = useState<Stats | null>(null);
  const [yesterday, setYesterday] = useState<Stats | null>(null);
  const [hourly, setHourly] = useState<HourBucket[]>([]);
  const [topFahrer, setTopFahrer] = useState<TopFahrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [offen, setOffen] = useState(true);

  async function load() {
    try {
      const now = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      const yesterdayEnd = new Date(todayStart);

      async function fetchStats(from: Date, to: Date): Promise<Stats> {
        let q = supabase
          .from('customer_orders')
          .select('id, gesamtbetrag, bestellt_am, fertig_am, status, fahrer_id, lieferzeit_min')
          .gte('bestellt_am', from.toISOString())
          .lt('bestellt_am', to.toISOString());
        if (locationId) q = q.eq('location_id', locationId);
        const { data: orders } = await q;

        if (!orders) return { umsatz: 0, lieferungen: 0, avgLieferzeitMin: null, stornoRate: 0, onlineFahrer: 0 };

        const geliefert = orders.filter((o: any) => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
        const storno = orders.filter((o: any) => o.status === 'storniert');
        const total = orders.length;
        const umsatz = geliefert.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
        const zeiten = geliefert
          .map((o: any) => o.lieferzeit_min as number | null)
          .filter((v): v is number => v !== null && v > 0);
        const avgMin = zeiten.length > 0 ? Math.round(zeiten.reduce((s, v) => s + v, 0) / zeiten.length) : null;

        return {
          umsatz,
          lieferungen: geliefert.length,
          avgLieferzeitMin: avgMin,
          stornoRate: total > 0 ? Math.round((storno.length / total) * 100) : 0,
          onlineFahrer: 0,
        };
      }

      // Stündliche Verteilung heute
      let hq = supabase
        .from('customer_orders')
        .select('bestellt_am, status')
        .gte('bestellt_am', todayStart.toISOString())
        .lt('bestellt_am', now.toISOString());
      if (locationId) hq = hq.eq('location_id', locationId);
      const { data: hOrders } = await hq;

      const hBuckets: Record<number, number> = {};
      for (const o of (hOrders ?? []) as { bestellt_am: string; status: string }[]) {
        const h = new Date(o.bestellt_am).getHours();
        if (['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status)) {
          hBuckets[h] = (hBuckets[h] ?? 0) + 1;
        }
      }
      const nowH = now.getHours();
      const buckets: HourBucket[] = [];
      for (let h = 10; h <= Math.max(nowH, 22); h++) {
        buckets.push({ hour: `${h}h`, count: hBuckets[h] ?? 0 });
      }

      // Fahrer-Rangliste
      let fq = supabase
        .from('customer_orders')
        .select('fahrer_id, lieferzeit_min, status')
        .gte('bestellt_am', todayStart.toISOString())
        .in('status', ['geliefert', 'abgeholt', 'abgeschlossen']);
      if (locationId) fq = fq.eq('location_id', locationId);
      const { data: fOrders } = await fq;

      const fahrerMap: Record<string, { count: number; zeiten: number[] }> = {};
      for (const o of (fOrders ?? []) as { fahrer_id?: string; lieferzeit_min?: number | null }[]) {
        if (!o.fahrer_id) continue;
        if (!fahrerMap[o.fahrer_id]) fahrerMap[o.fahrer_id] = { count: 0, zeiten: [] };
        fahrerMap[o.fahrer_id].count++;
        if (o.lieferzeit_min && o.lieferzeit_min > 0) fahrerMap[o.fahrer_id].zeiten.push(o.lieferzeit_min);
      }

      // Fahrer-Namen laden
      const fahrerIds = Object.keys(fahrerMap).slice(0, 10);
      let namen: Record<string, string> = {};
      if (fahrerIds.length > 0) {
        const { data: emps } = await supabase
          .from('employees')
          .select('id, vorname, nachname')
          .in('id', fahrerIds);
        for (const e of (emps ?? []) as { id: string; vorname?: string; nachname?: string }[]) {
          namen[e.id] = `${e.vorname ?? ''} ${e.nachname ?? ''}`.trim();
        }
      }

      const top: TopFahrer[] = Object.entries(fahrerMap)
        .map(([id, { count, zeiten }]) => ({
          name: namen[id] || 'Fahrer',
          lieferungen: count,
          avgMin: zeiten.length > 0 ? Math.round(zeiten.reduce((s, v) => s + v, 0) / zeiten.length) : null,
        }))
        .sort((a, b) => b.lieferungen - a.lieferungen)
        .slice(0, 3);

      // Online Fahrer
      const { count: online } = await supabase
        .from('driver_status')
        .select('id', { count: 'exact', head: true })
        .eq('ist_online', true);

      const [t, y] = await Promise.all([
        fetchStats(todayStart, now),
        fetchStats(yesterdayStart, yesterdayEnd),
      ]);
      t.onlineFahrer = online ?? 0;

      setToday(t);
      setYesterday(y);
      setHourly(buckets);
      setTopFahrer(top);
    } catch (e) {
      console.error('StatistikDashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 2 * 60_000);
    const ch = supabase.channel('lieferdienst-stats-2000')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, load)
      .subscribe();
    return () => {
      clearInterval(iv);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const deltas = useMemo(() => {
    if (!today || !yesterday) return null;
    return {
      umsatz: yesterday.umsatz > 0 ? (today.umsatz - yesterday.umsatz) / yesterday.umsatz : null,
      lieferungen: yesterday.lieferungen > 0 ? (today.lieferungen - yesterday.lieferungen) / yesterday.lieferungen : null,
      storno: yesterday.stornoRate > 0 ? ((today.stornoRate - yesterday.stornoRate) / yesterday.stornoRate) : null,
    };
  }, [today, yesterday]);

  if (loading || !today) return null;

  const maxHourly = Math.max(...hourly.map((h) => h.count), 1);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Executive Dashboard</span>
        <span className="ml-2 text-[10px] rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 font-bold">
          Heute
        </span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                icon: <Euro className="h-3.5 w-3.5" />,
                label: 'Umsatz',
                value: formatEuro(today.umsatz),
                delta: deltas?.umsatz ?? null,
                yValue: yesterday ? formatEuro(yesterday.umsatz) : null,
                positive: true,
              },
              {
                icon: <Package className="h-3.5 w-3.5" />,
                label: 'Lieferungen',
                value: String(today.lieferungen),
                delta: deltas?.lieferungen ?? null,
                yValue: yesterday ? String(yesterday.lieferungen) : null,
                positive: true,
              },
              {
                icon: <Clock className="h-3.5 w-3.5" />,
                label: 'Ø Lieferzeit',
                value: today.avgLieferzeitMin !== null ? `${today.avgLieferzeitMin} Min` : '--',
                delta: null,
                yValue: yesterday?.avgLieferzeitMin !== null ? `${yesterday?.avgLieferzeitMin} Min` : null,
                positive: false,
              },
              {
                icon: <Users className="h-3.5 w-3.5" />,
                label: 'Online Fahrer',
                value: String(today.onlineFahrer),
                delta: null,
                yValue: null,
                positive: true,
              },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border bg-muted/10 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  {kpi.icon}
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{kpi.label}</span>
                </div>
                <div className="flex items-end gap-1.5">
                  <span className="text-base font-black tabular-nums text-foreground leading-none">{kpi.value}</span>
                  {kpi.delta !== null && (
                    <div className={cn('flex items-center gap-0.5 text-[9px] font-bold mb-0.5', kpi.positive && kpi.delta > 0 ? 'text-green-600 dark:text-green-400' : kpi.delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                      <TrendIcon delta={kpi.delta} />
                      {kpi.delta !== null ? `${kpi.delta > 0 ? '+' : ''}${Math.round(kpi.delta * 100)}%` : ''}
                    </div>
                  )}
                </div>
                {kpi.yValue && (
                  <p className="text-[9px] text-muted-foreground">Gestern: {kpi.yValue}</p>
                )}
              </div>
            ))}
          </div>

          {/* Storno-Rate */}
          {today.stornoRate > 0 && (
            <div className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]',
              today.stornoRate > 10 ? 'border-red-200 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300' :
              today.stornoRate > 5  ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300' :
              'border-green-200 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300',
            )}>
              <Zap className="h-3 w-3 shrink-0" />
              <span className="font-bold">Storno-Rate: {today.stornoRate}%</span>
              {yesterday && (
                <span className="text-[10px] opacity-70">· Gestern: {yesterday.stornoRate}%</span>
              )}
              {(deltas?.storno ?? 0) > 0.1 && <span className="ml-auto font-bold text-red-600">Anstieg!</span>}
            </div>
          )}

          {/* Stunden-Balkendiagramm */}
          {hourly.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Lieferungen je Stunde</p>
              <ResponsiveContainer width="100%" height={60}>
                <BarChart data={hourly} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 6 }}
                    formatter={(v: number) => [`${v} Lieferungen`, '']}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                    {hourly.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.count === Math.max(...hourly.map((h) => h.count)) ? '#5a8a3c' : '#a3c97d'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Top Fahrer */}
          {topFahrer.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wide">Top Fahrer heute</p>
              <div className="space-y-1.5">
                {topFahrer.map((f, idx) => (
                  <div key={f.name} className="flex items-center gap-2">
                    <span className={cn(
                      'h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black text-white',
                      idx === 0 ? 'bg-yellow-500' : idx === 1 ? 'bg-gray-400' : 'bg-amber-700',
                    )}>
                      {idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-foreground flex-1 truncate">{f.name}</span>
                    <span className="text-[10px] font-bold tabular-nums text-matcha-700 dark:text-matcha-300 shrink-0">
                      {f.lieferungen} Lief.
                    </span>
                    {f.avgMin && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ø{f.avgMin} Min
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground text-right">
            Echtzeit · Aktualisiert alle 2 Min
          </p>
        </div>
      )}
    </div>
  );
}
