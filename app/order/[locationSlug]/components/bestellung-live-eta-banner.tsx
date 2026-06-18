'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Package, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Props = {
  orderId: string;
  bestellnummer: string;
  etaEarliest: string | null;
  etaLatest: string | null;
  status: string;
};

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------

type StatusKey = 'bestätigt' | 'in_zubereitung' | 'unterwegs' | 'geliefert';

const STATUS_ORDER: Record<string, number> = {
  neu: 0,
  bestätigt: 0,
  in_zubereitung: 1,
  fertig: 1, // treat "fertig" as still in preparation from customer POV
  unterwegs: 2,
  geliefert: 3,
};

type StageConfig = {
  key: StatusKey;
  label: string;
  shortLabel: string;
  Icon: React.ElementType;
  /** Tailwind colour tokens used at each stage */
  bg: string;
  ring: string;
  text: string;
  activeBg: string;
  activeText: string;
  progressFrom: string;
  progressTo: string;
  /** Banner background gradient for the active stage */
  bannerGradient: string;
  bannerBorder: string;
};

const STAGES: StageConfig[] = [
  {
    key: 'bestätigt',
    label: 'Bestellung angenommen',
    shortLabel: 'Angenommen',
    Icon: Package,
    bg: 'bg-blue-500',
    ring: 'ring-blue-300',
    text: 'text-white',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-800',
    progressFrom: 'from-blue-400',
    progressTo: 'to-blue-600',
    bannerGradient: 'from-blue-50 to-sky-50',
    bannerBorder: 'border-blue-200',
  },
  {
    key: 'in_zubereitung',
    label: 'In Zubereitung',
    shortLabel: 'Zubereitung',
    Icon: Zap,
    bg: 'bg-orange-500',
    ring: 'ring-orange-300',
    text: 'text-white',
    activeBg: 'bg-orange-50',
    activeText: 'text-orange-800',
    progressFrom: 'from-orange-400',
    progressTo: 'to-amber-500',
    bannerGradient: 'from-orange-50 to-amber-50',
    bannerBorder: 'border-orange-200',
  },
  {
    key: 'unterwegs',
    label: 'Unterwegs zu dir',
    shortLabel: 'Unterwegs',
    Icon: Truck,
    bg: 'bg-emerald-500',
    ring: 'ring-emerald-300',
    text: 'text-white',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-800',
    progressFrom: 'from-emerald-400',
    progressTo: 'to-green-500',
    bannerGradient: 'from-emerald-50 to-green-50',
    bannerBorder: 'border-emerald-200',
  },
  {
    key: 'geliefert',
    label: 'Geliefert!',
    shortLabel: 'Geliefert',
    Icon: CheckCircle2,
    bg: 'bg-green-500',
    ring: 'ring-green-300',
    text: 'text-white',
    activeBg: 'bg-green-50',
    activeText: 'text-green-800',
    progressFrom: 'from-green-400',
    progressTo: 'to-emerald-600',
    bannerGradient: 'from-green-50 to-emerald-50',
    bannerBorder: 'border-green-200',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns remaining seconds until an ISO timestamp. Negative when past. */
function secsUntil(iso: string): number {
  return Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
}

/** Human-readable German countdown string, e.g. "Noch 18 Minuten" */
function fmtCountdown(iso: string): { headline: string; detail: string } {
  const secs = secsUntil(iso);
  if (secs <= 0) return { headline: 'Gleich da!', detail: '' };
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m >= 1) {
    return {
      headline: `Noch ${m} Minute${m !== 1 ? 'n' : ''}`,
      detail: `${String(s).padStart(2, '0')} Sek`,
    };
  }
  return { headline: `Noch ${s} Sekunde${s !== 1 ? 'n' : ''}`, detail: '' };
}

/** Formats an ISO timestamp to "HH:MM Uhr" */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

/**
 * Returns a 0–100 number representing how far through the delivery window we
 * are.  Falls back gracefully when timestamps are missing.
 */
function calcProgress(etaEarliest: string | null, etaLatest: string | null): number {
  if (!etaEarliest || !etaLatest) return 0;
  const earliest = new Date(etaEarliest).getTime();
  const latest = new Date(etaLatest).getTime();
  const now = Date.now();
  if (now >= latest) return 100;
  if (now <= earliest) return 0;
  return Math.round(((now - earliest) / (latest - earliest)) * 100);
}

// ---------------------------------------------------------------------------
// Sparkle animation component
// ---------------------------------------------------------------------------

type SparkleProps = { count?: number };

function Sparkles({ count = 8 }: SparkleProps) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        const delay = (i * 0.12).toFixed(2);
        const size = 4 + (i % 3) * 3;
        return (
          <span
            key={i}
            className="absolute inline-block rounded-full bg-yellow-300 opacity-0 animate-sparkle"
            style={{
              width: size,
              height: size,
              top: `${50 + 38 * Math.sin((angle * Math.PI) / 180)}%`,
              left: `${50 + 38 * Math.cos((angle * Math.PI) / 180)}%`,
              animationDelay: `${delay}s`,
              animationDuration: '1.4s',
              animationIterationCount: 3,
            }}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animated truck track
// ---------------------------------------------------------------------------

type TruckTrackProps = { stageIdx: number; totalStages: number };

function TruckTrack({ stageIdx, totalStages }: TruckTrackProps) {
  // Position the truck from 0% (left) to ~90% (right) based on current stage
  const pct = Math.min(90, Math.round((stageIdx / (totalStages - 1)) * 90));
  return (
    <div aria-hidden className="relative h-6 w-full overflow-hidden">
      {/* Track dots */}
      <div className="absolute inset-y-0 flex items-center w-full">
        <div className="w-full h-px border-t-2 border-dashed border-current opacity-20" />
      </div>
      {/* Truck icon that slides */}
      <div
        className="absolute inset-y-0 flex items-center transition-all duration-1000 ease-in-out"
        style={{ left: `${pct}%` }}
      >
        <Truck
          size={20}
          className={cn(
            'drop-shadow-sm',
            stageIdx === 2 ? 'text-emerald-600' : stageIdx === 3 ? 'text-green-600' : 'text-blue-400',
          )}
          aria-hidden
        />
      </div>
      {/* Destination pin */}
      <div className="absolute right-0 inset-y-0 flex items-center">
        <MapPin size={14} className="text-rose-400 drop-shadow-sm" aria-hidden />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useTick hook – fires every `ms` milliseconds to force re-render
// ---------------------------------------------------------------------------

function useTick(ms: number): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BestellungLiveEtaBanner({
  orderId,
  bestellnummer,
  etaEarliest: initialEtaEarliest,
  etaLatest: initialEtaLatest,
  status: initialStatus,
}: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [etaEarliest, setEtaEarliest] = useState(initialEtaEarliest);
  const [etaLatest, setEtaLatest] = useState(initialEtaLatest);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Live countdown – tick every second for the countdown display
  useTick(1_000);

  // --------------------------------------------------------------------------
  // Supabase realtime subscription
  // --------------------------------------------------------------------------

  useEffect(() => {
    const ch = supabase
      .channel(`live-eta-banner-${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'customer_orders',
          filter: `id=eq.${orderId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new;
          if (typeof row.status === 'string') setStatus(row.status);
          if (typeof row.eta_earliest === 'string') setEtaEarliest(row.eta_earliest);
          if (typeof row.eta_latest === 'string') setEtaLatest(row.eta_latest);
        },
      )
      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // --------------------------------------------------------------------------
  // Derived state
  // --------------------------------------------------------------------------

  const stageIdx = STATUS_ORDER[status] ?? 0;
  const stage = STAGES[Math.min(stageIdx, STAGES.length - 1)];
  const isDelivered = status === 'geliefert';
  const progress = isDelivered ? 100 : calcProgress(etaEarliest, etaLatest);

  // Countdown data – use etaLatest as the "upper bound" for display
  const countdownTarget = etaLatest ?? etaEarliest;
  const countdown = countdownTarget ? fmtCountdown(countdownTarget) : null;

  // Show the ETA window in local time
  const etaWindow =
    etaEarliest && etaLatest
      ? `${fmtTime(etaEarliest)} – ${fmtTime(etaLatest)}`
      : etaEarliest
      ? fmtTime(etaEarliest)
      : null;

  // --------------------------------------------------------------------------
  // Compact delivered state
  // --------------------------------------------------------------------------

  if (isDelivered) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Bestellungsstatus: Geliefert"
        className={cn(
          'relative w-full rounded-2xl border overflow-hidden',
          'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200',
          'px-4 py-4 shadow-sm',
        )}
      >
        <Sparkles count={10} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-500 shadow-md shadow-green-200">
            <CheckCircle2 size={20} className="text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-green-600">
              Bestellung #{bestellnummer}
            </p>
            <p className="text-base font-extrabold text-green-900 leading-tight">
              Erfolgreich geliefert!
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Guten Appetit! Wir freuen uns auf deinen nächsten Besuch.
            </p>
          </div>
        </div>

        {/* Progress bar – full */}
        <div className="relative z-10 mt-3 h-1.5 w-full overflow-hidden rounded-full bg-green-100">
          <div className="h-full w-full rounded-full bg-gradient-to-r from-green-400 to-emerald-600 transition-all duration-700" />
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // Active / live state
  // --------------------------------------------------------------------------

  return (
    <div
      role="region"
      aria-label={`Live-Status für Bestellung #${bestellnummer}: ${stage.label}`}
      className={cn(
        'relative w-full rounded-2xl border overflow-hidden shadow-sm',
        `bg-gradient-to-br ${stage.bannerGradient}`,
        stage.bannerBorder,
      )}
    >
      {/* Subtle animated shimmer overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer bg-[length:200%_100%] opacity-60"
      />

      <div className="relative z-10 px-4 pt-4 pb-3 space-y-3">

        {/* ── Top row: order number + live badge ── */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
            Bestellung #{bestellnummer}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/80 border border-gray-200 px-2 py-0.5 text-[10px] font-bold text-gray-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" aria-hidden />
            LIVE
          </span>
        </div>

        {/* ── Current status headline ── */}
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow',
              stage.bg,
              'ring-2',
              stage.ring,
            )}
          >
            <stage.Icon size={17} className="text-white" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <p
              className={cn('text-base font-extrabold leading-snug', stage.activeText)}
            >
              {stage.label}
            </p>
            {etaWindow && !isDelivered && (
              <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                <Clock size={10} aria-hidden />
                {etaWindow}
              </p>
            )}
          </div>
        </div>

        {/* ── Animated truck track ── */}
        <div className={cn('px-1', stage.activeText)}>
          <TruckTrack stageIdx={stageIdx} totalStages={STAGES.length} />
        </div>

        {/* ── Stage pills ── */}
        <div className="flex items-center justify-between gap-1" aria-hidden>
          {STAGES.map((s, i) => {
            const done = i < stageIdx;
            const active = i === stageIdx;
            return (
              <div
                key={s.key}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5',
                  i < stageIdx ? 'opacity-100' : i === stageIdx ? 'opacity-100' : 'opacity-30',
                )}
              >
                <div
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full transition-all duration-500',
                    done
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : active
                      ? cn(s.bg, 'text-white shadow ring-2', s.ring, 'ring-offset-1')
                      : 'bg-white/60 border border-gray-200 text-gray-400',
                  )}
                >
                  {done ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <s.Icon size={12} />
                  )}
                </div>
                <span
                  className={cn(
                    'text-center text-[8px] font-semibold leading-tight max-w-[52px]',
                    done ? 'text-emerald-700' : active ? stage.activeText : 'text-gray-400',
                  )}
                >
                  {s.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Progress bar ── */}
        <div className="space-y-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/60 border border-white/80">
            <div
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Lieferfortschritt"
              className={cn(
                'h-full rounded-full bg-gradient-to-r transition-all duration-1000 ease-in-out',
                stage.progressFrom,
                stage.progressTo,
              )}
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          {etaWindow && (
            <div className="flex justify-between text-[9px] text-gray-400 px-0.5">
              <span>Bestellung aufgegeben</span>
              <span>{etaWindow}</span>
            </div>
          )}
        </div>

        {/* ── Countdown ── */}
        {countdown && countdownTarget && secsUntil(countdownTarget) > 0 && (
          <div
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Lieferzeitschätzung: ${countdown.headline}`}
            className={cn(
              'flex items-baseline gap-2 rounded-xl px-3 py-2.5 border',
              stage.activeBg,
              'border-white/60',
            )}
          >
            <Clock size={14} className={cn('shrink-0 mt-0.5', stage.activeText)} aria-hidden />
            <div className="flex-1 min-w-0">
              <span className={cn('text-lg font-extrabold tabular-nums leading-none', stage.activeText)}>
                {countdown.headline}
              </span>
              {countdown.detail && (
                <span className="ml-1.5 text-xs tabular-nums text-gray-500">
                  {countdown.detail}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── "Just arrived" message when ETA has passed but not yet confirmed delivered ── */}
        {countdownTarget && secsUntil(countdownTarget) <= 0 && !isDelivered && (
          <div
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2"
          >
            <Truck size={14} className="text-amber-600 shrink-0 animate-bounce" aria-hidden />
            <span className="text-sm font-bold text-amber-800">Sollte gleich ankommen…</span>
          </div>
        )}

      </div>
    </div>
  );
}
