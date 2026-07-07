'use client';

import { useEffect, useState } from 'react';
import {
  Route, Clock, CheckCircle2, AlertTriangle, Zap, TrendingUp, Gauge, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  eta_earliest?: string | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: Stop[];
};

type TourRow = {
  batch: Batch;
  driverName: string;
  progressPct: number;
  doneStops: number;
  totalStops: number;
  elapsedMin: number;
  remainMin: number | null;
  score: number;
  health: 'great' | 'ok' | 'warn' | 'late';
};

function ScoreGauge({ score }: { score: number }) {
  const angle = (score / 100) * 180 - 90;
  const color =
    score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="relative flex items-center justify-center w-14 h-9 overflow-hidden">
      {/* arc background */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-7 rounded-t-full border-4 border-muted/40"
        style={{ borderColor: 'rgba(0,0,0,0.08)' }}
      />
      {/* needle */}
      <div
        className="absolute bottom-0.5 left-1/2 -translate-x-1/2 origin-bottom rounded-full transition-transform duration-700"
        style={{
          width: 2,
          height: 22,
          background: color,
          transform: `rotate(${angle}deg)`,
        }}
      />
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-black tabular-nums"
        style={{ color, transform: 'translateX(-50%) translateY(1px)' }}
      >
        {score}
      </div>
    </div>
  );
}

function ProgressArc({ pct }: { pct: number }) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="4" stroke="rgba(0,0,0,0.08)" />
      <circle
        cx="22" cy="22" r={radius}
        fill="none"
        strokeWidth="4"
        stroke={pct >= 66 ? '#22c55e' : pct >= 33 ? '#f59e0b' : '#3b82f6'}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className="transition-all duration-700"
      />
      <text x="22" y="26" textAnchor="middle" className="text-[9px] font-black" fill="currentColor" fontSize="10" fontWeight="900">
        {pct}%
      </text>
    </svg>
  );
}

function computeScore(batch: Batch, elapsedMin: number): number {
  const total = batch.stops.length;
  if (total === 0) return 50;
  const done = batch.stops.filter((s) => s.geliefert_am).length;
  const eta = batch.total_eta_min ?? 40;
  const donePct = done / total;
  const timePct = elapsedMin / eta;
  const efficiency = timePct > 0 ? donePct / timePct : 1;
  const raw = Math.round(Math.min(100, efficiency * 70 + donePct * 30));
  return Math.max(10, raw);
}

export function DispatchPhase590TourScoreVisualisierung({
  batches,
}: {
  batches: Batch[];
}) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter((b) =>
    ['unterwegs', 'aktiv', 'gestartet'].includes(b.status),
  );

  if (activeBatches.length === 0) return null;

  const now = Date.now();

  const rows: TourRow[] = activeBatches.map((b) => {
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname}`.trim()
      : 'Unbekannt';
    const totalStops = b.stops.length;
    const doneStops = b.stops.filter((s) => s.geliefert_am).length;
    const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
    const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
    const etaMin = b.total_eta_min ?? null;
    const remainMin = etaMin !== null ? Math.max(0, etaMin - elapsedMin) : null;
    const progressPct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
    const score = computeScore(b, elapsedMin);
    const health: TourRow['health'] =
      score >= 80 ? 'great' : score >= 60 ? 'ok' : score >= 40 ? 'warn' : 'late';

    return { batch: b, driverName, progressPct, doneStops, totalStops, elapsedMin, remainMin, score, health };
  }).sort((a, b) => a.score - b.score);

  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const lateCount = rows.filter((r) => r.health === 'late').length;

  const healthStyle = {
    great: { border: 'border-matcha-200', bg: 'bg-matcha-50/60', badge: 'bg-matcha-500 text-white', label: 'Optimal' },
    ok:    { border: 'border-blue-200',   bg: 'bg-blue-50/60',   badge: 'bg-blue-500 text-white',   label: 'Gut' },
    warn:  { border: 'border-amber-200',  bg: 'bg-amber-50/60',  badge: 'bg-amber-500 text-white',  label: 'Knapp' },
    late:  { border: 'border-red-200',    bg: 'bg-red-50/60',    badge: 'bg-red-500 text-white',    label: 'Spät' },
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <Gauge className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Tour Score · Visualisierung
        </span>
        <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          Ø {avgScore}
        </span>
        {lateCount > 0 && (
          <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            {lateCount} spät
          </span>
        )}
        <div className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map((row) => {
            const hs = healthStyle[row.health];
            return (
              <div key={row.batch.id} className={cn('px-4 py-3 flex items-center gap-3', hs.bg)}>
                {/* Score Gauge */}
                <div className="shrink-0 flex flex-col items-center">
                  <ScoreGauge score={row.score} />
                  <span className={cn('mt-0.5 text-[8px] font-black rounded px-1 py-0.5', hs.badge)}>
                    {hs.label}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.batch.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                        Zone {row.batch.zone}
                      </span>
                    )}
                  </div>

                  {/* Progress arc + stats */}
                  <div className="mt-1.5 flex items-center gap-3">
                    <ProgressArc pct={row.progressPct} />
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <CheckCircle2 className="h-2.5 w-2.5 text-matcha-500" />
                        {row.doneStops}/{row.totalStops} Stopps
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5 text-blue-400" />
                        {row.elapsedMin} Min vergangen
                      </div>
                      {row.remainMin !== null && (
                        <div className={cn(
                          'flex items-center gap-1 text-[10px] font-bold',
                          row.health === 'late' ? 'text-red-600' : row.health === 'warn' ? 'text-amber-600' : 'text-matcha-600',
                        )}>
                          <Route className="h-2.5 w-2.5" />
                          ~{row.remainMin} Min verbleibend
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trend icon */}
                <div className="shrink-0">
                  {row.health === 'great' ? (
                    <Zap className="h-5 w-5 text-matcha-500" />
                  ) : row.health === 'ok' ? (
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  ) : (
                    <AlertTriangle className={cn('h-5 w-5', row.health === 'late' ? 'text-red-500' : 'text-amber-500')} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
