'use client';

import { useMemo, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { TrendingUp, Euro, Users, Package, ChevronDown, ChevronUp, Target } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';

// Phase 1330 — Schicht-Ertrags-Cockpit (Lieferdienst)
// Echtzeit-Gewinn-Analyse: Umsatz, Kosten, Marge je Stunde + Fahrer-Effizienz

interface Order {
  id: string;
  status?: string | null;
  gesamtbetrag?: number | null;
  bestellt_am?: string | null;
  lieferkosten?: number | null;
}

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  aktiv?: boolean | null;
}

interface Props {
  orders: Order[];
  drivers: Driver[];
  completedOrders: Order[];
}

const COST_PER_DRIVER_HOUR = 12;
const ASSUMED_SHIFT_HOURS = 6;

interface HourlyBucket {
  hour: string;
  umsatz: number;
  bestellungen: number;
}

function buildHourlyBuckets(orders: Order[]): HourlyBucket[] {
  const buckets = new Map<string, { umsatz: number; bestellungen: number }>();
  const now = new Date();
  for (let h = Math.max(0, now.getHours() - 7); h <= now.getHours(); h++) {
    const key = `${h}:00`;
    buckets.set(key, { umsatz: 0, bestellungen: 0 });
  }

  for (const o of orders) {
    if (!o.bestellt_am || !o.gesamtbetrag) continue;
    const d = new Date(o.bestellt_am);
    const key = `${d.getHours()}:00`;
    if (!buckets.has(key)) continue;
    const b = buckets.get(key)!;
    b.umsatz += o.gesamtbetrag;
    b.bestellungen++;
  }

  return Array.from(buckets.entries()).map(([hour, d]) => ({
    hour,
    umsatz: Math.round(d.umsatz * 100) / 100,
    bestellungen: d.bestellungen,
  }));
}

export function LieferdienstPhase1330SchichtErtragsCockpit({ orders, drivers, completedOrders }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo(() => {
    const completedArr = completedOrders ?? [];
    const totalRevenue = completedArr.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);
    const deliveryCosts = completedArr.reduce((s, o) => s + (o.lieferkosten ?? 2.5), 0);
    const activeDriverCount = (drivers ?? []).filter(d => d.aktiv).length || (drivers ?? []).length;
    const laborCost = activeDriverCount * COST_PER_DRIVER_HOUR * ASSUMED_SHIFT_HOURS;
    const totalCosts = deliveryCosts + laborCost;
    const profit = totalRevenue - totalCosts;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    const avgOrderValue = completedArr.length > 0 ? totalRevenue / completedArr.length : 0;

    return { totalRevenue, totalCosts, profit, margin, avgOrderValue, activeDriverCount, completedCount: completedArr.length };
  }, [completedOrders, drivers]);

  const hourlyData = useMemo(() => buildHourlyBuckets([...(orders ?? []), ...(completedOrders ?? [])]), [orders, completedOrders]);

  const profitColor = stats.profit >= 0 ? '#2d6b45' : '#dc2626';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Ertrags-Cockpit</span>
          <span
            className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', stats.profit >= 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700')}
          >
            {stats.profit >= 0 ? '+' : ''}{euro(stats.profit)}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 pt-4 pb-4 space-y-4">
          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Umsatz', value: euro(stats.totalRevenue), sub: `${stats.completedCount} Bestellungen`, color: '#2d6b45', icon: Euro },
              { label: 'Kosten', value: euro(stats.totalCosts), sub: `${stats.activeDriverCount} Fahrer`, color: '#dc2626', icon: Users },
              { label: 'Gewinn', value: euro(stats.profit), sub: `${Math.round(stats.margin)}% Marge`, color: profitColor, icon: Target },
              { label: 'Ø Bestellung', value: euro(stats.avgOrderValue), sub: 'je Auftrag', color: '#d97706', icon: Package },
            ].map(({ label, value, sub, color, icon: Icon }) => (
              <div key={label} className="rounded-xl bg-muted/30 border px-3 py-2.5">
                <div className="flex items-center gap-1 mb-1">
                  <Icon className="h-3 w-3" style={{ color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                </div>
                <div className="font-mono text-base font-black tabular-nums" style={{ color }}>{value}</div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Marge-Balken */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-muted-foreground">Gewinn-Marge</span>
              <span className={cn('text-[10px] font-bold', stats.margin >= 20 ? 'text-matcha-600' : stats.margin >= 10 ? 'text-amber-600' : 'text-red-600')}>
                {Math.round(stats.margin)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(0, stats.margin))}%`,
                  background: stats.margin >= 20 ? '#2d6b45' : stats.margin >= 10 ? '#d97706' : '#dc2626',
                }}
              />
            </div>
          </div>

          {/* Stunden-Umsatz-Chart */}
          {hourlyData.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Stunden-Umsatz
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={hourlyData} barSize={16} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [euro(v), 'Umsatz']}
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                  />
                  <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
                    {hourlyData.map((_, i) => (
                      <Cell key={i} fill="#2d6b45" fillOpacity={0.6 + 0.4 * (i / hourlyData.length)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
