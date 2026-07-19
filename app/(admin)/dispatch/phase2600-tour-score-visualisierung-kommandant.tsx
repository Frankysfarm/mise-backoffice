'use client';

/**
 * Phase 2600 — Tour-Score Visualisierung Kommandant (Dispatch)
 *
 * Konsolidiertes Cockpit: Score-Ring je aktivem Fahrer,
 * farbkodierte Stop-Dots, Tour-Fortschrittsbalken, ETA-Anzeige,
 * expandierbare Stop-Liste, Alert bei Score < 60.
 * Polling: 25 Sekunden.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Bike, ChevronDown, ChevronUp, Loader2, MapPin, Navigation, Route,
} from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────────── */

interface Stop {
  id: string;
  reihenfolge: number | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
  adresse: string | null;
}

interface Batch {
  id: string;
  status: string | null;
  fahrer_id: string | null;
  zone: string | null;
  started_at: string | null;
  total_eta_min: number | null;
  stops: Stop[];
}

interface Driver {
  employee_id: string | null;
  employee: { vorname: string | null; nachname: string | null } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  locationId?: string | null;
}

type Health = 'on-time' | 'tight' | 'late' | 'idle';

const HEALTH_STYLE: Record<Health, { bg: string; border: string; text: string; dot: string; label: string }> = {
  'on-time': { bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-500', label: 'Pünktlich'   },
  tight:     { bg: 'bg-amber-50  dark:bg-amber-950/30',  border: 'border-amber-200  dark:border-amber-800',  text: 'text-amber-700  dark:text-amber-300',  dot: 'bg-amber-400',  label: 'Knapp'       },
  late:      { bg: 'bg-red-50    dark:bg-red-950/30',    border: 'border-red-200    dark:border-red-800',    text: 'text-red-700    dark:text-red-300',    dot: 'bg-red-500',    label: 'Verspätet'   },
  idle:      { bg: 'bg-stone-50  dark:bg-stone-900/20',  border: 'border-stone-200  dark:border-stone-700',  text: 'text-stone-400  dark:text-stone-500',  dot: 'bg-stone-300',  label: 'Warten'      },
};

/* ── Score Ring ─────────────────────────────────────────────────────── */

function ScoreRing({ score, size = 42 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? '#6a9e5f' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e7e5e4" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

/* ── Stop Dots ──────────────────────────────────────────────────────── */

function StopDots({ stops }: { stops: Stop[] }) {
  const sorted = [...stops].sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {sorted.map((s, i) => {
        const done = !!s.geliefert_am;
        const arrived = !!s.angekommen_am && !done;
        return (
          <div
            key={s.id}
            className={cn(
              'h-2 w-2 rounded-full',
              done ? 'bg-matcha-500' : arrived ? 'bg-amber-400' : 'bg-stone-200 dark:bg-stone-700',
            )}
            title={done ? `Stop ${i + 1}: Geliefert` : arrived ? `Stop ${i + 1}: Angekommen` : `Stop ${i + 1}: Ausstehend`}
          />
        );
      })}
    </div>
  );
}

/* ── Progress Bar ───────────────────────────────────────────────────── */

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="w-full h-1.5 rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
      <div
        className="h-full rounded-full bg-matcha-500 transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── Driver Row ─────────────────────────────────────────────────────── */

function DriverRow({
  batch,
  driver,
  score,
  expanded,
  onToggle,
}: {
  batch: Batch;
  driver: Driver | null;
  score: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const stops = batch.stops ?? [];
  const done = stops.filter(s => !!s.geliefert_am).length;
  const total = stops.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const elapsedMin = batch.started_at
    ? Math.floor((Date.now() - new Date(batch.started_at).getTime()) / 60_000)
    : null;
  const etaMin = batch.total_eta_min;
  const remaining = etaMin !== null && elapsedMin !== null ? etaMin - elapsedMin : null;

  const health: Health =
    batch.status === 'warten' || !batch.started_at ? 'idle' :
    remaining === null ? 'on-time' :
    remaining > 5 ? 'on-time' :
    remaining >= 0 ? 'tight' :
    'late';

  const { bg, border, text } = HEALTH_STYLE[health];
  const name = driver?.employee
    ? `${driver.employee.vorname ?? ''} ${driver.employee.nachname ?? ''}`.trim()
    : `Fahrer ${batch.fahrer_id?.slice(-4) ?? '?'}`;

  return (
    <div className={cn('rounded-xl border mb-2 overflow-hidden', bg, border)}>
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <ScoreRing score={score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Bike className="w-3 h-3 shrink-0 text-stone-400" />
              <span className="text-xs font-bold text-stone-800 dark:text-stone-100 truncate">{name}</span>
              {batch.zone && <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 shrink-0">{batch.zone}</span>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {remaining !== null && (
                <span className={cn('text-[10px] font-semibold', text)}>
                  {remaining > 0 ? `${remaining} Min` : `+${Math.abs(remaining)} Min`}
                </span>
              )}
              {expanded ? <ChevronUp className="w-3 h-3 text-stone-400" /> : <ChevronDown className="w-3 h-3 text-stone-400" />}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StopDots stops={stops} />
            <span className="text-[10px] text-stone-500 dark:text-stone-400 shrink-0">{done}/{total}</span>
          </div>
          <ProgressBar done={done} total={total} />
        </div>
      </button>

      {expanded && total > 0 && (
        <div className="border-t border-stone-200/70 dark:border-stone-700/50 px-3 pb-2 pt-1.5 space-y-1">
          {[...stops]
            .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
            .map((s, i) => {
              const isDone = !!s.geliefert_am;
              const isNext = !isDone && i === stops.filter(x => !!x.geliefert_am).length;
              return (
                <div key={s.id} className="flex items-start gap-2">
                  <div className={cn(
                    'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black',
                    isDone ? 'bg-matcha-100 text-matcha-700' : isNext ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 dark:bg-stone-800 text-stone-500',
                  )}>
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-stone-600 dark:text-stone-300 truncate">{s.adresse ?? '—'}</div>
                    {isDone && s.geliefert_am && (
                      <div className="text-[9px] text-matcha-600">
                        Geliefert {new Date(s.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                    {isNext && <div className="text-[9px] text-amber-600 font-semibold">Aktueller Stopp</div>}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────────── */

export function DispatchPhase2600TourScoreVisualisierungKommandant({
  batches,
  drivers,
}: Props) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  // Derive active batches
  const active = batches.filter(
    b => b.status && !['fertig', 'abgeschlossen', 'storniert'].includes(b.status),
  );

  const alertCount = Object.values(scores).filter(s => s < 60).length;
  const teamAvg = Object.values(scores).length
    ? Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length)
    : null;

  // Load scores from driver-score API
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const driverIds = active.map(b => b.fahrer_id).filter(Boolean);
        if (driverIds.length === 0) return;
        const res = await fetch(`/api/delivery/driver-score?driver_ids=${driverIds.join(',')}`)
          .then(r => r.ok ? r.json() : null);
        if (res?.scores) {
          setScores(res.scores);
        } else {
          // Fallback: derive naive score from stop completion rate
          const naive: Record<string, number> = {};
          for (const b of active) {
            if (!b.fahrer_id) continue;
            const stops = b.stops ?? [];
            const done = stops.filter(s => !!s.geliefert_am).length;
            const total = stops.length;
            const pct = total === 0 ? 75 : Math.round(60 + (done / total) * 40);
            naive[b.fahrer_id] = pct;
          }
          setScores(naive);
        }
      } catch {
        // Fallback scores
        const naive: Record<string, number> = {};
        for (const b of active) {
          if (!b.fahrer_id) continue;
          const stops = b.stops ?? [];
          const done = stops.filter(s => !!s.geliefert_am).length;
          const total = stops.length;
          naive[b.fahrer_id] = total === 0 ? 75 : Math.round(60 + (done / total) * 40);
        }
        setScores(naive);
      } finally {
        setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 25_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  const toggle = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm mb-4 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-stone-900 text-left"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
            alertCount > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-matcha-100 dark:bg-matcha-900/40',
          )}>
            {alertCount > 0
              ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              : <Route className="w-4 h-4 text-matcha-700 dark:text-matcha-400" />}
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800 dark:text-stone-100">
              Tour-Score & Visualisierung
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400">
              {active.length} aktive Tour{active.length !== 1 ? 'en' : ''}
              {teamAvg !== null && <span> · Team-Ø {teamAvg}</span>}
              {alertCount > 0 && <span className="ml-1.5 font-semibold text-red-600 dark:text-red-400">· {alertCount} Score &lt;60</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {loading && <Loader2 className="w-3 h-3 animate-spin text-stone-400" />}
          {open ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="p-3 bg-white dark:bg-stone-900">
          {active.length === 0 ? (
            <div className="text-center py-6 text-stone-400 dark:text-stone-500 text-sm flex flex-col items-center gap-2">
              <Navigation className="w-8 h-8 text-stone-300 dark:text-stone-600" />
              Keine aktiven Touren
            </div>
          ) : (
            active.map(batch => {
              const driver = drivers.find(d => d.employee_id === batch.fahrer_id) ?? null;
              const score = batch.fahrer_id ? (scores[batch.fahrer_id] ?? 75) : 75;
              return (
                <DriverRow
                  key={batch.id}
                  batch={batch}
                  driver={driver}
                  score={score}
                  expanded={expanded.has(batch.id)}
                  onToggle={() => toggle(batch.id)}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
