'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { ElementType } from 'react';
import {
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Navigation,
  AlertTriangle,
  TrendingUp,
  Euro,
  Route,
} from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function elapsedMin(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

/** Derive a 0-100 driver performance score from batch data. */
function calcScore(batch: Batch, completedCount: number, totalStops: number, elapsed: number): number {
  if (totalStops === 0) return 0;

  const etaTotal = batch.total_eta_min ?? 0;

  // On-time factor: penalise if running late, reward if ahead
  const timeFactor = etaTotal > 0
    ? Math.max(0, Math.min(1, 1 - (elapsed - etaTotal) / etaTotal))
    : 0.75;

  // Completion factor
  const completionFactor = completedCount / totalStops;

  // Weighted score
  const raw = timeFactor * 55 + completionFactor * 45;
  return Math.min(100, Math.round(raw));
}

/** Return Tailwind colour tokens for a 0-100 score. */
function scoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: 'stroke-matcha-500', text: 'text-matcha-700', bg: 'bg-matcha-50' };
  if (score >= 55) return { ring: 'stroke-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50'  };
  return                { ring: 'stroke-red-400',    text: 'text-red-700',    bg: 'bg-red-50'    };
}

/** Derive a rough profit estimate: fixed revenue minus distance cost. */
function calcProfitEur(batch: Batch, totalStops: number): number | null {
  if (totalStops === 0) return null;
  const revenuePerStop = 6.5;   // avg delivery fee
  const costPerKm      = 0.30;  // fuel + wear
  const distKm = batch.total_distance_km ?? 0;
  return Math.round((totalStops * revenuePerStop - distKm * costPerKm) * 10) / 10;
}

/** ETA-window status for a stop → pill style. */
function etaWindowStatus(
  stop: BatchStop,
): 'on-time' | 'tight' | 'late' | 'none' {
  const etaIso = stop.order?.eta_latest ?? stop.order?.eta_earliest ?? null;
  if (!etaIso) return 'none';
  const secsLeft = Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000);
  if (secsLeft < -120)  return 'late';
  if (secsLeft < 600)   return 'tight';
  return 'on-time';
}

// ─── sub-components ───────────────────────────────────────────────────────────

/** Small SVG ring showing a score 0-100. */
function ScoreRing({ score }: { score: number }) {
  const { ring, text, bg } = scoreColor(score);
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <div className={cn('relative flex items-center justify-center rounded-full shrink-0', bg)}
         style={{ width: 36, height: 36 }}>
      <svg width={36} height={36} className="absolute inset-0 -rotate-90" aria-hidden>
        {/* track */}
        <circle cx={18} cy={18} r={r} fill="none" strokeWidth={3} className="stroke-border" />
        {/* arc */}
        <circle
          cx={18} cy={18} r={r}
          fill="none"
          strokeWidth={3}
          strokeLinecap="round"
          className={ring}
          strokeDasharray={`${dash} ${circ}`}
        />
      </svg>
      <span className={cn('relative z-10 text-[9px] font-black tabular-nums leading-none', text)}>
        {score}
      </span>
    </div>
  );
}

/** Coloured pill for a stop's ETA window. */
function EtaPill({ stop }: { stop: BatchStop }) {
  const status = etaWindowStatus(stop);
  if (status === 'none') return null;

  const etaIso = stop.order?.eta_latest ?? stop.order?.eta_earliest!;
  const minLeft = Math.floor((new Date(etaIso).getTime() - Date.now()) / 60_000);
  const label = minLeft < 0 ? `+${Math.abs(minLeft)}m` : `${minLeft}m`;

  const styles = {
    'on-time': 'bg-matcha-100 text-matcha-700 border-matcha-200',
    'tight':   'bg-amber-100 text-amber-700 border-amber-200',
    'late':    'bg-red-100 text-red-700 border-red-200',
  } as const;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none',
      styles[status],
    )}>
      <Clock size={8} />
      {label}
    </span>
  );
}

/** Section header with icon and optional badge. */
function SectionHeader({
  icon: Icon,
  label,
  badge,
}: {
  icon: ElementType;
  label: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <Icon size={10} className="text-muted-foreground/70 shrink-0" />
      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/70">
        {label}
      </span>
      {badge && <span className="ml-auto">{badge}</span>}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function DispatchTourVisualisierung({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter(b =>
    b.status === 'unterwegs' ||
    b.status === 'on_route'  ||
    b.status === 'aktiv'     ||
    b.status === 'assigned',
  );

  if (activeBatches.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* ── Panel header ── */}
      <div className="flex items-center gap-2">
        <Truck size={14} className="text-muted-foreground" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Visualisierung
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {activeBatches.length} aktiv
        </span>
      </div>

      {/* ── Tour cards ── */}
      <div className="space-y-2.5">
        {activeBatches.map(batch => {
          const batchStops     = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const completedCount = batchStops.filter(s => s.geliefert_am != null).length;
          const totalStops     = batchStops.length;
          const progressPct    = totalStops > 0 ? (completedCount / totalStops) * 100 : 0;

          const elapsed    = elapsedMin(batch.startzeit);
          const etaTotal   = batch.total_eta_min ?? null;
          const etaRemain  = etaTotal != null ? Math.max(0, etaTotal - elapsed) : null;
          const isLate     = etaTotal != null && elapsed > etaTotal * 1.15;

          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
            : 'Fahrer';

          const score      = calcScore(batch, completedCount, totalStops, elapsed);
          const profit     = calcProfitEur(batch, totalStops);
          const distKm     = batch.total_distance_km;

          return (
            <div key={batch.id} className="rounded-lg bg-muted/40 border border-border/60 px-3 py-2.5 space-y-2.5">

              {/* ══ Card header: driver + score ring + zone ══ */}
              <div className="flex items-center gap-2">
                {/* Score ring */}
                <ScoreRing score={score} />

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Truck size={12} className="text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-foreground truncate">{driverName}</span>
                    {batch.zone && (
                      <span className="rounded bg-background border border-border/50 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                        {batch.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {/* Score label */}
                    <span className={cn('text-[9px] font-semibold', scoreColor(score).text)}>
                      Score: {score}
                    </span>
                    {/* Stopps */}
                    <span className="text-[9px] text-muted-foreground">
                      · {completedCount}/{totalStops} Stopps
                    </span>
                    {/* Distance + time summary */}
                    {(distKm != null || etaTotal != null) && (
                      <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                        <Route size={8} />
                        {distKm != null ? `${distKm.toFixed(1)} km` : '—'}
                        {etaTotal != null && ` · ~${etaTotal} min`}
                      </span>
                    )}
                  </div>
                </div>

                {/* ETA remaining pill */}
                {etaRemain != null && (
                  <span className={cn(
                    'shrink-0 flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                    isLate
                      ? 'bg-red-100 text-red-700'
                      : etaRemain <= 5
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-matcha-100 text-matcha-700',
                  )}>
                    <Clock size={9} />
                    {etaRemain} Min
                  </span>
                )}
              </div>

              {/* ══ Stopp-Kette mit ETA-Pills ══ */}
              <div>
                <SectionHeader icon={MapPin} label="Stopp-Kette" />
                <div className="flex items-start gap-1 overflow-x-auto pb-1">
                  {batchStops.map((stop, idx) => {
                    const done    = stop.geliefert_am != null;
                    const current = !done && batchStops.slice(0, idx).every(s => s.geliefert_am != null);
                    const addr    = stop.order?.kunde_adresse ?? null;
                    const name    = stop.order?.kunde_name ?? `Stop ${idx + 1}`;
                    const title   = addr ? `${name}\n${addr}` : name;

                    return (
                      <div key={stop.id} className="flex items-center gap-1 shrink-0">
                        <div className="flex flex-col items-center gap-0.5">
                          {/* Node circle */}
                          <div
                            className={cn(
                              'h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-black border-2 shrink-0 cursor-default',
                              done
                                ? 'bg-matcha-500 border-matcha-600 text-white'
                                : current
                                ? 'bg-blue-500 border-blue-600 text-white animate-pulse'
                                : 'bg-muted border-border text-muted-foreground',
                            )}
                            title={title}
                          >
                            {done ? <CheckCircle2 size={12} /> : idx + 1}
                          </div>
                          {/* ETA pill below node */}
                          {!done && <EtaPill stop={stop} />}
                        </div>

                        {/* Connector line */}
                        {idx < batchStops.length - 1 && (
                          <div className={cn(
                            'h-0.5 w-4 rounded-full self-start mt-3.5',
                            done ? 'bg-matcha-400' : 'bg-border',
                          )} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ══ Aktueller Stop: Adresse + ETA ══ */}
              {(() => {
                const activeStop = batchStops.find(
                  (s, idx) => s.geliefert_am == null && batchStops.slice(0, idx).every(p => p.geliefert_am != null),
                );
                if (!activeStop?.order) return null;
                const o = activeStop.order;
                const stopEtaMin =
                  batch.total_eta_min && batchStops.length > 0
                    ? Math.round(
                        (batch.total_eta_min / batchStops.length) *
                        (batchStops.indexOf(activeStop) + 1 - completedCount),
                      )
                    : null;
                const etaIso      = o.eta_latest ?? o.eta_earliest;
                const stopSecsLeft = etaIso
                  ? Math.floor((new Date(etaIso).getTime() - Date.now()) / 1000)
                  : null;
                const isLateStop  = stopSecsLeft !== null && stopSecsLeft < -120;

                return (
                  <div>
                    <SectionHeader icon={Navigation} label="Aktueller Stopp" />
                    <div className={cn(
                      'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs',
                      isLateStop ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200',
                    )}>
                      <Navigation
                        size={11}
                        className={cn('shrink-0 mt-0.5', isLateStop ? 'text-red-500' : 'text-blue-500')}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate text-foreground">{o.kunde_name}</div>
                        {o.kunde_adresse && (
                          <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                            <MapPin size={8} className="inline mr-0.5" />
                            {o.kunde_adresse}
                          </div>
                        )}
                      </div>
                      {(stopSecsLeft !== null || stopEtaMin !== null) && (
                        <div className={cn(
                          'shrink-0 font-mono text-[10px] font-black tabular-nums',
                          isLateStop ? 'text-red-600' : 'text-blue-600',
                        )}>
                          {stopSecsLeft !== null
                            ? stopSecsLeft < 0
                              ? `+${Math.floor(Math.abs(stopSecsLeft) / 60)}m`
                              : `${Math.floor(stopSecsLeft / 60)}m`
                            : `~${stopEtaMin}m`}
                          {isLateStop && (
                            <AlertTriangle size={9} className="inline ml-0.5 text-red-500" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ══ Tour-Kennzahlen: Profit + Marge ══ */}
              {profit !== null && (
                <div>
                  <SectionHeader icon={TrendingUp} label="Tour-Kennzahlen" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className={cn(
                      'flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold',
                      profit >= 0
                        ? 'bg-matcha-50 border-matcha-200 text-matcha-700'
                        : 'bg-red-50 border-red-200 text-red-700',
                    )}>
                      <Euro size={9} />
                      <span>
                        {profit >= 0 ? '+' : ''}{profit.toFixed(2)} €
                      </span>
                    </div>
                    {distKm != null && distKm > 0 && (
                      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                        <Route size={9} />
                        {(profit / distKm).toFixed(2)} €/km
                      </div>
                    )}
                    {totalStops > 0 && (
                      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/60 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                        <MapPin size={9} />
                        {(profit / totalStops).toFixed(2)} €/Stopp
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ══ Fortschrittsbalken ══ */}
              <div>
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-[9px] text-muted-foreground font-medium">Fortschritt</span>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground">
                    {Math.round(progressPct)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-500',
                      isLate ? 'bg-red-500' : 'bg-matcha-500',
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
