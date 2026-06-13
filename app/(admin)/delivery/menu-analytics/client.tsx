'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  Star,
  AlertTriangle,
  RefreshCw,
  Camera,
  BarChart2,
  ShoppingBag,
  Euro,
  Package,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface MenuItemPerformance {
  item_name: string;
  total_orders: number;
  total_quantity: number;
  total_revenue: number;
  avg_price: number;
  days_with_sales: number;
  last_sale_date: string;
  avg_orders_per_day: number;
  revenue_rank?: number;
}

interface MenuDailyTrend {
  snapshot_date: string;
  daily_orders: number;
  daily_quantity: number;
  daily_revenue: number;
  distinct_items_sold: number;
}

interface MenuDashboard {
  summary: {
    total_items_tracked: number;
    total_orders_30d: number;
    total_revenue_30d: number;
    hero_item_name: string | null;
    hero_item_orders: number;
    slow_mover_count: number;
  };
  hero_items: MenuItemPerformance[];
  slow_movers: MenuItemPerformance[];
  daily_trend: MenuDailyTrend[];
  snapshot_date: string;
}

// ─────────────────────────────────────────────
// Helper components
// ─────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'blue',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600 border-blue-200',
    green:  'bg-green-50 text-green-600 border-green-200',
    amber:  'bg-amber-50 text-amber-600 border-amber-200',
    red:    'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs mt-0.5 opacity-70">{sub}</div>}
    </div>
  );
}

function RevenueBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{pct}%</span>
    </div>
  );
}

function HeroItemRow({
  item,
  maxRevenue,
  rank,
}: {
  item: MenuItemPerformance;
  maxRevenue: number;
  rank: number;
}) {
  const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;
  return (
    <div className="flex flex-col gap-1 py-3 border-b last:border-0">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {medal ? (
            <span className="text-lg">{medal}</span>
          ) : (
            <span className="text-sm text-gray-400 w-6 text-center">#{rank}</span>
          )}
          <span className="font-medium text-gray-800 truncate">{item.item_name}</span>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-sm text-gray-500">{item.total_orders}× bestellt</span>
          <span className="font-semibold text-gray-800">€{item.total_revenue.toFixed(2)}</span>
        </div>
      </div>
      <RevenueBar value={item.total_revenue} max={maxRevenue} />
      <div className="flex gap-4 text-xs text-gray-400">
        <span>{item.total_quantity} Stück</span>
        <span>Ø €{item.avg_price.toFixed(2)}/Stück</span>
        <span>{item.avg_orders_per_day} Bestellungen/Tag</span>
        <span>Letzte: {item.last_sale_date}</span>
      </div>
    </div>
  );
}

function SlowMoverRow({ item }: { item: MenuItemPerformance }) {
  const [open, setOpen] = useState(false);
  const daysSince =
    item.last_sale_date
      ? Math.floor((Date.now() - new Date(item.last_sale_date).getTime()) / 86400000)
      : 999;
  const severity = item.total_orders === 0 ? 'red' : item.total_orders <= 2 ? 'amber' : 'yellow';
  const severityColors: Record<string, string> = {
    red:    'border-red-200 bg-red-50',
    amber:  'border-amber-200 bg-amber-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  };
  return (
    <div className={`rounded-lg border p-3 mb-2 ${severityColors[severity]}`}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 ${severity === 'red' ? 'text-red-500' : 'text-amber-500'}`} />
          <span className="font-medium text-gray-800">{item.item_name}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {item.total_orders === 0 ? 'Kein Verkauf' : `${item.total_orders}× in 30d`}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
          <div className="text-center">
            <div className="font-semibold text-gray-700">{item.total_orders}</div>
            <div className="text-xs text-gray-400">Bestellungen</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-700">€{item.total_revenue.toFixed(2)}</div>
            <div className="text-xs text-gray-400">Umsatz</div>
          </div>
          <div className="text-center">
            <div className="font-semibold text-gray-700">{daysSince === 999 ? 'Nie' : `${daysSince}d`}</div>
            <div className="text-xs text-gray-400">Seit letztem Kauf</div>
          </div>
          <div className="col-span-3 text-xs text-gray-500 mt-1 p-2 bg-white/60 rounded">
            💡 Empfehlung: {
              item.total_orders === 0
                ? 'Artikel überprüfen oder aus dem Menü entfernen — kein einziger Lieferverkauf in 30 Tagen.'
                : `Artikel bewerben, Preis prüfen oder in Kategorieempfehlungen hervorheben.`
            }
          </div>
        </div>
      )}
    </div>
  );
}

function TrendChart({ data }: { data: MenuDailyTrend[] }) {
  if (data.length === 0) {
    return <div className="text-center text-gray-400 py-8 text-sm">Noch keine Trend-Daten vorhanden</div>;
  }
  const maxOrders = Math.max(...data.map((d) => d.daily_orders), 1);
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-1 h-28 min-w-[400px] px-1">
        {data.map((d) => {
          const h = Math.round((d.daily_orders / maxOrders) * 100);
          const date = new Date(d.snapshot_date);
          const label = date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
          return (
            <div key={d.snapshot_date} className="flex flex-col items-center flex-1 min-w-[24px] group">
              <div className="relative flex-1 w-full flex items-end justify-center">
                <div
                  className="w-full bg-blue-400 group-hover:bg-blue-500 rounded-t transition-all"
                  style={{ height: `${Math.max(h, 4)}%` }}
                  title={`${d.snapshot_date}: ${d.daily_orders} Bestellungen, €${d.daily_revenue.toFixed(0)}`}
                />
              </div>
              <div className="text-[9px] text-gray-400 mt-1 text-center leading-tight">{label}</div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
        <span>{data[0]?.snapshot_date}</span>
        <span>{data[data.length - 1]?.snapshot_date}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

type Tab = 'hero' | 'slow' | 'trend';

export default function MenuAnalyticsClient() {
  const [dashboard, setDashboard] = useState<MenuDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('hero');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/menu-analytics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MenuDashboard = await res.json();
      setDashboard(data);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // 5-Min Auto-Refresh
    return () => clearInterval(interval);
  }, [load]);

  async function triggerSnapshot() {
    setSnapshotting(true);
    try {
      await fetch('/api/delivery/admin/menu-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapshotting(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        Menü-Analytics werden geladen…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600 bg-red-50 rounded-xl">
        Fehler: {error}
        <button onClick={load} className="ml-4 underline text-sm">Erneut versuchen</button>
      </div>
    );
  }

  const d = dashboard!;
  const maxRevenue = d.hero_items[0]?.total_revenue ?? 1;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'hero', label: '⭐ Hero-Items', count: d.hero_items.length },
    { key: 'slow', label: '⚠️ Slow Mover', count: d.slow_movers.length },
    { key: 'trend', label: '📈 14-Tage-Trend' },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <PieChart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Menü-Analytics</h1>
            <p className="text-xs text-gray-500">Artikel-Verkaufsleistung im Liefer-Kanal · letzte 30 Tage</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={triggerSnapshot}
            disabled={snapshotting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Camera className={`w-4 h-4 ${snapshotting ? 'animate-pulse' : ''}`} />
            {snapshotting ? 'Snapshot läuft…' : 'Snapshot jetzt'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          icon={Package}
          label="Artikel getrackt"
          value={d.summary.total_items_tracked}
          sub="einzigartige Artikel (30d)"
          color="blue"
        />
        <KpiCard
          icon={ShoppingBag}
          label="Liefer-Bestellungen"
          value={d.summary.total_orders_30d}
          sub="abgeschlossen (30d)"
          color="green"
        />
        <KpiCard
          icon={Euro}
          label="Tracked Umsatz"
          value={`€${d.summary.total_revenue_30d.toFixed(0)}`}
          sub="Liefer-Kanal (30d)"
          color="purple"
        />
        <KpiCard
          icon={Star}
          label="Hero-Item"
          value={d.summary.hero_item_name ?? '—'}
          sub={d.summary.hero_item_name ? `${d.summary.hero_item_orders}× bestellt` : 'Noch kein Artikel'}
          color="amber"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Slow Mover"
          value={d.summary.slow_mover_count}
          sub="< 5 Bestellungen in 30d"
          color={d.summary.slow_mover_count > 0 ? 'red' : 'green'}
        />
        <KpiCard
          icon={BarChart2}
          label="Snapshot-Datum"
          value={d.snapshot_date}
          sub="letzter Cron-Lauf"
          color="blue"
        />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === t.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'hero' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-500" />
            <h2 className="font-semibold text-gray-800">Top-Artikel nach Umsatz (30 Tage)</h2>
          </div>
          {d.hero_items.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              Noch keine Artikel-Daten vorhanden.
              <br />
              <button onClick={triggerSnapshot} className="mt-2 underline text-blue-500">
                Ersten Snapshot erstellen
              </button>
            </div>
          ) : (
            <div>
              {d.hero_items.map((item, idx) => (
                <HeroItemRow
                  key={item.item_name}
                  item={item}
                  maxRevenue={maxRevenue}
                  rank={idx + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'slow' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="w-5 h-5 text-red-400" />
            <h2 className="font-semibold text-gray-800">Slow Mover — Handlungsbedarf</h2>
          </div>
          {d.slow_movers.length === 0 ? (
            <div className="text-center text-gray-400 py-8 text-sm">
              Alle Artikel performen gut! Kein Slow Mover erkannt.
            </div>
          ) : (
            <div>
              {d.slow_movers.map((item) => (
                <SlowMoverRow key={item.item_name} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'trend' && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-800">14-Tage Liefer-Trend (tägliche Bestellungen)</h2>
          </div>
          <TrendChart data={d.daily_trend} />
          {d.daily_trend.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-700">
                  {Math.round(d.daily_trend.reduce((s, r) => s + r.daily_orders, 0) / d.daily_trend.length)}
                </div>
                <div className="text-xs text-gray-400">Ø Bestellungen/Tag</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-700">
                  €{Math.round(d.daily_trend.reduce((s, r) => s + r.daily_revenue, 0) / d.daily_trend.length).toFixed(0)}
                </div>
                <div className="text-xs text-gray-400">Ø Umsatz/Tag</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="font-semibold text-gray-700">
                  {Math.max(...d.daily_trend.map((r) => r.distinct_items_sold))}
                </div>
                <div className="text-xs text-gray-400">Max. Artikel/Tag</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Box */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
        <p className="font-medium text-gray-700 mb-1">Wie funktioniert Menü-Analytics?</p>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Täglich werden alle <strong>abgeschlossenen Liefer-Bestellungen</strong> analysiert.</li>
          <li><strong>Hero-Items</strong> sind die Top-10 Artikel nach Gesamt-Umsatz im Liefer-Kanal (30 Tage).</li>
          <li><strong>Slow Mover</strong> haben weniger als 5 Bestellungen in 30 Tagen — hier besteht Optimierungspotenzial.</li>
          <li>Cron läuft täglich um 02:00 UTC. Manueller Snapshot jederzeit über den Button möglich.</li>
        </ul>
      </div>

    </div>
  );
}
