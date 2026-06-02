'use client'

import { useEffect, useState } from 'react'
import { Order } from '@/lib/lieferdienst/orders'
import { calculateDailyStats, formatCurrency, formatTime } from '@/lib/lieferdienst/statistics'
import {
  Activity, TrendingUp, Clock, CheckCircle, XCircle,
  Package, RefreshCw, Target, Truck, Users, DollarSign, BarChart3, Route, Zap, MapPin, Download, ShieldCheck, CalendarClock
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

type DeliveryStats = {
  orders: { total: number; delivered: number; held: number; zone_breakdown: Record<string, number> };
  tours: { total: number; bundled_count: number; avg_distance_km: number | null; avg_eta_min: number | null };
  scoring: { avg_score: number | null; total_decisions: number };
} | null;

type SlaData = {
  summary: {
    totalStops: number;
    onTimeCount: number;
    lateCount: number;
    onTimePct: number;
    avgDeviationMin: number;
    avgDeliveryMin: number;
  };
  byZone: Record<string, { totalStops: number; onTimeCount: number; onTimePct: number; avgDeviationMin: number }>;
  _fallback?: boolean;
} | null;

type TrendData = {
  today: { orders: number; delivered: number; avg_score: number | null };
  yesterday: { orders: number; delivered: number; avg_score: number | null };
  delta_orders: number;
  delta_delivered: number;
} | null;

type LiveDriver = {
  id: string;
  name: string;
  state: string;
  active: boolean;
  total_deliveries: number;
  live_position: { recorded_at: string; seconds_stale: number } | null;
  active_batch: { stop_count: number; state: string; zone: string | null } | null;
};

interface StatisticsViewProps {
  orders: Order[]
  completedOrders: Order[]
}

export function StatisticsView({ orders, completedOrders }: StatisticsViewProps) {
  const allOrders = [...orders, ...completedOrders]
  const stats = calculateDailyStats(allOrders)

  const [deliveryStats, setDeliveryStats] = useState<DeliveryStats>(null)
  const [liveDrivers, setLiveDrivers] = useState<LiveDriver[]>([])
  const [heatmapPoints, setHeatmapPoints] = useState<{ zone: string; count: number }[]>([])
  const [trendData, setTrendData] = useState<TrendData>(null)
  const [driverPerf, setDriverPerf] = useState<{
    driver_id: string; employee_name: string | null; vehicle: string;
    state: string; deliveries_today: number; deliveries_yesterday: number;
    active_batch_id: string | null;
  }[]>([])
  const [slaData, setSlaData] = useState<SlaData>(null)
  const [upcomingShifts, setUpcomingShifts] = useState<{
    id: string; driver_id: string; planned_start: string; planned_end: string;
    status: string; driver?: { name: string; vehicle: string } | null;
  }[]>([])
  const [forecastSlots, setForecastSlots] = useState<{
    hourLocal: string; expectedOrders: number; recommendedMinDrivers: number;
  }[]>([])
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [refreshing, setRefreshing] = useState(false)
  const [nextRefreshSec, setNextRefreshSec] = useState(30)

  const fetchDrivers = () => {
    fetch('/api/delivery/admin/drivers')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.drivers) { setLiveDrivers(d.drivers); setLastRefresh(new Date()); } })
      .catch(() => {})
  }

  useEffect(() => {
    fetchDrivers()
    setNextRefreshSec(30)
    const iv = setInterval(() => { fetchDrivers(); setNextRefreshSec(30); }, 30_000)
    const countdownIv = setInterval(() => setNextRefreshSec((s) => Math.max(0, s - 1)), 1_000)
    return () => { clearInterval(iv); clearInterval(countdownIv); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const locationId = (orders[0] as any)?.location_id ?? (completedOrders[0] as any)?.location_id
    if (!locationId) return
    const from = new Date(); from.setHours(0, 0, 0, 0);
    fetch(`/api/delivery/stats?location_id=${locationId}&from=${from.toISOString()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setDeliveryStats(d))
      .catch(() => {})
    fetch(`/api/delivery/admin/heatmap?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: { points?: { zone: string; weight: number }[] } | null) => {
        if (!d?.points) return
        const byZone: Record<string, number> = {}
        for (const p of d.points) byZone[p.zone ?? 'Unbekannt'] = (byZone[p.zone ?? 'Unbekannt'] ?? 0) + p.weight
        setHeatmapPoints(
          Object.entries(byZone)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([zone, count]) => ({ zone, count }))
        )
      })
      .catch(() => {})
    fetch(`/api/delivery/admin/trends?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then((d: TrendData) => d && !('_fallback' in (d as object)) && setTrendData(d))
      .catch(() => {})
    fetch(`/api/delivery/admin/performance?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.drivers && !d._fallback) setDriverPerf(d.drivers) })
      .catch(() => {})
    fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=1`)
      .then(r => r.ok ? r.json() : null)
      .then((d: SlaData) => { if (d && !d._fallback) setSlaData(d) })
      .catch(() => {})
    fetch(`/api/delivery/admin/shifts?location_id=${locationId}&hours=8`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.shifts?.length) setUpcomingShifts(d.shifts) })
      .catch(() => {})
    fetch(`/api/delivery/admin/forecast?location_id=${locationId}&hours=6`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slots?.length) setForecastSlots(d.slots) })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const deliveredOrders = completedOrders.filter(o => o.status === 'done')
  const withEta = deliveredOrders.filter(o => o.estimatedTime != null && o.estimatedTime > 0)
  const avgEtaMin = withEta.length > 0
    ? Math.round(withEta.reduce((s, o) => s + (o.estimatedTime ?? 0), 0) / withEta.length)
    : 0
  const fastOrders = withEta.filter(o => (o.estimatedTime ?? 0) <= 20).length
  const fastPct = withEta.length > 0 ? Math.round((fastOrders / withEta.length) * 100) : 0
  
  const completionRate = stats.totalOrders > 0
    ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
    : 0

  const ordersWithAmount = allOrders.filter(o => ((o as any).totalAmount ?? (o as any).gesamtbetrag ?? 0) > 0)
  const avgOrderValue = ordersWithAmount.length > 0
    ? ordersWithAmount.reduce((s, o) => s + ((o as any).totalAmount ?? (o as any).gesamtbetrag ?? 0), 0) / ordersWithAmount.length
    : 0
  const rejectedRate = stats.totalOrders > 0
    ? Math.round((stats.rejectedOrders / stats.totalOrders) * 100)
    : 0

  const hourlyData = stats.ordersByHour
    .map((count, hour) => ({ hour: formatTime(hour), orders: count }))
    .filter((_, i) => i >= 8 && i <= 23) // Only show 8:00 - 23:00

  const typeData = [
    { name: 'Vor Ort', value: stats.ordersByType.dine_in, color: '#10b981' },
    { name: 'Abholung', value: stats.ordersByType.takeaway, color: '#f59e0b' },
    { name: 'Lieferung', value: stats.ordersByType.delivery, color: '#8b5cf6' },
  ].filter(d => d.value > 0)

  // Bestellungen der letzten 60 Min und Rate
  const ordersLastHour = allOrders.filter(o => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : 0
    return t > 0 && Date.now() - t < 60 * 60_000
  }).length
  const ordersLastHalfHour = allOrders.filter(o => {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : 0
    return t > 0 && Date.now() - t < 30 * 60_000
  }).length
  const ratePerHour = ordersLastHalfHour * 2  // extrapoliert

  function handleExportCSV() {
    const rows = [
      ['Bestellnummer', 'Zeit', 'Status', 'Typ', 'Betrag (€)', 'Zone', 'Zahlungsart'],
      ...allOrders.map(o => [
        (o as any).bestellnummer ?? '',
        o.createdAt ? new Date(o.createdAt).toLocaleString('de-DE') : '',
        o.status ?? '',
        (o as any).orderType ?? (o as any).type ?? '',
        ((o as any).gesamtbetrag ?? 0).toFixed(2),
        (o as any).delivery_zone ?? '',
        (o as any).zahlungsart ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bestellungen-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-char">Tagesstatistiken</h1>
          <p className="text-steel">
            {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          {/* Live-Rate Badge */}
          {ratePerHour > 0 && (
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              ~{ratePerHour}/h jetzt · {ordersLastHour} letzte Stunde
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-medium text-steel hover:text-char transition px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50"
            title="Tagesbestellungen als CSV exportieren"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
          <button
            onClick={() => { setRefreshing(true); fetchDrivers(); setNextRefreshSec(30); setTimeout(() => setRefreshing(false), 800); }}
            className="flex items-center gap-2 text-xs font-medium text-steel hover:text-char transition px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Aktualisieren
            <span className="text-stone-400">{lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
          </button>
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <div className="flex-1 h-0.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all duration-1000"
                style={{ width: `${(nextRefreshSec / 30) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-stone-400 tabular-nums">{nextRefreshSec}s</span>
          </div>
        </div>
      </div>

      {/* Jetzt-Status Banner */}
      {liveDrivers.length > 0 && (() => {
        const onlineDrivers = liveDrivers.filter(d => d.active)
        const deliveringDrivers = liveDrivers.filter(d => d.active && d.active_batch)
        const totalLiveStops = deliveringDrivers.reduce((s, d) => s + (d.active_batch?.stop_count ?? 0), 0)
        const efficiencyPct = onlineDrivers.length > 0 ? Math.round((deliveringDrivers.length / onlineDrivers.length) * 100) : 0
        return (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Live · Jetzt gerade</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="font-display text-3xl font-black text-char">{onlineDrivers.length}</div>
                <div className="text-xs text-steel mt-0.5 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Online</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl font-black text-orange-600">{deliveringDrivers.length}</div>
                <div className="text-xs text-steel mt-0.5 flex items-center justify-center gap-1"><Truck className="w-3 h-3" /> Im Einsatz</div>
              </div>
              <div className="text-center">
                <div className="font-display text-3xl font-black text-blue-600">{totalLiveStops}</div>
                <div className="text-xs text-steel mt-0.5 flex items-center justify-center gap-1"><Route className="w-3 h-3" /> Stopps</div>
              </div>
              <div className="text-center">
                <div className={`font-display text-3xl font-black ${efficiencyPct >= 70 ? 'text-emerald-600' : efficiencyPct >= 40 ? 'text-amber-600' : 'text-stone-400'}`}>{efficiencyPct}%</div>
                <div className="text-xs text-steel mt-0.5 flex items-center justify-center gap-1"><Activity className="w-3 h-3" /> Auslastung</div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${efficiencyPct >= 70 ? 'bg-emerald-400' : efficiencyPct >= 40 ? 'bg-amber-400' : 'bg-stone-300'}`} style={{ width: `${efficiencyPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Trend: Heute vs. Gestern */}
      {trendData && (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-bold text-char">Heute vs. Gestern</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: 'Bestellungen',
                today: trendData.today.orders,
                yesterday: trendData.yesterday.orders,
                delta: trendData.delta_orders,
                color: 'text-char',
              },
              {
                label: 'Geliefert',
                today: trendData.today.delivered,
                yesterday: trendData.yesterday.delivered,
                delta: trendData.delta_delivered,
                color: 'text-emerald-600',
              },
              {
                label: 'Ø Score',
                today: trendData.today.avg_score != null ? Math.round(trendData.today.avg_score) : null,
                yesterday: trendData.yesterday.avg_score != null ? Math.round(trendData.yesterday.avg_score) : null,
                delta: trendData.today.avg_score != null && trendData.yesterday.avg_score != null
                  ? Math.round(trendData.today.avg_score - trendData.yesterday.avg_score)
                  : null,
                color: 'text-violet-600',
              },
            ].map((row) => (
              <div key={row.label} className="text-center">
                <div className={`font-display text-2xl font-black ${row.color}`}>
                  {row.today ?? '–'}
                </div>
                <div className="text-xs text-steel mt-0.5">{row.label}</div>
                {row.delta != null && row.delta !== 0 && (
                  <div className={`mt-1 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    row.delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {row.delta > 0 ? '▲' : '▼'} {Math.abs(row.delta)} vs gestern
                  </div>
                )}
                {row.yesterday != null && (
                  <div className="text-[9px] text-stone-400 mt-0.5">Gestern: {row.yesterday}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schicht-Prognose */}
      {ratePerHour > 0 && (() => {
        const nowHour = new Date().getHours();
        const shiftEndHour = 22;
        const hoursLeft = Math.max(0, shiftEndHour - nowHour - new Date().getMinutes() / 60);
        const projected = Math.round(stats.totalOrders + ratePerHour * hoursLeft);
        const actualRevenue = allOrders.reduce((s, o) => s + ((o as any).gesamtbetrag ?? (o as any).total ?? 0), 0);
        const avgValue = stats.totalOrders > 0 ? actualRevenue / stats.totalOrders : 0;
        const projectedRevenue = projected * avgValue;
        const yesterdayOrders = trendData?.yesterday.orders ?? null;
        const aheadOfYesterday = yesterdayOrders != null ? projected - yesterdayOrders : null;
        return (
          <div className="rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 to-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-violet-600" />
              <span className="text-sm font-bold text-char">Schicht-Prognose · bis {shiftEndHour}:00 Uhr</span>
              {aheadOfYesterday != null && (
                <span className={`ml-auto inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${aheadOfYesterday >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {aheadOfYesterday >= 0 ? '▲' : '▼'} {Math.abs(aheadOfYesterday)} vs. gestern
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="font-display text-3xl font-black text-violet-700">{projected}</div>
                <div className="text-xs text-steel mt-0.5">Bestellungen (erwartet)</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl font-black text-char">{ratePerHour}/h</div>
                <div className="text-xs text-steel mt-0.5">Aktuelle Rate</div>
              </div>
              <div className="text-center">
                <div className="font-display text-2xl font-black text-emerald-700">
                  {avgValue > 0 ? formatCurrency(projectedRevenue) : '—'}
                </div>
                <div className="text-xs text-steel mt-0.5">Prognosierter Umsatz</div>
              </div>
            </div>
            {hoursLeft > 0 && (
              <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-400">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-400 transition-all" style={{ width: `${Math.round(((shiftEndHour - hoursLeft - 8) / (shiftEndHour - 8)) * 100)}%` }} />
                </div>
                <span className="shrink-0">{hoursLeft.toFixed(1)}h verbleibend</span>
              </div>
            )}
          </div>
        )
      })()}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-saffron/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-saffron" />
            </div>
            <span className="text-sm font-medium text-steel">Bestellungen</span>
          </div>
          <p className="text-3xl font-bold text-char">{stats.totalOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-600" />
            </div>
            <span className="text-sm font-medium text-steel">Abgeschlossen</span>
          </div>
          <p className="text-3xl font-bold text-emerald-600">{stats.completedOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <span className="text-sm font-medium text-steel">Abgelehnt</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats.rejectedOrders}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm font-medium text-steel">Ø Zubereitungszeit</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{stats.avgPrepTime} <span className="text-lg">Min</span></p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-violet-600" />
            </div>
            <span className="text-sm font-medium text-steel">Umsatz (ca.)</span>
          </div>
          <p className="text-3xl font-bold text-violet-600">{formatCurrency(stats.revenue)}</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm font-medium text-steel">Erfolgsquote</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{completionRate}%</p>
          <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${completionRate}%` }} />
          </div>
        </div>

        {/* Ø Bestellwert */}
        {avgOrderValue > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-teal-600" />
              </div>
              <span className="text-sm font-medium text-steel">Ø Bestellwert</span>
            </div>
            <p className="text-3xl font-bold text-teal-600">{formatCurrency(avgOrderValue)}</p>
            <p className="mt-1 text-xs text-steel">{ordersWithAmount.length} Bestellungen mit Betrag</p>
          </div>
        )}

        {/* Stornoquote */}
        {stats.totalOrders > 0 && stats.rejectedOrders > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-sm font-medium text-steel">Stornoquote</span>
            </div>
            <p className="text-3xl font-bold text-red-500">{rejectedRate}%</p>
            <p className="mt-1 text-xs text-steel">{stats.rejectedOrders} von {stats.totalOrders} abgelehnt</p>
          </div>
        )}

        {/* Dispatch Score Card */}
        {deliveryStats?.scoring?.avg_score != null && (
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-matcha-100 flex items-center justify-center">
                <Target className="w-5 h-5 text-matcha-700" />
              </div>
              <span className="text-sm font-medium text-steel">Ø Dispatch-Score</span>
            </div>
            <p className="text-3xl font-bold text-matcha-700">{deliveryStats.scoring.avg_score}</p>
            <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full bg-matcha-400 rounded-full transition-all" style={{ width: `${deliveryStats.scoring.avg_score}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4">Bestellungen nach Uhrzeit</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#78716c' }}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e7e5e4',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar 
                  dataKey="orders" 
                  fill="#E8A54B" 
                  radius={[6, 6, 0, 0]}
                  name="Bestellungen"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {stats.peakHour > 0 && (
            <p className="text-sm text-steel mt-3">
              Peak-Stunde: <span className="font-semibold text-char">{formatTime(stats.peakHour)}</span>
            </p>
          )}
        </div>

        {/* Order Types */}
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4">Nach Bestelltyp</h3>
          {typeData.length > 0 ? (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {typeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e7e5e4',
                        borderRadius: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-4">
                {typeData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-sm text-stone-600">{item.name}</span>
                    </div>
                    <span className="text-sm font-semibold text-char">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-48 flex items-center justify-center">
              <p className="text-stone-400">Keine Daten</p>
            </div>
          )}
        </div>
      </div>

      {/* Delivery Performance */}
      {deliveredOrders.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <Truck className="w-5 h-5 text-violet-600" />
            Lieferperformance
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-2xl font-bold text-char">{deliveredOrders.length}</div>
              <div className="text-sm text-steel mt-0.5">Abgeschlossen heute</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{avgEtaMin} <span className="text-base font-normal">Min</span></div>
              <div className="text-sm text-steel mt-0.5">Ø ETA-Angabe</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{fastPct}%</div>
              <div className="text-sm text-steel mt-0.5">Unter 20 Min</div>
            </div>
          </div>
          {/* Mini bar chart of prep times */}
          <div className="mt-4 space-y-2">
            {[
              { label: '≤ 15 Min', count: withEta.filter(o => (o.estimatedTime ?? 0) <= 15).length, color: '#10b981' },
              { label: '16–25 Min', count: withEta.filter(o => (o.estimatedTime ?? 0) > 15 && (o.estimatedTime ?? 0) <= 25).length, color: '#f59e0b' },
              { label: '> 25 Min', count: withEta.filter(o => (o.estimatedTime ?? 0) > 25).length, color: '#ef4444' },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <div className="w-20 text-xs text-steel shrink-0">{row.label}</div>
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: withEta.length > 0 ? `${(row.count / withEta.length) * 100}%` : '0%',
                      backgroundColor: row.color,
                    }}
                  />
                </div>
                <div className="w-6 text-xs font-semibold text-char text-right">{row.count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart Dispatch Stats */}
      {deliveryStats && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-matcha-600" />
            Smart-Dispatch Statistiken (heute)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <div className="text-2xl font-bold text-char">{deliveryStats.tours.total}</div>
              <div className="text-sm text-steel mt-0.5">Touren gesamt</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <div className="text-2xl font-bold text-violet-600">{deliveryStats.tours.bundled_count}</div>
              <div className="text-sm text-steel mt-0.5">Gebündelt</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <div className="text-2xl font-bold text-blue-600">
                {deliveryStats.tours.avg_distance_km != null ? `${deliveryStats.tours.avg_distance_km} km` : '–'}
              </div>
              <div className="text-sm text-steel mt-0.5">Ø Distanz</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100">
              <div className="text-2xl font-bold text-emerald-600">
                {deliveryStats.scoring.avg_score != null ? `${deliveryStats.scoring.avg_score}` : '–'}
              </div>
              <div className="text-sm text-steel mt-0.5">Ø Score</div>
            </div>
          </div>
          {/* Zone-Breakdown */}
          {Object.keys(deliveryStats.orders.zone_breakdown).length > 0 && (
            <div>
              <div className="text-sm font-semibold text-char mb-2 flex items-center gap-2">
                <Route className="w-4 h-4" /> Lieferungen nach Zone
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(deliveryStats.orders.zone_breakdown).map(([zone, count]) => (
                  <div key={zone} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm">
                    <span className={`font-bold ${zone === 'A' ? 'text-emerald-600' : zone === 'B' ? 'text-blue-600' : zone === 'C' ? 'text-orange-600' : 'text-red-600'}`}>
                      Zone {zone}
                    </span>
                    <span className="font-semibold text-char">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SLA-Panel: On-Time-Rate, Ø-Verzögerung, Zone-Aufschlüsselung */}
      {slaData && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            SLA-Report · Heute
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
            {/* On-Time Rate */}
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className={`text-3xl font-black ${slaData.summary.onTimePct >= 90 ? 'text-emerald-600' : slaData.summary.onTimePct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>
                {Math.round(slaData.summary.onTimePct)}%
              </div>
              <div className="text-xs text-stone-500 mt-1">Pünktlich geliefert</div>
              <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${slaData.summary.onTimePct >= 90 ? 'bg-emerald-400' : slaData.summary.onTimePct >= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${Math.round(slaData.summary.onTimePct)}%` }}
                />
              </div>
            </div>
            {/* Avg Deviation */}
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className={`text-3xl font-black ${slaData.summary.avgDeviationMin <= 2 ? 'text-emerald-600' : slaData.summary.avgDeviationMin <= 8 ? 'text-amber-600' : 'text-red-600'}`}>
                {slaData.summary.avgDeviationMin > 0 ? '+' : ''}{Math.round(slaData.summary.avgDeviationMin)} <span className="text-lg font-normal">Min</span>
              </div>
              <div className="text-xs text-stone-500 mt-1">Ø Abweichung</div>
            </div>
            {/* Avg Delivery Time */}
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className="text-3xl font-black text-blue-600">
                {Math.round(slaData.summary.avgDeliveryMin)} <span className="text-lg font-normal">Min</span>
              </div>
              <div className="text-xs text-stone-500 mt-1">Ø Lieferzeit</div>
            </div>
            {/* Total Stops */}
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className="text-3xl font-black text-char">
                {slaData.summary.onTimeCount}<span className="text-base font-normal text-stone-400">/{slaData.summary.totalStops}</span>
              </div>
              <div className="text-xs text-stone-500 mt-1">Pünktliche Stopps</div>
            </div>
          </div>
          {/* Per-Zone SLA */}
          {Object.keys(slaData.byZone).length > 0 && (
            <div>
              <div className="text-sm font-semibold text-char mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> SLA nach Zone
              </div>
              <div className="space-y-2">
                {Object.entries(slaData.byZone)
                  .sort((a, b) => b[1].totalStops - a[1].totalStops)
                  .map(([zone, zs]) => {
                    const pct = Math.round(zs.onTimePct)
                    const barColor = pct >= 90 ? 'bg-emerald-400' : pct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                    const zoneColor = zone === 'A' ? 'text-emerald-700 bg-emerald-100' : zone === 'B' ? 'text-blue-700 bg-blue-100' : zone === 'C' ? 'text-amber-700 bg-amber-100' : 'text-red-700 bg-red-100'
                    return (
                      <div key={zone} className="flex items-center gap-3 text-sm">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${zoneColor}`}>{zone}</span>
                        <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`w-10 text-right font-bold tabular-nums shrink-0 ${pct >= 90 ? 'text-emerald-600' : pct >= 70 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
                        <span className="w-14 text-right text-xs text-stone-400 tabular-nums shrink-0">
                          {zs.avgDeviationMin > 0 ? '+' : ''}{Math.round(zs.avgDeviationMin)}m Ø
                        </span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schichtplan-Vorschau: nächste 8h */}
      {upcomingShifts.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <CalendarClock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-char">Schichtplan (nächste 8h)</h3>
            <span className="ml-auto text-xs text-stone-400">{upcomingShifts.length} {upcomingShifts.length === 1 ? 'Schicht' : 'Schichten'}</span>
          </div>
          <div className="space-y-2">
            {upcomingShifts
              .sort((a, b) => new Date(a.planned_start).getTime() - new Date(b.planned_start).getTime())
              .map((shift) => {
                const start = new Date(shift.planned_start);
                const end = new Date(shift.planned_end);
                const now = Date.now();
                const isActive = shift.status === 'active' || (start.getTime() <= now && end.getTime() >= now && shift.status !== 'completed' && shift.status !== 'cancelled');
                const isUpcoming = !isActive && start.getTime() > now;
                const isMissed = shift.status === 'missed' || (start.getTime() < now && shift.status === 'scheduled');
                const minutesToStart = Math.round((start.getTime() - now) / 60_000);
                const durationH = Math.round((end.getTime() - start.getTime()) / 3_600_000 * 10) / 10;
                const vehicle = shift.driver?.vehicle ?? '';
                const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗', fuss: '🚶' };
                const fmt = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={shift.id} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    isActive ? 'border-emerald-200 bg-emerald-50' :
                    isMissed ? 'border-red-100 bg-red-50 opacity-60' :
                    'border-stone-100 bg-stone-50'
                  }`}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-stone-200 text-base shrink-0">
                      {vehicleEmoji[vehicle] ?? '🚲'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-char text-sm truncate">
                        {shift.driver?.name ?? 'Fahrer'}
                      </div>
                      <div className="text-xs text-stone-500">
                        {fmt(start)} – {fmt(end)} · {durationH}h
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {isActive ? (
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Aktiv</span>
                      ) : isMissed ? (
                        <span className="rounded-full bg-red-400 px-2 py-0.5 text-[10px] font-bold text-white uppercase">Fehlt</span>
                      ) : isUpcoming && minutesToStart <= 60 ? (
                        <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-matcha-900 uppercase">in {minutesToStart} Min</span>
                      ) : (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">{fmt(start)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Live Fahrer-Status */}
      {liveDrivers.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-1 flex items-center gap-2">
            <Truck className="w-5 h-5 text-orange-500" />
            Live Fahrer-Status
          </h3>
          <p className="text-sm text-steel mb-4">
            {liveDrivers.filter(d => d.active).length} online · {liveDrivers.filter(d => d.active && d.active_batch).length} im Einsatz
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {liveDrivers.map(driver => {
              const isDelivering = driver.active && driver.active_batch != null;
              const isFree = driver.active && driver.active_batch == null;
              return (
                <div
                  key={driver.id}
                  className={`rounded-xl border-2 p-4 ${
                    isDelivering ? 'border-orange-200 bg-orange-50' :
                    isFree ? 'border-emerald-200 bg-emerald-50' :
                    'border-stone-200 bg-stone-50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-char">{driver.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isDelivering ? 'bg-orange-500 text-white' :
                      isFree ? 'bg-emerald-500 text-white' :
                      'bg-stone-300 text-stone-700'
                    }`}>
                      {isDelivering ? 'Liefert' : isFree ? 'Frei' : 'Offline'}
                    </span>
                  </div>
                  {driver.active_batch && (
                    <div className="text-xs text-stone-600 space-y-0.5">
                      <div>{driver.active_batch.stop_count} Stops</div>
                      {driver.active_batch.zone && <div>Zone {driver.active_batch.zone}</div>}
                    </div>
                  )}
                  {driver.live_position && (
                    <div className={`mt-2 text-[10px] font-medium ${
                      driver.live_position.seconds_stale > 120 ? 'text-red-500' :
                      driver.live_position.seconds_stale > 60 ? 'text-orange-500' :
                      'text-emerald-600'
                    }`}>
                      GPS vor {driver.live_position.seconds_stale}s
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-stone-400">{driver.total_deliveries} Lieferungen gesamt</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fahrer-Effizienz Schicht-Zusammenfassung */}
      {liveDrivers.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-600" />
            Fahrer-Effizienz (Schicht)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 text-stone-500 font-medium">Fahrer</th>
                  <th className="text-right py-2 text-stone-500 font-medium">Lieferungen</th>
                  <th className="text-right py-2 text-stone-500 font-medium">Status</th>
                  <th className="text-right py-2 text-stone-500 font-medium">GPS</th>
                  <th className="py-2 px-2 text-stone-500 font-medium">Auslastung</th>
                </tr>
              </thead>
              <tbody>
                {liveDrivers
                  .sort((a, b) => b.total_deliveries - a.total_deliveries)
                  .map((driver) => {
                    const maxDeliveries = Math.max(...liveDrivers.map((d) => d.total_deliveries), 1);
                    const pct = Math.round((driver.total_deliveries / maxDeliveries) * 100);
                    const isDelivering = driver.active && driver.active_batch != null;
                    const isFree = driver.active && driver.active_batch == null;
                    const gpsFresh = driver.live_position && driver.live_position.seconds_stale < 60;
                    return (
                      <tr key={driver.id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                        <td className="py-2.5 font-semibold text-char">{driver.name}</td>
                        <td className="py-2.5 text-right font-bold text-char tabular-nums">{driver.total_deliveries}</td>
                        <td className="py-2.5 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            isDelivering ? 'bg-orange-100 text-orange-700' :
                            isFree ? 'bg-emerald-100 text-emerald-700' :
                            'bg-stone-100 text-stone-500'
                          }`}>
                            {isDelivering ? `${driver.active_batch?.stop_count ?? 1} Stops` : isFree ? 'Frei' : 'Offline'}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {driver.live_position ? (
                            <span className={`text-xs font-medium ${gpsFresh ? 'text-emerald-600' : 'text-red-500'}`}>
                              {gpsFresh ? '● Live' : `${driver.live_position.seconds_stale}s alt`}
                            </span>
                          ) : (
                            <span className="text-xs text-stone-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-violet-400 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-stone-500 w-8 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          {liveDrivers.length === 0 && (
            <p className="text-sm text-stone-400 text-center py-6">Keine Fahrer aktiv</p>
          )}
        </div>
      )}

      {/* Liefer-Heatmap: Top-Zonen */}
      {heatmapPoints.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-rose-500" />
            Bestellungen nach Zone (heute)
          </h3>
          <div className="space-y-2">
            {heatmapPoints.map(({ zone, count }, i) => {
              const max = heatmapPoints[0]?.count ?? 1
              const pct = Math.round((count / max) * 100)
              const zoneColor =
                zone === 'A' ? 'bg-emerald-400' :
                zone === 'B' ? 'bg-blue-400' :
                zone === 'C' ? 'bg-amber-400' :
                zone === 'D' ? 'bg-red-400' : 'bg-stone-300'
              return (
                <div key={zone + i} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${zoneColor}`}>
                    {zone}
                  </span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${zoneColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right font-bold tabular-nums text-char">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top-Artikel heute */}
      {(() => {
        const itemCounts: Record<string, number> = {};
        for (const order of completedOrders) {
          for (const item of (order.items ?? []) as { name: string; quantity?: number }[]) {
            itemCounts[item.name] = (itemCounts[item.name] ?? 0) + (item.quantity ?? 1);
          }
        }
        const topItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (topItems.length === 0) return null;
        const maxCount = topItems[0][1];
        return (
          <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-char flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                Top-Artikel heute
              </h3>
              <span className="text-xs text-stone-400">{completedOrders.length} abgeschlossen</span>
            </div>
            <div className="space-y-2.5">
              {topItems.map(([name, count], i) => {
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={name} className="flex items-center gap-3 text-sm">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-stone-300 text-white' :
                      i === 2 ? 'bg-orange-200 text-orange-800' :
                      'bg-stone-100 text-stone-500'
                    }`}>{i + 1}</span>
                    <span className="flex-1 min-w-0 truncate font-medium text-char">{name}</span>
                    <div className="w-24 h-2 bg-stone-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-6 text-right font-bold tabular-nums text-char shrink-0">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Fahrer-Tagesranking */}
      {driverPerf.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Fahrer-Tagesranking
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100">
                  <th className="text-left py-2 font-medium text-stone-500">Fahrer</th>
                  <th className="text-right py-2 font-medium text-stone-500">Heute</th>
                  <th className="text-right py-2 font-medium text-stone-500">Gestern</th>
                  <th className="text-right py-2 font-medium text-stone-500">Trend</th>
                  <th className="text-right py-2 font-medium text-stone-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {driverPerf
                  .sort((a, b) => b.deliveries_today - a.deliveries_today)
                  .map((d, i) => {
                    const delta = d.deliveries_today - d.deliveries_yesterday
                    const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗', car: '🚗' }
                    const isActive = !!d.active_batch_id
                    return (
                      <tr key={d.driver_id} className="border-b border-stone-50 hover:bg-stone-50 transition">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black ${i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-stone-300 text-white' : 'bg-stone-100 text-stone-500'}`}>
                              {i + 1}
                            </span>
                            <span className="font-semibold text-char">{d.employee_name ?? '—'}</span>
                            <span className="text-base">{vehicleEmoji[d.vehicle] ?? '🚲'}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-black text-char tabular-nums text-lg">{d.deliveries_today}</td>
                        <td className="py-3 text-right text-stone-400 tabular-nums">{d.deliveries_yesterday}</td>
                        <td className="py-3 text-right">
                          {delta !== 0 ? (
                            <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${delta > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
                            </span>
                          ) : (
                            <span className="text-stone-300 text-xs">–</span>
                          )}
                        </td>
                        <td className="py-3 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isActive ? 'bg-orange-100 text-orange-700' : d.state === 'available' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                            {isActive ? 'Liefert' : d.state === 'available' ? 'Frei' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 15-Minuten Tagesgang */}
      <ShiftHeatmap15Min orders={orders} completedOrders={completedOrders} />

      {/* Bedarfsvorhersage: nächste 6 Stunden */}
      {forecastSlots.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-semibold text-char">Bedarfsvorhersage (nächste 6h)</h3>
            <span className="ml-auto text-xs text-stone-400">KI-basiert · letzte 8 Wochen</span>
          </div>
          <div className="space-y-2">
            {forecastSlots.map((slot) => {
              const maxExp = Math.max(...forecastSlots.map(s => s.expectedOrders), 1)
              const pct = Math.round((slot.expectedOrders / maxExp) * 100)
              const barColor = slot.expectedOrders >= 10 ? 'bg-red-400' : slot.expectedOrders >= 6 ? 'bg-amber-400' : 'bg-emerald-400'
              const now = new Date()
              const [hStr] = slot.hourLocal.split(':')
              const slotH = parseInt(hStr, 10)
              const isCurrentHour = now.getHours() === slotH
              return (
                <div key={slot.hourLocal} className={`flex items-center gap-3 rounded-xl px-3 py-2 transition ${isCurrentHour ? 'bg-amber-50 border border-amber-200' : 'bg-stone-50'}`}>
                  <span className={`w-14 shrink-0 text-sm font-bold tabular-nums ${isCurrentHour ? 'text-amber-700' : 'text-steel'}`}>
                    {slot.hourLocal} Uhr
                  </span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-sm font-black tabular-nums text-char shrink-0">
                    {slot.expectedOrders}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    {Array.from({ length: slot.recommendedMinDrivers }).map((_, i) => (
                      <Truck key={i} className="w-3 h-3 text-blue-500" />
                    ))}
                    {slot.recommendedMinDrivers === 0 && <span className="text-xs text-stone-300">—</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-stone-400">
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-emerald-400" /> &lt;6 Bestellungen</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> 6–9</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-red-400" /> ≥10</span>
            <span className="flex items-center gap-1 ml-auto"><Truck className="w-3 h-3 text-blue-500" /> = empf. Fahrer</span>
          </div>
        </div>
      )}

      {/* Live-Umsatz Schicht */}
      <ShiftRevenuePanel orders={orders} completedOrders={completedOrders} deliveryStats={deliveryStats} />
    </div>
  )
}

/* ------------------------------ ShiftHeatmap15Min ------------------------------ */

function ShiftHeatmap15Min({ orders, completedOrders }: { orders: Order[]; completedOrders: Order[] }) {
  const allOrders = [...orders, ...completedOrders]

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayMs = today.getTime()

  const buckets: Record<number, number> = {}
  for (const o of allOrders) {
    const t = o.createdAt ? new Date(o.createdAt).getTime() : undefined
    if (!t || t < todayMs) continue
    const key = Math.floor((t - todayMs) / (15 * 60_000))
    buckets[key] = (buckets[key] ?? 0) + 1
  }

  if (Object.keys(buckets).length === 0) return null

  const maxCount = Math.max(...Object.values(buckets), 1)
  const nowKey = Math.floor((Date.now() - todayMs) / (15 * 60_000))
  // Show last 16 buckets (= 4 hours)
  const keys = Array.from({ length: 16 }, (_, i) => Math.max(0, nowKey - 15 + i))

  const data = keys.map((k) => ({
    key: k,
    count: buckets[k] ?? 0,
    label: new Date(todayMs + k * 15 * 60_000).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    isCurrent: k === nowKey,
  }))

  const totalWindow = data.reduce((s, d) => s + d.count, 0)
  const peakBucket = data.reduce((m, d) => (d.count > m.count ? d : m), data[0])

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-char flex items-center gap-2">
          <Activity className="w-5 h-5 text-saffron" />
          15-Min Tagesgang (letzte 4h)
        </h3>
        <div className="flex items-center gap-3 text-xs text-steel">
          <span>{totalWindow} Bestellungen</span>
          {peakBucket.count > 0 && (
            <span className="font-semibold text-char">
              Peak: {peakBucket.label} ({peakBucket.count}×)
            </span>
          )}
        </div>
      </div>
      <div className="flex items-end gap-0.5" style={{ height: 80 }}>
        {data.map(({ key, count, label, isCurrent }) => {
          const pct = count > 0 ? Math.max(8, Math.round((count / maxCount) * 100)) : 0
          return (
            <div key={key} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${label}: ${count}`}>
              <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
                <div
                  style={{ height: pct > 0 ? `${pct}%` : '2px' }}
                  className={[
                    'w-full rounded-t-sm transition-all duration-300',
                    isCurrent ? 'bg-saffron' :
                    count > 0 ? 'bg-stone-300 hover:bg-stone-400' :
                    'bg-stone-100',
                  ].join(' ')}
                />
              </div>
              {(isCurrent || key % 4 === 0) && (
                <div className={['text-[9px] tabular-nums truncate', isCurrent ? 'font-bold text-saffron' : 'text-stone-400'].join(' ')}>
                  {label}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-stone-400">
        <span>{data[0]?.label}</span>
        <span className="text-saffron font-bold">Jetzt</span>
      </div>
    </div>
  )
}

/* ------------------------------ ShiftRevenuePanel ------------------------------ */

function ShiftRevenuePanel({
  orders,
  completedOrders,
  deliveryStats,
}: {
  orders: Order[];
  completedOrders: Order[];
  deliveryStats: DeliveryStats;
}) {
  const allOrders = [...orders, ...completedOrders]
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Umsatz aus Bestellungen (Schätzwert aus lokalen Orders)
  const revenueByType: Record<string, number> = { lieferung: 0, abholung: 0, vor_ort: 0 }
  let totalRevenue = 0

  for (const o of allOrders) {
    if (['done', 'geliefert', 'abgeschlossen', 'abgeholt'].includes(o.status)) {
      const amount = (o as any).gesamtbetrag ?? (o as any).totalAmount ?? 0
      totalRevenue += amount
      const typ = (o as any).typ ?? 'vor_ort'
      revenueByType[typ] = (revenueByType[typ] ?? 0) + amount
    }
  }

  // Zahlungsart-Aufschlüsselung
  const byPayment: Record<string, number> = {}
  for (const o of allOrders) {
    const pay = (o as any).zahlungsart ?? 'unbekannt'
    const amount = (o as any).gesamtbetrag ?? 0
    byPayment[pay] = (byPayment[pay] ?? 0) + amount
  }

  // Delivery API Score ggf. anzeigen
  const avgDeliveryScore = deliveryStats?.scoring?.avg_score

  if (totalRevenue === 0 && !avgDeliveryScore) return null

  const barData = Object.entries(revenueByType)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: k === 'lieferung' ? 'Lieferung' : k === 'abholung' ? 'Abholung' : 'Vor Ort',
      value: Math.round(v * 100) / 100,
      color: k === 'lieferung' ? '#8b5cf6' : k === 'abholung' ? '#f59e0b' : '#10b981',
    }))

  const maxBar = Math.max(...barData.map((b) => b.value), 1)

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-char flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-violet-600" />
          Schicht-Umsatz
        </h3>
        <div className="text-2xl font-black text-char">
          {formatCurrency(totalRevenue)}
        </div>
      </div>

      {/* Umsatz nach Typ */}
      {barData.length > 0 && (
        <div className="space-y-2 mb-4">
          {barData.map(({ name, value, color }) => (
            <div key={name} className="flex items-center gap-3 text-sm">
              <span className="w-20 text-steel shrink-0">{name}</span>
              <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${(value / maxBar) * 100}%`, backgroundColor: color }}
                />
              </div>
              <span className="w-20 text-right font-semibold text-char tabular-nums">
                {formatCurrency(value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Zahlungsart */}
      {Object.keys(byPayment).length > 0 && (
        <div className="border-t border-stone-100 pt-4">
          <div className="text-xs font-semibold text-steel mb-2 uppercase tracking-wide">Nach Zahlungsart</div>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(byPayment)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3)
              .map(([pay, amount]) => (
                <div key={pay} className="rounded-xl bg-stone-50 p-3 border border-stone-100 text-center">
                  <div className="text-lg font-black text-char">{formatCurrency(amount)}</div>
                  <div className="text-xs text-steel mt-0.5 capitalize">
                    {pay === 'bar' ? '💵 Bar' : pay === 'karte' ? '💳 Karte' : pay === 'online' ? '🌐 Online' : pay}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Dispatch-Score Indikator */}
      {avgDeliveryScore != null && (
        <div className="border-t border-stone-100 mt-4 pt-4 flex items-center justify-between">
          <div className="text-sm text-steel flex items-center gap-2">
            <Target className="w-4 h-4 text-matcha-600" />
            Ø Dispatch-Qualität
          </div>
          <div className="flex items-center gap-2">
            <div className="w-32 h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  avgDeliveryScore >= 80 ? 'bg-emerald-400' :
                  avgDeliveryScore >= 60 ? 'bg-blue-400' :
                  avgDeliveryScore >= 40 ? 'bg-amber-400' :
                  'bg-red-400'
                }`}
                style={{ width: `${avgDeliveryScore}%` }}
              />
            </div>
            <span className={`font-black text-lg ${
              avgDeliveryScore >= 80 ? 'text-emerald-600' :
              avgDeliveryScore >= 60 ? 'text-blue-600' :
              'text-amber-600'
            }`}>
              {Math.round(avgDeliveryScore)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
