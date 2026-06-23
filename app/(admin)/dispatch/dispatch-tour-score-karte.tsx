'use client';

/**
 * DispatchTourScoreKarte
 *
 * Horizontally-scrollable compact tour cards, one per active batch.
 * Each card shows:
 *  • Driver name + vehicle chip
 *  • Stop-progress dots (delivered=green, current=pulsing blue, pending=gray)
 *  • ETA countdown to tour end
 *  • Composite tour score 0–100 as a mini arc gauge
 *  • Urgency flag when any stop is overdue vs. eta_latest
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, CheckCircle2, Clock, MapPin, Trophy } from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_latest: string | null;
    dispatch_score?: number | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

type Driver = {
  employee_id: string;
  fahrzeug: string;
  ist_online: boolean;
  employee: { id: string; vorname: string; nachname: string } | null;
};

interface Props {
  batches: Batch[];
  drivers?: Driver[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtMin(secs: number): string {
  if (secs <= 0) return 'fertig';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function tourScore(stops: BatchStop[], elapsedSec: number): number {
  if (!stops.length) return 0;
  const deliveredStops = stops.filter((s) => s.geliefert_am);
  const pünktlichkeit = deliveredStops.reduce((acc, stop) => {
    if (!stop.geliefert_am || !stop.order?.eta_latest) return acc + 80;
    const late = (new Date(stop.geliefert_am).getTime() - new Date(stop.order.eta_latest).getTime()) / 60_000;
    return acc + (late <= 0 ? 100 : late <= 5 ? 80 : late <= 10 ? 50 : 20);
  }, 0) / (deliveredStops.length || 1);

  const dispatchScores = stops
    .map((s) => s.order?.dispatch_score)
    .filter((v): v is number => v != null);
  const avgDispatch = dispatchScores.length
    ? dispatchScores.reduce((a, b) => a + b, 0) / dispatchScores.length
    : 70;

  return Math.round(pünktlichkeit * 0.6 + avgDispatch * 0.4);
}

/* ── Score Arc SVG ─────────────────────────────────────────────────────────── */

function ScoreArc({ score }: { score: number }) {
  const r = 18;
  const circ = Math.PI * r;
  const pct = Math.min(1, score / 100);
  const offset = circ * (1 - pct);
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={44} height={26} viewBox="0 0 44 26">
      <path d="M 4 24 A 18 18 0 0 1 40 24" fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={4} />
      <path
        d="M 4 24 A 18 18 0 0 1 40 24"
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s, stroke 0.4s' }}
      />
      <text x="22" y="23" textAnchor="middle" fontSize={9} fontWeight="900" fill={color}>
        {score}
      </text>
    </svg>
  );
}

/* ── Tour Card ───────────────────────────────────────────────────────────────── */

function TourCard({ batch, driver }: { batch: Batch; driver: Driver | undefined }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const sortedStops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const deliveredCount = sortedStops.filter((s) => s.geliefert_am).length;
  const totalStops = sortedStops.length;
  const currentStopIdx = deliveredCount < totalStops ? deliveredCount : totalStops - 1;

  // ETA countdown
  let etaSecsLeft: number | null = null;
  if (batch.startzeit && batch.total_eta_min != null) {
    etaSecsLeft = Math.floor(
      (new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000 - now) / 1000,
    );
  }

  // Elapsed for score
  const elapsedSec = batch.startzeit
    ? Math.floor((now - new Date(batch.startzeit).getTime()) / 1000)
    : 0;

  // Any overdue stop?
  const hasOverdue = sortedStops.some(
    (s) =>
      !s.geliefert_am &&
      s.order?.eta_latest &&
      new Date(s.order.eta_latest).getTime() < now,
  );

  const score = tourScore(sortedStops, elapsedSec);

  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
    : driver?.employee
    ? `${driver.employee.vorname} ${driver.employee.nachname.charAt(0)}.`
    : 'Fahrer';

  const vehicleLabel = driver?.fahrzeug ?? 'fahrrad';
  const zone = batch.zone ?? '–';

  const statusColor =
    batch.status === 'unterwegs' || batch.status === 'on_route'
      ? 'border-matcha-400'
      : batch.status === 'bereit'
      ? 'border-amber-400'
      : 'border-gray-200';

  return (
    <div
      className={cn(
        'shrink-0 w-56 rounded-xl border-2 bg-card overflow-hidden shadow-sm',
        statusColor,
        hasOverdue && 'border-red-500',
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 text-[11px] font-black shrink-0">
          {driverName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black truncate">{driverName}</div>
          <div className="text-[9px] text-muted-foreground truncate capitalize">
            {vehicleLabel} · Zone {zone}
          </div>
        </div>
        {hasOverdue && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 animate-pulse" />
        )}
      </div>

      {/* Stop dots */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1 flex-wrap">
          {sortedStops.map((stop, idx) => {
            const delivered = !!stop.geliefert_am;
            const isCurrent = idx === currentStopIdx && !delivered;
            const overdue =
              !delivered &&
              stop.order?.eta_latest &&
              new Date(stop.order.eta_latest).getTime() < now;

            return (
              <div key={stop.id} className="flex items-center gap-0.5">
                <div
                  className={cn(
                    'h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-black border',
                    delivered
                      ? 'bg-matcha-500 border-matcha-600 text-white'
                      : isCurrent
                      ? 'bg-blue-500 border-blue-600 text-white animate-pulse'
                      : overdue
                      ? 'bg-red-100 border-red-400 text-red-700'
                      : 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  )}
                  title={stop.order?.kunde_name ?? `Stop ${idx + 1}`}
                >
                  {delivered ? '✓' : idx + 1}
                </div>
                {idx < sortedStops.length - 1 && (
                  <div
                    className={cn(
                      'h-0.5 w-3',
                      delivered ? 'bg-matcha-400' : 'bg-muted-foreground/20',
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[9px] text-muted-foreground mt-1">
          {deliveredCount}/{totalStops} Stops abgeschlossen
        </div>
      </div>

      {/* Footer: score + ETA */}
      <div className="flex items-center justify-between px-3 pb-2.5 gap-2">
        <div className="flex flex-col items-center">
          <ScoreArc score={score} />
          <span className="text-[8px] text-muted-foreground mt-0.5">Tour-Score</span>
        </div>
        <div className="flex-1 text-right">
          {etaSecsLeft !== null ? (
            <>
              <div
                className={cn(
                  'text-sm font-black tabular-nums',
                  etaSecsLeft < 0 ? 'text-red-600' : etaSecsLeft < 300 ? 'text-amber-600' : 'text-matcha-700',
                )}
              >
                {etaSecsLeft < 0 ? '+' : ''}{fmtMin(Math.abs(etaSecsLeft))}
              </div>
              <div className="text-[9px] text-muted-foreground">
                {etaSecsLeft < 0 ? 'überfällig' : 'bis Rückkehr'}
              </div>
            </>
          ) : (
            <div className="text-[10px] text-muted-foreground">ETA unbekannt</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Main Export ─────────────────────────────────────────────────────────────── */

export function DispatchTourScoreKarte({ batches, drivers = [] }: Props) {
  const active = batches.filter(
    (b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'bereit',
  );

  if (active.length === 0) return null;

  const avgScore = Math.round(
    active.reduce((sum, b) => {
      const elapsedSec = b.startzeit
        ? Math.floor((Date.now() - new Date(b.startzeit).getTime()) / 1000)
        : 0;
      return sum + tourScore(b.stops, elapsedSec);
    }, 0) / active.length,
  );

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <Trophy className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-black">Tour-Score-Karte</div>
          <div className="text-[10px] text-muted-foreground">
            {active.length} aktive Tour{active.length !== 1 ? 'en' : ''} · Ø Score{' '}
            <span
              className={cn(
                'font-bold',
                avgScore >= 80 ? 'text-matcha-600' : avgScore >= 60 ? 'text-amber-600' : 'text-red-600',
              )}
            >
              {avgScore}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> geliefert</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500 inline-block animate-pulse" /> aktuell</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted border border-muted-foreground/30 inline-block" /> offen</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="flex gap-3 p-3" style={{ minWidth: 'max-content' }}>
          {active.map((batch) => {
            const driver = drivers.find(
              (d) => d.employee_id === batch.fahrer_id || d.employee?.id === batch.fahrer_id,
            );
            return <TourCard key={batch.id} batch={batch} driver={driver} />;
          })}
        </div>
      </div>
    </div>
  );
}
