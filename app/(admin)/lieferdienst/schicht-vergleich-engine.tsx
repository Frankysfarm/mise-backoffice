'use client';

/**
 * SchichtVergleichEnginePanel — Phase 412
 *
 * Visualisiert den aktuellen Schicht-Score aus der Phase-411-Baseline-Engine.
 * API: GET /api/delivery/admin/schicht-vergleich?location_id=...
 *
 * Zeigt:
 * - Komposit-ShiftScore (0–100) als Ring-Gauge
 * - Score-Label (exzellent/gut/okay/schwach)
 * - isOnTrack-Badge
 * - Delta-Kacheln: Umsatz%, Lieferungen%, Ø-Lieferzeit%, Pünktlichkeit-Diff
 * - Baseline-Info: 6-Wochen-Schnitt
 * - Kontextuelle Empfehlung
 */

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, Target, RefreshCw, CheckCircle2, AlertCircle, Clock, Package, Euro, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SchichtDelta {
  umsatzPct: number | null;
  lieferungenPct: number | null;
  deliveryMinPct: number | null;
  onTimePtsDiff: number | null;
}

interface SchichtTodayData {
  dayOfWeek: number;
  date: string;
  umsatzEur: number;
  lieferungen: number;
  bestellungen: number;
  stornos?: number;
  aktiveFahrer: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

interface BaselineData {
  avgUmsatzEur: number | null;
  avgLieferungen: number | null;
  avgDeliveryMin: number | null;
  avgOnTimePct: number | null;
  weeksUsed: number;
}

interface SchichtVergleichData {
  locationId: string;
  today: SchichtTodayData;
  baseline: BaselineData | null;
  delta: SchichtDelta;
  shiftScore: number;
  scoreLabel: 'exzellent' | 'gut' | 'okay' | 'schwach';
  isOnTrack: boolean;
  recommendation: string | null;
  computedAt: string;
}

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const SCORE_CONFIG = {
  exzellent: { color: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200', ring: '#4a7c59', label: 'Exzellent' },
  gut:       { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', ring: '#059669', label: 'Gut' },
  okay:      { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', ring: '#d97706', label: 'Okay' },
  schwach:   { color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', ring: '#dc2626', label: 'Schwach' },
};

function ScoreRing({ score, label }: { score: number; label: keyof typeof SCORE_CONFIG }) {
  const cfg = SCORE_CONFIG[label];
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
      <svg width="96" height="96" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#e7e5e4" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          stroke={cfg.ring} strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-black tabular-nums', cfg.color)}>{Math.round(score)}</span>
        <span className="text-[9px] font-bold text-stone-400 uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

function DeltaBadge({ value, suffix = '%', invertGood = false, label, icon: Icon }: {
  value: number | null;
  suffix?: string;
  invertGood?: boolean;
  label: string;
  icon: React.ElementType;
}) {
  if (value === null) {
    return (
      <div className="flex flex-col items-center gap-0.5 rounded-xl bg-stone-50 border border-stone-100 px-3 py-2.5">
        <Icon className="h-3.5 w-3.5 text-stone-300" />
        <span className="text-[11px] font-black text-stone-300">—</span>
        <span className="text-[9px] text-stone-400">{label}</span>
      </div>
    );
  }
  const isPositive = invertGood ? value < 0 : value > 0;
  const isNeutral = Math.abs(value) < 1;
  const color = isNeutral ? 'text-stone-500' : isPositive ? 'text-matcha-700' : 'text-red-600';
  const bg = isNeutral ? 'bg-stone-50 border-stone-100' : isPositive ? 'bg-matcha-50 border-matcha-200' : 'bg-red-50 border-red-200';
  const TrendIcon = isNeutral ? Minus : isPositive ? TrendingUp : TrendingDown;
  return (
    <div className={cn('flex flex-col items-center gap-0.5 rounded-xl border px-3 py-2.5', bg)}>
      <div className="flex items-center gap-0.5">
        <Icon className={cn('h-3 w-3', color)} />
        <TrendIcon className={cn('h-3 w-3', color)} />
      </div>
      <span className={cn('text-[11px] font-black tabular-nums', color)}>
        {value > 0 ? '+' : ''}{value.toFixed(1)}{suffix}
      </span>
      <span className="text-[9px] text-stone-500">{label}</span>
    </div>
  );
}

export function SchichtVergleichEnginePanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<SchichtVergleichData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError(false);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-vergleich?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const t = setInterval(() => load(true), 3 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-8 w-8 rounded-full bg-stone-100 animate-pulse" />
          <div className="h-4 w-48 bg-stone-100 rounded animate-pulse" />
        </div>
        <div className="flex gap-4">
          <div className="h-24 w-24 rounded-full bg-stone-100 animate-pulse" />
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-14 bg-stone-100 rounded-xl animate-pulse" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <AlertCircle className="h-4 w-4" />
          <span>Schicht-Vergleichs-Engine nicht verfügbar</span>
        </div>
      </div>
    );
  }

  const cfg = SCORE_CONFIG[data.scoreLabel];
  const dow = DOW_LABELS[data.today.dayOfWeek] ?? '—';
  const weeksUsed = data.baseline?.weeksUsed ?? 0;

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden', cfg.border)}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 px-5 py-3.5 border-b', cfg.bg, cfg.border.replace('border-', 'border-b-'))}>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', cfg.bg)}>
          <Target className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-800">Schicht-Vergleichs-Engine</div>
          <div className="text-[11px] text-stone-500">
            {dow} · Baseline aus {weeksUsed} Wochen ·{' '}
            {new Date(data.computedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data.isOnTrack ? (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 px-2.5 py-0.5 text-[10px] font-bold text-matcha-700">
              <CheckCircle2 className="h-3 w-3" /> On Track
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-[10px] font-bold text-red-700">
              <AlertCircle className="h-3 w-3" /> Abweichung
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="h-7 w-7 rounded-lg border border-stone-200 bg-white flex items-center justify-center hover:bg-stone-50 transition"
          >
            <RefreshCw className={cn('h-3 w-3 text-stone-400', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Score Ring + Deltas */}
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ScoreRing score={data.shiftScore} label={data.scoreLabel} />
            <span className={cn('text-[11px] font-bold', cfg.color)}>{cfg.label}</span>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-2">
            <DeltaBadge
              value={data.delta.umsatzPct}
              label="Umsatz"
              icon={Euro}
            />
            <DeltaBadge
              value={data.delta.lieferungenPct}
              label="Lieferungen"
              icon={Package}
            />
            <DeltaBadge
              value={data.delta.deliveryMinPct}
              label="Ø Lieferzeit"
              icon={Clock}
              invertGood
            />
            <DeltaBadge
              value={data.delta.onTimePtsDiff}
              suffix=" Pkt"
              label="Pünktlichkeit"
              icon={Zap}
            />
          </div>
        </div>

        {/* Today vs Baseline quick row */}
        {data.baseline && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: 'Umsatz heute',
                value: data.today.umsatzEur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
                baseline: data.baseline.avgUmsatzEur !== null
                  ? 'Ø ' + data.baseline.avgUmsatzEur.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €'
                  : null,
              },
              {
                label: 'Lieferungen',
                value: data.today.lieferungen.toString(),
                baseline: data.baseline.avgLieferungen !== null
                  ? 'Ø ' + data.baseline.avgLieferungen.toFixed(1)
                  : null,
              },
              {
                label: 'Ø Lieferzeit',
                value: data.today.avgDeliveryMin !== null ? data.today.avgDeliveryMin.toFixed(1) + ' Min' : '—',
                baseline: data.baseline.avgDeliveryMin !== null
                  ? 'Ø ' + data.baseline.avgDeliveryMin.toFixed(1) + ' Min'
                  : null,
              },
              {
                label: 'Pünktlichkeit',
                value: data.today.onTimePct !== null ? Math.round(data.today.onTimePct) + '%' : '—',
                baseline: data.baseline.avgOnTimePct !== null
                  ? 'Ø ' + Math.round(data.baseline.avgOnTimePct) + '%'
                  : null,
              },
            ].map(({ label, value, baseline }) => (
              <div key={label} className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
                <div className="text-[10px] text-stone-500 font-medium">{label}</div>
                <div className="text-sm font-black tabular-nums text-stone-800">{value}</div>
                {baseline && <div className="text-[9px] text-stone-400 mt-0.5">{baseline}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {data.recommendation && (
          <div className={cn('flex items-start gap-2 rounded-xl border px-3.5 py-2.5', cfg.bg, cfg.border)}>
            <Zap className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', cfg.color)} />
            <p className={cn('text-xs font-medium leading-snug', cfg.color)}>{data.recommendation}</p>
          </div>
        )}

        {/* Footer meta */}
        <div className="flex items-center gap-3 text-[10px] text-stone-400">
          <span>{data.today.aktiveFahrer} aktive Fahrer</span>
          <span>·</span>
          <span>{data.today.bestellungen} Bestellungen</span>
          <span>·</span>
          <span>{data.today.stornos ?? 0} Stornos</span>
        </div>
      </div>
    </div>
  );
}
