'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, Bike, Clock, Package,
  TrendingUp, Zap, ShieldCheck, ChefHat, Truck, AlertCircle,
} from 'lucide-react';

type OpsSnapshot = {
  queue: { neu: number; zubereitung: number; bereit: number; unterwegs: number; total: number };
  drivers: { online: number; idle: number; active: number; offline: number; total: number };
  alerts: { critical: number; warning: number; info: number; total: number; latest: { type: string; severity: string; message: string; createdAt: string }[] };
  signal: { type: string; etaExtensionMin: number; messageDe: string | null };
  revenue: { today: number; yesterday: number; deltaPct: number | null };
  sla: { onTimePct: number | null; avgDeviationMin: number | null; sampleSize: number };
  throughput: { deliveriesLast30min: number; perHourRate: number };
  delays: { active: number };
  atRisk: { id: string; bestellnummer: string; status: string; waitMinutes: number; kundeName: string | null; zone: string | null; dispatchAttempts: number }[];
  generatedAt: string;
};

const SIGNAL_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  normal:    { label: 'Normal',     color: 'text-matcha-700', bg: 'bg-matcha-50',  border: 'border-matcha-300' },
  busy:      { label: 'Ausgelastet', color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-300'  },
  surge:     { label: 'Surge',      color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-300'    },
  critical:  { label: 'Kritisch',   color: 'text-red-800',    bg: 'bg-red-100',    border: 'border-red-400'    },
  quiet:     { label: 'Ruhig',      color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-300'   },
};

export function OpsSnapshotPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<OpsSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/admin/ops-snapshot?location_id=${locationId}`);
        if (res.ok && !cancelled) {
          const d: OpsSnapshot = await res.json();
          setData(d);
          setLastRefresh(new Date());
        }
      } catch { /* noop */ } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!locationId || !data) return null;

  const signal = SIGNAL_META[data.signal.type] ?? SIGNAL_META.normal;
  const slaOk = data.sla.onTimePct !== null && data.sla.onTimePct >= 80;
  const slaWarn = data.sla.onTimePct !== null && data.sla.onTimePct >= 60 && data.sla.onTimePct < 80;

  return (
    <div className="rounded-2xl border bg-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', loading ? 'bg-amber-400 animate-pulse' : 'bg-matcha-500 animate-pulse')} />
          <span className="text-sm font-black text-stone-800">Live Ops-Cockpit</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black border', signal.bg, signal.color, signal.border)}>
            {signal.label}
            {data.signal.etaExtensionMin > 0 && ` +${data.signal.etaExtensionMin}m ETA`}
          </span>
        </div>
        {lastRefresh && (
          <span className="text-[9px] text-stone-400 tabular-nums">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>

      {/* Queue Flow: neu → kocht → bereit → unterwegs */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Neu',       value: data.queue.neu,        icon: Package,  color: 'border-stone-200 bg-stone-50',      textColor: 'text-stone-700' },
          { label: 'Kocht',     value: data.queue.zubereitung, icon: ChefHat,  color: 'border-orange-200 bg-orange-50',    textColor: 'text-orange-700' },
          { label: 'Bereit',    value: data.queue.bereit,     icon: Zap,      color: 'border-matcha-200 bg-matcha-50',    textColor: 'text-matcha-700' },
          { label: 'Unterwegs', value: data.queue.unterwegs,  icon: Truck,    color: 'border-blue-200 bg-blue-50',        textColor: 'text-blue-700' },
        ].map(({ label, value, icon: Icon, color, textColor }) => (
          <div key={label} className={cn('rounded-xl border px-3 py-2.5 text-center', color)}>
            <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1', textColor)} />
            <div className={cn('text-2xl font-black tabular-nums leading-none', textColor)}>{value}</div>
            <div className="text-[9px] text-stone-400 mt-0.5 font-bold uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue + SLA + Throughput */}
      <div className="grid grid-cols-3 gap-2">
        {/* Revenue */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-emerald-600" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Umsatz heute</span>
          </div>
          <div className="text-lg font-black text-stone-800 tabular-nums leading-none">
            {data.revenue.today.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €
          </div>
          {data.revenue.deltaPct !== null && (
            <div className={cn(
              'mt-1 flex items-center gap-0.5 text-[9px] font-bold',
              data.revenue.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-600',
            )}>
              {data.revenue.deltaPct >= 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
              {Math.abs(data.revenue.deltaPct)}% vs. gestern
            </div>
          )}
        </div>

        {/* SLA */}
        <div className={cn(
          'rounded-xl border px-3 py-2.5',
          slaOk ? 'border-matcha-200 bg-matcha-50' : slaWarn ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50 animate-pulse',
        )}>
          <div className="flex items-center gap-1 mb-1">
            <ShieldCheck className={cn('h-3 w-3', slaOk ? 'text-matcha-600' : slaWarn ? 'text-amber-600' : 'text-red-600')} />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Pünktlichkeit</span>
          </div>
          <div className={cn(
            'text-lg font-black tabular-nums leading-none',
            slaOk ? 'text-matcha-700' : slaWarn ? 'text-amber-700' : 'text-red-700',
          )}>
            {data.sla.onTimePct !== null ? `${data.sla.onTimePct}%` : '–'}
          </div>
          <div className="mt-1 text-[9px] text-stone-400">
            {data.sla.sampleSize} letzte Lieferungen
            {data.sla.avgDeviationMin !== null && ` · Ø ${data.sla.avgDeviationMin}m Abw.`}
          </div>
        </div>

        {/* Throughput */}
        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5">
          <div className="flex items-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-blue-600" />
            <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Durchsatz</span>
          </div>
          <div className="text-lg font-black text-stone-800 tabular-nums leading-none">
            {data.throughput.perHourRate}/h
          </div>
          <div className="mt-1 text-[9px] text-stone-400">
            {data.throughput.deliveriesLast30min} letzte 30 Min
          </div>
        </div>
      </div>

      {/* Drivers + Delays row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Driver breakdown */}
        <div className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5">
          <Bike className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-[11px] font-bold text-stone-600">
            <span className="text-matcha-700 font-black">{data.drivers.online}</span> online
          </span>
          {data.drivers.idle > 0 && (
            <span className="text-[10px] text-stone-400">· {data.drivers.idle} frei</span>
          )}
          {data.drivers.active > 0 && (
            <span className="text-[10px] text-blue-600 font-bold">· {data.drivers.active} aktiv</span>
          )}
        </div>

        {/* Active delays */}
        {data.delays.active > 0 && (
          <div className={cn(
            'flex items-center gap-1.5 rounded-xl border px-3 py-1.5',
            data.delays.active >= 3 ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50',
          )}>
            <Clock className={cn('h-3.5 w-3.5 shrink-0', data.delays.active >= 3 ? 'text-red-600 animate-pulse' : 'text-amber-600')} />
            <span className={cn('text-[11px] font-bold', data.delays.active >= 3 ? 'text-red-700' : 'text-amber-700')}>
              {data.delays.active} {data.delays.active === 1 ? 'Verspätung' : 'Verspätungen'}
            </span>
          </div>
        )}

        {/* Alerts */}
        {data.alerts.total > 0 && (
          <div className={cn(
            'flex items-center gap-1.5 rounded-xl border px-3 py-1.5',
            data.alerts.critical > 0 ? 'border-red-400 bg-red-50' : 'border-amber-300 bg-amber-50',
          )}>
            <AlertTriangle className={cn(
              'h-3.5 w-3.5 shrink-0',
              data.alerts.critical > 0 ? 'text-red-600 animate-pulse' : 'text-amber-600',
            )} />
            <span className={cn('text-[11px] font-bold', data.alerts.critical > 0 ? 'text-red-700' : 'text-amber-700')}>
              {data.alerts.critical > 0 ? `${data.alerts.critical} kritisch` : `${data.alerts.warning} Warnung${data.alerts.warning !== 1 ? 'en' : ''}`}
            </span>
          </div>
        )}

        {/* Signal message */}
        {data.signal.messageDe && (
          <div className={cn('flex items-center gap-1.5 rounded-xl border px-3 py-1.5 flex-1 min-w-0', signal.bg, signal.border)}>
            <Zap className={cn('h-3.5 w-3.5 shrink-0', signal.color)} />
            <span className={cn('text-[10px] font-bold truncate', signal.color)}>{data.signal.messageDe}</span>
          </div>
        )}
      </div>

      {/* At-Risk Orders */}
      {data.atRisk.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">
              {data.atRisk.length} Bestellungen warten zu lang
            </span>
          </div>
          <div className="space-y-1.5">
            {data.atRisk.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black',
                    o.waitMinutes >= 30 ? 'bg-red-200 text-red-800' : 'bg-amber-200 text-amber-800',
                  )}>
                    {o.waitMinutes}m
                  </span>
                  <span className="truncate font-semibold text-stone-700">
                    {o.kundeName ?? o.bestellnummer}
                  </span>
                  {o.zone && (
                    <span className="shrink-0 text-[9px] text-stone-400">Zone {o.zone}</span>
                  )}
                </div>
                {o.dispatchAttempts > 0 && (
                  <span className="shrink-0 text-[9px] text-red-600 font-bold">
                    {o.dispatchAttempts}× versucht
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
