'use client';

/**
 * DispatchFahrerErmuedungsStrip — Compact driver fatigue monitor for the dispatch board.
 *
 * Reads from GET /api/delivery/admin/fatigue-monitor and shows a live strip
 * of all active drivers with their fatigue risk level. Dispatchers can spot
 * high-risk drivers before assigning new orders and trigger a break.
 *
 * Risk levels: low (grün) · medium (gelb) · high (orange) · critical (rot).
 * Pollt every 3 min automatically.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, Flame,
  Loader2, RefreshCw, ShieldAlert, Zap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface DriverFatigueState {
  driverId: string;
  driverName: string;
  driverVehicle: string;
  driverState: string;
  snapshot: {
    fatigueScore: number;
    riskLevel: RiskLevel;
    hoursOnShift: number;
    shiftDeliveries: number;
    lateRateShift: number;
    speedDriftPct: number;
    lastDeliveryAgoMin: number | null;
    longestBreakMin: number;
  } | null;
  openAlert: {
    riskLevel: RiskLevel;
    triggerReason: string;
    triggeredAt: string;
  } | null;
}

interface FatigueDashboard {
  driversMonitored: number;
  driversAtRisk: number;
  criticalCount: number;
  avgFatigueScore: number;
  drivers: DriverFatigueState[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; border: string; icon: typeof Activity }> = {
  low:      { label: 'Fit',      color: 'text-matcha-700',  bg: 'bg-matcha-50',  border: 'border-matcha-200', icon: CheckCircle2 },
  medium:   { label: 'Mittel',   color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: Activity },
  high:     { label: 'Müde',     color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200', icon: AlertTriangle },
  critical: { label: 'Kritisch', color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-300',    icon: ShieldAlert },
};

function riskScore(level: RiskLevel): number {
  return { low: 0, medium: 1, high: 2, critical: 3 }[level];
}

function DriverChip({ driver }: { driver: DriverFatigueState }) {
  const snap = driver.snapshot;
  const level: RiskLevel = snap?.riskLevel ?? 'low';
  const cfg = RISK_CONFIG[level];
  const RiskIcon = cfg.icon;
  const score = snap?.fatigueScore ?? 0;
  const hours = snap?.hoursOnShift ?? 0;
  const pulse = level === 'critical' || (driver.openAlert && riskScore(driver.openAlert.riskLevel) >= 2);

  return (
    <div className={cn(
      'relative flex flex-col gap-1 rounded-xl border px-3 py-2.5 min-w-[120px] flex-shrink-0',
      cfg.bg, cfg.border,
      pulse && 'ring-2 ring-red-400/60 ring-offset-1',
    )}>
      {/* Driver name */}
      <div className="flex items-center gap-1.5 leading-none">
        <RiskIcon size={12} className={cn(cfg.color, pulse && 'animate-pulse')} />
        <span className="text-[11px] font-bold text-char truncate max-w-[80px]">{driver.driverName}</span>
      </div>

      {/* Score pill */}
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-lg font-black tabular-nums leading-none', cfg.color)}>{Math.round(score)}</span>
        <span className={cn('text-[10px] font-bold uppercase tracking-wide', cfg.color)}>{cfg.label}</span>
      </div>

      {/* Hours on shift */}
      <div className="flex items-center gap-1 text-[10px] text-stone-400">
        <Clock size={9} />
        <span>{hours.toFixed(1)}h</span>
        {snap && snap.lateRateShift > 0.2 && (
          <span className="ml-auto text-orange-500 font-bold">{Math.round(snap.lateRateShift * 100)}% spät</span>
        )}
      </div>

      {/* Alert reason */}
      {driver.openAlert && (
        <div className="mt-0.5 text-[9px] text-red-600 font-medium leading-snug truncate">
          ⚠ {driver.openAlert.triggerReason}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DispatchFahrerErmuedungsStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<FatigueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const r = await fetch('/api/delivery/admin/fatigue-monitor', { cache: 'no-store' });
      if (!r.ok) return;
      const d = await r.json() as FatigueDashboard;
      setData(d);
      // Auto-expand if there are at-risk drivers
      if (d.driversAtRisk > 0) setOpen(true);
    } catch {
      // Silently ignore — optional feature
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(() => load(), 3 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!locationId) return null;
  if (loading) return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 flex items-center gap-2 text-xs text-stone-400">
      <Loader2 size={13} className="animate-spin" />
      Lade Fahrer-Ermüdungsmonitor…
    </div>
  );
  if (!data || data.driversMonitored === 0) return null;

  const drivers = [...data.drivers].sort((a, b) =>
    riskScore(b.snapshot?.riskLevel ?? 'low') - riskScore(a.snapshot?.riskLevel ?? 'low')
  );
  const atRisk = data.driversAtRisk;
  const hasCritical = data.criticalCount > 0;

  return (
    <div className={cn(
      'rounded-2xl border bg-white overflow-hidden transition-all',
      hasCritical ? 'border-red-300' : atRisk > 0 ? 'border-orange-200' : 'border-stone-200',
    )}>
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-full shrink-0',
          hasCritical ? 'bg-red-100 text-red-600' : atRisk > 0 ? 'bg-orange-100 text-orange-600' : 'bg-matcha-100 text-matcha-700',
        )}>
          <Flame size={14} className={hasCritical ? 'animate-pulse' : ''} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-char">Fahrer-Ermüdungsmonitor</div>
          <div className="text-[11px] text-stone-400 mt-0.5">
            {data.driversMonitored} aktiv · Ø Score {Math.round(data.avgFatigueScore)}
            {atRisk > 0 && (
              <span className={cn('ml-2 font-bold', hasCritical ? 'text-red-600' : 'text-orange-600')}>
                · {atRisk} gefährdet{hasCritical ? ` (${data.criticalCount} kritisch!)` : ''}
              </span>
            )}
          </div>
        </div>
        {/* Pill per risk level */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasCritical && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              {data.criticalCount} krit.
            </span>
          )}
          {atRisk > 0 && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              {atRisk} at-risk
            </span>
          )}
          <button
            onClick={e => { e.stopPropagation(); load(true); }}
            className="p-1 rounded-lg hover:bg-stone-100 transition"
            aria-label="Aktualisieren"
          >
            <RefreshCw size={12} className={cn('text-stone-400', refreshing && 'animate-spin')} />
          </button>
          <Zap size={13} className={cn('transition', open ? 'rotate-180 text-stone-400' : 'text-stone-300')} />
        </div>
      </button>

      {/* Expanded driver strip */}
      {open && (
        <div className="border-t border-stone-100 px-4 py-3">
          {drivers.length === 0 ? (
            <div className="text-xs text-stone-400 text-center py-2">Keine aktiven Fahrer</div>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {drivers.map(d => <DriverChip key={d.driverId} driver={d} />)}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-[10px] text-stone-400 border-t border-stone-100 pt-2">
            <span>Aktualisiert alle 3 Min · Quelle: Ermüdungsmodell (Phase 119)</span>
            <span>Score ≥55 = müde · ≥75 = kritisch</span>
          </div>
        </div>
      )}
    </div>
  );
}
