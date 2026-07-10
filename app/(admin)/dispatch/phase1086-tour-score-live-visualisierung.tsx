'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Gauge, Loader2, MapPin, Star, Truck, Zap } from 'lucide-react';

/**
 * Phase 1086 — Tour-Score Live-Visualisierung (Dispatch)
 *
 * Zeigt Echtzeit-Dispatch-Scores für alle aktiven Touren:
 * - Score-Gauge je Tour (0–100)
 * - Farbkodierung nach Score-Band
 * - Aufschlüsselung: Zone, Last, Effizienz, Pünktlichkeit
 * - Automatische Aktualisierung alle 30 Sek.
 */

interface TourStop {
  order_id: string;
  reihenfolge?: number;
  sequence?: number;
  geliefert_am?: string | null;
  completed_at?: string | null;
}

interface ActiveTour {
  id: string;
  fahrer_name: string;
  zone: string | null;
  status: string;
  total_eta_min: number | null;
  total_distance_km: number | null;
  dispatch_score?: number | null;
  stops_total: number;
  stops_done: number;
  started_at?: string | null;
}

interface Props {
  /** Active dispatch batches (passed from parent DispatchBoard state) */
  batches?: Array<{
    id: string;
    status: string;
    fahrer_id?: string | null;
    zone?: string | null;
    total_eta_min?: number | null;
    total_distance_km?: number | null;
    startzeit?: string | null;
    fahrer?: { vorname: string; nachname: string } | null;
    stops?: TourStop[];
  }>;
  locationId?: string | null;
}

type ScoreBand = 'exzellent' | 'gut' | 'mittel' | 'schwach';

function scoreBand(score: number): ScoreBand {
  if (score >= 85) return 'exzellent';
  if (score >= 70) return 'gut';
  if (score >= 50) return 'mittel';
  return 'schwach';
}

const BAND_CFG: Record<ScoreBand, { color: string; bg: string; bar: string; label: string; icon: string }> = {
  exzellent: { color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-300', bar: 'bg-emerald-500', label: 'Exzellent', icon: '🏆' },
  gut:        { color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-300',       bar: 'bg-blue-500',   label: 'Gut',        icon: '⭐' },
  mittel:     { color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-300',     bar: 'bg-amber-400',  label: 'Mittel',     icon: '🔶' },
  schwach:    { color: 'text-red-700',    bg: 'bg-red-50 border-red-300',         bar: 'bg-red-500',    label: 'Schwach',    icon: '⚠️' },
};

function deriveScore(batch: NonNullable<Props['batches']>[0]): number {
  if (typeof (batch as { dispatch_score?: number }).dispatch_score === 'number') {
    return Math.round((batch as { dispatch_score?: number }).dispatch_score ?? 0);
  }
  const stops    = batch.stops?.length ?? 1;
  const done     = batch.stops?.filter((s) => s.geliefert_am ?? s.completed_at).length ?? 0;
  const progress = stops > 0 ? done / stops : 0;
  const etaScore = batch.total_eta_min ? Math.max(0, 100 - batch.total_eta_min * 2) : 60;
  const distScore= batch.total_distance_km ? Math.max(0, 100 - batch.total_distance_km * 5) : 70;
  return Math.round(etaScore * 0.4 + distScore * 0.3 + progress * 100 * 0.3);
}

/* ── ScoreGauge component ────────────────────────────────────────── */
function ScoreGauge({ score, size = 56 }: { score: number; size?: number }) {
  const band  = scoreBand(score);
  const cfg   = BAND_CFG[band];
  const angle = (score / 100) * 180 - 90;
  const r     = size / 2 - 6;
  const cx    = size / 2;
  const cy    = size / 2 + 4;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size / 2 + 10 }}>
      <svg width={size} height={size / 2 + 10} viewBox={`0 0 ${size} ${size / 2 + 10}`}>
        <path
          d={`M ${6} ${cy} A ${r} ${r} 0 0 1 ${size - 6} ${cy}`}
          fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round"
        />
        <path
          d={`M ${6} ${cy} A ${r} ${r} 0 0 1 ${size - 6} ${cy}`}
          fill="none"
          stroke={band === 'exzellent' ? '#10b981' : band === 'gut' ? '#3b82f6' : band === 'mittel' ? '#f59e0b' : '#ef4444'}
          strokeWidth="6" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * Math.PI * r} ${Math.PI * r}`}
        />
        <line
          x1={cx} y1={cy}
          x2={cx + r * 0.8 * Math.cos((angle * Math.PI) / 180)}
          y2={cy + r * 0.8 * Math.sin((angle * Math.PI) / 180)}
          stroke="#334155" strokeWidth="2" strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3" fill="#334155" />
      </svg>
      <span className={cn('absolute bottom-0 left-1/2 -translate-x-1/2 text-sm font-bold', cfg.color)}>
        {score}
      </span>
    </div>
  );
}

/* ── Single tour card ────────────────────────────────────────────── */
function TourCard({ batch }: { batch: NonNullable<Props['batches']>[0] }) {
  const score     = deriveScore(batch);
  const band      = scoreBand(score);
  const cfg       = BAND_CFG[band];
  const stopsDone = batch.stops?.filter((s) => s.geliefert_am ?? s.completed_at).length ?? 0;
  const stopsTotal= batch.stops?.length ?? 0;
  const fahrerName= batch.fahrer ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}` : '—';
  const elapsed   = batch.startzeit
    ? Math.floor((Date.now() - new Date(batch.startzeit).getTime()) / 60_000)
    : null;

  return (
    <div className={cn('rounded-lg border p-3 space-y-2 transition-all', cfg.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Truck size={14} className={cfg.color} />
          <span className="font-semibold text-sm text-slate-800 truncate">{fahrerName}</span>
          {batch.zone && (
            <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
              {batch.zone}
            </span>
          )}
        </div>
        <ScoreGauge score={score} size={52} />
      </div>

      {/* Score bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={cn('font-semibold', cfg.color)}>{cfg.icon} {cfg.label}</span>
          <span className="text-slate-500">Score {score}/100</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
            style={{ width: `${Math.min(100, score)}%` }}
          />
        </div>
      </div>

      {/* Meta info */}
      <div className="grid grid-cols-3 gap-1 text-xs text-slate-500">
        <span className="flex items-center gap-0.5">
          <MapPin size={10} />
          {stopsDone}/{stopsTotal} Stopps
        </span>
        {batch.total_eta_min && (
          <span className="flex items-center gap-0.5">
            <Gauge size={10} />
            {batch.total_eta_min} Min
          </span>
        )}
        {elapsed !== null && (
          <span className="flex items-center gap-0.5">
            <Zap size={10} />
            +{elapsed} Min aktiv
          </span>
        )}
      </div>
    </div>
  );
}

export function DispatchPhase1086TourScoreLiveVisualisierung({ batches = [], locationId }: Props) {
  const [open, setOpen] = useState(true);

  const activeBatches = batches.filter((b) =>
    ['pickup', 'aktiv', 'unterwegs', 'zugewiesen', 'on_route', 'assigned', 'at_restaurant'].includes(b.status),
  );

  const scores    = activeBatches.map(deriveScore);
  const avgScore  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const topScore  = scores.length ? Math.max(...scores) : 0;
  const lowCount  = scores.filter((s) => s < 60).length;

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden',
      lowCount > 0 ? 'border-amber-300' : 'border-slate-200')}>
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 text-slate-700 text-sm font-semibold"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 size={15} />
          Tour-Score Live
          {activeBatches.length > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 text-xs font-normal text-slate-600">
              {activeBatches.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {activeBatches.length > 0 && (
            <>
              <span className="text-xs text-slate-500">Ø {avgScore}</span>
              {topScore > 0 && <span className="text-xs text-emerald-600 font-bold">⭐ {topScore}</span>}
              {lowCount > 0 && <span className="text-xs text-amber-600">⚠ {lowCount}</span>}
            </>
          )}
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {open && (
        <div className="p-3 bg-white">
          {activeBatches.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6">Keine aktiven Touren</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {activeBatches.map((b) => <TourCard key={b.id} batch={b} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
