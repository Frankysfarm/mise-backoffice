"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  AlertTriangle,
  Clock,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
  TrendingUp,
  Truck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { euro } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerOrder {
  id: string;
  created_at: string;
  total_amount: number;
  status: string;
  typ: string;
  delivery_zone: string | null;
  driver_id: string | null;
}

interface HourlyBucket {
  hour: string;
  orders: number;
  revenue: number;
}

interface ZoneStat {
  zone: string;
  count: number;
}

interface KpiState {
  totalRevenue: number;
  totalOrders: number;
  cancellationRate: number;
  avgOrderValue: number;
  deliveryCount: number;
  pickupCount: number;
  hourly: HourlyBucket[];
  topZones: ZoneStat[];
}

type Props = {
  locationId: string | null;
};

// ---------------------------------------------------------------------------
// Mock data (45 orders, €1 847, 8h distribution peaking at 12h & 19h)
// ---------------------------------------------------------------------------

function buildMockKpis(): KpiState {
  const hourlyRaw: [number, number, number][] = [
    [8, 2, 82],
    [9, 3, 123],
    [10, 4, 164],
    [11, 6, 246],
    [12, 9, 369],
    [13, 5, 205],
    [14, 3, 123],
    [15, 2, 82],
    [16, 2, 82],
    [17, 2, 82],
    [18, 3, 123],
    [19, 8, 328],
    [20, 5, 205],
    [21, 1, 41],
  ];
  const hourly: HourlyBucket[] = hourlyRaw.map(([h, orders, revenue]) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    orders,
    revenue,
  }));

  return {
    totalRevenue: 1847,
    totalOrders: 45,
    cancellationRate: 4.4,
    avgOrderValue: 41.04,
    deliveryCount: 34,
    pickupCount: 11,
    hourly,
    topZones: [
      { zone: "Mitte", count: 14 },
      { zone: "Nord", count: 11 },
      { zone: "Süd", count: 9 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Compute KPIs from raw orders
// ---------------------------------------------------------------------------

function computeKpis(orders: CustomerOrder[]): KpiState {
  const nonCancelled = orders.filter((o) => o.status !== "cancelled");
  const totalRevenue = nonCancelled.reduce((s, o) => s + (o.total_amount ?? 0), 0);
  const totalOrders = nonCancelled.length;
  const cancelled = orders.length - nonCancelled.length;
  const cancellationRate = orders.length > 0 ? (cancelled / orders.length) * 100 : 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const deliveryCount = nonCancelled.filter((o) => o.typ === "delivery").length;
  const pickupCount = nonCancelled.filter((o) => o.typ !== "delivery").length;

  // Hourly buckets 00-23
  const bucketMap: Record<number, { orders: number; revenue: number }> = {};
  for (let h = 0; h < 24; h++) bucketMap[h] = { orders: 0, revenue: 0 };
  for (const o of nonCancelled) {
    const h = new Date(o.created_at).getHours();
    bucketMap[h].orders += 1;
    bucketMap[h].revenue += o.total_amount ?? 0;
  }
  const hourly: HourlyBucket[] = Object.entries(bucketMap)
    .filter(([, v]) => v.orders > 0)
    .map(([h, v]) => ({
      hour: `${String(Number(h)).padStart(2, "0")}:00`,
      orders: v.orders,
      revenue: v.revenue,
    }));

  // Zone aggregation
  const zoneMap: Record<string, number> = {};
  for (const o of nonCancelled) {
    const z = o.delivery_zone ?? "Unbekannt";
    zoneMap[z] = (zoneMap[z] ?? 0) + 1;
  }
  const topZones: ZoneStat[] = Object.entries(zoneMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([zone, count]) => ({ zone, count }));

  return {
    totalRevenue,
    totalOrders,
    cancellationRate,
    avgOrderValue,
    deliveryCount,
    pickupCount,
    hourly,
    topZones,
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, icon, sub, accent = "text-gray-700" }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-gray-300">{icon}</span>
      </div>
      <span className={cn("text-3xl font-extrabold leading-none", accent)}>{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

const BAR_COLORS = ["#22c55e", "#16a34a", "#4ade80", "#86efac", "#bbf7d0", "#dcfce7"];

function HourlyChart({ data }: { data: HourlyBucket[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Bestellungen pro Stunde</h3>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(val: number, name: string) =>
              name === "orders" ? [`${val} Bestellungen`, "Bestellungen"] : [euro(val), "Umsatz"]
            }
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />
          <Bar dataKey="orders" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((_, i) => (
              <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeliverySplit({
  deliveryCount,
  pickupCount,
}: {
  deliveryCount: number;
  pickupCount: number;
}) {
  const total = deliveryCount + pickupCount;
  const deliveryPct = total > 0 ? Math.round((deliveryCount / total) * 100) : 0;
  const pickupPct = total > 0 ? 100 - deliveryPct : 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Truck className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Lieferung vs. Abholung</h3>
      </div>
      {/* Bar */}
      <div className="flex rounded-full overflow-hidden h-3 bg-gray-100">
        <div
          className="bg-green-500 transition-all duration-700"
          style={{ width: `${deliveryPct}%` }}
        />
        <div
          className="bg-blue-400 transition-all duration-700"
          style={{ width: `${pickupPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
          Lieferung: {deliveryCount} ({deliveryPct}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
          Abholung: {pickupCount} ({pickupPct}%)
        </span>
      </div>
    </div>
  );
}

function TopZones({ zones }: { zones: ZoneStat[] }) {
  const max = zones[0]?.count ?? 1;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-700">Top 3 Zonen</h3>
      </div>
      {zones.length === 0 ? (
        <p className="text-xs text-gray-400">Keine Zonendaten</p>
      ) : (
        <ol className="space-y-2">
          {zones.map((z, i) => (
            <li key={z.zone} className="flex items-center gap-3">
              <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium text-gray-700 truncate">{z.zone}</span>
                  <span className="text-sm font-bold text-green-700 ml-2">{z.count}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-400 rounded-full transition-all duration-700"
                    style={{ width: `${Math.round((z.count / max) * 100)}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LieferdienstTagesKpiCockpit({ locationId }: Props) {
  const [kpis, setKpis] = useState<KpiState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [isMock, setIsMock] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!locationId) return;

    try {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("customer_orders")
        .select("id,created_at,total_amount,status,typ,delivery_zone,driver_id")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .eq("location_id", locationId);

      if (!mountedRef.current) return;

      if (error || !data || data.length === 0) {
        setKpis(buildMockKpis());
        setIsMock(true);
      } else {
        setKpis(computeKpis(data as CustomerOrder[]));
        setIsMock(false);
      }
      setLastRefreshed(new Date());
    } catch {
      if (mountedRef.current) {
        setKpis(buildMockKpis());
        setIsMock(true);
        setLastRefreshed(new Date());
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    fetchData();
    intervalRef.current = setInterval(fetchData, 60_000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  // ---- Placeholder when no location selected ----
  if (!locationId) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
        <ShoppingBag className="w-10 h-10 text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Kein Standort ausgewählt</p>
        <p className="text-xs text-gray-400 max-w-xs">
          Bitte wähle einen Standort aus, um das Tages-KPI-Cockpit anzuzeigen.
        </p>
      </div>
    );
  }

  // ---- Loading skeleton ----
  if (loading || !kpis) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        <p className="text-sm text-gray-500">KPIs werden geladen…</p>
      </div>
    );
  }

  const cancellationDisplay =
    kpis.cancellationRate === 0
      ? "0 %"
      : `${kpis.cancellationRate.toFixed(1)} %`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-800">Tages-KPI-Cockpit</h2>
          {isMock && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              <AlertTriangle className="w-3 h-3" />
              Demo-Daten
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Loader2
            className={cn(
              "w-3 h-3",
              loading ? "animate-spin text-green-500" : "text-transparent"
            )}
          />
          {lastRefreshed && (
            <span>
              {lastRefreshed.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              Uhr
            </span>
          )}
          <span className="text-gray-300">· 60 Sek.</span>
        </div>
      </div>

      {/* KPI stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Umsatz"
          value={euro(kpis.totalRevenue)}
          icon={<TrendingUp className="w-5 h-5" />}
          sub="Heute (netto)"
          accent="text-green-700"
        />
        <StatCard
          label="Bestellungen"
          value={String(kpis.totalOrders)}
          icon={<Package className="w-5 h-5" />}
          sub="Abgeschlossen"
          accent="text-gray-800"
        />
        <StatCard
          label="Ø Bestellwert"
          value={euro(kpis.avgOrderValue)}
          icon={<ShoppingBag className="w-5 h-5" />}
          accent="text-indigo-700"
        />
        <StatCard
          label="Storno-Rate"
          value={cancellationDisplay}
          icon={<XCircle className="w-5 h-5" />}
          accent={kpis.cancellationRate > 10 ? "text-red-600" : "text-gray-700"}
          sub={kpis.cancellationRate > 10 ? "Erhöht!" : "Normal"}
        />
      </div>

      {/* Hourly chart */}
      {kpis.hourly.length > 0 && <HourlyChart data={kpis.hourly} />}

      {/* Bottom row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DeliverySplit deliveryCount={kpis.deliveryCount} pickupCount={kpis.pickupCount} />
        <TopZones zones={kpis.topZones} />
      </div>
    </div>
  );
}
