'use client';

import { useEffect, useState, useCallback } from 'react';
import { LieferstatistikDashboard } from './liefer-statistik-dashboard';
import type {
  AnalyticsDashboard,
  AnalyticsSnapshot,
  TopDriver,
  WeekComparison,
} from '@/lib/delivery/delivery-analytics';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, TrendingUp, TrendingDown, Minus,
  Package, Clock, CheckCircle2, XCircle, Euro,
  Users, ChevronUp, ChevronDown, Download, FileText,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const REFRESH_INTERVAL = 60; // s

// ─── Formatter ────────────────────────────────────────────────────────────────

function fmtPct(v: number | null | undefined) {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtMin(v: number | null | undefined) {
  if (v == null) return '—';
  const m = Math.floor(v);
  const s = Math.round((v - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} Min`;
}

function fmtEur(v: number | null | undefined) {
  if (v == null) return '—';
  return `€${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// ─── Delta Badge ──────────────────────────────────────────────────────────────

function DeltaBadge({
  pct, invertColors = false,
}: { pct: number | null; invertColors?: boolean }) {
  if (pct == null) return <span className="text-gray-500 text-xs">—</span>;
  const positive = pct >= 0;
  const good = invertColors ? !positive : positive;
  const Icon = pct > 0.5 ? TrendingUp : pct < -0.5 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${good ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, delta, invertDelta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  invertDelta?: boolean;
}) {
  return (
    <Card className="bg-gray-900 border-gray-700/50 p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-xs font-medium">{label}</span>
        <span className="text-gray-600">{icon}</span>
      </div>
      <span className="text-2xl font-bold text-white">{value}</span>
      <div className="flex items-center gap-2">
        {sub && <span className="text-gray-500 text-xs">{sub}</span>}
        {delta !== undefined && <DeltaBadge pct={delta} invertColors={invertDelta} />}
      </div>
    </Card>
  );
}

// ─── Trend Chart ──────────────────────────────────────────────────────────────

function TrendChart({ trend }: { trend: AnalyticsSnapshot[] }) {
  if (trend.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-12">
        Noch keine historischen Snapshots vorhanden.
        Täglich um 02:05 UTC wird der Vortag gespeichert.
      </div>
    );
  }

  const chartData = [...trend].reverse().map((r) => ({
    date:       fmtDate(r.analyticsDate),
    lieferrate: r.deliveryRate,
    sla:        r.slaCompliancePct,
    minuten:    r.avgDeliveryMin,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={chartData} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: '#9ca3af', fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis yAxisId="pct" domain={[0, 100]} tick={{ fill: '#9ca3af', fontSize: 11 }} unit="%" width={36} />
        <YAxis yAxisId="min" orientation="right" tick={{ fill: '#9ca3af', fontSize: 11 }} unit=" Min" width={44} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#e5e7eb' }}
          formatter={(v: unknown, name: unknown) => {
            const val = v as number | null;
            const key = name as string;
            if (val == null) return ['—', key];
            if (key === 'ø Zeit') return [`${val.toFixed(1)} Min`, key];
            return [`${val.toFixed(1)}%`, key];
          }}
        />
        <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
        <Line yAxisId="pct" type="monotone" dataKey="lieferrate" name="Lieferrate" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line yAxisId="pct" type="monotone" dataKey="sla" name="SLA-Einhaltung" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line yAxisId="min" type="monotone" dataKey="minuten" name="ø Zeit" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Top-Fahrer-Tabelle ───────────────────────────────────────────────────────

function TopDriversTable({ drivers }: { drivers: TopDriver[] }) {
  if (drivers.length === 0) {
    return <div className="text-gray-500 text-sm text-center py-8">Keine Fahrerdaten für die letzten 7 Tage.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left text-gray-400 font-medium pb-2 pr-4">#</th>
            <th className="text-left text-gray-400 font-medium pb-2 pr-4">Fahrer</th>
            <th className="text-right text-gray-400 font-medium pb-2 pr-4">Lieferungen</th>
            <th className="text-right text-gray-400 font-medium pb-2 pr-4">Pünktlich</th>
            <th className="text-right text-gray-400 font-medium pb-2 pr-4">ø Zeit</th>
            <th className="text-right text-gray-400 font-medium pb-2">Umsatz</th>
          </tr>
        </thead>
        <tbody>
          {drivers.map((d, i) => (
            <tr key={d.driverId} className="border-b border-gray-800 hover:bg-gray-800/30">
              <td className="py-2 pr-4 text-gray-500">{i + 1}</td>
              <td className="py-2 pr-4">
                <div className="text-white font-medium">{d.name ?? 'Unbekannt'}</div>
                {d.vehicle && <div className="text-gray-500 text-xs">{d.vehicle}</div>}
              </td>
              <td className="py-2 pr-4 text-right text-white font-medium">{d.deliveries}</td>
              <td className="py-2 pr-4 text-right">
                <span className={d.onTimePct != null && d.onTimePct >= 90 ? 'text-emerald-400' : d.onTimePct != null && d.onTimePct >= 75 ? 'text-amber-400' : 'text-red-400'}>
                  {fmtPct(d.onTimePct)}
                </span>
              </td>
              <td className="py-2 pr-4 text-right text-gray-300">{fmtMin(d.avgDeliveryMin)}</td>
              <td className="py-2 text-right text-gray-300">{fmtEur(d.totalEur)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Wochenvergleich ──────────────────────────────────────────────────────────

function WeekRow({
  label, thisVal, lastVal, delta, unit, invertDelta,
}: {
  label: string;
  thisVal: string;
  lastVal: string;
  delta: number | null;
  unit?: string;
  invertDelta?: boolean;
}) {
  void unit;
  const Icon = delta != null && delta > 0.5
    ? ChevronUp
    : delta != null && delta < -0.5
      ? ChevronDown
      : Minus;
  const good = invertDelta ? (delta != null && delta <= 0) : (delta != null && delta >= 0);
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-gray-500 text-sm w-20 text-right">{lastVal}</span>
        <span className="text-white font-medium w-20 text-right">{thisVal}</span>
        {delta != null ? (
          <span className={`flex items-center gap-0.5 text-xs w-16 justify-end ${good ? 'text-emerald-400' : 'text-red-400'}`}>
            <Icon className="h-3 w-3" />
            {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        ) : (
          <span className="text-gray-600 text-xs w-16 text-right">—</span>
        )}
      </div>
    </div>
  );
}

function WeekComparisonPanel({ wc }: { wc: WeekComparison }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between pb-2 mb-1">
        <span className="text-gray-600 text-xs" />
        <div className="flex items-center gap-3">
          <span className="text-gray-500 text-xs w-20 text-right">Vorwoche</span>
          <span className="text-gray-300 text-xs w-20 text-right">Diese Woche</span>
          <span className="text-gray-500 text-xs w-16 text-right">Δ</span>
        </div>
      </div>
      <WeekRow
        label="Abgeschlossene Lieferungen"
        thisVal={String(wc.thisWeekDeliveries)}
        lastVal={String(wc.lastWeekDeliveries)}
        delta={wc.deliveriesDeltaPct}
      />
      <WeekRow
        label="SLA-Einhaltung"
        thisVal={fmtPct(wc.thisWeekSlaAvgPct)}
        lastVal={fmtPct(wc.lastWeekSlaAvgPct)}
        delta={wc.slaDeltaPct}
      />
      <WeekRow
        label="ø Lieferzeit"
        thisVal={fmtMin(wc.thisWeekAvgMinutes)}
        lastVal={fmtMin(wc.lastWeekAvgMinutes)}
        delta={wc.minutesDeltaPct}
        invertDelta
      />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DeliveryAnalyticsClient() {
  const [data, setData]       = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [snapping, setSnapping]   = useState(false);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/delivery/admin/analytics', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as AnalyticsDashboard);
      setCountdown(REFRESH_INTERVAL);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { void load(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSnapshot = async () => {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    setExporting(format);
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const thirtyAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const url = `/api/delivery/admin/analytics/export?format=${format}&from=${thirtyAgo}&to=${yesterday}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const filename = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]
        ?? `delivery-analytics.${format}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setExporting(null);
    }
  };

  if (loading && !data) {
    return <div className="text-gray-500 text-sm animate-pulse">Lade Analytics…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
        Fehler: {error}
        <Button size="sm" variant="outline" className="ml-4" onClick={() => void load()}>Erneut laden</Button>
      </div>
    );
  }

  if (!data) return null;

  const { today: t, trend30, topDrivers, weekComparison } = data;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="text-gray-500 text-xs">
          Heute live · Auto-Refresh in {countdown}s
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleSnapshot()} disabled={snapping}>
            {snapping ? 'Snapshot läuft…' : 'Snapshot jetzt'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleExport('csv')}
            disabled={exporting !== null}
            title="Letzte 30 Tage als CSV exportieren"
          >
            <Download className={`h-4 w-4 mr-1 ${exporting === 'csv' ? 'animate-bounce' : ''}`} />
            {exporting === 'csv' ? 'CSV…' : 'CSV'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleExport('pdf')}
            disabled={exporting !== null}
            title="Letzte 30 Tage als PDF exportieren"
          >
            <FileText className={`h-4 w-4 mr-1 ${exporting === 'pdf' ? 'animate-bounce' : ''}`} />
            {exporting === 'pdf' ? 'PDF…' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          icon={<Package className="h-4 w-4" />}
          label="Lieferrate"
          value={fmtPct(t.deliveryRate)}
          sub={`${t.completedDeliveries}/${t.deliveryOrders} abgeschlossen`}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="ø Lieferzeit"
          value={fmtMin(t.avgDeliveryMin)}
          sub="Abholung → Übergabe"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="SLA-Einhaltung"
          value={fmtPct(t.slaCompliancePct)}
          sub={`${t.slaOnTime}/${t.slaTotal} pünktlich`}
        />
        <KpiCard
          icon={<XCircle className="h-4 w-4" />}
          label="Stornoquote"
          value={fmtPct(t.cancellationRate)}
          sub={`${t.cancelledOrders} storniert`}
          invertDelta
        />
        <KpiCard
          icon={<Euro className="h-4 w-4" />}
          label="ø Umsatz/Lieferung"
          value={fmtEur(t.revenuePerDeliveryEur)}
          sub={fmtEur(t.totalRevenueEur) + ' gesamt'}
        />
      </div>

      {/* Sekundär-KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Bestellungen heute</div>
          <div className="text-xl font-bold text-white">{t.totalOrders}</div>
          <div className="text-gray-500 text-xs">{t.deliveryOrders} Lieferungen</div>
        </div>
        <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Aktive Fahrer</div>
          <div className="text-xl font-bold text-white">
            <Users className="h-4 w-4 inline mr-1 text-gray-500" />{t.activeDrivers}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Umsatz Lieferungen</div>
          <div className="text-xl font-bold text-white">{fmtEur(t.totalRevenueEur)}</div>
        </div>
        <div className="bg-gray-900 border border-gray-700/50 rounded-lg p-3">
          <div className="text-gray-400 text-xs mb-1">Trend-Datenpunkte</div>
          <div className="text-xl font-bold text-white">{trend30.length} Tage</div>
          <div className="text-gray-500 text-xs">30-Tage-Verlauf</div>
        </div>
      </div>

      {/* 30-Tage-Trend */}
      <Card className="bg-gray-900 border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-4">30-Tage-Trend</h3>
        <TrendChart trend={trend30} />
      </Card>

      {/* Zwei-Spalten: Wochenvergleich + Top-Fahrer */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-gray-900 border-gray-700/50 p-5">
          <h3 className="text-white font-semibold mb-4">Wochenvergleich</h3>
          <WeekComparisonPanel wc={weekComparison} />
        </Card>

        <Card className="bg-gray-900 border-gray-700/50 p-5">
          <h3 className="text-white font-semibold mb-4">Top-Fahrer (letzte 7 Tage)</h3>
          <TopDriversTable drivers={topDrivers} />
        </Card>
      </div>

      {/* Liefer-Statistiken: Segmentierung nach Zone/Typ/Zahlung */}
      <Card className="bg-gray-900 border-gray-700/50 p-5">
        <h3 className="text-white font-semibold mb-4">Liefer-Statistiken — Segmentanalyse</h3>
        <LieferstatistikDashboard />
      </Card>
    </div>
  );
}
