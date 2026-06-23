'use client';

/**
 * LieferstatistikDashboard
 *
 * Ergänzt die bestehende Delivery Analytics um:
 *  • Heute-Überblick: Bestellungen/Umsatz/Storno-Rate (direkt aus customer_orders)
 *  • 7-Tage-Balkendiagramm: Bestellungen + Umsatz je Tag
 *  • Bestelltyp-Split: Lieferung vs. Abholung
 *  • Zahlungsart-Split: Bar vs. Karte
 *  • Top-5 Lieferzonen nach Auftragsvolumen
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  AlertTriangle, ArrowUpRight, Bike, CreditCard, Euro, Package,
  ShoppingBag, TrendingUp, Wallet, X,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type DayRow = {
  label: string; // DD.MM
  orders: number;
  revenue: number;
  cancelled: number;
};

type ZoneRow = {
  zone: string;
  orders: number;
  revenue: number;
};

type Stats = {
  todayOrders: number;
  todayRevenue: number;
  todayCancelled: number;
  todayDelivery: number;
  todayPickup: number;
  todayBar: number;
  todayKarte: number;
  days7: DayRow[];
  topZones: ZoneRow[];
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtEur(v: number) {
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dayLabel(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoISO(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ── Mini KPI Card ─────────────────────────────────────────────────────────── */

function KpiCard({
  icon, label, value, sub, color = 'matcha',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: 'matcha' | 'red' | 'amber' | 'blue';
}) {
  const colors = {
    matcha: 'bg-matcha-50 border-matcha-200 text-matcha-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
  };
  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', colors[color])}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold opacity-70">{label}</span>
        <span className="opacity-50">{icon}</span>
      </div>
      <div className="text-lg font-black leading-none">{value}</div>
      {sub && <div className="text-[9px] opacity-60">{sub}</div>}
    </div>
  );
}

/* ── Split Bar ───────────────────────────────────────────────────────────────── */

function SplitBar({
  labelA, labelB, countA, countB, colorA, colorB,
}: {
  labelA: string; labelB: string;
  countA: number; countB: number;
  colorA: string; colorB: string;
}) {
  const total = countA + countB;
  if (total === 0) return null;
  const pctA = Math.round((countA / total) * 100);
  const pctB = 100 - pctA;

  return (
    <div className="space-y-1.5">
      <div className="h-3 rounded-full overflow-hidden flex">
        <div className={cn('h-full transition-all', colorA)} style={{ width: `${pctA}%` }} />
        <div className={cn('h-full transition-all', colorB)} style={{ width: `${pctB}%` }} />
      </div>
      <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className={cn('h-2 w-2 rounded-full inline-block', colorA)} />
          {labelA} {pctA}% ({countA})
        </span>
        <span className="flex items-center gap-1">
          {labelB} {pctB}% ({countB})
          <span className={cn('h-2 w-2 rounded-full inline-block', colorB)} />
        </span>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

interface Props {
  locationId?: string | null;
}

export function LieferstatistikDashboard({ locationId: locationIdProp }: Props) {
  const [locationId, setLocationId] = useState<string | null>(locationIdProp ?? null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // Resolve location ID from auth if not provided
  useEffect(() => {
    if (locationIdProp) { setLocationId(locationIdProp); return; }
    const sb = createClient();
    sb.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      sb.from('employees')
        .select('location_id')
        .eq('auth_user_id', user.id)
        .maybeSingle()
        .then(({ data }) => { if (data?.location_id) setLocationId(data.location_id as string); });
    });
  }, [locationIdProp]);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    const sb = createClient();

    async function load() {
      setLoading(true);
      try {
        const today = todayISO();
        const sevenDaysAgo = daysAgoISO(7);

        // Fetch last 8 days of orders (for 7-day trend + today)
        const { data: orders } = await sb
          .from('customer_orders')
          .select('id,bestellt_am,gesamtbetrag,status,typ,zahlungsart,delivery_zone')
          .eq('location_id', locationId)
          .gte('bestellt_am', sevenDaysAgo + 'T00:00:00')
          .order('bestellt_am', { ascending: true });

        if (!orders) { setLoading(false); return; }

        // ── Today stats ──────────────────────────────────────────────
        const todayRows = orders.filter((o) => (o.bestellt_am ?? '').startsWith(today));
        const todayOrders = todayRows.length;
        const todayRevenue = todayRows.reduce((s, o) => s + Number(o.gesamtbetrag || 0), 0);
        const todayCancelled = todayRows.filter((o) => o.status === 'storniert').length;
        const todayDelivery = todayRows.filter((o) => o.typ === 'lieferung').length;
        const todayPickup = todayRows.filter((o) => o.typ === 'abholung').length;
        const todayBar = todayRows.filter((o) =>
          (o.zahlungsart ?? '').toLowerCase().includes('bar') ||
          (o.zahlungsart ?? '').toLowerCase().includes('cash'),
        ).length;
        const todayKarte = todayRows.length - todayBar;

        // ── 7-day trend ──────────────────────────────────────────────
        const dayMap = new Map<string, DayRow>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          dayMap.set(iso, { label: dayLabel(d), orders: 0, revenue: 0, cancelled: 0 });
        }
        for (const o of orders) {
          const iso = (o.bestellt_am ?? '').substring(0, 10);
          const row = dayMap.get(iso);
          if (!row) continue;
          row.orders++;
          row.revenue += Number(o.gesamtbetrag || 0);
          if (o.status === 'storniert') row.cancelled++;
        }
        const days7 = Array.from(dayMap.values());

        // ── Top zones ────────────────────────────────────────────────
        const zoneMap = new Map<string, ZoneRow>();
        for (const o of orders.filter((o) => o.status !== 'storniert')) {
          const zone = o.delivery_zone ?? 'Unbekannt';
          const existing = zoneMap.get(zone) ?? { zone, orders: 0, revenue: 0 };
          existing.orders++;
          existing.revenue += Number(o.gesamtbetrag || 0);
          zoneMap.set(zone, existing);
        }
        const topZones = Array.from(zoneMap.values())
          .sort((a, b) => b.orders - a.orders)
          .slice(0, 5);

        setStats({
          todayOrders, todayRevenue, todayCancelled,
          todayDelivery, todayPickup, todayBar, todayKarte,
          days7, topZones,
        });
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [locationId]);

  if (!locationId) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        Bitte Standort wählen für Statistiken.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-center">
        <div className="h-5 w-5 border-2 border-matcha-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground mt-2">Lade Statistiken…</p>
      </div>
    );
  }

  if (!stats) return null;

  const cancelRate = stats.todayOrders > 0
    ? ((stats.todayCancelled / stats.todayOrders) * 100).toFixed(1)
    : '0.0';

  const maxOrders = Math.max(...stats.days7.map((d) => d.orders), 1);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <TrendingUp className="h-4.5 w-4.5" />
        </div>
        <div>
          <div className="text-base font-black">Liefer-Statistiken</div>
          <div className="text-[10px] text-muted-foreground">
            Heute + 7-Tage-Überblick · Segmentierung nach Zone, Typ & Zahlung
          </div>
        </div>
      </div>

      {/* Today KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Heute Bestellungen"
          value={String(stats.todayOrders)}
          sub="seit Mitternacht"
          color="matcha"
        />
        <KpiCard
          icon={<Euro className="h-4 w-4" />}
          label="Heute Umsatz"
          value={fmtEur(stats.todayRevenue)}
          sub={stats.todayOrders > 0 ? `ø ${fmtEur(stats.todayRevenue / stats.todayOrders)} je Bestellung` : '—'}
          color="blue"
        />
        <KpiCard
          icon={<Bike className="h-4 w-4" />}
          label="Lieferungen heute"
          value={String(stats.todayDelivery)}
          sub={`${stats.todayPickup} Abholungen`}
          color="matcha"
        />
        <KpiCard
          icon={<X className="h-4 w-4" />}
          label="Storno-Rate"
          value={`${cancelRate}%`}
          sub={`${stats.todayCancelled} storniert`}
          color={Number(cancelRate) > 10 ? 'red' : Number(cancelRate) > 5 ? 'amber' : 'matcha'}
        />
      </div>

      {/* 7-day trend chart */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-black">7-Tage-Trend: Bestellungen & Umsatz</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={stats.days7} barGap={2} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#888' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 9, fill: '#888' }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: '#888' }} tickFormatter={(v) => `€${v}`} />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8 }}
              formatter={(val: number, name: string) =>
                name === 'Umsatz' ? [fmtEur(val), name] : [val, name]
              }
            />
            <Bar yAxisId="left" dataKey="orders" name="Bestellungen" radius={[3, 3, 0, 0]}>
              {stats.days7.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.label === dayLabel(new Date()) ? '#4d7c0f' : '#86efac'}
                />
              ))}
            </Bar>
            <Bar yAxisId="right" dataKey="revenue" name="Umsatz" radius={[3, 3, 0, 0]} fill="#fde047" opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
        <div className="flex gap-3 text-[9px] font-bold text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-matcha-700 inline-block" /> Heute</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-300 inline-block" /> Vorherige Tage</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-yellow-300 inline-block" /> Umsatz</span>
        </div>
      </div>

      {/* Splits */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Order type split */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-matcha-600" />
            <span className="text-sm font-black">Bestelltyp heute</span>
          </div>
          <SplitBar
            labelA="Lieferung"
            labelB="Abholung"
            countA={stats.todayDelivery}
            countB={stats.todayPickup}
            colorA="bg-matcha-500"
            colorB="bg-blue-400"
          />
        </div>

        {/* Payment split */}
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-black">Zahlungsart heute</span>
          </div>
          <SplitBar
            labelA="Bar"
            labelB="Karte"
            countA={stats.todayBar}
            countB={stats.todayKarte}
            colorA="bg-amber-500"
            colorB="bg-blue-500"
          />
        </div>
      </div>

      {/* Top zones */}
      {stats.topZones.length > 0 && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-matcha-600" />
            <span className="text-sm font-black">Top-5 Lieferzonen (letzte 7 Tage)</span>
          </div>
          <div className="space-y-2">
            {stats.topZones.map((zone, idx) => {
              const maxZoneOrders = stats.topZones[0]?.orders ?? 1;
              const pct = Math.round((zone.orders / maxZoneOrders) * 100);
              return (
                <div key={zone.zone} className="space-y-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold">
                      <span className="text-muted-foreground mr-1">#{idx + 1}</span>
                      {zone.zone}
                    </span>
                    <span className="text-muted-foreground">
                      {zone.orders} Aufträge · {fmtEur(zone.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-400 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancellation alert */}
      {Number(cancelRate) > 10 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
          <div>
            <div className="text-xs font-black text-red-700">Hohe Storno-Rate: {cancelRate}%</div>
            <div className="text-[10px] text-red-600">
              {stats.todayCancelled} von {stats.todayOrders} Bestellungen wurden heute storniert — Überprüfung empfohlen.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
