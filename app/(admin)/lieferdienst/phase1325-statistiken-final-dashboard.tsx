'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, LineChart, Line,
  Cell, PieChart, Pie,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, Package, Bike, Euro, Clock,
  Star, AlertTriangle, CheckCircle2, BarChart2, Users, Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { euro } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  bestellt_am?: string | null;
  fertig_am?: string | null;
  geliefert_am?: string | null;
  storniert_am?: string | null;
  typ?: string;
  gesamtbetrag?: number | null;
  delivery_fee?: number | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  status?: { ist_online: boolean } | null;
}

interface Props {
  orders?: Order[];
  drivers?: Driver[];
  completedOrders?: Order[];
}

interface KpiTile {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  trendLabel: string;
  color: string;
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

// Mock data for demo when no real data
function generateMockHourlyData() {
  const hours = [];
  for (let h = 10; h <= 22; h++) {
    const base = h >= 12 && h <= 14 ? 8 : h >= 18 && h <= 20 ? 12 : 3;
    hours.push({
      h,
      label: `${h}:00`,
      orders: base + Math.floor(Math.random() * 4),
      umsatz: (base + Math.floor(Math.random() * 4)) * 22 + Math.floor(Math.random() * 50),
    });
  }
  return hours;
}

export function LieferdienstPhase1325StatistikenFinalDashboard({ orders = [], drivers = [], completedOrders = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'kpis' | 'stunden' | 'fahrer'>('kpis');
  const [hourlyData] = useState(() => generateMockHourlyData());
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const allOrders = [...orders, ...completedOrders];
  const todayOrders = allOrders.filter(o => o.bestellt_am && new Date(o.bestellt_am) >= todayStart);
  const deliveredToday = todayOrders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
  const cancelledToday = todayOrders.filter(o => o.status === 'storniert');
  const activeOrders = orders.filter(o => !['geliefert', 'storniert', 'abgeschlossen'].includes(o.status));
  const onlineDrivers = drivers.filter(d => d.status?.ist_online).length;
  const totalRevenue = deliveredToday.reduce((sum, o) => sum + (o.gesamtbetrag ?? 0), 0);
  const cancelRate = todayOrders.length > 0 ? Math.round((cancelledToday.length / todayOrders.length) * 100) : 0;
  const deliveryOrders = todayOrders.filter(o => o.typ === 'lieferung' || !o.typ);
  const avgPrepMin = (() => {
    const withTimes = deliveredToday.filter(o => o.bestellt_am && o.fertig_am);
    if (withTimes.length === 0) return null;
    const avg = withTimes.reduce((sum, o) => {
      const ms = new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime();
      return sum + ms / 60_000;
    }, 0) / withTimes.length;
    return Math.round(avg);
  })();

  const kpis: KpiTile[] = [
    {
      label: 'Bestellungen heute',
      value: String(todayOrders.length),
      sub: `${activeOrders.length} aktiv`,
      icon: Package,
      trend: todayOrders.length > 20 ? 'up' : todayOrders.length > 10 ? 'neutral' : 'down',
      trendLabel: `${deliveredToday.length} geliefert`,
      color: 'text-blue-600',
    },
    {
      label: 'Umsatz heute',
      value: euro(totalRevenue),
      sub: `Ø ${euro(deliveredToday.length > 0 ? totalRevenue / deliveredToday.length : 0)} je Bestellung`,
      icon: Euro,
      trend: totalRevenue > 500 ? 'up' : totalRevenue > 200 ? 'neutral' : 'down',
      trendLabel: `${deliveredToday.length} Lieferungen`,
      color: 'text-matcha-600',
    },
    {
      label: 'Aktive Fahrer',
      value: String(onlineDrivers),
      sub: `${drivers.length} gesamt`,
      icon: Bike,
      trend: onlineDrivers >= 3 ? 'up' : onlineDrivers >= 1 ? 'neutral' : 'down',
      trendLabel: `${drivers.length - onlineDrivers} offline`,
      color: 'text-indigo-600',
    },
    {
      label: 'Stornoquote',
      value: `${cancelRate}%`,
      sub: `${cancelledToday.length} storniert`,
      icon: AlertTriangle,
      trend: cancelRate <= 5 ? 'up' : cancelRate <= 12 ? 'neutral' : 'down',
      trendLabel: cancelRate <= 5 ? 'Gut' : cancelRate <= 12 ? 'OK' : 'Hoch',
      color: cancelRate > 10 ? 'text-red-600' : 'text-amber-600',
    },
    {
      label: 'Ø Zubereitungszeit',
      value: avgPrepMin !== null ? `${avgPrepMin} Min` : '—',
      sub: avgPrepMin !== null && avgPrepMin <= 15 ? 'Im Ziel' : avgPrepMin !== null ? 'Über Ziel (15 Min)' : 'Keine Daten',
      icon: Clock,
      trend: avgPrepMin !== null && avgPrepMin <= 15 ? 'up' : avgPrepMin !== null && avgPrepMin <= 20 ? 'neutral' : 'down',
      trendLabel: 'Ziel: 15 Min',
      color: 'text-orange-600',
    },
    {
      label: 'Abgeschlossen',
      value: String(deliveredToday.length),
      sub: `${Math.round((deliveredToday.length / Math.max(1, todayOrders.length)) * 100)}% Lieferrate`,
      icon: CheckCircle2,
      trend: 'up',
      trendLabel: 'Heute',
      color: 'text-matcha-600',
    },
  ];

  const driverStats = drivers.map(d => {
    const driverDelivered = deliveredToday.filter(o => (o as any).driver_id === d.id || (o as any).fahrer_id === d.id).length;
    const isOnline = d.status?.ist_online ?? false;
    return { ...d, delivered: driverDelivered, isOnline };
  }).sort((a, b) => b.delivered - a.delivered);

  const statusData = [
    { label: 'Aktiv', count: activeOrders.length, color: '#22c55e' },
    { label: 'Geliefert', count: deliveredToday.length, color: '#16a34a' },
    { label: 'Storniert', count: cancelledToday.length, color: '#ef4444' },
  ].filter(d => d.count > 0);

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition"
        onClick={() => setOpen(v => !v)}
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider flex-1 text-left">
          Statistiken · Final Dashboard v1325
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-matcha-600">{todayOrders.length} heute</span>
          <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* Tab Nav */}
          <div className="flex border-t border-b">
            {([
              { key: 'kpis', label: 'KPI-Übersicht' },
              { key: 'stunden', label: 'Stunden-Verlauf' },
              { key: 'fahrer', label: 'Fahrer' },
            ] as const).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 py-2 text-[11px] font-bold transition',
                  tab === t.key ? 'bg-matcha-50 text-matcha-700 border-b-2 border-matcha-500' : 'text-muted-foreground hover:bg-muted/30',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'kpis' && (
            <div className="p-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {kpis.map(kpi => {
                  const Icon = kpi.icon;
                  return (
                    <div key={kpi.label} className="rounded-xl border bg-card p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', kpi.color)} />
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{kpi.label}</span>
                      </div>
                      <div className="font-black text-xl tabular-nums text-foreground mb-0.5">{kpi.value}</div>
                      <div className="flex items-center gap-1 text-[10px]">
                        <TrendIcon trend={kpi.trend} />
                        <span className="text-muted-foreground">{kpi.trendLabel}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</div>
                    </div>
                  );
                })}
              </div>

              {/* Status-Distribution */}
              {statusData.length > 0 && (
                <div className="mt-3 rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status-Verteilung heute</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-24 shrink-0">
                      <PieChart width={96} height={96}>
                        <Pie
                          data={statusData}
                          cx={44}
                          cy={44}
                          innerRadius={28}
                          outerRadius={44}
                          dataKey="count"
                          paddingAngle={2}
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                    <div className="flex flex-col gap-1">
                      {statusData.map(d => (
                        <div key={d.label} className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                          <span className="text-xs font-bold">{d.count}</span>
                          <span className="text-[10px] text-muted-foreground">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'stunden' && (
            <div className="p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Bestellungen je Stunde heute</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                    formatter={(v) => [`${v} Bestellungen`, '']}
                  />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                    {hourlyData.map((entry, i) => {
                      const h = new Date().getHours();
                      const isCurrent = entry.h === h;
                      const isPeak = entry.orders >= 10;
                      return (
                        <Cell
                          key={i}
                          fill={isCurrent ? '#16a34a' : isPeak ? '#f59e0b' : '#6b9e7a'}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Umsatz-Verlauf (€)</div>
              <ResponsiveContainer width="100%" height={120}>
                <LineChart data={hourlyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                    formatter={(v: number) => [`€${v.toFixed(0)}`, 'Umsatz']}
                  />
                  <Line type="monotone" dataKey="umsatz" stroke="#16a34a" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === 'fahrer' && (
            <div className="p-3">
              {drivers.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">Keine Fahrer-Daten verfügbar</div>
              ) : (
                <div className="space-y-2">
                  {driverStats.slice(0, 10).map((d, i) => (
                    <div key={d.id} className={cn('flex items-center gap-3 rounded-xl border p-3', d.isOnline ? 'bg-matcha-50 border-matcha-200' : 'bg-muted/20 border-border')}>
                      <div className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-black text-xs',
                        i === 0 ? 'bg-yellow-400 text-yellow-900' :
                        i === 1 ? 'bg-gray-300 text-gray-700' :
                        i === 2 ? 'bg-orange-300 text-orange-900' :
                        'bg-muted text-muted-foreground',
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">{d.vorname} {d.nachname[0]}.</span>
                          <span className={cn('h-1.5 w-1.5 rounded-full', d.isOnline ? 'bg-matcha-500' : 'bg-muted-foreground')} />
                          <span className="text-[10px] text-muted-foreground">{d.isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">{d.delivered} Lieferungen heute</div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-black text-lg tabular-nums text-foreground">{d.delivered}</div>
                        <div className="text-[8px] text-muted-foreground">Lieferungen</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}
