'use client';

/**
 * TourStopEtaPredictor — Phase 166
 *
 * Zeigt vorhergesagte Ankunftszeiten für alle ausstehenden Stopps in Echtzeit.
 * Berechnet ETA auf Basis der GPS-Geschwindigkeit (oder 20 km/h Default)
 * und der Distanzen zwischen den Stopps.
 *
 * Farbkodierung:
 * 🟢 Grün       = pünktlich (> 5 Min Puffer bis eta_latest)
 * 🟠 Orange     = leicht spät (0–5 Min Puffer)
 * 🔴 Rot        = überfällig (nach eta_latest), pulsierend
 */

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    bestellnummer: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  };
};

interface Props {
  stops: Stop[];
  currentSpeed: number | null;
  started_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_SPEED_KMH = 20;
const TIGHT_BUFFER_MS = 5 * 60 * 1000; // 5 min
const STOP_SERVICE_TIME_MS = 90 * 1000; // ~90 s dwell per stop

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Ticks every second so ETA countdowns stay live. */
function useTick(intervalMs = 1_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return tick;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtCountdown(diffMs: number): string {
  if (diffMs <= 0) return '0 Min';
  const totalSec = Math.ceil(diffMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')} Std`;
  if (m > 0) return `${m} Min`;
  return `${totalSec} Sek`;
}

function fmtDistance(m: number | null | undefined): string | null {
  if (m == null || m <= 0) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

type StopStatus = 'on-time' | 'tight' | 'overdue';

function getStatus(arrivalMs: number, etaLatestStr: string | null): StopStatus {
  if (!etaLatestStr) return 'on-time';
  const deadline = new Date(etaLatestStr).getTime();
  const buffer = deadline - arrivalMs;
  if (buffer < 0) return 'overdue';
  if (buffer < TIGHT_BUFFER_MS) return 'tight';
  return 'on-time';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status, etaLatest, arrivalMs }: {
  status: StopStatus;
  etaLatest: string | null;
  arrivalMs: number;
}) {
  const label =
    status === 'on-time' ? 'pünktlich' :
    status === 'tight'   ? 'leicht spät' :
                           'überfällig';

  const lateMsAgo = etaLatest
    ? arrivalMs - new Date(etaLatest).getTime()
    : 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide leading-none',
        status === 'on-time' && 'bg-accent/15 text-accent',
        status === 'tight'   && 'bg-orange-500/20 text-orange-300',
        status === 'overdue' && 'bg-red-500/20 text-red-400 animate-pulse',
      )}
    >
      {status === 'on-time' && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === 'tight'   && <Clock className="h-2.5 w-2.5" />}
      {status === 'overdue' && <Zap className="h-2.5 w-2.5" />}
      {label}
      {status === 'overdue' && lateMsAgo > 0 && (
        <span className="ml-0.5 opacity-80">+{fmtCountdown(lateMsAgo)}</span>
      )}
    </span>
  );
}

function StopRow({
  stop,
  arrivalMs,
  isNext,
  nowMs,
}: {
  stop: Stop;
  arrivalMs: number;
  isNext: boolean;
  nowMs: number;
}) {
  const status = getStatus(arrivalMs, stop.order.eta_latest);
  const remainingMs = Math.max(0, arrivalMs - nowMs);
  const dist = fmtDistance(stop.distanz_zum_vorgaenger_m);

  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-3 space-y-2 transition-colors',
        isNext
          ? 'border-accent/30 bg-accent/5'
          : status === 'overdue'
            ? 'border-red-500/20 bg-red-500/5'
            : status === 'tight'
              ? 'border-orange-500/20 bg-orange-500/5'
              : 'border-white/8 bg-white/3',
      )}
    >
      {/* Top row: stop number + address + badge */}
      <div className="flex items-start gap-2.5">
        {/* Stop number bubble */}
        <div
          className={cn(
            'mt-0.5 h-6 w-6 shrink-0 rounded-lg flex items-center justify-center text-[11px] font-black',
            isNext
              ? 'bg-accent text-matcha-900'
              : status === 'overdue'
                ? 'bg-red-500/30 text-red-300'
                : status === 'tight'
                  ? 'bg-orange-500/30 text-orange-300'
                  : 'bg-white/10 text-matcha-300',
          )}
        >
          {stop.reihenfolge}
        </div>

        {/* Address */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'text-[11px] font-semibold truncate max-w-[160px]',
                isNext ? 'text-matcha-100' : 'text-matcha-200',
              )}
            >
              {stop.order.kunde_adresse ?? `Stop ${stop.reihenfolge}`}
            </span>
            {stop.order.kunde_plz && (
              <span className="text-[10px] text-matcha-500 shrink-0">
                {stop.order.kunde_plz}
              </span>
            )}
          </div>
          <div className="mt-1">
            <StatusBadge
              status={status}
              etaLatest={stop.order.eta_latest}
              arrivalMs={arrivalMs}
            />
          </div>
        </div>
      </div>

      {/* Bottom row: predicted arrival + countdown + distance */}
      <div className="flex items-center gap-3 pl-[34px]">
        {/* Predicted clock */}
        <div className="flex items-center gap-1.5">
          <Clock className={cn(
            'h-3.5 w-3.5 shrink-0',
            isNext ? 'text-accent' : 'text-matcha-400',
          )} />
          <span
            className={cn(
              'text-sm font-black tabular-nums',
              isNext
                ? 'text-accent'
                : status === 'overdue'
                  ? 'text-red-400'
                  : status === 'tight'
                    ? 'text-orange-300'
                    : 'text-matcha-100',
            )}
          >
            {fmtClock(arrivalMs)}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-1 text-matcha-400">
          <span className="text-[10px]">in</span>
          <span
            className={cn(
              'text-xs font-bold tabular-nums',
              status === 'overdue' ? 'text-red-400' :
              status === 'tight'   ? 'text-orange-300' :
                                     'text-matcha-300',
            )}
          >
            {fmtCountdown(remainingMs)}
          </span>
        </div>

        {/* Distance */}
        {dist && (
          <div className="ml-auto flex items-center gap-1 text-matcha-500">
            <MapPin className="h-3 w-3" />
            <span className="text-[10px] font-medium tabular-nums">{dist}</span>
          </div>
        )}
      </div>

      {/* ETA window hint */}
      {stop.order.eta_earliest && stop.order.eta_latest && (
        <div className="pl-[34px] flex items-center gap-1 text-[10px] text-matcha-600">
          <Navigation className="h-2.5 w-2.5" />
          <span>
            Fenster: {fmtClock(new Date(stop.order.eta_earliest).getTime())} –{' '}
            {fmtClock(new Date(stop.order.eta_latest).getTime())}
          </span>
        </div>
      )}
    </div>
  );
}

function CompletedRow({ stop }: { stop: Stop }) {
  const deliveredAt = stop.geliefert_am
    ? fmtClock(new Date(stop.geliefert_am).getTime())
    : null;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-white/5 bg-white/2 opacity-60">
      <div className="h-5 w-5 shrink-0 rounded-md flex items-center justify-center bg-accent/20">
        <CheckCircle2 className="h-3 w-3 text-accent" />
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-[10px] font-bold text-matcha-500 tabular-nums w-4 shrink-0">
          {stop.reihenfolge}
        </span>
        <span className="text-[11px] text-matcha-500 truncate">
          {stop.order.kunde_adresse ?? `Stop ${stop.reihenfolge}`}
        </span>
      </div>
      {deliveredAt && (
        <span className="text-[10px] text-matcha-600 tabular-nums shrink-0">
          ✓ {deliveredAt}
        </span>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TourStopEtaPredictor({ stops, currentSpeed, started_at }: Props) {
  const nowMs = useTick(1_000);

  const { completed, pending } = useMemo(() => {
    const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
    return {
      completed: sorted.filter((s) => s.geliefert_am !== null),
      pending:   sorted.filter((s) => s.geliefert_am === null),
    };
  }, [stops]);

  // Effective speed in m/ms
  const speedMpMs = useMemo(() => {
    const kmh = currentSpeed != null && currentSpeed > 0 ? currentSpeed : DEFAULT_SPEED_KMH;
    return kmh / 3_600_000; // km/h → m/ms
  }, [currentSpeed]);

  /**
   * Cumulative predicted arrival times for each pending stop.
   * We walk forward from `nowMs`, adding travel time + dwell per stop.
   */
  const pendingWithEta = useMemo(() => {
    let cursor = nowMs;
    return pending.map((stop) => {
      const distM = stop.distanz_zum_vorgaenger_m ?? 0;
      const travelMs = speedMpMs > 0 ? distM / speedMpMs : 0;
      cursor += travelMs + STOP_SERVICE_TIME_MS;
      return { stop, arrivalMs: cursor };
    });
  }, [pending, nowMs, speedMpMs]);

  // Cumulative ETA (arrival at final stop)
  const finalArrivalMs = pendingWithEta.at(-1)?.arrivalMs ?? null;

  // Overall status for the summary bar
  const overallStatus: StopStatus = useMemo(() => {
    if (pendingWithEta.length === 0) return 'on-time';
    const statuses = pendingWithEta.map(({ stop, arrivalMs }) =>
      getStatus(arrivalMs, stop.order.eta_latest),
    );
    if (statuses.includes('overdue')) return 'overdue';
    if (statuses.includes('tight'))   return 'tight';
    return 'on-time';
  }, [pendingWithEta]);

  // How many stops are overdue / tight
  const overdueCount = pendingWithEta.filter(({ stop, arrivalMs }) =>
    getStatus(arrivalMs, stop.order.eta_latest) === 'overdue',
  ).length;

  // Return null if nothing pending
  if (pending.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-matcha-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent shrink-0" />
          <span className="text-xs font-black text-matcha-100 uppercase tracking-wider">
            Ankunftsvorhersage
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Speed indicator */}
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
            <Navigation className="h-2.5 w-2.5 text-matcha-400" />
            <span className="text-[10px] font-bold text-matcha-300 tabular-nums">
              {currentSpeed != null && currentSpeed > 0
                ? `${Math.round(currentSpeed)} km/h`
                : `~${DEFAULT_SPEED_KMH} km/h`}
            </span>
          </div>

          {/* Overall health indicator */}
          <div
            className={cn(
              'h-2 w-2 rounded-full shrink-0',
              overallStatus === 'on-time' && 'bg-accent',
              overallStatus === 'tight'   && 'bg-orange-400',
              overallStatus === 'overdue' && 'bg-red-500 animate-pulse',
            )}
          />
        </div>
      </div>

      <div className="p-3 space-y-2">
        {/* ── Completed stops (collapsed, trophy row) ── */}
        {completed.length > 0 && (
          <div className="space-y-1">
            {completed.map((stop) => (
              <CompletedRow key={stop.id} stop={stop} />
            ))}
            <div className="my-1 border-t border-white/8" />
          </div>
        )}

        {/* ── Pending stops ── */}
        <div className="space-y-2">
          {pendingWithEta.map(({ stop, arrivalMs }, idx) => (
            <StopRow
              key={stop.id}
              stop={stop}
              arrivalMs={arrivalMs}
              isNext={idx === 0}
              nowMs={nowMs}
            />
          ))}
        </div>

        {/* ── Cumulative ETA summary ── */}
        {finalArrivalMs !== null && (
          <div
            className={cn(
              'mt-1 rounded-2xl border px-4 py-3 flex items-center justify-between gap-3',
              overallStatus === 'on-time' && 'border-accent/20 bg-accent/5',
              overallStatus === 'tight'   && 'border-orange-500/20 bg-orange-500/5',
              overallStatus === 'overdue' && 'border-red-500/20 bg-red-500/5',
            )}
          >
            <div>
              <div className="text-[10px] font-bold text-matcha-400 uppercase tracking-wide">
                Tour-Abschluss (geschätzt)
              </div>
              <div className="mt-0.5 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    'text-xl font-black tabular-nums',
                    overallStatus === 'on-time' && 'text-accent',
                    overallStatus === 'tight'   && 'text-orange-300',
                    overallStatus === 'overdue' && 'text-red-400',
                  )}
                >
                  {fmtClock(finalArrivalMs)}
                </span>
                <span className="text-xs text-matcha-400">
                  in {fmtCountdown(finalArrivalMs - nowMs)}
                </span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-[10px] text-matcha-500">
                {pending.length} ausstehend
              </div>
              {overdueCount > 0 && (
                <div className="text-[10px] font-bold text-red-400 animate-pulse">
                  {overdueCount} überfällig
                </div>
              )}
              {overdueCount === 0 && overallStatus === 'tight' && (
                <div className="text-[10px] font-bold text-orange-300">
                  Zeit knapp
                </div>
              )}
              {overallStatus === 'on-time' && (
                <div className="text-[10px] font-bold text-accent">
                  Im Zeitplan
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
