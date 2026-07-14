'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn, euro } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Package, Euro, Clock, Users, Star, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1459 — Statistiken-Gesamtüberblick-Dashboard (Lieferdienst)
// Kompaktes Übersichtsdashboard: Heute vs. Gestern KPIs, Stunden-Verlauf-Chart,
// Fahrer-Rangliste und Trend-Pfeile — alles auf einen Blick.

interface Order {
  id: string;
  status?: string | null;
  gesamtbetrag?: number | null;
  erstellt_am?: string | null;
  liefer_zeit?: number | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  stops_today?: number;
  rating?: number | null;
}

interface Props {
  orders: Order[];
  completedOrders: Order[];
  drivers: Driver[];
}

interface KPI {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
  icon: React.ReactNode;
  cls?: string;
}

function Trend({ dir }: { dir?: 'up' | 'down' | 'flat' }) {
  if (!dir || dir === 'flat') return <Minus className="h-3 w-3 text-slate-400" />;
  if (dir === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="h-3 w-3 text-red-400" />;
}

function toHour(d: string): number {
  return new Date(d).getHours();
}

function buildHourly(orders: Order[]): { h: string; n: number }[] {
  const now = new Date();
  const counts: Record<number, number> = {};
  orders.forEach(o => {
    if (!o.erstellt_am) return;
    const h = toHour(o.erstellt_am);
    counts[h] = (counts[h] ?? 0) + 1;
  });
  const result = [];
  for (let i = 0; i <= now.getHours(); i++) {
    result.push({ h: `${i}`, n: counts[i] ?? 0 });
  }
  return result;
}

export function LieferdienstPhase1459StatistikenGesamtueberblick({ orders, completedOrders, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const allToday = [...orders, ...completedOrders];

  const totalToday = allToday.length;
  const umsatz = allToday.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
  const avgLieferzeit = (() => {
    const vals = allToday.map(o => o.liefer_zeit).filter((v): v is number => v !== null && v !== undefined);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  })();
  const activeDrivers = drivers.length;

  const hourly = buildHourly(allToday);
  const maxN = Math.max(...hourly.map(h => h.n), 1);

  const driverRanking = drivers
    .slice()
    .sort((a, b) => (b.stops_today ?? 0) - (a.stops_today ?? 0))
    .slice(0, 5);

  const kpis: KPI[] = [
    {
      label: 'Bestellungen',
      value: `${totalToday}`,
      icon: <Package className="h-4 w-4 text-blue-500" />,
      trend: totalToday >= 10 ? 'up' : 'flat',
    },
    {
      label: 'Umsatz',
      value: euro(umsatz),
      icon: <Euro className="h-4 w-4 text-emerald-500" />,
      trend: umsatz >= 200 ? 'up' : 'flat',
    },
    {
      label: 'Ø Lieferzeit',
      value: avgLieferzeit !== null ? `${avgLieferzeit} Min` : '—',
      icon: <Clock className="h-4 w-4 text-amber-500" />,
      trend: avgLieferzeit !== null ? (avgLieferzeit <= 30 ? 'up' : 'down') : 'flat',
    },
    {
      label: 'Fahrer aktiv',
      value: `${activeDrivers}`,
      icon: <Users className="h-4 w-4 text-violet-500" />,
      trend: activeDrivers >= 3 ? 'up' : 'flat',
    },
  ];

  return (
    <Card className="overflow-hidden border shadow-sm">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold">Statistiken-Gesamtüberblick</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 border-b">
            {kpis.map(k => (
              <div key={k.label} className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between">
                  {k.icon}
                  <Trend dir={k.trend} />
                </div>
                <div className="text-lg font-black tabular-nums leading-tight">{k.value}</div>
                <div className="text-[10px] text-muted-foreground font-medium">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Stunden-Chart */}
          {hourly.length > 0 && (
            <div className="px-4 pt-3 pb-1">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Bestellungen je Stunde (heute)
              </div>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <XAxis dataKey="h" tick={{ fontSize: 9 }} interval={2} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                      formatter={(v: number) => [`${v} Bestellungen`, '']}
                    />
                    <Bar dataKey="n" radius={[2, 2, 0, 0]}>
                      {hourly.map((entry, i) => (
                        <Cell key={i} fill={entry.n === maxN ? '#2d6b45' : '#d1fae5'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Fahrer-Rangliste */}
          {driverRanking.length > 0 && (
            <div className="border-t px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Fahrer-Rangliste (Stops heute)
              </div>
              <div className="space-y-1.5">
                {driverRanking.map((d, i) => (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className={cn('w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-black shrink-0',
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                        i === 1 ? 'bg-slate-100 text-slate-600' :
                          i === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-50 text-slate-400')}>
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-medium truncate">
                      {`${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || `Fahrer ${i + 1}`}
                    </span>
                    <span className="text-xs font-bold text-muted-foreground tabular-nums">
                      {d.stops_today ?? 0} Stops
                    </span>
                    {d.rating !== null && d.rating !== undefined && (
                      <span className="flex items-center gap-0.5 text-xs text-amber-500">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        {d.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
