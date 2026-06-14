'use client';

/**
 * SchichtAnalyticsPanel — Detailliertes Schicht-Analyse-Dashboard
 *
 * Zeigt für die Lieferdienst-Ansicht:
 * - Stündliche Bestellverteilung (Balkendiagramm)
 * - Top-Fahrer nach Lieferungen heute
 * - Zone-Umsatz-Aufschlüsselung
 * - Durchschnittliche Bestellwerte + Gesamtumsatz
 * - Pünktlichkeits-Trend
 *
 * Daten direkt aus Supabase, alle 5 Min aktualisiert.
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn, euro } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Award, Bike, Clock, Euro, MapPin, TrendingUp, Trophy,
} from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type HourBucket = { h: number; label: string; orders: number; revenue: number };

type DriverStat = {
  id: string;
  vorname: string;
  nachname: string;
  deliveries: number;
  avgMin: number | null;
};

type ZoneStat = { zone: string; orders: number; revenue: number };

type Analytics = {
  hourly: HourBucket[];
  drivers: DriverStat[];
  zones: ZoneStat[];
  totalRevenue: number;
  avgOrderValue: number | null;
  totalOrders: number;
  peakHour: number | null;
  peakHourOrders: number;
};

async function loadAnalytics(supabase: ReturnType<typeof createClient>): Promise<Analytics> {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id, gesamtbetrag, bestellt_am, geliefert_am, delivery_zone, status, typ')
    .eq('location_id', LOCATION_ID)
    .gte('bestellt_am', todayStart.toISOString())
    .not('bestellt_am', 'is', null);

  const allOrders = (orders ?? []) as {
    id: string; gesamtbetrag: number; bestellt_am: string;
    geliefert_am: string | null; delivery_zone: string | null;
    status: string; typ: string;
  }[];

  // Stündliche Verteilung
  const hCounts: Record<number, { orders: number; revenue: number }> = {};
  for (const o of allOrders) {
    const h = new Date(o.bestellt_am).getHours();
    if (!hCounts[h]) hCounts[h] = { orders: 0, revenue: 0 };
    hCounts[h].orders++;
    hCounts[h].revenue += o.gesamtbetrag ?? 0;
  }
  const nowH = new Date().getHours();
  const hourly: HourBucket[] = [];
  for (let h = 10; h <= Math.max(nowH, 22); h++) {
    hourly.push({ h, label: `${h}`, orders: hCounts[h]?.orders ?? 0, revenue: hCounts[h]?.revenue ?? 0 });
  }
  const peakH = hourly.reduce<{ h: number | null; n: number }>((m, b) => b.orders > m.n ? { h: b.h, n: b.orders } : m, { h: null, n: 0 });

  // Gesamtumsatz + Avg
  const delivered = allOrders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
  const totalRevenue = delivered.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  const avgOrderValue = delivered.length >= 3 ? totalRevenue / delivered.length : null;

  // Zone-Aufschlüsselung
  const zoneMap: Record<string, { orders: number; revenue: number }> = {};
  for (const o of delivered.filter(o => o.typ === 'lieferung')) {
    const z = o.delivery_zone ?? 'Unbekannt';
    if (!zoneMap[z]) zoneMap[z] = { orders: 0, revenue: 0 };
    zoneMap[z].orders++;
    zoneMap[z].revenue += o.gesamtbetrag ?? 0;
  }
  const zones: ZoneStat[] = Object.entries(zoneMap)
    .map(([zone, v]) => ({ zone, ...v }))
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 5);

  // Fahrer-Stats aus Batches+Stops
  const { data: batches } = await supabase
    .from('delivery_batches')
    .select('id, fahrer_id')
    .gte('created_at', todayStart.toISOString());

  const batchIds = (batches ?? []).map((b: any) => b.id);
  const batchDriverMap = new Map((batches ?? []).map((b: any) => [b.id, b.fahrer_id as string]));

  const { data: delivStops } = batchIds.length > 0
    ? await supabase
        .from('delivery_batch_stops')
        .select('id, batch_id, geliefert_am, angekommen_am, reihenfolge')
        .in('batch_id', batchIds)
        .not('geliefert_am', 'is', null)
    : { data: [] };

  const driverDelivMap: Record<string, number> = {};
  for (const s of delivStops ?? []) {
    const dId = batchDriverMap.get((s as any).batch_id);
    if (dId) driverDelivMap[dId] = (driverDelivMap[dId] ?? 0) + 1;
  }

  const topDriverIds = Object.entries(driverDelivMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  let drivers: DriverStat[] = [];
  if (topDriverIds.length > 0) {
    const { data: emps } = await supabase
      .from('employees')
      .select('id, vorname, nachname')
      .in('id', topDriverIds);
    drivers = (emps ?? []).map((e: any) => ({
      id: e.id,
      vorname: e.vorname,
      nachname: e.nachname,
      deliveries: driverDelivMap[e.id] ?? 0,
      avgMin: null,
    })).sort((a, b) => b.deliveries - a.deliveries);
  }

  return {
    hourly,
    drivers,
    zones,
    totalRevenue,
    avgOrderValue,
    totalOrders: allOrders.length,
    peakHour: peakH.h,
    peakHourOrders: peakH.n,
  };
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-2.5 py-2 shadow-soft text-xs">
      <div className="font-black tabular-nums">{payload[0].value} Bestellungen</div>
      {payload[1] && <div className="text-muted-foreground">{euro(payload[1].value)}</div>}
    </div>
  );
};

export function SchichtAnalyticsPanel() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  async function refresh() {
    const d = await loadAnalytics(supabase).catch(() => null);
    if (d) setData(d);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 5 * 60_000);
    const ch = supabase
      .channel('schicht-analytics-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_orders' }, refresh)
      .subscribe();
    return () => { clearInterval(iv); supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground flex items-center gap-2">
        <Clock className="h-4 w-4 animate-spin" />
        Schicht-Analyse wird geladen…
      </div>
    );
  }
  if (!data) return null;

  const nowH = new Date().getHours();

  return (
    <div className="space-y-4">
      {/* KPI-Leiste */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: Euro, label: 'Umsatz heute', value: euro(data.totalRevenue), sub: data.avgOrderValue ? `Ø ${euro(data.avgOrderValue)}` : null, color: 'text-matcha-700' },
          { icon: TrendingUp, label: 'Bestellungen', value: String(data.totalOrders), sub: 'heute gesamt', color: 'text-blue-700' },
          { icon: Clock, label: 'Spitzenstunde', value: data.peakHour != null ? `${data.peakHour}:00` : '–', sub: data.peakHourOrders > 0 ? `${data.peakHourOrders} Bestellungen` : null, color: 'text-amber-700' },
          { icon: Bike, label: 'Fahrer aktiv', value: String(data.drivers.length), sub: 'haben heute geliefert', color: 'text-purple-700' },
        ].map(({ icon: Icon, label, value, sub, color }) => (
          <div key={label} className="rounded-xl border bg-card px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
            </div>
            <div className={cn('text-xl font-black tabular-nums leading-tight', color)}>{value}</div>
            {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Stündliches Balkendiagramm */}
      <div className="rounded-xl border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
            <span className="text-sm font-bold">Stündliche Bestellverteilung</span>
          </div>
          <span className="text-[10px] text-muted-foreground">Heute</span>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={data.hourly} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={28}>
              {data.hourly.map(({ h }) => (
                <Cell
                  key={h}
                  fill={
                    h === data.peakHour ? '#2d6b45' :
                    h === nowH ? '#55a47c' :
                    '#b7ddc7'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-700" />Spitzenstunde</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500" />Aktuelle Stunde</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-200" />Sonstige</span>
        </div>
      </div>

      {/* Fahrer-Rangliste */}
      {data.drivers.length > 0 && (
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-sm font-bold">Fahrer-Rangliste (heute)</span>
          </div>
          <div className="space-y-1.5">
            {data.drivers.map((d, i) => {
              const maxDel = data.drivers[0].deliveries;
              const pct = maxDel > 0 ? (d.deliveries / maxDel) * 100 : 0;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
              return (
                <div key={d.id} className="flex items-center gap-2">
                  <span className="w-5 text-center text-[11px] font-black text-muted-foreground shrink-0">
                    {medal ?? `${i + 1}.`}
                  </span>
                  <span className="w-28 text-[11px] font-semibold truncate shrink-0 text-foreground">
                    {d.vorname} {d.nachname[0]}.
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-stone-400' : i === 2 ? 'bg-amber-700' : 'bg-matcha-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-black tabular-nums text-matcha-700 w-12 text-right shrink-0">
                    {d.deliveries} Liefg.
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Zone-Breakdown */}
      {data.zones.length > 0 && (
        <div className="rounded-xl border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500 shrink-0" />
            <span className="text-sm font-bold">Zonen-Umsatz</span>
          </div>
          <div className="space-y-1.5">
            {data.zones.map((z, i) => {
              const maxOrders = data.zones[0].orders;
              const pct = maxOrders > 0 ? (z.orders / maxOrders) * 100 : 0;
              return (
                <div key={z.zone} className="flex items-center gap-2">
                  <span className="w-24 text-[10px] font-semibold truncate text-muted-foreground">{z.zone}</span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500',
                        i === 0 ? 'bg-blue-600' : 'bg-blue-400',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold tabular-nums text-blue-700 w-20 text-right">
                    {z.orders} · {euro(z.revenue)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-muted-foreground border-t pt-2">
            Umsatz-Gesamt Lieferungen: {euro(data.zones.reduce((s, z) => s + z.revenue, 0))}
          </div>
        </div>
      )}
    </div>
  );
}
