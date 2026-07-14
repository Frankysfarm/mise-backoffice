'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Package, Euro, Clock, Star, Loader2, BarChart3 } from 'lucide-react';
import { cn, euro } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

type StatCard = {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  icon: React.ReactNode;
  color: string;
};

type HourlyBar = { h: number; label: string; orders: number };

type DashboardData = {
  ordersToday: number;
  revenueToday: number;
  avgDeliveryMin: number;
  avgRating: number | null;
  ordersTarget: number;
  revenueTarget: number;
  ordersLastWeek: number;
  revenueLastWeek: number;
  hourlyData: HourlyBar[];
  topItems: { name: string; count: number }[];
};

const MOCK: DashboardData = {
  ordersToday: 47,
  revenueToday: 1342.80,
  avgDeliveryMin: 26,
  avgRating: 4.7,
  ordersTarget: 60,
  revenueTarget: 1800,
  ordersLastWeek: 41,
  revenueLastWeek: 1198.50,
  hourlyData: [
    { h: 11, label: '11h', orders: 3 },
    { h: 12, label: '12h', orders: 9 },
    { h: 13, label: '13h', orders: 11 },
    { h: 14, label: '14h', orders: 5 },
    { h: 17, label: '17h', orders: 4 },
    { h: 18, label: '18h', orders: 8 },
    { h: 19, label: '19h', orders: 7 },
  ],
  topItems: [
    { name: 'Margherita', count: 14 },
    { name: 'Burger Classic', count: 11 },
    { name: 'Pasta Carbonara', count: 8 },
    { name: 'Caesar Salad', count: 6 },
  ],
};

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
  if (delta == null) return null;
  if (delta > 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-matcha-700">
      <TrendingUp className="h-3 w-3" />+{delta.toFixed(1)}%
    </span>
  );
  if (delta < 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600">
      <TrendingDown className="h-3 w-3" />{delta.toFixed(1)}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground">
      <Minus className="h-3 w-3" />0%
    </span>
  );
}

function GoalProgress({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{pct}% von Ziel</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', pct >= 100 ? 'bg-matcha-500' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function LieferdienstPhase1000StatistikHubDashboard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); setData(MOCK); return; }
    fetch(`/api/delivery/admin/stats/dashboard?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d ?? MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  const d = data;

  const orderDelta = d && d.ordersLastWeek > 0
    ? ((d.ordersToday - d.ordersLastWeek) / d.ordersLastWeek) * 100
    : null;
  const revenueDelta = d && d.revenueLastWeek > 0
    ? ((d.revenueToday - d.revenueLastWeek) / d.revenueLastWeek) * 100
    : null;

  const cards: StatCard[] = d ? [
    {
      label: 'Bestellungen heute',
      value: d.ordersToday.toString(),
      delta: orderDelta,
      deltaLabel: 'vs. letzte Woche',
      icon: <Package className="h-5 w-5" />,
      color: 'text-matcha-700',
    },
    {
      label: 'Umsatz heute',
      value: euro(d.revenueToday),
      delta: revenueDelta,
      deltaLabel: 'vs. letzte Woche',
      icon: <Euro className="h-5 w-5" />,
      color: 'text-emerald-700',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${d.avgDeliveryMin} Min`,
      delta: null,
      icon: <Clock className="h-5 w-5" />,
      color: d.avgDeliveryMin <= 30 ? 'text-matcha-700' : d.avgDeliveryMin <= 40 ? 'text-amber-700' : 'text-red-700',
    },
    {
      label: 'Ø Bewertung',
      value: d.avgRating != null ? d.avgRating.toFixed(1) : '—',
      delta: null,
      icon: <Star className="h-5 w-5" />,
      color: d.avgRating != null && d.avgRating >= 4.5 ? 'text-amber-600' : 'text-muted-foreground',
    },
  ] : [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Statistiken-Dashboard
          </span>
          {d && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {d.ordersToday} Bestell. · {euro(d.revenueToday)}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-4">
          {loading && (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Lade Statistiken…
            </div>
          )}

          {!loading && d && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-2">
                {cards.map((card) => (
                  <div key={card.label} className="rounded-xl border border-border bg-white p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={cn('', card.color)}>{card.icon}</span>
                      <DeltaBadge delta={card.delta} />
                    </div>
                    <div className={cn('text-xl font-black tabular-nums', card.color)}>{card.value}</div>
                    <div className="text-[10px] text-muted-foreground">{card.label}</div>
                  </div>
                ))}
              </div>

              {/* Goal Progress */}
              <div className="rounded-xl border border-border bg-white p-3 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Tagesziele
                </div>
                <GoalProgress value={d.ordersToday} target={d.ordersTarget} label="Bestellungen" />
                <GoalProgress value={d.revenueToday} target={d.revenueTarget} label="Umsatz" />
              </div>

              {/* Hourly Chart */}
              {d.hourlyData.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Bestellungen je Stunde
                  </div>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={d.hourlyData} barSize={18}>
                      <XAxis dataKey="label" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        formatter={(v: unknown) => [`${v as number} Best.`, 'Bestellungen']}
                      />
                      <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                        {d.hourlyData.map((entry, i) => (
                          <Cell key={i} fill={entry.orders >= 8 ? '#5a7d4e' : '#a5c49a'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Top Items */}
              {d.topItems.length > 0 && (
                <div className="rounded-xl border border-border bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Top-Artikel heute
                  </div>
                  <div className="space-y-1.5">
                    {d.topItems.map((item, i) => {
                      const maxCount = Math.max(...d.topItems.map((x) => x.count));
                      return (
                        <div key={item.name} className="flex items-center gap-2">
                          <span className="w-4 shrink-0 text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                          <span className="text-xs flex-1 truncate">{item.name}</span>
                          <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-matcha-500 rounded-full"
                              style={{ width: `${Math.round((item.count / maxCount) * 100)}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right text-[10px] font-bold tabular-nums">
                            {item.count}×
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
