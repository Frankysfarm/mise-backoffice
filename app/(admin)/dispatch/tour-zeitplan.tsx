'use client';

/**
 * TourZeitplanGrid — Zeitplan-Übersicht aller aktiven Touren im Dispatch.
 *
 * Zeigt alle laufenden Touren als horizontale Timeline:
 * - Startzeit links, geplante Rückkehr rechts
 * - Stopps als Punkte auf der Linie (grün = geliefert, grau = ausstehend)
 * - Farbkodierung: grün (pünktlich), gelb (knapp), rot (überfällig)
 * - ETA bis Rückkehr als Countdown
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, CheckCircle2, AlertTriangle, Truck, Route } from 'lucide-react';

type BatchStop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

type TourStatus = 'ok' | 'knapp' | 'overdue';

function getTourStatus(batch: Batch): TourStatus {
  const now = Date.now();
  if (!batch.startzeit || !batch.total_eta_min) return 'ok';
  const etaMs = new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000;
  const secLeft = (etaMs - now) / 1000;
  if (secLeft < 0) return 'overdue';
  if (secLeft < 10 * 60) return 'knapp';
  return 'ok';
}

const STATUS_COLORS: Record<TourStatus, { border: string; bg: string; text: string; dot: string }> = {
  ok:      { border: 'border-matcha-500/40', bg: 'bg-matcha-900/30', text: 'text-matcha-300', dot: 'bg-matcha-400' },
  knapp:   { border: 'border-amber-400/40',  bg: 'bg-amber-900/20',  text: 'text-amber-300',  dot: 'bg-amber-400' },
  overdue: { border: 'border-red-500/50',    bg: 'bg-red-900/20',    text: 'text-red-300',    dot: 'bg-red-500' },
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function SecsCountdown({ startIso, etaMin }: { startIso: string; etaMin: number }) {
  useTick();
  const now = Date.now();
  const etaMs = new Date(startIso).getTime() + etaMin * 60_000;
  const secLeft = Math.floor((etaMs - now) / 1000);
  const isOverdue = secLeft < 0;
  const abs = Math.abs(secLeft);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${m}:${String(s).padStart(2, '0')}`;
  return (
    <span className={cn(
      'font-mono font-black tabular-nums text-sm',
      isOverdue ? 'text-red-400 animate-pulse' : secLeft < 600 ? 'text-amber-300' : 'text-matcha-300',
    )}>
      {isOverdue ? `+${str}` : str}
    </span>
  );
}

function TourRow({ batch }: { batch: Batch }) {
  const sorted = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const done = sorted.filter(s => !!s.geliefert_am).length;
  const total = sorted.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const status = getTourStatus(batch);
  const colors = STATUS_COLORS[status];
  const driverName = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname?.[0] ?? ''}.`
    : '—';
  const returnTime = batch.startzeit && batch.total_eta_min
    ? new Date(new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000)
        .toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className={cn(
      'rounded-xl border px-3 py-2.5 space-y-2',
      colors.border, colors.bg,
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={cn('h-6 w-6 rounded-full flex items-center justify-center shrink-0', colors.dot)}>
          <Truck className="h-3 w-3 text-white" />
        </div>
        <span className={cn('text-xs font-bold truncate', colors.text)}>{driverName}</span>
        {batch.zone && (
          <span className="text-[10px] text-matcha-500 bg-matcha-800/50 rounded-full px-2 py-0.5 font-bold">
            Zone {batch.zone}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {status === 'overdue' && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-400 animate-pulse shrink-0" />
          )}
          {batch.startzeit && batch.total_eta_min && (
            <SecsCountdown startIso={batch.startzeit} etaMin={batch.total_eta_min} />
          )}
        </div>
      </div>

      {/* Stop-Timeline */}
      <div className="flex items-center gap-0.5 relative">
        <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-white/10 rounded-full -translate-y-1/2" />
        <div
          className={cn('absolute left-0 top-1/2 h-0.5 rounded-full -translate-y-1/2 transition-all duration-700', colors.dot)}
          style={{ width: `${pct}%` }}
        />
        {sorted.map((stop, i) => {
          const isDone = !!stop.geliefert_am;
          const isCurrent = !isDone && sorted.slice(0, i).every(s => !!s.geliefert_am);
          return (
            <div
              key={stop.id}
              className="relative z-10 flex-1 flex justify-center"
              title={stop.order?.kunde_name ?? `Stop ${i + 1}`}
            >
              <div className={cn(
                'h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all',
                isDone
                  ? cn('bg-matcha-500 border-matcha-400')
                  : isCurrent
                  ? cn(colors.dot, 'border-white/50 shadow-[0_0_8px_rgba(74,230,138,0.5)]')
                  : 'bg-matcha-800 border-white/20',
              )}>
                {isDone && <CheckCircle2 className="h-2 w-2 text-white" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 text-[10px] text-matcha-500">
        <span>{done}/{total} Stopps</span>
        {batch.startzeit && (
          <span className="flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            Start {fmtTime(batch.startzeit)}
          </span>
        )}
        {returnTime && (
          <span className="ml-auto font-bold text-matcha-400">
            Rückkehr ~{returnTime}
          </span>
        )}
        {batch.total_distance_km != null && (
          <span className="flex items-center gap-0.5">
            <Route className="h-2.5 w-2.5" />
            {batch.total_distance_km.toFixed(1)} km
          </span>
        )}
      </div>
    </div>
  );
}

export function TourZeitplanGrid({ batches }: { batches: Batch[] }) {
  const active = batches.filter(b =>
    b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'active'
  );

  if (active.length === 0) return null;

  const overdueBatches = active.filter(b => getTourStatus(b) === 'overdue');

  return (
    <div className="rounded-xl border border-white/10 bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-400 shrink-0" />
          <span className="text-sm font-bold text-matcha-200">
            Touren-Zeitplan
          </span>
          <span className="rounded-full bg-matcha-800 px-2 py-0.5 text-[10px] font-black text-matcha-300">
            {active.length} aktiv
          </span>
        </div>
        {overdueBatches.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-900/40 border border-red-500/40 px-2 py-0.5 text-[10px] font-black text-red-300 animate-pulse">
            <AlertTriangle className="h-2.5 w-2.5" />
            {overdueBatches.length} überfällig
          </span>
        )}
      </div>

      {/* Tour rows */}
      <div className="space-y-2">
        {active.map(b => (
          <TourRow key={b.id} batch={b} />
        ))}
      </div>
    </div>
  );
}
