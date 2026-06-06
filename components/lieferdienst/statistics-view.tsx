'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Order } from '@/lib/lieferdienst/orders'
import { calculateDailyStats, formatCurrency, formatTime } from '@/lib/lieferdienst/statistics'
import { createClient } from '@/lib/supabase/client'
import {
  Activity, TrendingUp, Clock, CheckCircle, XCircle,
  Package, RefreshCw, Target, Truck, Users, DollarSign, BarChart3, Route, Zap, MapPin, Download, ShieldCheck, CalendarClock, Radio, Star, AlertTriangle, MessageSquare, ThumbsUp, ChevronUp, ChevronDown, Copy, Check as CheckIcon
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

type SatisfactionData = {
  totalRatings: number;
  avgRating: number;
  positiveRate: number;
  negativeRate: number;
  withComment: number;
  byDriver: { driver_id: string; name: string | null; avg_rating: number; count: number }[];
  recentComments: { rating: number; comment: string; created_at: string }[];
} | null;

type ActiveAlert = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  created_at: string;
};

type LiveDriver = {
  id: string;
  name: string;
  state: string;
  active: boolean;
  total_deliveries: number;
  live_position: { recorded_at: string; seconds_stale: number } | null;
  active_batch: { stop_count: number; state: string; zone: string | null } | null;
};

type EtaAccuracyData = {
  overall: { completedDeliveries: number; onTimeRate: number; avgErrorMin: number };
  byZone: { zone: string; vehicle: string; completedDeliveries: number; onTimeRate: number; avgErrorMin: number }[];
  _fallback?: boolean;
} | null;

type SurgeData = {
  status: {
    isActive: boolean;
    multiplier: number;
    driverBonusEur: number;
    currentQueueDepth: number;
    ordersPerHourEst: number;
    driverUtilizationPct: number;
    conditionsMet: boolean;
    ruleName: string | null;
  };
  surgeActivationsToday: number;
  todayTotalBonusPaidEur: number;
  todayDeliveriesDuringSurge: number;
  topDriverBonuses: { driver_name: string; total_bonus_today_eur: number; bonus_deliveries: number }[];
} | null;

type CoverageData = {
  summary: {
    total_slots: number;
    covered_slots: number;
    uncovered_slots: number;
    worst_gap: number;
  };
  coverage: {
    hour_of_day: number;
    day_of_week: number;
    scheduled_drivers: number;
    required_drivers: number;
    gap: number;
  }[];
} | null;

type FailedAttemptsData = {
  stats: {
    total: number;
    pending: number;
    resolved: number;
    resolutionRate: number;
    byReason: Record<string, number>;
    byResolution: Record<string, number>;
    avgResolutionHours: number | null;
  };
  attempts: {
    id: string;
    orderId: string;
    reason: string;
    attemptNumber: number;
    notes: string | null;
    nextAttemptAt: string | null;
    createdAt: string;
    bestellnummer: string | null;
    kundeName: string | null;
    kundeAdresse: string | null;
    driverName: string | null;
  }[];
} | null;

type PayoutSummaryData = {
  today: {
    activeDrivers: number;
    totalDeliveries: number;
    totalPayoutEur: number;
    avgPerDelivery: number;
  };
  pending: {
    draftPeriods: number;
    totalAmountEur: number;
  };
  topDriverToday: Array<{
    driverId: string;
    driverName: string;
    deliveries: number;
    totalEur: number;
  }>;
} | null;

type FranchiseSummaryData = {
  tenant_id: string;
  locations: {
    location_id: string;
    location_name: string;
    queue_depth: number;
    active_tours: number;
    cooking_now: number;
    oldest_queued_min: number | null;
    completed_today: number;
    active_alerts: number;
    critical_alerts: number;
    health: 'ok' | 'warning' | 'critical';
  }[];
  drivers: { drivers_online: number; drivers_idle: number; drivers_busy: number };
  alerts: { id: string; location_name: string; alert_type: string; severity: string; message: string; created_at: string }[];
  totals: { queue_depth: number; active_tours: number; cooking_now: number; completed_today: number; active_alerts: number; critical_alerts: number };
  _fallback?: true;
} | null;

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
  const [satisfactionData, setSatisfactionData] = useState<SatisfactionData>(null)
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([])
  const [dailyKpis, setDailyKpis] = useState<{
    orders: { total: number; delivery: number; pickup: number; completed: number; cancelled: number };
    revenue: { total: number | null; delivery: number | null; pickup: number | null; cash: number | null; card: number | null };
    activeDrivers: number;
  } | null>(null)
  const [etaAccuracy, setEtaAccuracy] = useState<EtaAccuracyData>(null)
  const [surgeData, setSurgeData] = useState<SurgeData>(null)
  const [coverageData, setCoverageData] = useState<CoverageData>(null)
  const [failedAttemptsData, setFailedAttemptsData] = useState<FailedAttemptsData>(null)
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummaryData>(null)
  const [payoutConfig, setPayoutConfig] = useState<{
    basePerDelivery: number;
    kmRate: number;
    peakMultiplier: number;
    bonusPerRatingPoint: number;
    minRatingForBonus: number;
    milestoneBonuses: Record<string, number>;
    locationId: string;
  } | null>(null)
  const [alertRules, setAlertRules] = useState<{
    id: string;
    alert_type: string;
    threshold_value: number;
    window_minutes: number;
    severity: 'info' | 'warning' | 'critical';
    enabled: boolean;
    location_id: string;
  }[]>([])
  const [franchiseSummary, setFranchiseSummary] = useState<FranchiseSummaryData>(null)
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
    fetch(`/api/delivery/admin/satisfaction?location_id=${locationId}&days=14`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.totalRatings > 0) setSatisfactionData(d) })
      .catch(() => {})
    fetch(`/api/delivery/admin/alerts?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.alerts?.length) setActiveAlerts(d.alerts) })
      .catch(() => {})
    const todayStr = new Date().toISOString().slice(0, 10)
    fetch(`/api/delivery/admin/reporting?type=daily&location_id=${locationId}&date=${todayStr}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.orders && !d._fallback) setDailyKpis({ orders: d.orders, revenue: d.revenue, activeDrivers: d.activeDrivers ?? 0 }) })
      .catch(() => {})
    fetch(`/api/delivery/admin/eta-accuracy?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.overall && !d._fallback) setEtaAccuracy(d) })
      .catch(() => {})
    fetch(`/api/delivery/admin/surge?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.status) setSurgeData(d) })
      .catch(() => {})
    fetch(`/api/delivery/admin/coverage?location_id=${locationId}&hours=12`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary && d.summary.total_slots > 0) setCoverageData(d) })
      .catch(() => {})
    Promise.all([
      fetch(`/api/delivery/admin/failed-attempts?location_id=${locationId}&action=list`).then(r => r.ok ? r.json() : null),
      fetch(`/api/delivery/admin/failed-attempts?location_id=${locationId}&action=stats&days=30`).then(r => r.ok ? r.json() : null),
    ]).then(([listData, statsData]) => {
      if (statsData?.stats && statsData.stats.total > 0) {
        setFailedAttemptsData({ stats: statsData.stats, attempts: listData?.attempts ?? [] })
      }
    }).catch(() => {})
    fetch(`/api/delivery/admin/payouts?view=summary&location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.summary) setPayoutSummary(d.summary) })
      .catch(() => {})
    fetch(`/api/delivery/admin/payout-config?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.config) {
          const c = d.config;
          setPayoutConfig({
            basePerDelivery: c.base_per_delivery ?? c.basePerDelivery ?? 3.00,
            kmRate: c.km_rate ?? c.kmRate ?? 0.25,
            peakMultiplier: c.peak_multiplier ?? c.peakMultiplier ?? 1.20,
            bonusPerRatingPoint: c.bonus_per_rating_point ?? c.bonusPerRatingPoint ?? 0.10,
            minRatingForBonus: c.min_rating_for_bonus ?? c.minRatingForBonus ?? 4.0,
            milestoneBonuses: c.milestone_bonuses ?? c.milestoneBonuses ?? {},
            locationId,
          })
        }
      })
      .catch(() => {})
    fetch(`/api/delivery/admin/alert-rules?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.rules?.length) setAlertRules(d.rules) })
      .catch(() => {})
    fetch('/api/delivery/admin/franchise')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.locations && d.locations.length >= 1 && !d._fallback) setFranchiseSummary(d) })
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

  const [rapportCopied, setRapportCopied] = useState(false)

  function handleCopyRapport() {
    const now = new Date()
    const done = completedOrders.filter(o => o.status === 'done')
    const rejected = completedOrders.filter(o => o.status === 'rejected')
    const revenue = done.reduce((s, o) => s + ((o as any).gesamtbetrag ?? 0), 0)
    const lines = [
      `📊 Schicht-Rapport — ${now.toLocaleDateString('de-DE')} ${now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`,
      ``,
      `✅ Fertige Bestellungen: ${done.length}`,
      `❌ Abgelehnt: ${rejected.length}`,
      `💶 Umsatz (fertig): ${revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`,
      `📦 Aktiv: ${orders.filter(o => !['done', 'rejected'].includes(o.status)).length}`,
      liveDrivers.length > 0 ? `🚗 Fahrer online: ${liveDrivers.filter(d => d.active).length}` : '',
      deliveryStats ? `🗺 Touren heute: ${deliveryStats.tours.total}` : '',
      slaData ? `⏱ Pünktlichkeit: ${slaData.summary.onTimePct}%` : '',
      ``,
      `Stand: ${now.toLocaleString('de-DE')}`,
    ].filter(Boolean)
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setRapportCopied(true)
      setTimeout(() => setRapportCopied(false), 3000)
    }).catch(() => {})
  }

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
            onClick={handleCopyRapport}
            className={`flex items-center gap-1.5 text-xs font-medium transition px-3 py-1.5 rounded-lg border ${rapportCopied ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-stone-200 text-steel hover:text-char hover:bg-stone-50'}`}
            title="Schicht-Rapport in die Zwischenablage kopieren"
          >
            {rapportCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {rapportCopied ? 'Kopiert!' : 'Rapport'}
          </button>
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

      {/* Bestellgeschwindigkeit — Ampel-Indikator */}
      {ratePerHour > 0 && (() => {
        const level = ratePerHour >= 10 ? 'hoch' : ratePerHour >= 5 ? 'normal' : 'niedrig'
        const levelColor = level === 'hoch' ? 'border-red-200 bg-red-50' : level === 'normal' ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-50'
        const dotColor = level === 'hoch' ? 'bg-red-500' : level === 'normal' ? 'bg-amber-500' : 'bg-stone-400'
        const textColor = level === 'hoch' ? 'text-red-700' : level === 'normal' ? 'text-amber-700' : 'text-stone-500'
        const pct = Math.min(100, Math.round((ratePerHour / 15) * 100))
        const label = level === 'hoch' ? 'Stoßzeit' : level === 'normal' ? 'Normal' : 'Ruhig'
        return (
          <div className={`rounded-2xl border p-4 flex items-center gap-4 ${levelColor}`}>
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-current/10">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-50 ${dotColor} ${level === 'hoch' ? 'animate-ping' : ''}`} />
              <span className={`relative inline-flex h-5 w-5 rounded-full ${dotColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-sm font-bold ${textColor}`}>{label} · {ratePerHour} Bestellungen/h</span>
                <span className="text-xs text-stone-400">{ordersLastHour} letzte Stunde</span>
              </div>
              <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${level === 'hoch' ? 'bg-red-400' : level === 'normal' ? 'bg-amber-400' : 'bg-stone-300'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        )
      })()}

      {/* Betriebsalarme */}
      {activeAlerts.length > 0 && (
        <div className={`rounded-2xl border p-4 ${activeAlerts.some(a => a.severity === 'critical') ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className={`w-4 h-4 ${activeAlerts.some(a => a.severity === 'critical') ? 'text-red-600' : 'text-amber-600'}`} />
            <span className={`text-sm font-bold uppercase tracking-wider ${activeAlerts.some(a => a.severity === 'critical') ? 'text-red-700' : 'text-amber-700'}`}>
              Betriebsalarme · {activeAlerts.length} aktiv
            </span>
            {activeAlerts.some(a => a.severity === 'critical') && (
              <span className="ml-auto inline-flex h-2 w-2 rounded-full bg-red-500 animate-ping" />
            )}
          </div>
          <div className="space-y-2">
            {activeAlerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${
                alert.severity === 'critical' ? 'border-red-200 bg-red-100/60' :
                alert.severity === 'warning' ? 'border-amber-200 bg-amber-100/60' :
                'border-stone-200 bg-stone-100/60'
              }`}>
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  alert.severity === 'critical' ? 'bg-red-500 text-white' :
                  alert.severity === 'warning' ? 'bg-amber-500 text-white' :
                  'bg-stone-400 text-white'
                }`}>
                  {alert.severity === 'critical' ? 'Kritisch' : alert.severity === 'warning' ? 'Warnung' : 'Info'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-char truncate">{alert.title}</div>
                  <div className="text-xs text-stone-600 mt-0.5 line-clamp-1">{alert.message}</div>
                </div>
                <span className="shrink-0 text-[10px] text-stone-400 tabular-nums">
                  {new Date(alert.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert-Regeln Konfiguration */}
      {alertRules.length > 0 && (
        <AlertRulesPanel
          rules={alertRules}
          onRuleChanged={(updated) => setAlertRules(prev => prev.map(r => r.id === updated.id ? updated : r))}
        />
      )}

      {/* Echtzeit-Bestellungseingang */}
      <LiveOrderFeed locationId={(orders[0] as any)?.location_id ?? (completedOrders[0] as any)?.location_id} />

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

      {/* DB-verifizierter Tagesbericht (aus Reporting-API) */}
      {dailyKpis && (dailyKpis.orders.total > 0 || (dailyKpis.revenue.total ?? 0) > 0) && (
        <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-char">Tagesbericht · DB-verifiziert</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Echtdaten
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100 text-center">
              <div className="text-2xl font-black text-char">{dailyKpis.orders.total}</div>
              <div className="text-[10px] text-steel mt-0.5 uppercase tracking-wide">Bestellungen</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100 text-center">
              <div className="text-2xl font-black text-violet-600">{dailyKpis.orders.delivery}</div>
              <div className="text-[10px] text-steel mt-0.5 uppercase tracking-wide">Lieferungen</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100 text-center">
              <div className="text-2xl font-black text-amber-600">{dailyKpis.orders.pickup}</div>
              <div className="text-[10px] text-steel mt-0.5 uppercase tracking-wide">Abholungen</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-3 border border-stone-100 text-center">
              <div className="text-2xl font-black text-emerald-600">{dailyKpis.orders.completed}</div>
              <div className="text-[10px] text-steel mt-0.5 uppercase tracking-wide">Abgeschlossen</div>
            </div>
          </div>
          {dailyKpis.revenue.total != null && dailyKpis.revenue.total > 0 && (
            <div className="border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-steel uppercase tracking-wide">Umsatz (DB)</span>
                <span className="font-display text-xl font-black text-char">
                  {dailyKpis.revenue.total.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {dailyKpis.revenue.cash != null && dailyKpis.revenue.cash > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2">
                    <div className="text-sm font-black text-amber-700">
                      {dailyKpis.revenue.cash.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="text-[9px] text-steel mt-0.5">💵 Bar</div>
                  </div>
                )}
                {dailyKpis.revenue.card != null && dailyKpis.revenue.card > 0 && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-2">
                    <div className="text-sm font-black text-blue-700">
                      {dailyKpis.revenue.card.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="text-[9px] text-steel mt-0.5">💳 Karte</div>
                  </div>
                )}
                {dailyKpis.revenue.delivery != null && dailyKpis.revenue.pickup != null && (
                  <div className="rounded-lg bg-violet-50 border border-violet-100 p-2">
                    <div className="text-sm font-black text-violet-700">
                      {(dailyKpis.revenue.total - (dailyKpis.revenue.cash ?? 0) - (dailyKpis.revenue.card ?? 0)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                    </div>
                    <div className="text-[9px] text-steel mt-0.5">🌐 Online</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Schicht-Performance-Übersicht: Recharts Balkendiagramm Bestellungen je Stunde */}
      {hourlyData.filter(d => d.orders > 0).length >= 2 && (() => {
        const nowH = new Date().getHours();
        const displayData = hourlyData.filter(d => d.orders > 0 || d.hour.startsWith(String(nowH)));
        const maxOrders = Math.max(...displayData.map(d => d.orders), 1);
        const totalDelivered = completedOrders.length;
        const totalRevenue = [...orders, ...completedOrders].reduce((s, o) => s + ((o as any).gesamtbetrag ?? (o as any).total ?? 0), 0);
        const peakIdx = displayData.reduce((best, d, i) => d.orders > displayData[best].orders ? i : best, 0);
        const peakLabel = displayData[peakIdx]?.hour ?? '';

        return (
          <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-bold text-char">Bestellungen je Stunde</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500">
                {peakLabel && <span className="font-semibold text-char">Peak: {peakLabel}</span>}
                <span className="font-semibold text-emerald-700">{totalDelivered} geliefert</span>
                {totalRevenue > 0 && (
                  <span className="font-semibold text-violet-700">
                    {totalRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={displayData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: '#f1f5f9' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload as { hour: string; orders: number };
                    return (
                      <div className="rounded-lg bg-matcha-900 px-2.5 py-1.5 text-[11px] text-white shadow-lg">
                        <div className="font-bold">{d.hour} Uhr</div>
                        <div>{d.orders} Bestellung{d.orders !== 1 ? 'en' : ''}</div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {displayData.map((entry, index) => {
                    const pct = maxOrders > 0 ? entry.orders / maxOrders : 0;
                    const color =
                      pct >= 0.9 ? '#ef4444' :
                      pct >= 0.7 ? '#f97316' :
                      pct >= 0.4 ? '#f59e0b' : '#10b981';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Kompakte KPI-Leiste unter dem Chart */}
            <div className="mt-3 pt-3 border-t border-stone-100 grid grid-cols-4 gap-2 text-center">
              {[
                { label: 'Gesamt', value: stats.totalOrders, color: 'text-char' },
                { label: 'Geliefert', value: totalDelivered, color: 'text-emerald-700' },
                { label: 'Abgelehnt', value: stats.rejectedOrders, color: stats.rejectedOrders > 0 ? 'text-red-600' : 'text-stone-400' },
                { label: 'Ø Wert', value: avgOrderValue > 0 ? `${avgOrderValue.toFixed(0)} €` : '–', color: 'text-violet-700' },
              ].map(kpi => (
                <div key={kpi.label}>
                  <div className={`font-black text-lg leading-tight ${kpi.color}`}>{kpi.value}</div>
                  <div className="text-[9px] text-stone-400 uppercase tracking-wide mt-0.5">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
                {(() => {
                  const sorted = [...driverPerf].sort((a, b) => b.deliveries_today - a.deliveries_today);
                  const maxDeliveries = Math.max(...sorted.map(d => d.deliveries_today), 1);
                  const vehicleEmoji: Record<string, string> = { bike: '🚲', ebike: '🛵', scooter: '🛴', auto: '🚗', car: '🚗' };
                  return sorted.map((d, i) => {
                    const delta = d.deliveries_today - d.deliveries_yesterday;
                    const isActive = !!d.active_batch_id;
                    const barPct = Math.round((d.deliveries_today / maxDeliveries) * 100);
                    const barColor = i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-stone-400' : i === 2 ? 'bg-orange-300' : 'bg-emerald-300';
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
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${barPct}%` }} />
                            </div>
                            <span className="font-black text-char tabular-nums text-lg w-6 text-right">{d.deliveries_today}</span>
                          </div>
                        </td>
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
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kundenzufriedenheit */}
      {satisfactionData && (
        <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
          <h3 className="text-lg font-semibold text-char mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-400" />
            Kundenzufriedenheit · 14 Tage
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className={`text-3xl font-black ${satisfactionData.avgRating >= 4 ? 'text-emerald-600' : satisfactionData.avgRating >= 3 ? 'text-amber-600' : 'text-red-600'}`}>
                {satisfactionData.avgRating.toFixed(1)}
              </div>
              <div className="flex justify-center gap-0.5 mt-1">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-3 h-3 ${s <= Math.round(satisfactionData.avgRating) ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                ))}
              </div>
              <div className="text-xs text-stone-500 mt-1">{satisfactionData.totalRatings} Bewertungen</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className="text-3xl font-black text-emerald-600">{Math.round(satisfactionData.positiveRate)}%</div>
              <div className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1">
                <ThumbsUp className="w-3 h-3" /> Positiv
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className="text-3xl font-black text-red-500">{Math.round(satisfactionData.negativeRate)}%</div>
              <div className="text-xs text-stone-500 mt-1">Negativ</div>
            </div>
            <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
              <div className="text-3xl font-black text-blue-600">{satisfactionData.withComment}</div>
              <div className="text-xs text-stone-500 mt-1 flex items-center justify-center gap-1">
                <MessageSquare className="w-3 h-3" /> Kommentare
              </div>
            </div>
          </div>
          {/* Positiv-Rate Balken */}
          <div className="mb-5">
            <div className="flex justify-between text-xs text-stone-500 mb-1">
              <span>Positiv-Rate</span>
              <span className="font-bold">{Math.round(satisfactionData.positiveRate)}%</span>
            </div>
            <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${satisfactionData.positiveRate >= 80 ? 'bg-emerald-400' : satisfactionData.positiveRate >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                style={{ width: `${satisfactionData.positiveRate}%` }}
              />
            </div>
          </div>
          {/* Top Fahrer nach Bewertung */}
          {satisfactionData.byDriver.length > 0 && (
            <div className="mb-5">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Fahrer-Bewertungen</div>
              <div className="space-y-1.5">
                {satisfactionData.byDriver.slice(0, 4).map((d) => (
                  <div key={d.driver_id} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 truncate font-medium text-char">{d.name ?? '—'}</span>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= Math.round(d.avg_rating) ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                      ))}
                    </div>
                    <span className="w-8 text-right font-bold tabular-nums text-char">{d.avg_rating.toFixed(1)}</span>
                    <span className="text-xs text-stone-400 w-16 text-right">{d.count} Bew.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Letzte Kommentare */}
          {satisfactionData.recentComments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Letzte Kommentare</div>
              <div className="space-y-2">
                {satisfactionData.recentComments.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5 rounded-xl bg-stone-50 p-3 border border-stone-100">
                    <div className="flex gap-0.5 mt-0.5 shrink-0">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-3 h-3 ${s <= c.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                      ))}
                    </div>
                    <p className="flex-1 text-sm text-char line-clamp-2">{c.comment}</p>
                    <span className="shrink-0 text-[10px] text-stone-400 tabular-nums">
                      {new Date(c.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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

      {/* Schichtziele */}
      <ShiftTargetPanel
        orders={orders}
        completedOrders={completedOrders}
        slaData={slaData}
        avgEtaMin={avgEtaMin}
      />

      {/* Live-Umsatz Schicht */}
      <ShiftRevenuePanel orders={orders} completedOrders={completedOrders} deliveryStats={deliveryStats} />

      {/* Fahrer-Bestenliste heute */}
      <DriverLeaderboard driverPerf={driverPerf} />

      {/* ETA-Genauigkeit */}
      {etaAccuracy && etaAccuracy.overall.completedDeliveries > 0 && (
        <EtaAccuracyPanel data={etaAccuracy} />
      )}

      {/* Surge-Preis Status */}
      {surgeData && (
        <SurgePricingPanel data={surgeData} />
      )}

      {/* Fahrer-Abdeckung nächste 12h */}
      {coverageData && coverageData.summary.total_slots > 0 && (
        <CoverageAnalysisPanel data={coverageData} />
      )}

      {/* Push-Benachrichtigungen Statistik */}
      <PushNotificationStats locationId={(orders[0] as any)?.location_id ?? (completedOrders[0] as any)?.location_id ?? null} />

      {/* Fehlgeschlagene Zustellversuche */}
      {failedAttemptsData && (
        <FailedAttemptsPanel data={failedAttemptsData} />
      )}

      {/* Fahrer-Vergütung heute */}
      {payoutSummary && payoutSummary.today.totalDeliveries > 0 && (
        <PayoutSummaryPanel data={payoutSummary} />
      )}

      {/* Vergütungs-Konfiguration */}
      {payoutConfig && (
        <PayoutConfigPanel
          config={payoutConfig}
          onSaved={(updated) => setPayoutConfig(updated)}
        />
      )}

      {/* Franchise Echtzeit-Übersicht (mehrere Standorte) */}
      {franchiseSummary && franchiseSummary.locations.length > 1 && (
        <FranchiseOverviewPanel data={franchiseSummary} />
      )}
    </div>
  )
}

/* ------------------------------ DriverLeaderboard ------------------------------ */

type DriverPerfEntry = {
  driver_id: string;
  employee_name: string | null;
  vehicle: string;
  state: string;
  deliveries_today: number;
  deliveries_yesterday: number;
  active_batch_id: string | null;
};

const VEHICLE_EMOJI: Record<string, string> = {
  auto: '🚗', bike: '🚲', ebike: '⚡', roller: '🛵', scooter: '🛵', fuss: '🚶',
};

function DriverLeaderboard({ driverPerf }: { driverPerf: DriverPerfEntry[] }) {
  if (driverPerf.length === 0) return null;
  const sorted = [...driverPerf].sort((a, b) => b.deliveries_today - a.deliveries_today);
  const top5 = sorted.slice(0, 5);
  const maxDeliveries = top5[0]?.deliveries_today ?? 0;
  if (maxDeliveries === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <Star className="w-4 h-4 text-amber-500" />
        <span className="font-bold text-sm uppercase tracking-wider text-char">Fahrer-Bestenliste · Heute</span>
      </div>
      <div className="space-y-2">
        {top5.map((d, i) => {
          const pct = maxDeliveries > 0 ? Math.round((d.deliveries_today / maxDeliveries) * 100) : 0;
          const isActive = !!d.active_batch_id;
          const vEmoji = VEHICLE_EMOJI[d.vehicle] ?? '🚴';
          const deltaYesterday = d.deliveries_today - d.deliveries_yesterday;
          const barColor = i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-stone-400' : i === 2 ? 'bg-orange-400' : 'bg-stone-200';
          const medalLabel = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          return (
            <div key={d.driver_id} className="flex items-center gap-3">
              <div className="w-7 text-center shrink-0">
                <span className="text-sm font-black">{medalLabel}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-semibold text-sm text-char truncate">
                    {vEmoji} {d.employee_name ?? `Fahrer ${d.driver_id.slice(0, 4)}`}
                  </span>
                  {isActive && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Aktive Tour" />
                  )}
                  {deltaYesterday !== 0 && d.deliveries_yesterday > 0 && (
                    <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 shrink-0 ${deltaYesterday > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {deltaYesterday > 0 ? '+' : ''}{deltaYesterday}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-black text-char shrink-0 tabular-nums w-8 text-right">
                    {d.deliveries_today}
                  </span>
                  <span className="text-[10px] text-stone-400 shrink-0">Lief.</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length > 5 && (
        <div className="mt-3 text-[10px] text-stone-400 text-center">
          +{sorted.length - 5} weitere Fahrer
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ShiftTargetPanel ------------------------------ */

function ShiftTargetPanel({
  orders,
  completedOrders,
  slaData,
  avgEtaMin,
}: {
  orders: Order[];
  completedOrders: Order[];
  slaData: SlaData;
  avgEtaMin: number;
}) {
  // Schichtziele (anpassbar — hier als sinnvolle Defaults)
  const TARGETS = {
    orders: 60,
    completionRate: 95, // Prozent
    avgPrepMin: 20,
    onTimePct: 90,
  }

  const allOrders = [...orders, ...completedOrders]
  const done = completedOrders.filter(o => o.status === 'done').length
  const rejected = completedOrders.filter(o => o.status === 'rejected').length
  const total = allOrders.length
  const completionRate = total > 0 ? Math.round(((total - rejected) / total) * 100) : 0
  const onTimePct = slaData?.summary.onTimePct ?? null

  type TargetItem = {
    label: string
    current: number
    target: number
    unit: string
    higherIsBetter: boolean
    color: string
  }

  const targets: TargetItem[] = [
    {
      label: 'Bestellungen',
      current: total,
      target: TARGETS.orders,
      unit: '',
      higherIsBetter: true,
      color: 'bg-violet-400',
    },
    {
      label: 'Fertigstellungsrate',
      current: completionRate,
      target: TARGETS.completionRate,
      unit: '%',
      higherIsBetter: true,
      color: 'bg-emerald-400',
    },
    {
      label: 'Ø Zubereitungszeit',
      current: avgEtaMin,
      target: TARGETS.avgPrepMin,
      unit: ' Min',
      higherIsBetter: false,
      color: 'bg-amber-400',
    },
    ...(onTimePct != null
      ? [{
          label: 'Pünktlichkeit',
          current: Math.round(onTimePct),
          target: TARGETS.onTimePct,
          unit: '%',
          higherIsBetter: true,
          color: 'bg-blue-400',
        }]
      : []),
  ]

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-5 h-5 text-matcha-600" />
        <h3 className="text-lg font-semibold text-char">Schichtziele</h3>
        <span className="ml-auto text-xs text-stone-400">Tagesziele · aktueller Fortschritt</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {targets.map((t) => {
          const pct = t.target > 0 ? Math.min(100, Math.round((t.current / t.target) * 100)) : 0
          const achieved = t.higherIsBetter ? t.current >= t.target : t.current <= t.target
          const nearMiss = !achieved && (t.higherIsBetter
            ? t.current >= t.target * 0.9
            : t.current <= t.target * 1.1)
          const statusColor = achieved ? 'text-emerald-600' : nearMiss ? 'text-amber-600' : 'text-red-600'
          const barColor = achieved ? 'bg-emerald-400' : nearMiss ? 'bg-amber-400' : t.color
          const displayPct = t.higherIsBetter ? pct : Math.min(100, Math.round((t.target / Math.max(t.current, 1)) * 100))
          return (
            <div key={t.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-steel">{t.label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`font-black text-base tabular-nums ${statusColor}`}>
                    {t.current}{t.unit}
                  </span>
                  <span className="text-xs text-stone-400">/ {t.target}{t.unit}</span>
                  {achieved && <span className="text-emerald-500 text-sm">✓</span>}
                </div>
              </div>
              <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${barColor}`}
                  style={{ width: `${displayPct}%` }}
                />
              </div>
              <div className="text-[10px] text-stone-400 text-right tabular-nums">
                {achieved
                  ? 'Ziel erreicht!'
                  : t.higherIsBetter
                    ? `Noch ${t.target - t.current}${t.unit} zum Ziel`
                    : `${t.current - t.target}${t.unit} über Ziel`}
              </div>
            </div>
          )
        })}
      </div>
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

/* ------------------------------ EtaAccuracyPanel ------------------------------ */

function EtaAccuracyPanel({ data }: { data: NonNullable<EtaAccuracyData> }) {
  const onTimePct = Math.round(data.overall.onTimeRate * 100)
  const errorMin = Math.round(Math.abs(data.overall.avgErrorMin))
  const early = data.overall.avgErrorMin < 0
  const topZones = [...data.byZone]
    .filter(z => z.completedDeliveries >= 3)
    .sort((a, b) => b.completedDeliveries - a.completedDeliveries)
    .slice(0, 6)

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Target className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-char">ETA-Genauigkeit</h3>
        <span className="ml-auto text-xs text-stone-400">{data.overall.completedDeliveries} Lieferungen ausgewertet</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className={`text-3xl font-black ${onTimePct >= 80 ? 'text-emerald-600' : onTimePct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {onTimePct}%
          </div>
          <div className="text-xs text-stone-500 mt-1">Pünktlich-Rate</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className={`text-3xl font-black ${errorMin <= 5 ? 'text-emerald-600' : errorMin <= 10 ? 'text-amber-600' : 'text-red-600'}`}>
            {early ? '-' : '+'}{errorMin}m
          </div>
          <div className="text-xs text-stone-500 mt-1">{early ? 'Ø früher' : 'Ø später'} als ETA</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className="text-3xl font-black text-char">{data.overall.completedDeliveries}</div>
          <div className="text-xs text-stone-500 mt-1">Lieferungen</div>
        </div>
      </div>

      <div className="mb-2 flex justify-between text-xs text-stone-500">
        <span>Pünktlichkeitsrate</span>
        <span className="font-bold">{onTimePct}%</span>
      </div>
      <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-5">
        <div
          className={`h-full rounded-full transition-all ${onTimePct >= 80 ? 'bg-emerald-400' : onTimePct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
          style={{ width: `${onTimePct}%` }}
        />
      </div>

      {topZones.length > 0 && (
        <>
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Nach Zone</div>
          <div className="space-y-2">
            {topZones.map((z) => {
              const zPct = Math.round(z.onTimeRate * 100)
              const zErr = Math.round(Math.abs(z.avgErrorMin))
              const zEarly = z.avgErrorMin < 0
              const zColor = z.zone === 'A' ? 'bg-emerald-400' : z.zone === 'B' ? 'bg-blue-400' : z.zone === 'C' ? 'bg-amber-400' : 'bg-red-400'
              return (
                <div key={`${z.zone}-${z.vehicle}`} className="flex items-center gap-3 text-sm">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${zColor}`}>
                    {z.zone}
                  </span>
                  <span className="text-xs text-stone-500 shrink-0 w-14 capitalize">{z.vehicle}</span>
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${zPct >= 80 ? 'bg-emerald-400' : zPct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${zPct}%` }} />
                  </div>
                  <span className="w-10 text-right font-bold tabular-nums text-char shrink-0">{zPct}%</span>
                  <span className={`text-xs shrink-0 font-medium ${zEarly ? 'text-emerald-600' : 'text-red-500'}`}>
                    {zEarly ? '-' : '+'}{zErr}m
                  </span>
                  <span className="text-[10px] text-stone-400 w-10 text-right shrink-0">{z.completedDeliveries}×</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

/* ------------------------------ SurgePricingPanel ------------------------------ */

function SurgePricingPanel({ data }: { data: NonNullable<SurgeData> }) {
  const { status } = data
  const hasActivity = data.surgeActivationsToday > 0 || data.todayDeliveriesDuringSurge > 0

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Zap className={`w-5 h-5 ${status.isActive ? 'text-amber-500' : 'text-stone-400'}`} />
        <h3 className="text-lg font-semibold text-char">Surge-Pricing</h3>
        <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${status.isActive ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
          {status.isActive ? 'Aktiv' : 'Inaktiv'}
        </span>
        {status.ruleName && (
          <span className="ml-1 text-xs text-stone-400 truncate">{status.ruleName}</span>
        )}
      </div>

      {status.isActive && (
        <div className="mb-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-black text-amber-700">{status.multiplier.toFixed(1)}×</div>
              <div className="text-xs text-amber-600 mt-0.5">Multiplier</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-700">+{status.driverBonusEur.toFixed(2)}€</div>
              <div className="text-xs text-amber-600 mt-0.5">Fahrer-Bonus</div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-700">{status.currentQueueDepth}</div>
              <div className="text-xs text-amber-600 mt-0.5">Warteschlange</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="flex justify-between text-xs text-stone-500 mb-1">
                <span>Fahrer-Auslastung</span>
                <span className="font-bold">{Math.round(status.driverUtilizationPct)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${status.driverUtilizationPct}%` }} />
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-amber-700">{Math.round(status.ordersPerHourEst)}/h</div>
              <div className="text-[10px] text-amber-600">Geschätzte Rate</div>
            </div>
          </div>
        </div>
      )}

      {!status.isActive && status.conditionsMet && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-sm text-amber-700 font-medium">Surge-Bedingungen erfüllt — kann manuell aktiviert werden</span>
        </div>
      )}

      {hasActivity && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
            <div className="text-xl font-black text-char">{data.surgeActivationsToday}</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Aktivierungen</div>
          </div>
          <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
            <div className="text-xl font-black text-char">{data.todayDeliveriesDuringSurge}</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Surge-Lieferungen</div>
          </div>
          <div className="rounded-xl bg-stone-50 p-3 border border-stone-100">
            <div className="text-xl font-black text-emerald-600">{data.todayTotalBonusPaidEur.toFixed(2)}€</div>
            <div className="text-[10px] text-stone-500 mt-0.5">Bonus ausgezahlt</div>
          </div>
        </div>
      )}

      {data.topDriverBonuses.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Top-Fahrer Boni heute</div>
          <div className="space-y-1.5">
            {data.topDriverBonuses.slice(0, 3).map((d, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="w-5 shrink-0 text-center">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span className="flex-1 min-w-0 truncate font-medium text-char">{d.driver_name}</span>
                <span className="font-bold text-emerald-600 shrink-0">+{d.total_bonus_today_eur.toFixed(2)}€</span>
                <span className="text-xs text-stone-400 w-14 text-right shrink-0">{d.bonus_deliveries} Lief.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!status.isActive && !hasActivity && (
        <div className="text-center py-4 text-sm text-stone-400">
          Kein Surge-Pricing heute aktiv
        </div>
      )}
    </div>
  )
}

/* ------------------------------ CoverageAnalysisPanel ------------------------------ */

function CoverageAnalysisPanel({ data }: { data: NonNullable<CoverageData> }) {
  const { summary, coverage } = data
  const coveragePct = summary.total_slots > 0
    ? Math.round((summary.covered_slots / summary.total_slots) * 100)
    : 0
  const hasGaps = summary.uncovered_slots > 0

  // Nächste Stunden mit Unterdeckung
  const now = new Date()
  const currentHour = now.getHours()
  const endHour = currentHour + 12
  const upcomingSlots = coverage
    .filter((s) => {
      if (endHour <= 24) return s.hour_of_day >= currentHour && s.hour_of_day < endHour
      return s.hour_of_day >= currentHour || s.hour_of_day < endHour % 24
    })
    .sort((a, b) => {
      const aN = a.hour_of_day >= currentHour ? a.hour_of_day : a.hour_of_day + 24
      const bN = b.hour_of_day >= currentHour ? b.hour_of_day : b.hour_of_day + 24
      return aN - bN
    })
    .slice(0, 8)

  return (
    <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-sm">
      <div className="flex items-center gap-2 mb-5">
        <Users className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-char">Fahrer-Abdeckung (nächste 12h)</h3>
        <span className={`ml-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${hasGaps ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
          {hasGaps ? `${summary.uncovered_slots} Lücken` : 'Vollständig'}
        </span>
        <span className="ml-auto text-xs text-stone-400">{summary.covered_slots}/{summary.total_slots} Slots gedeckt</span>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className={`text-3xl font-black ${coveragePct >= 80 ? 'text-emerald-600' : coveragePct >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
            {coveragePct}%
          </div>
          <div className="text-xs text-stone-500 mt-1">Abdeckungsrate</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className={`text-3xl font-black ${summary.uncovered_slots === 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {summary.uncovered_slots}
          </div>
          <div className="text-xs text-stone-500 mt-1">Unterdeckte Slots</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-4 border border-stone-100 text-center">
          <div className={`text-3xl font-black ${summary.worst_gap >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {summary.worst_gap >= 0 ? '+' : ''}{summary.worst_gap}
          </div>
          <div className="text-xs text-stone-500 mt-1">Schlimmste Lücke</div>
        </div>
      </div>

      {upcomingSlots.length > 0 && (
        <>
          <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Stundenplan</div>
          <div className="space-y-1.5">
            {upcomingSlots.map((slot) => {
              const isCurrent = slot.hour_of_day === currentHour
              const gap = slot.gap
              const gapColor = gap < 0 ? 'bg-red-400' : gap === 0 ? 'bg-amber-400' : 'bg-emerald-400'
              const maxDrivers = Math.max(slot.required_drivers, slot.scheduled_drivers, 1)
              const scheduledPct = Math.round((slot.scheduled_drivers / maxDrivers) * 100)
              const requiredPct = Math.round((slot.required_drivers / maxDrivers) * 100)
              return (
                <div key={slot.hour_of_day} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isCurrent ? 'bg-blue-50 border border-blue-200' : gap < 0 ? 'bg-red-50 border border-red-100' : 'bg-stone-50'}`}>
                  <span className={`w-12 shrink-0 text-sm font-bold tabular-nums ${isCurrent ? 'text-blue-700' : gap < 0 ? 'text-red-700' : 'text-steel'}`}>
                    {String(slot.hour_of_day).padStart(2, '0')}:00
                  </span>
                  <div className="flex-1 relative h-3 rounded-full bg-stone-200 overflow-hidden">
                    <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${gapColor}`} style={{ width: `${scheduledPct}%` }} />
                    <div className="absolute inset-y-0 left-0 border-r-2 border-stone-600/40 transition-all" style={{ width: `${requiredPct}%` }} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`font-bold tabular-nums text-sm ${gap < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                      {slot.scheduled_drivers}
                    </span>
                    <span className="text-stone-400 text-xs">/</span>
                    <span className="text-xs text-stone-500">{slot.required_drivers}</span>
                  </div>
                  {gap < 0 && (
                    <span className="shrink-0 text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-1.5 py-0.5">
                      -{Math.abs(gap)}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[10px] text-stone-400">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-1.5 rounded-full bg-emerald-400" /> Eingeplant</span>
            <span className="flex items-center gap-1"><span className="inline-block w-0 h-3 border-r-2 border-stone-600/40" /> Bedarf</span>
            <span className="ml-auto">Zahlen: eingeplant / Mindestbedarf</span>
          </div>
        </>
      )}
    </div>
  )
}

/* ===================================================================
 * LiveOrderFeed — Echtzeit-Bestellungseingang via Supabase Realtime
 * =================================================================== */
type LiveEvent = {
  id: string;
  ts: number;
  bestellnummer: string;
  status: string;
  gesamtbetrag: number;
  typ?: string;
  isNew?: boolean;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  neu:            { label: 'Neu',          color: 'bg-blue-100 text-blue-700' },
  bestätigt:      { label: 'Angenommen',   color: 'bg-matcha-100 text-matcha-700' },
  in_zubereitung: { label: 'Zubereitung',  color: 'bg-amber-100 text-amber-700' },
  fertig:         { label: 'Bereit',       color: 'bg-purple-100 text-purple-700' },
  unterwegs:      { label: 'Unterwegs',    color: 'bg-cyan-100 text-cyan-700' },
  geliefert:      { label: 'Geliefert',    color: 'bg-emerald-100 text-emerald-700' },
  abgeholt:       { label: 'Abgeholt',     color: 'bg-emerald-100 text-emerald-700' },
  storniert:      { label: 'Storniert',    color: 'bg-red-100 text-red-700' },
};

export function LiveOrderFeed({ locationId }: { locationId?: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const newIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const filter = locationId ? `location_id=eq.${locationId}` : undefined;
    const ch = supabase
      .channel('live-order-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'customer_orders', ...(filter ? { filter } : {}) },
        (payload: { new: Record<string, unknown>; eventType: string }) => {
          if (!payload.new?.id) return;
          const row = payload.new as any;
          const ev: LiveEvent = {
            id: `${row.id}-${row.status}-${Date.now()}`,
            ts: Date.now(),
            bestellnummer: row.bestellnummer ?? '?',
            status: row.status ?? 'neu',
            gesamtbetrag: Number(row.gesamtbetrag ?? 0),
            typ: row.typ ?? row.order_type,
            isNew: true,
          };
          newIds.current.add(ev.id);
          setTimeout(() => {
            newIds.current.delete(ev.id);
            setEvents((xs) => xs.map((x) => x.id === ev.id ? { ...x, isNew: false } : x));
          }, 3000);
          setEvents((xs) => [ev, ...xs].slice(0, 12));
        },
      )
      .subscribe((status: string) => {
        setConnected(status === 'SUBSCRIBED');
      });
    return () => { supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (events.length === 0 && !connected) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <Radio className="w-4 h-4 text-emerald-600" />
        <span className="font-bold text-sm text-char uppercase tracking-wider">Live-Bestellungen</span>
        <span className={`ml-1 inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-stone-300'}`} />
        {connected && <span className="text-[10px] text-emerald-600 font-bold">LIVE</span>}
        {events.length === 0 && connected && (
          <span className="ml-auto text-xs text-stone-400">Warte auf Bestellungen…</span>
        )}
      </div>
      {events.length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {events.map((ev) => {
            const meta = STATUS_LABELS[ev.status] ?? { label: ev.status, color: 'bg-stone-100 text-stone-700' };
            const age = Math.floor((Date.now() - ev.ts) / 1000);
            const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`;
            return (
              <div
                key={ev.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${ev.isNew ? 'bg-emerald-50 ring-1 ring-emerald-300' : 'bg-stone-50'}`}
              >
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="font-mono text-xs font-bold text-char flex-1 truncate">
                  #{ev.bestellnummer.replace(/^[A-Z]+-/, '')}
                </span>
                {ev.gesamtbetrag > 0 && (
                  <span className="text-xs font-bold text-matcha-700 shrink-0">
                    {ev.gesamtbetrag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </span>
                )}
                <span className="text-[10px] text-stone-400 shrink-0 tabular-nums">{ageStr}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ PushNotificationStats ------------------------------ */

type PushStatsData = {
  mise: { total_24h: number; delivered_24h: number; failed_24h: number; delivery_rate: number | null; pending_now: number };
  webpush: { total_24h: number; delivered_24h: number; failed_24h: number; delivery_rate: number | null; pending_now: number };
  type_breakdown?: Record<string, number>;
} | null;

function PushNotificationStats({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<PushStatsData>(null);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/push-stats?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.mise || d?.webpush) setData(d); })
      .catch(() => {});
  }, [locationId]);

  if (!data) return null;
  const totalSent = (data.mise?.delivered_24h ?? 0) + (data.webpush?.delivered_24h ?? 0);
  const totalSentAll = (data.mise?.total_24h ?? 0) + (data.webpush?.total_24h ?? 0);
  if (totalSentAll === 0) return null;

  const overallRate = totalSentAll > 0 ? Math.round((totalSent / totalSentAll) * 100) : null;
  const pendingNow = (data.mise?.pending_now ?? 0) + (data.webpush?.pending_now ?? 0);
  const failedTotal = (data.mise?.failed_24h ?? 0) + (data.webpush?.failed_24h ?? 0);

  const channels = [
    { key: 'mise',    label: 'Mise App (Expo)',  d: data.mise,    color: 'bg-matcha-500', bg: 'bg-matcha-50', textCls: 'text-matcha-700' },
    { key: 'webpush', label: 'Web Push (VAPID)',  d: data.webpush, color: 'bg-blue-400',   bg: 'bg-blue-50',   textCls: 'text-blue-700' },
  ].filter(c => (c.d?.total_24h ?? 0) > 0);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-matcha-600" />
        <span className="font-bold text-sm uppercase tracking-wider text-stone-800">Push-Benachrichtigungen · 24h</span>
        {pendingNow > 0 && (
          <span className="ml-auto rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-bold animate-pulse">
            {pendingNow} ausstehend
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-matcha-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-matcha-700">{totalSent}</div>
          <div className="text-[11px] text-matcha-600 font-medium">Zugestellt</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-char">{totalSentAll}</div>
          <div className="text-[11px] text-stone-500 font-medium">Gesamt</div>
        </div>
        <div className={`rounded-xl p-3 text-center ${failedTotal > 0 ? 'bg-red-50' : 'bg-emerald-50'}`}>
          <div className={`font-black text-2xl tabular-nums ${failedTotal > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
            {overallRate !== null ? `${overallRate}%` : '—'}
          </div>
          <div className={`text-[11px] font-medium ${failedTotal > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
            {failedTotal > 0 ? `${failedTotal} Fehler` : 'Erfolgsrate'}
          </div>
        </div>
      </div>

      {channels.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-stone-400 uppercase tracking-wide mb-2">Nach Kanal</div>
          {channels.map(ch => {
            const rate = ch.d.total_24h > 0 ? Math.round((ch.d.delivered_24h / ch.d.total_24h) * 100) : 0;
            return (
              <div key={ch.key} className="flex items-center gap-3">
                <div className="w-32 shrink-0 text-[11px] font-medium text-stone-600 truncate">{ch.label}</div>
                <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div className={`h-full rounded-full ${ch.color} transition-all`} style={{ width: `${rate}%` }} />
                </div>
                <div className="w-14 text-right text-[11px] tabular-nums font-bold text-stone-600">
                  {ch.d.delivered_24h}/{ch.d.total_24h}
                </div>
                <div className="w-9 text-right text-[10px] tabular-nums text-stone-400">{rate}%</div>
              </div>
            );
          })}
        </div>
      )}

      {data.type_breakdown && Object.keys(data.type_breakdown).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(data.type_breakdown).slice(0, 5).map(([type, count]) => (
            <span key={type} className="rounded-full bg-stone-100 text-stone-600 px-2 py-0.5 text-[10px] font-bold">
              {type.replace(/_/g, ' ')}: {count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ FailedAttemptsPanel ------------------------------ */

const REASON_LABELS: Record<string, string> = {
  no_answer:     'Keine Reaktion',
  not_home:      'Nicht zu Hause',
  wrong_address: 'Falsche Adresse',
  refused:       'Annahme verweigert',
  access_denied: 'Kein Zutritt',
  other:         'Sonstiges',
};
const RESOLUTION_LABELS: Record<string, string> = {
  delivered:              'Nachträglich zugestellt',
  returned_to_restaurant: 'Zurückgebracht',
  cancelled:              'Storniert',
  rescheduled:            'Neuer Termin',
};

function FailedAttemptsPanel({ data }: { data: NonNullable<FailedAttemptsData> }) {
  const { stats, attempts } = data;
  const topReasons = Object.entries(stats.byReason)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const maxReason = topReasons[0]?.[1] ?? 1;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-5">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="font-bold text-sm uppercase tracking-wider text-stone-800">Fehlgeschlagene Zustellversuche</span>
        <span className="ml-auto text-[10px] text-stone-400 font-medium">Letzte 30 Tage</span>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-stone-700">{stats.total}</div>
          <div className="text-[11px] text-stone-500 font-medium">Gesamt</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-amber-700">{stats.pending}</div>
          <div className="text-[11px] text-amber-600 font-medium">Offen</div>
        </div>
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-emerald-700">{stats.resolutionRate}%</div>
          <div className="text-[11px] text-emerald-600 font-medium">Gelöst</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <div className="font-black text-2xl tabular-nums text-blue-700">
            {stats.avgResolutionHours != null ? `${stats.avgResolutionHours}h` : '—'}
          </div>
          <div className="text-[11px] text-blue-600 font-medium">Ø Lösezeit</div>
        </div>
      </div>

      {/* Häufigste Gründe */}
      {topReasons.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500 mb-2">Häufigste Gründe</div>
          <div className="space-y-2">
            {topReasons.map(([reason, count]) => {
              const pct = Math.round((count / maxReason) * 100);
              return (
                <div key={reason} className="flex items-center gap-3">
                  <div className="w-28 shrink-0 text-[11px] font-medium text-stone-700">{REASON_LABELS[reason] ?? reason}</div>
                  <div className="flex-1 h-2 rounded-full bg-stone-100 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-6 text-right text-[11px] tabular-nums font-bold text-stone-700">{count}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auflösungen */}
      {Object.keys(stats.byResolution).length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500 mb-2">Auflösungen</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byResolution).map(([res, count]) => (
              <span key={res} className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1 text-[11px] font-semibold text-stone-700">
                {RESOLUTION_LABELS[res] ?? res}
                <span className="ml-1 font-black text-stone-500">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Offene Versuche */}
      {attempts.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-stone-500 mb-2">
            Offene Fälle ({attempts.length})
          </div>
          <div className="space-y-2">
            {attempts.slice(0, 5).map((a) => (
              <div key={a.id} className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-bold text-stone-800 truncate">
                      {a.kundeName ?? '—'}
                    </span>
                    {a.bestellnummer && (
                      <span className="text-[10px] font-mono text-stone-500">#{a.bestellnummer.replace(/^[A-Z]+-/, '')}</span>
                    )}
                    <span className="ml-auto rounded-full bg-amber-200 text-amber-800 px-2 py-0.5 text-[10px] font-bold">
                      {REASON_LABELS[a.reason] ?? a.reason}
                    </span>
                  </div>
                  {a.kundeAdresse && (
                    <div className="text-[10px] text-stone-500 mt-0.5 truncate">{a.kundeAdresse}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {a.driverName && (
                      <span className="text-[10px] text-stone-400">Fahrer: {a.driverName}</span>
                    )}
                    {a.nextAttemptAt && (
                      <span className="text-[10px] font-medium text-blue-600">
                        Retry: {new Date(a.nextAttemptAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                    <span className="text-[10px] text-stone-400">
                      {new Date(a.createdAt).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {attempts.length > 5 && (
              <div className="text-center text-[11px] text-stone-400">+ {attempts.length - 5} weitere offene Fälle</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ PayoutSummaryPanel ------------------------------ */

function PayoutSummaryPanel({ data }: { data: NonNullable<PayoutSummaryData> }) {
  const fmt = (n: number) =>
    n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

  const maxEur = data.topDriverToday.length > 0 ? data.topDriverToday[0].totalEur : 1;
  const medalLabel = (i: number) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-emerald-600" />
        <span className="font-bold text-sm uppercase tracking-wider text-char">Fahrer-Vergütung · Heute</span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-emerald-50 p-3 text-center">
          <div className="text-xl font-black text-emerald-700">{fmt(data.today.totalPayoutEur)}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5">Gesamt ausgezahlt</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3 text-center">
          <div className="text-xl font-black text-char">{fmt(data.today.avgPerDelivery)}</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Ø pro Lieferung</div>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-center">
          <div className="text-xl font-black text-blue-700">{data.today.totalDeliveries}</div>
          <div className="text-[11px] text-blue-600 mt-0.5">Lieferungen</div>
        </div>
        <div className="rounded-xl bg-amber-50 p-3 text-center">
          <div className="text-xl font-black text-amber-700">{data.today.activeDrivers}</div>
          <div className="text-[11px] text-amber-600 mt-0.5">Aktive Fahrer</div>
        </div>
      </div>

      {/* Top-Fahrer */}
      {data.topDriverToday.length > 0 && (
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">Top-Fahrer heute</div>
          <div className="space-y-2">
            {data.topDriverToday.map((d, i) => {
              const pct = maxEur > 0 ? Math.round((d.totalEur / maxEur) * 100) : 0;
              const barColor = i === 0 ? 'bg-amber-400' : i === 1 ? 'bg-stone-400' : i === 2 ? 'bg-orange-400' : 'bg-stone-200';
              return (
                <div key={d.driverId} className="flex items-center gap-2">
                  <div className="w-7 text-center shrink-0 text-sm font-black">{medalLabel(i)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-semibold text-char truncate">{d.driverName}</span>
                      <span className="text-sm font-black text-emerald-700 shrink-0 ml-2">{fmt(d.totalEur)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">{d.deliveries} Lieferungen</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ausstehende Perioden */}
      {data.pending.draftPeriods > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span className="text-xs text-amber-800">
            <span className="font-bold">{data.pending.draftPeriods} Abrechnungsperiode{data.pending.draftPeriods !== 1 ? 'n' : ''}</span>
            {' '}ausstehend — {fmt(data.pending.totalAmountEur)} zur Freigabe
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ PayoutConfigPanel ------------------------------ */

type PayoutConfigState = {
  basePerDelivery: number;
  kmRate: number;
  peakMultiplier: number;
  bonusPerRatingPoint: number;
  minRatingForBonus: number;
  milestoneBonuses: Record<string, number>;
  locationId: string;
};

function PayoutConfigPanel({ config, onSaved }: { config: PayoutConfigState; onSaved: (c: PayoutConfigState) => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState(config);

  function startEdit() { setDraft(config); setEditing(true); }
  function cancel() { setEditing(false); setSaveMsg(null); }

  async function save() {
    setSaving(true);
    try {
      const body = {
        location_id: config.locationId,
        base_per_delivery: draft.basePerDelivery,
        km_rate: draft.kmRate,
        peak_multiplier: draft.peakMultiplier,
        bonus_per_rating_point: draft.bonusPerRatingPoint,
        min_rating_for_bonus: draft.minRatingForBonus,
        milestone_bonuses: draft.milestoneBonuses,
      };
      const res = await fetch('/api/delivery/admin/payout-config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onSaved({ ...draft });
        setEditing(false);
        setSaveMsg('Gespeichert ✓');
        setTimeout(() => setSaveMsg(null), 4000);
      } else {
        setSaveMsg('Fehler beim Speichern');
      }
    } catch {
      setSaveMsg('Netzwerkfehler');
    } finally {
      setSaving(false);
    }
  }

  const fmtEur = (n: number) => `${n.toFixed(2)} €`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-matcha-600" />
          <span className="font-bold text-sm uppercase tracking-wider text-char">Vergütungs-Konfiguration</span>
          {!open && (
            <span className="text-xs text-stone-400 ml-1">
              Basis {fmtEur(config.basePerDelivery)} · {fmtEur(config.kmRate)}/km · ×{config.peakMultiplier.toFixed(2)} Peak
            </span>
          )}
          {saveMsg && <span className="text-xs font-semibold text-emerald-600">{saveMsg}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-100">
          {!editing ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                <ConfigChip label="Basis / Lieferung" value={fmtEur(config.basePerDelivery)} color="emerald" />
                <ConfigChip label="km-Bonus" value={`${fmtEur(config.kmRate)}/km`} color="blue" />
                <ConfigChip label="Peak-Multiplikator" value={`×${config.peakMultiplier.toFixed(2)}`} color="amber" />
                <ConfigChip label="Rating-Bonus" value={`${fmtEur(config.bonusPerRatingPoint)}/0.1★`} color="violet" />
                <ConfigChip label="Mindest-Rating" value={`≥${config.minRatingForBonus.toFixed(1)}★`} color="stone" />
              </div>
              {Object.keys(config.milestoneBonuses).length > 0 && (
                <div className="mt-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5">Meilenstein-Boni</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(config.milestoneBonuses).sort(([a], [b]) => Number(a) - Number(b)).map(([count, bonus]) => (
                      <div key={count} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold text-stone-700">
                        {count}. Lieferung → +{fmtEur(bonus)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button
                onClick={startEdit}
                className="mt-4 rounded-xl bg-matcha-700 text-white px-4 py-2 text-sm font-bold hover:bg-matcha-800 transition"
              >
                Konfiguration bearbeiten
              </button>
            </>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <NumInput label="Basis / Lieferung (€)" value={draft.basePerDelivery} min={0} max={20} step={0.1}
                  onChange={(v) => setDraft(d => ({ ...d, basePerDelivery: v }))} />
                <NumInput label="km-Rate (€/km)" value={draft.kmRate} min={0} max={2} step={0.01}
                  onChange={(v) => setDraft(d => ({ ...d, kmRate: v }))} />
                <NumInput label="Peak-Multiplikator" value={draft.peakMultiplier} min={1} max={3} step={0.05}
                  onChange={(v) => setDraft(d => ({ ...d, peakMultiplier: v }))} />
                <NumInput label="Rating-Bonus (€/0.1★)" value={draft.bonusPerRatingPoint} min={0} max={1} step={0.01}
                  onChange={(v) => setDraft(d => ({ ...d, bonusPerRatingPoint: v }))} />
                <NumInput label="Mindest-Rating für Bonus" value={draft.minRatingForBonus} min={1} max={5} step={0.1}
                  onChange={(v) => setDraft(d => ({ ...d, minRatingForBonus: v }))} />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => void save()}
                  disabled={saving}
                  className="rounded-xl bg-matcha-700 text-white px-4 py-2 text-sm font-bold hover:bg-matcha-800 disabled:opacity-60 transition flex items-center gap-2"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {saving ? 'Speichern…' : 'Speichern'}
                </button>
                <button onClick={cancel} className="rounded-xl border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition">
                  Abbrechen
                </button>
              </div>
              {saveMsg && <div className="text-sm font-semibold text-red-600">{saveMsg}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfigChip({ label, value, color }: { label: string; value: string; color: string }) {
  const cls: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-800',
    blue: 'bg-blue-50 text-blue-800',
    amber: 'bg-amber-50 text-amber-800',
    violet: 'bg-violet-50 text-violet-800',
    stone: 'bg-stone-100 text-stone-700',
  };
  return (
    <div className={`rounded-xl p-3 ${cls[color] ?? cls.stone}`}>
      <div className="text-lg font-black">{value}</div>
      <div className="text-[11px] font-medium mt-0.5 opacity-75">{label}</div>
    </div>
  );
}

function NumInput({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-stone-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm font-semibold tabular-nums focus:outline-none focus:ring-2 focus:ring-matcha-400"
      />
    </label>
  );
}

/* ------------------------------ AlertRulesPanel ------------------------------ */

type AlertRuleItem = {
  id: string;
  alert_type: string;
  threshold_value: number;
  window_minutes: number;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  location_id: string;
};

const ALERT_TYPE_LABELS: Record<string, { label: string; unit: string; desc: string }> = {
  dispatch_queue_high:   { label: 'Dispatch-Queue',      unit: 'Bestellungen',  desc: 'Alarm wenn N+ Bestellungen auf Fahrer warten' },
  no_drivers_online:    { label: 'Keine Fahrer online',  unit: '',              desc: 'Alarm wenn keine Fahrer online sind' },
  kitchen_overload:     { label: 'Küchen-Überlastung',   unit: 'offene Orders', desc: 'Alarm bei zu vielen gleichzeitigen Bestellungen' },
  stale_orders_critical:{ label: 'Alte unzugewiesene',  unit: 'Min warten',    desc: 'Alarm wenn Bestellungen zu lange unzugewiesen' },
  eta_accuracy_low:     { label: 'ETA-Genauigkeit',      unit: '% Pünktlich',   desc: 'Alarm wenn ETA-Trefferquote unter Schwellwert fällt' },
};

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  warning:  'bg-amber-100 text-amber-700 border-amber-200',
  info:     'bg-blue-100 text-blue-700 border-blue-200',
};
const SEV_LABEL: Record<string, string> = { critical: 'Kritisch', warning: 'Warnung', info: 'Info' };

function AlertRulesPanel({ rules, onRuleChanged }: {
  rules: AlertRuleItem[];
  onRuleChanged: (r: AlertRuleItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [draftThreshold, setDraftThreshold] = useState<number>(0);

  async function toggle(rule: AlertRuleItem) {
    const updated = { ...rule, enabled: !rule.enabled };
    setSaving(rule.id);
    try {
      const res = await fetch('/api/delivery/admin/alert-rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          location_id: rule.location_id,
          alert_type: rule.alert_type,
          threshold_value: rule.threshold_value,
          window_minutes: rule.window_minutes,
          severity: rule.severity,
          enabled: updated.enabled,
        }),
      });
      if (res.ok) onRuleChanged(updated);
    } finally {
      setSaving(null);
    }
  }

  async function saveThreshold(rule: AlertRuleItem) {
    const updated = { ...rule, threshold_value: draftThreshold };
    setSaving(rule.id);
    try {
      const res = await fetch('/api/delivery/admin/alert-rules', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          location_id: rule.location_id,
          alert_type: rule.alert_type,
          threshold_value: draftThreshold,
          window_minutes: rule.window_minutes,
          severity: rule.severity,
          enabled: rule.enabled,
        }),
      });
      if (res.ok) { onRuleChanged(updated); setEditId(null); }
    } finally {
      setSaving(null);
    }
  }

  const enabledCount = rules.filter(r => r.enabled).length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-stone-50 transition"
      >
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="font-bold text-sm uppercase tracking-wider text-char">Alert-Regeln</span>
          <span className="text-xs text-stone-400">{enabledCount}/{rules.length} aktiv</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-100">
          <p className="text-[11px] text-stone-400 mt-3 mb-3">Schwellwerte definieren, wann Betriebsalarme ausgelöst werden.</p>
          <div className="space-y-2">
            {rules.map((rule) => {
              const meta = ALERT_TYPE_LABELS[rule.alert_type] ?? { label: rule.alert_type, unit: '', desc: '' };
              const isEditing = editId === rule.id;
              const isSaving = saving === rule.id;
              return (
                <div key={rule.id} className={`rounded-xl border p-3 transition ${rule.enabled ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 opacity-60'}`}>
                  <div className="flex items-start gap-3">
                    {/* Toggle */}
                    <button
                      onClick={() => void toggle(rule)}
                      disabled={isSaving}
                      className={`mt-0.5 relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 transition-colors ${rule.enabled ? 'bg-matcha-600 border-matcha-600' : 'bg-stone-200 border-stone-200'}`}
                      title={rule.enabled ? 'Deaktivieren' : 'Aktivieren'}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${rule.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-char">{meta.label}</span>
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${SEV_CLS[rule.severity] ?? SEV_CLS.info}`}>
                          {SEV_LABEL[rule.severity] ?? rule.severity}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{meta.desc}</div>
                      {/* Threshold edit */}
                      <div className="mt-2 flex items-center gap-2">
                        {isEditing ? (
                          <>
                            <input
                              type="number"
                              value={draftThreshold}
                              onChange={(e) => setDraftThreshold(parseFloat(e.target.value) || 0)}
                              className="h-7 w-20 rounded-lg border border-stone-200 px-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-matcha-400"
                            />
                            {meta.unit && <span className="text-[11px] text-stone-400">{meta.unit}</span>}
                            <button
                              onClick={() => void saveThreshold(rule)}
                              disabled={isSaving}
                              className="h-7 rounded-lg bg-matcha-700 text-white px-2 text-xs font-bold hover:bg-matcha-800 disabled:opacity-60 transition"
                            >
                              {isSaving ? '…' : 'OK'}
                            </button>
                            <button onClick={() => setEditId(null)} className="h-7 rounded-lg border px-2 text-xs font-semibold text-stone-500 hover:bg-stone-50 transition">
                              ✕
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => { setEditId(rule.id); setDraftThreshold(rule.threshold_value); }}
                            className="text-[11px] rounded-full bg-stone-100 hover:bg-stone-200 px-2.5 py-1 font-bold tabular-nums text-stone-700 transition"
                          >
                            Schwellwert: {rule.threshold_value}{meta.unit ? ` ${meta.unit}` : ''}
                            {rule.window_minutes > 0 ? ` (letzte ${rule.window_minutes} Min)` : ''}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ FranchiseOverviewPanel ------------------------------ */

function FranchiseOverviewPanel({ data }: { data: NonNullable<FranchiseSummaryData> }) {
  const [open, setOpen] = useState(true);

  const hasCritical = data.totals.critical_alerts > 0;
  const hasAlerts   = data.totals.active_alerts > 0;

  const healthColor = (h: 'ok' | 'warning' | 'critical') =>
    h === 'critical' ? 'bg-red-500' : h === 'warning' ? 'bg-amber-400' : 'bg-matcha-500';

  const healthBorder = (h: 'ok' | 'warning' | 'critical') =>
    h === 'critical' ? 'border-red-200 bg-red-50' : h === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-matcha-200 bg-matcha-50';

  return (
    <div className={`rounded-2xl border p-4 ${hasCritical ? 'border-red-300 bg-red-50' : hasAlerts ? 'border-amber-300 bg-amber-50' : 'border-matcha-200 bg-matcha-50'}`}>
      <button onClick={() => setOpen(v => !v)} className="flex items-center gap-3 w-full text-left">
        <MapPin className={`h-5 w-5 shrink-0 ${hasCritical ? 'text-red-600' : hasAlerts ? 'text-amber-600' : 'text-matcha-600'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-bold text-sm ${hasCritical ? 'text-red-900' : hasAlerts ? 'text-amber-900' : 'text-matcha-900'}`}>
              Franchise-Übersicht · {data.locations.length} Standorte
            </span>
            {hasCritical && (
              <span className="rounded-full bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                {data.totals.critical_alerts} kritisch
              </span>
            )}
          </div>
          <div className={`text-xs mt-0.5 ${hasCritical ? 'text-red-700' : hasAlerts ? 'text-amber-700' : 'text-matcha-700'}`}>
            {data.totals.queue_depth} wartend · {data.totals.active_tours} Touren · {data.totals.completed_today} heute geliefert · {data.drivers.drivers_online} Fahrer online
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-stone-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2 border-t border-stone-200 pt-3">
          {/* Per-location rows */}
          {data.locations.map(loc => (
            <div key={loc.location_id} className={`rounded-xl border p-3 ${healthBorder(loc.health)}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${healthColor(loc.health)}`} />
                <span className="font-bold text-sm text-stone-800 truncate flex-1">{loc.location_name}</span>
                {loc.critical_alerts > 0 && (
                  <span className="rounded-full bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5">{loc.critical_alerts} kritisch</span>
                )}
                {loc.active_alerts > 0 && loc.critical_alerts === 0 && (
                  <span className="rounded-full bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5">{loc.active_alerts} Alarm</span>
                )}
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Wartend', value: loc.queue_depth, warn: loc.queue_depth >= 5 },
                  { label: 'Touren', value: loc.active_tours, warn: false },
                  { label: 'Küche', value: loc.cooking_now, warn: false },
                  { label: 'Geliefert', value: loc.completed_today, warn: false },
                ].map(({ label, value, warn }) => (
                  <div key={label} className="rounded-lg bg-white/60 border border-white/80 py-1.5">
                    <div className={`text-base font-black tabular-nums ${warn && value > 0 ? 'text-amber-700' : 'text-stone-800'}`}>{value}</div>
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-stone-500">{label}</div>
                  </div>
                ))}
              </div>
              {loc.oldest_queued_min !== null && loc.oldest_queued_min > 10 && (
                <div className="mt-1.5 text-[10px] font-bold text-amber-700">
                  Älteste Bestellung wartet {loc.oldest_queued_min} Min
                </div>
              )}
            </div>
          ))}

          {/* Cross-location alerts */}
          {data.alerts.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Aktive Alarme</div>
              {data.alerts.slice(0, 5).map(alert => (
                <div key={alert.id} className={`rounded-xl border px-3 py-2 text-xs ${
                  alert.severity === 'critical' ? 'border-red-200 bg-red-50 text-red-800' :
                  alert.severity === 'warning'  ? 'border-amber-200 bg-amber-50 text-amber-800' :
                  'border-stone-200 bg-stone-50 text-stone-700'
                }`}>
                  <span className="font-bold">{alert.location_name}:</span>{' '}
                  {alert.message}
                </div>
              ))}
              {data.alerts.length > 5 && (
                <div className="text-[11px] text-stone-500 text-center">+ {data.alerts.length - 5} weitere Alarme</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
