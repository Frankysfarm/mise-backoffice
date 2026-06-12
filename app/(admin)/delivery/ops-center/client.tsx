'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Minus, Users, Truck, ChefHat, Package, Zap, Activity, Euro,
  RefreshCw, Wifi, WifiOff, Timer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Typen ─────────────────────────────────────────────────────────────────────

interface OpsSnapshot {
  queue: {
    neu: number;
    zubereitung: number;
    bereit: number;
    unterwegs: number;
    total: number;
  };
  drivers: {
    online: number;
    idle: number;
    active: number;
    offline: number;
    total: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
    total: number;
    latest: Array<{ type: string; severity: string; message: string; createdAt: string }>;
  };
  signal: {
    type: 'normal' | 'extended' | 'paused';
    etaExtensionMin: number;
    messageDe: string | null;
  };
  revenue: {
    today: number;
    yesterday: number;
    deltaPct: number | null;
  };
  sla: {
    onTimePct: number | null;
    avgDeviationMin: number | null;
    sampleSize: number;
  };
  throughput: {
    deliveriesLast30min: number;
    perHourRate: number;
  };
  delays: { active: number };
  atRisk: Array<{
    id: string;
    bestellnummer: string;
    status: string;
    waitMinutes: number;
    kundeName: string | null;
    zone: string | null;
    dispatchAttempts: number;
  }>;
  generatedAt: string;
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

function euro(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtEuro(val: number): string {
  if (val >= 100000) return `${(val / 100).toFixed(0)} €`;
  return (val / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

// ── Subkomponenten ────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  variant?: 'default' | 'ok' | 'warn' | 'critical';
}) {
  const border = {
    default:  'border-zinc-200',
    ok:       'border-emerald-300',
    warn:     'border-amber-400',
    critical: 'border-red-400',
  }[variant];
  const bg = {
    default:  'bg-white',
    ok:       'bg-emerald-50/60',
    warn:     'bg-amber-50/60',
    critical: 'bg-red-50/60',
  }[variant];

  return (
    <div className={cn('rounded-xl border p-4 shadow-sm', border, bg)}>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">
        <span className="text-zinc-400">{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold text-zinc-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

function SignalBadge({ type, ext }: { type: OpsSnapshot['signal']['type']; ext: number }) {
  if (type === 'normal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Normal
      </span>
    );
  }
  if (type === 'extended') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        +{ext} Min ETA
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
      Pausiert
    </span>
  );
}

function QueueFunnel({ queue }: { q: OpsSnapshot['queue'] } & { queue: OpsSnapshot['queue'] }) {
  const steps: Array<{ label: string; count: number; color: string; icon: React.ReactNode }> = [
    { label: 'Neu',        count: queue.neu,        color: 'bg-blue-200  text-blue-800',   icon: <Package size={12} /> },
    { label: 'Küche',      count: queue.zubereitung, color: 'bg-orange-200 text-orange-800', icon: <ChefHat size={12} /> },
    { label: 'Bereit',     count: queue.bereit,     color: 'bg-yellow-200 text-yellow-800', icon: <Zap size={12} /> },
    { label: 'Unterwegs',  count: queue.unterwegs,  color: 'bg-emerald-200 text-emerald-800', icon: <Truck size={12} /> },
  ];

  const max = Math.max(...steps.map((s) => s.count), 1);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 flex items-center gap-1.5">
        <Activity size={12} className="text-zinc-400" />
        Bestell-Pipeline
        <span className="ml-auto text-zinc-400">{queue.total} gesamt</span>
      </div>
      <div className="space-y-2">
        {steps.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <div className={cn('flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold', s.color)} style={{ width: 70 }}>
              {s.icon}
              {s.label}
            </div>
            <div className="flex-1 h-4 rounded-full bg-zinc-100 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', s.color.split(' ')[0].replace('200', '400'))}
                style={{ width: `${Math.round((s.count / max) * 100)}%` }}
              />
            </div>
            <span className="w-6 text-right text-sm font-bold text-zinc-700">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriverPanel({ drivers }: { drivers: OpsSnapshot['drivers'] }) {
  const onlinePct = drivers.total > 0 ? Math.round((drivers.online / drivers.total) * 100) : 0;
  const variant = drivers.online === 0 ? 'critical' : drivers.idle > 0 ? 'ok' : 'warn';

  return (
    <div className={cn(
      'rounded-xl border p-4 shadow-sm',
      variant === 'critical' ? 'border-red-300 bg-red-50/60' :
      variant === 'ok'       ? 'border-emerald-300 bg-emerald-50/60' :
                               'border-amber-300 bg-amber-50/60',
    )}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 flex items-center gap-1.5">
        <Users size={12} className="text-zinc-400" />
        Fahrer
      </div>
      {/* Ring */}
      <div className="flex items-center gap-4 mb-3">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#e5e7eb" strokeWidth="6" />
            <circle
              cx="28" cy="28" r="22" fill="none"
              stroke={variant === 'critical' ? '#ef4444' : variant === 'ok' ? '#10b981' : '#f59e0b'}
              strokeWidth="6"
              strokeDasharray={`${2 * Math.PI * 22}`}
              strokeDashoffset={`${2 * Math.PI * 22 * (1 - onlinePct / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-zinc-700">
            {onlinePct}%
          </span>
        </div>
        <div>
          <div className="text-2xl font-bold text-zinc-900">{drivers.online}<span className="text-sm font-normal text-zinc-400">/{drivers.total}</span></div>
          <div className="text-xs text-zinc-500">Online</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
        <div className="rounded-md bg-white/80 py-1">
          <div className="font-bold text-emerald-600">{drivers.idle}</div>
          <div className="text-zinc-400">Frei</div>
        </div>
        <div className="rounded-md bg-white/80 py-1">
          <div className="font-bold text-blue-600">{drivers.active}</div>
          <div className="text-zinc-400">Aktiv</div>
        </div>
        <div className="rounded-md bg-white/80 py-1">
          <div className="font-bold text-zinc-500">{drivers.offline}</div>
          <div className="text-zinc-400">Offline</div>
        </div>
      </div>
    </div>
  );
}

function AlertPanel({ alerts }: { alerts: OpsSnapshot['alerts'] }) {
  const hasAlerts = alerts.total > 0;
  return (
    <div className={cn(
      'rounded-xl border p-4 shadow-sm',
      alerts.critical > 0 ? 'border-red-300 bg-red-50/60' :
      alerts.warning  > 0 ? 'border-amber-300 bg-amber-50/60' :
      hasAlerts            ? 'border-blue-200 bg-blue-50/60' :
                             'border-zinc-200 bg-white',
    )}>
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500 mb-3 flex items-center gap-1.5">
        <AlertTriangle size={12} className="text-zinc-400" />
        Aktive Alarme
        {hasAlerts && (
          <span className={cn(
            'ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            alerts.critical > 0 ? 'bg-red-100 text-red-700' :
            alerts.warning  > 0 ? 'bg-amber-100 text-amber-700' :
                                  'bg-blue-100 text-blue-700',
          )}>
            {alerts.total}
          </span>
        )}
      </div>
      {!hasAlerts ? (
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 size={16} />
          <span className="text-sm font-medium">Alles in Ordnung</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            {alerts.critical > 0 && (
              <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                {alerts.critical} Kritisch
              </span>
            )}
            {alerts.warning > 0 && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                {alerts.warning} Warnung
              </span>
            )}
            {alerts.info > 0 && (
              <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                {alerts.info} Info
              </span>
            )}
          </div>
          {alerts.latest.map((a, i) => (
            <div key={i} className="rounded-md bg-white/80 px-2 py-1.5 text-xs">
              <span className={cn(
                'mr-1 font-semibold',
                a.severity === 'critical' ? 'text-red-600' :
                a.severity === 'warning'  ? 'text-amber-600' : 'text-blue-600',
              )}>
                [{a.severity.toUpperCase()}]
              </span>
              {a.message}
              <span className="ml-1 text-zinc-400">({timeAgo(a.createdAt)})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AtRiskPanel({ orders }: { orders: OpsSnapshot['atRisk'] }) {
  if (orders.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 shadow-sm col-span-full">
      <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-600 mb-3 flex items-center gap-1.5">
        <Timer size={12} />
        Wartende Bestellungen (längste Wartezeit)
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {orders.map((o) => (
          <div key={o.id} className={cn(
            'rounded-lg bg-white border p-3',
            o.waitMinutes >= 20 ? 'border-red-300' :
            o.waitMinutes >= 10 ? 'border-amber-300' :
                                  'border-zinc-200',
          )}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-700">#{o.bestellnummer}</span>
              <span className={cn(
                'text-xs font-bold',
                o.waitMinutes >= 20 ? 'text-red-600' :
                o.waitMinutes >= 10 ? 'text-amber-600' : 'text-zinc-500',
              )}>
                {o.waitMinutes} Min
              </span>
            </div>
            <div className="text-[10px] text-zinc-500">
              {o.kundeName && <span>{o.kundeName} · </span>}
              {o.zone && <span>Zone {o.zone} · </span>}
              <span className={cn(
                'rounded px-1',
                o.status === 'bereit_zur_lieferung' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700',
              )}>
                {o.status === 'bereit_zur_lieferung' ? 'Bereit' : 'Neu'}
              </span>
            </div>
            {o.dispatchAttempts > 0 && (
              <div className="mt-1 text-[10px] text-red-500">{o.dispatchAttempts}× Dispatch-Versuch</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function OpsCenterClient({ locationId }: { locationId: string }) {
  const [snap, setSnap] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/ops-snapshot?location_id=${locationId}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OpsSnapshot = await res.json();
      setSnap(data);
      setError(null);
      setLastUpdate(new Date());
      setCountdown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  // Initial load + 30s polling
  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30_000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  // Countdown-Ticker
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c <= 1 ? 30 : c - 1)), 1_000);
    return () => clearInterval(t);
  }, []);

  if (loading && !snap) {
    return (
      <div className="flex items-center justify-center py-24 text-zinc-400">
        <RefreshCw size={20} className="animate-spin mr-2" />
        Lade Betriebsdaten…
      </div>
    );
  }

  if (error && !snap) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <AlertTriangle size={16} className="inline mr-2" />
        Fehler beim Laden: {error}
      </div>
    );
  }

  if (!snap) return null;

  const slaVariant = snap.sla.onTimePct == null ? 'default' :
    snap.sla.onTimePct >= 90 ? 'ok' :
    snap.sla.onTimePct >= 70 ? 'warn' : 'critical';

  const revenueVariant = snap.revenue.deltaPct == null ? 'default' :
    snap.revenue.deltaPct >= 0 ? 'ok' : 'warn';

  return (
    <div className="space-y-4">
      {/* Header: letzte Aktualisierung + Signal */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <SignalBadge type={snap.signal.type} ext={snap.signal.etaExtensionMin} />
          {snap.signal.messageDe && (
            <span className="text-xs text-zinc-500">{snap.signal.messageDe}</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {error ? (
            <WifiOff size={12} className="text-red-400" />
          ) : (
            <Wifi size={12} className="text-emerald-500" />
          )}
          {lastUpdate && (
            <span>Aktualisiert {timeAgo(lastUpdate.toISOString())} · nächste in {countdown}s</span>
          )}
          <button
            onClick={fetchSnapshot}
            className="ml-1 rounded p-1 hover:bg-zinc-100 transition-colors"
            title="Jetzt aktualisieren"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Hauptraster */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Revenue */}
        <StatCard
          icon={<Euro size={12} />}
          label="Umsatz heute"
          value={fmtEuro(snap.revenue.today)}
          sub={
            snap.revenue.deltaPct != null ? (
              <span className={snap.revenue.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                {snap.revenue.deltaPct >= 0 ? <TrendingUp size={10} className="inline mr-0.5" /> : <TrendingDown size={10} className="inline mr-0.5" />}
                {snap.revenue.deltaPct >= 0 ? '+' : ''}{snap.revenue.deltaPct}% vs. gestern
              </span>
            ) : (
              <span className="flex items-center gap-1"><Minus size={10} />Vergleich n/a</span>
            )
          }
          variant={revenueVariant}
        />

        {/* SLA */}
        <StatCard
          icon={<CheckCircle2 size={12} />}
          label="On-Time-Rate"
          value={snap.sla.onTimePct != null ? `${snap.sla.onTimePct}%` : '—'}
          sub={
            snap.sla.sampleSize > 0
              ? `Ø ${snap.sla.avgDeviationMin != null ? (snap.sla.avgDeviationMin > 0 ? '+' : '') + snap.sla.avgDeviationMin + ' Min' : '?'} · n=${snap.sla.sampleSize}`
              : 'Noch keine Daten'
          }
          variant={slaVariant}
        />

        {/* Durchsatz */}
        <StatCard
          icon={<Activity size={12} />}
          label="Durchsatz (30 Min)"
          value={`${snap.throughput.deliveriesLast30min}`}
          sub={`≈ ${snap.throughput.perHourRate} Lieferungen/Std`}
          variant={snap.throughput.perHourRate > 0 ? 'ok' : 'default'}
        />

        {/* Verspätungen */}
        <StatCard
          icon={<Clock size={12} />}
          label="Aktive Verspätungen"
          value={snap.delays.active}
          sub="Bestellungen nach ETA-Deadline"
          variant={snap.delays.active === 0 ? 'ok' : snap.delays.active <= 2 ? 'warn' : 'critical'}
        />
      </div>

      {/* Zweite Reihe: Pipeline + Driver + Alerts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QueueFunnel queue={snap.queue} q={snap.queue} />
        <DriverPanel drivers={snap.drivers} />
        <AlertPanel alerts={snap.alerts} />
      </div>

      {/* At-Risk Orders */}
      {snap.atRisk.length > 0 && (
        <AtRiskPanel orders={snap.atRisk} />
      )}
    </div>
  );
}
