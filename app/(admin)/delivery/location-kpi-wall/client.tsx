'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, MapPin, RefreshCw, TrendingUp, Users, Zap,
} from 'lucide-react';
import type { FranchiseCompareResponse, LocationCompareRow } from '@/app/api/delivery/admin/franchise-compare/route';

const REFRESH_SEC = 30;

function slaColor(rate: number | null) {
  if (rate === null) return 'text-gray-400';
  if (rate >= 90) return 'text-emerald-400';
  if (rate >= 75) return 'text-amber-400';
  return 'text-red-400';
}
function slaBg(rate: number | null) {
  if (rate === null) return 'bg-gray-800/40';
  if (rate >= 90) return 'bg-emerald-500/10';
  if (rate >= 75) return 'bg-amber-500/10';
  return 'bg-red-500/10';
}
function healthDot(health: string) {
  if (health === 'critical') return 'bg-red-500 animate-pulse';
  if (health === 'warning') return 'bg-amber-400 animate-pulse';
  return 'bg-emerald-400';
}
function rankBadge(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
function fmtN(v: number | null, decimals = 1, suffix = '') {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(decimals)}${suffix}`;
}

function PulseBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-1000', color)}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function LocationCard({ row, totalCompleted }: { row: LocationCompareRow; totalCompleted: number }) {
  const sharePct = totalCompleted > 0 ? Math.round((row.completed_today / totalCompleted) * 100) : 0;
  const isCritical = row.health === 'critical';
  const isWarning = row.health === 'warning';

  return (
    <div className={cn(
      'relative rounded-2xl border p-4 space-y-3 transition-all duration-300',
      isCritical ? 'border-red-500/40 bg-red-500/5' :
      isWarning  ? 'border-amber-500/30 bg-amber-500/5' :
                   'border-white/8 bg-white/3',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-2 h-2 rounded-full shrink-0 mt-0.5', healthDot(row.health))} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{row.location_name}</div>
            <div className="text-[10px] text-gray-400 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5" />
              Standort
            </div>
          </div>
        </div>
        <div className="shrink-0 text-lg leading-none">{rankBadge(row.rank)}</div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* SLA */}
        <div className={cn('rounded-xl p-2.5', slaBg(row.on_time_rate))}>
          <div className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> SLA
          </div>
          <div className={cn('text-lg font-black tabular-nums', slaColor(row.on_time_rate))}>
            {fmtN(row.on_time_rate, 0, '%')}
          </div>
          {row.on_time_rate !== null && (
            <PulseBar
              pct={row.on_time_rate}
              color={row.on_time_rate >= 90 ? 'bg-emerald-400' : row.on_time_rate >= 75 ? 'bg-amber-400' : 'bg-red-400'}
            />
          )}
        </div>

        {/* Umsatz */}
        <div className="rounded-xl p-2.5 bg-white/5">
          <div className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" /> Umsatz
          </div>
          <div className="text-lg font-black tabular-nums text-white">
            {row.revenue_today.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </div>
          <div className="text-[9px] text-gray-500">heute</div>
        </div>

        {/* Kochend */}
        <div className="rounded-xl p-2.5 bg-white/5">
          <div className="text-[9px] text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Bike className="h-2.5 w-2.5" /> Kochend
          </div>
          <div className="flex items-end gap-1">
            <div className="text-lg font-black tabular-nums text-emerald-300">{row.cooking_now}</div>
            <div className="text-[9px] text-gray-500 mb-0.5">in Zub.</div>
          </div>
          <PulseBar pct={Math.min((row.cooking_now / Math.max(row.cooking_now + row.queue_depth, 1)) * 100, 100)} color="bg-emerald-400" />
        </div>

        {/* Bewertung */}
        <div className="rounded-xl p-2.5 bg-white/5">
          <div className="text-[9px] text-gray-400 uppercase tracking-wider">⭐ Rating</div>
          <div className={cn('text-lg font-black tabular-nums', row.avg_rating !== null && row.avg_rating >= 4.5 ? 'text-emerald-400' : row.avg_rating !== null && row.avg_rating >= 3.5 ? 'text-amber-400' : 'text-red-400')}>
            {fmtN(row.avg_rating, 1)}
          </div>
          <div className="text-[9px] text-gray-500">{row.total_ratings} Bewertungen</div>
        </div>
      </div>

      {/* Queue + Tours */}
      <div className="flex items-center gap-3 text-xs border-t border-white/5 pt-2">
        <div className="flex items-center gap-1 text-blue-300">
          <Zap className="h-3 w-3" />
          <span className="font-bold">{row.queue_depth}</span>
          <span className="text-gray-500">Queue</span>
        </div>
        <div className="flex items-center gap-1 text-purple-300">
          <Activity className="h-3 w-3" />
          <span className="font-bold">{row.active_tours}</span>
          <span className="text-gray-500">Touren</span>
        </div>
        <div className="flex items-center gap-1 text-emerald-300 ml-auto">
          <CheckCircle2 className="h-3 w-3" />
          <span className="font-bold">{row.completed_today}</span>
          <span className="text-gray-500">({sharePct}%)</span>
        </div>
      </div>

      {/* Kritisch-Banner */}
      {isCritical && (
        <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold rounded-lg bg-red-500/10 px-2 py-1.5">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          Kritisch — sofortige Maßnahme erforderlich
        </div>
      )}
    </div>
  );
}

export function LocationKpiWallClient() {
  const [data, setData] = useState<FranchiseCompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/franchise-compare');
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Fehler beim Laden');
        return;
      }
      const d = await res.json() as FranchiseCompareResponse;
      setData(d);
      setError(null);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_SEC);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, REFRESH_SEC * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const criticalCount = data?.locations.filter((l) => l.health === 'critical').length ?? 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <MapPin className="h-6 w-6 text-matcha-400" />
            Location KPI-Wall
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Echtzeit-Übersicht aller Standorte · Automatische Aktualisierung
          </p>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-bold bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1.5 animate-pulse">
              <AlertTriangle className="h-3.5 w-3.5" />
              {criticalCount} kritisch
            </div>
          )}
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {countdown}s
          </button>
        </div>
      </div>

      {/* Totals Bar */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Standorte', value: data.totals.locations, icon: <MapPin className="h-4 w-4" />, color: 'text-blue-400' },
            { label: 'Queue gesamt', value: data.totals.queue_total, icon: <Zap className="h-4 w-4" />, color: 'text-amber-400' },
            { label: 'Aktive Touren', value: data.totals.tours_total, icon: <Activity className="h-4 w-4" />, color: 'text-purple-400' },
            { label: 'Heute geliefert', value: data.totals.completed_today, icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-emerald-400' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-white/8 bg-white/4 p-3">
              <div className={cn('flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider', kpi.color)}>
                {kpi.icon} {kpi.label}
              </div>
              <div className="text-2xl font-black mt-1 tabular-nums">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="flex items-center justify-center h-48 text-gray-500 text-sm gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Standorte werden geladen…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 p-4 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Location Grid */}
      {data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.locations.map((row) => (
            <LocationCard key={row.location_id} row={row} totalCompleted={data.totals.completed_today} />
          ))}
          {data.locations.length === 0 && (
            <div className="col-span-full text-center text-gray-500 py-12">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Keine Standorte gefunden</p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      {data && (
        <div className="text-center text-[10px] text-gray-600">
          Stand: {new Date(data.generated_at).toLocaleTimeString('de-DE')} · {data.totals.critical_alerts} Kritisch-Alerts
        </div>
      )}
    </div>
  );
}
