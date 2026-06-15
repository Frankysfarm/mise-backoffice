'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, Flame,
  RefreshCw, TrendingUp, Users, Zap, Package, ChevronRight,
  Navigation2, MapPin, BarChart3, Euro,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ShiftStats {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  pendingOrders: number;
  activeDrivers: number;
  hourBuckets?: { hour: string; orders: number; revenue: number }[];
}

interface OverviewDriver {
  id: string;
  name: string | null;
  vehicle: string | null;
  state: string;
  active: boolean;
}

interface ActiveTour {
  id: string;
  state: string;
  zone: string | null;
  stop_count: number | null;
  total_eta_min: number | null;
  created_at: string;
  driver: { id: string; name: string | null } | null;
}

interface FlowStatus {
  current_status: string;
  active_anomaly_count: number;
  latest_snapshot?: {
    anomaly_type: string | null;
    z_score: number | null;
    orders_5min: number;
    drivers_online: number;
  } | null;
}

interface StreakEntry {
  driverName: string | null;
  currentStreak: number;
  currentMultiplier: number;
}

// ─── Hilfs-Komponenten ────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, highlight, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className={cn(
      'rounded-xl border bg-white p-3.5 shadow-sm flex flex-col gap-1 transition-all',
      highlight && 'border-amber-300 bg-amber-50',
    )}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn('shrink-0', color ?? 'text-matcha-600')}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-black tabular-nums text-foreground">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function DriverStateBadge({ state }: { state: string }) {
  const styles: Record<string, string> = {
    online:     'bg-green-100 text-green-700',
    unterwegs:  'bg-blue-100  text-blue-700',
    returning:  'bg-violet-100 text-violet-700',
    offline:    'bg-gray-100  text-gray-500',
    break:      'bg-amber-100 text-amber-700',
  };
  const labels: Record<string, string> = {
    online:    'Verfügbar',
    unterwegs: 'Unterwegs',
    returning: 'Rückkehr',
    offline:   'Offline',
    break:     'Pause',
  };
  return (
    <span className={cn(
      'rounded-full px-2 py-0.5 text-[10px] font-bold',
      styles[state] ?? styles.offline,
    )}>
      {labels[state] ?? state}
    </span>
  );
}

function FlowStatusBanner({ flow }: { flow: FlowStatus | null }) {
  if (!flow) return null;

  const statusStyles: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    normal:              { bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Normalbetrieb'      },
    volume_spike:        { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500',   label: 'Bestellungsspike'   },
    volume_drop:         { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500',  label: 'Bestellungsrückgang'},
    cancellation_surge:  { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Stornowelle'        },
    failure_cluster:     { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Fehllieferungen'    },
    driver_shortage:     { bg: 'bg-red-50',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Fahrermangel'       },
  };

  const st = statusStyles[flow.current_status] ?? statusStyles.normal;

  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-3', st.bg)}>
      <div className={cn('h-2.5 w-2.5 rounded-full shrink-0', st.dot, flow.active_anomaly_count > 0 && 'animate-pulse')} />
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm font-bold', st.text)}>{st.label}</span>
        {flow.latest_snapshot && (
          <span className="ml-2 text-xs text-muted-foreground">
            {flow.latest_snapshot.orders_5min} Bestellungen (5 Min) · {flow.latest_snapshot.drivers_online} Fahrer online
            {flow.latest_snapshot.z_score != null && (
              <> · Z-Score {flow.latest_snapshot.z_score.toFixed(1)}</>
            )}
          </span>
        )}
      </div>
      {flow.active_anomaly_count > 0 && (
        <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-black px-2 py-0.5">
          {flow.active_anomaly_count} Anomalie{flow.active_anomaly_count !== 1 ? 'n' : ''}
        </span>
      )}
    </div>
  );
}

function TourHealthRow({ tour }: { tour: ActiveTour }) {
  const elapsedMin = Math.floor((Date.now() - new Date(tour.created_at).getTime()) / 60_000);
  const etaMin = tour.total_eta_min ?? 40;
  const overdue = elapsedMin > etaMin;
  const tight   = !overdue && elapsedMin > etaMin * 0.8;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-lg px-3 py-2 border',
      overdue ? 'bg-red-50 border-red-200' : tight ? 'bg-amber-50 border-amber-200' : 'bg-white border-transparent',
    )}>
      <Navigation2 size={13} className={overdue ? 'text-red-500' : 'text-muted-foreground'} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold truncate">{tour.driver?.name ?? '—'}</span>
          {tour.zone && (
            <span className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 font-bold">Zone {tour.zone}</span>
          )}
        </div>
        <div className="mt-0.5 h-1 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full', overdue ? 'bg-red-400' : tight ? 'bg-amber-400' : 'bg-matcha-500')}
            style={{ width: `${Math.min(100, (elapsedMin / etaMin) * 100)}%` }}
          />
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className={cn('text-xs font-black tabular-nums', overdue ? 'text-red-600' : 'text-foreground')}>
          {elapsedMin}m
        </div>
        <div className="text-[9px] text-muted-foreground">/{etaMin}m</div>
      </div>
    </div>
  );
}

function StreakFireRow({ entry }: { entry: StreakEntry }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Flame size={13} className={entry.currentStreak >= 10 ? 'text-orange-500 animate-pulse' : 'text-amber-400'} />
      <span className="text-xs font-medium truncate flex-1">{entry.driverName ?? '—'}</span>
      <span className="text-xs font-black tabular-nums">{entry.currentStreak}×</span>
      {entry.currentMultiplier > 1 && (
        <span className="text-[10px] rounded-full bg-orange-100 text-orange-700 px-1.5 font-bold">
          {entry.currentMultiplier.toFixed(2)}×
        </span>
      )}
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function LiveOpsClient({ locationId }: { locationId: string }) {
  const [shiftStats,  setShiftStats]  = useState<ShiftStats | null>(null);
  const [drivers,     setDrivers]     = useState<OverviewDriver[]>([]);
  const [activeTours, setActiveTours] = useState<ActiveTour[]>([]);
  const [flow,        setFlow]        = useState<FlowStatus | null>(null);
  const [streaks,     setStreaks]     = useState<StreakEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const [shiftRes, overviewRes, flowRes, streakRes] = await Promise.allSettled([
      fetch('/api/delivery/shifts?action=current_stats'),
      fetch(`/api/delivery/admin/overview?location_id=${locationId}`),
      fetch('/api/delivery/admin/flow-intelligence'),
      fetch(`/api/delivery/admin/driver-streaks?action=leaderboard&period=today&limit=5`),
    ]);

    if (shiftRes.status === 'fulfilled' && shiftRes.value.ok) {
      setShiftStats(await shiftRes.value.json());
    }
    if (overviewRes.status === 'fulfilled' && overviewRes.value.ok) {
      const d = await overviewRes.value.json();
      setDrivers((d.drivers ?? []) as OverviewDriver[]);
      setActiveTours((d.active_tours ?? []) as ActiveTour[]);
    }
    if (flowRes.status === 'fulfilled' && flowRes.value.ok) {
      setFlow(await flowRes.value.json());
    }
    if (streakRes.status === 'fulfilled' && streakRes.value.ok) {
      const rows = (await streakRes.value.json()) as StreakEntry[];
      setStreaks(Array.isArray(rows) ? rows.filter((r) => r.currentStreak > 0).slice(0, 5) : []);
    }

    setLastUpdated(new Date());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void load();
    timerRef.current = setInterval(() => void load(), 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const driversOnline   = drivers.filter((d) => d.state !== 'offline').length;
  const driversEnRoute  = drivers.filter((d) => d.state === 'unterwegs').length;
  const driversAvail    = drivers.filter((d) => d.state === 'online').length;

  const onTimeLabel = shiftStats
    ? `${shiftStats.onTimeRatePct.toFixed(0)}%`
    : '—';

  return (
    <div className="space-y-5">
      {/* Header strip */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Activity size={12} className="text-matcha-500" />
          <span>Auto-Refresh alle 30 Sek.</span>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span>Letzte Aktualisierung: {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <button onClick={() => void load()} className="flex items-center gap-1 rounded px-2 py-0.5 bg-muted hover:bg-muted/70 text-xs font-medium">
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            Jetzt
          </button>
        </div>
      </div>

      {/* Bestellfluss-Status */}
      <FlowStatusBanner flow={flow} />

      {/* KPI-Band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<Euro size={14} />}
          label="Umsatz heute"
          value={shiftStats ? euro(shiftStats.revenue) : '—'}
          sub={shiftStats ? `Ø ${euro(shiftStats.avgOrderValue)} / Bestellung` : undefined}
        />
        <KpiCard
          icon={<Package size={14} />}
          label="Bestellungen"
          value={shiftStats?.orders ?? '—'}
          sub={shiftStats ? `${shiftStats.pendingOrders} offen` : undefined}
          highlight={Boolean(shiftStats && shiftStats.pendingOrders > 5)}
        />
        <KpiCard
          icon={<CheckCircle2 size={14} />}
          label="Pünktlichkeit"
          value={onTimeLabel}
          sub={shiftStats ? `Ø ${shiftStats.avgDeliveryMin.toFixed(0)} Min Lieferzeit` : undefined}
          color={shiftStats && shiftStats.onTimeRatePct >= 85 ? 'text-green-600' : 'text-red-500'}
        />
        <KpiCard
          icon={<Bike size={14} />}
          label="Fahrer online"
          value={loading ? '—' : `${driversOnline}`}
          sub={`${driversAvail} frei · ${driversEnRoute} unterwegs`}
          highlight={driversOnline === 0}
          color="text-blue-600"
        />
      </div>

      {/* Touren + Fahrer – 2 Spalten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aktive Touren */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Navigation2 size={14} className="text-matcha-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Aktive Touren</span>
            <span className="ml-auto text-xs text-muted-foreground">{activeTours.length}</span>
          </div>
          <div className="p-3 space-y-1.5 max-h-60 overflow-y-auto">
            {activeTours.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Keine aktiven Touren</p>
            ) : activeTours.map((t) => (
              <TourHealthRow key={t.id} tour={t} />
            ))}
          </div>
        </div>

        {/* Fahrer-Grid */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Users size={14} className="text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Status</span>
            <span className="ml-auto text-xs text-muted-foreground">{drivers.length}</span>
          </div>
          <div className="p-3 max-h-60 overflow-y-auto space-y-1">
            {drivers.filter((d) => d.active).length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-4">Keine aktiven Fahrer</p>
            ) : drivers
                .filter((d) => d.active)
                .sort((a, b) => {
                  const order = ['unterwegs', 'online', 'returning', 'break', 'offline'];
                  return order.indexOf(a.state) - order.indexOf(b.state);
                })
                .map((d) => (
                  <div key={d.id} className="flex items-center gap-2 py-1">
                    <Bike size={12} className="text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate flex-1">{d.name ?? '—'}</span>
                    <span className="text-[10px] text-muted-foreground mr-1">{d.vehicle ?? ''}</span>
                    <DriverStateBadge state={d.state} />
                  </div>
                ))}
          </div>
        </div>
      </div>

      {/* Streak-Feuer + Quick Links – 2 Spalten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Aktive Streaks */}
        {streaks.length > 0 && (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-amber-50">
              <Flame size={14} className="text-orange-500" />
              <span className="text-xs font-bold uppercase tracking-wider">🔥 Aktive Streaks</span>
              <a href="/delivery/driver-streaks" className="ml-auto text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                Alle <ChevronRight size={11} />
              </a>
            </div>
            <div className="px-4 py-2 divide-y">
              {streaks.map((s, i) => (
                <StreakFireRow key={i} entry={s} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
            <Zap size={14} className="text-matcha-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Schnellzugriff</span>
          </div>
          <div className="p-2 grid grid-cols-2 gap-2">
            {[
              { href: '/dispatch',                      icon: <MapPin     size={13} />, label: 'Dispatch'          },
              { href: '/kitchen',                       icon: <BarChart3  size={13} />, label: 'Küche'             },
              { href: '/delivery/flow-intelligence',    icon: <Activity   size={13} />, label: 'Bestellfluss'      },
              { href: '/delivery/alerts',               icon: <AlertTriangle size={13} />, label: 'Alarme'         },
              { href: '/delivery/driver-streaks',       icon: <Flame      size={13} />, label: 'Streaks'           },
              { href: '/delivery/performance',          icon: <TrendingUp size={13} />, label: 'Performance'       },
              { href: '/delivery/reporting',            icon: <BarChart3  size={13} />, label: 'Reports'           },
              { href: '/delivery/driver-leaderboard',   icon: <Users      size={13} />, label: 'Rangliste'         },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-foreground bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <span className="text-matcha-600">{item.icon}</span>
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Stunden-Chart wenn verfügbar */}
      {shiftStats?.hourBuckets && shiftStats.hourBuckets.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-muted-foreground" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Bestellungen letzte 6h</span>
          </div>
          <div className="flex items-end gap-1 h-16">
            {shiftStats.hourBuckets.map((b, i) => {
              const maxOrders = Math.max(...shiftStats.hourBuckets!.map((x) => x.orders), 1);
              const pct = (b.orders / maxOrders) * 100;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
                  <div className="w-full flex items-end justify-center" style={{ height: 48 }}>
                    <div
                      className="w-full max-w-[24px] rounded-t bg-matcha-500/80"
                      style={{ height: `${Math.max(pct, 4)}%` }}
                      title={`${b.orders} Bestellungen`}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground">{b.hour}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
