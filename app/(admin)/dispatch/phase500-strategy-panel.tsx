'use client';

/**
 * Phase 500 — Dispatch Strategy Panel
 *
 * Zeigt die aktuelle Dispatch-Strategie (Speed / Balance / Spar) mit
 * direktem Wechseln per One-Tap. Zeigt dazu Tour-Gesundheits-Score
 * und Live-Kennzahlen der aktiven Tours.
 */

import { useEffect, useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Gauge, PiggyBank, Scale, Zap, CheckCircle2, Loader2, TrendingUp, Route, Clock } from 'lucide-react';
import { setDispatchStrategy, type DispatchStrategy } from './strategy-action';

interface Batch {
  id: string;
  status: string;
  total_eta_min: number | null;
  started_at?: string | null;
  stops?: { geliefert_am: string | null }[];
}

interface Props {
  batches: Batch[];
  initialStrategy?: DispatchStrategy;
}

const OPTIONS: {
  key: DispatchStrategy;
  Icon: typeof Zap;
  title: string;
  desc: string;
  color: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}[] = [
  {
    key: 'speed',
    Icon: Zap,
    title: 'Speed',
    desc: 'Sofort raus — Essen maximal heiß',
    color: 'text-amber-600',
    activeBg: 'bg-amber-50',
    activeBorder: 'border-amber-400',
    activeText: 'text-amber-800',
  },
  {
    key: 'balance',
    Icon: Scale,
    title: 'Balance',
    desc: 'Bündeln wenn sinnvoll — guter Mittelweg',
    color: 'text-matcha-600',
    activeBg: 'bg-matcha-50',
    activeBorder: 'border-matcha-400',
    activeText: 'text-matcha-800',
  },
  {
    key: 'spar',
    Icon: PiggyBank,
    title: 'Spar',
    desc: 'Maximal bündeln — wenigste Fahrten',
    color: 'text-blue-600',
    activeBg: 'bg-blue-50',
    activeBorder: 'border-blue-400',
    activeText: 'text-blue-800',
  },
];

function calcTourScore(batches: Batch[]): { score: number; active: number; onTime: number; avgProgress: number } {
  const active = batches.filter(b => b.status === 'unterwegs');
  if (active.length === 0) return { score: 0, active: 0, onTime: 0, avgProgress: 0 };

  let onTimeCount = 0;
  let progressSum = 0;

  for (const b of active) {
    const elapsed = b.started_at
      ? Math.floor((Date.now() - new Date(b.started_at).getTime()) / 60_000)
      : 0;
    const eta = b.total_eta_min ?? 0;
    if (eta > 0 && elapsed <= eta * 1.1) onTimeCount++;

    const stops = b.stops ?? [];
    const done = stops.filter(s => s.geliefert_am).length;
    progressSum += stops.length > 0 ? done / stops.length : 0;
  }

  const onTimePct = active.length > 0 ? Math.round((onTimeCount / active.length) * 100) : 0;
  const avgProgress = active.length > 0 ? Math.round((progressSum / active.length) * 100) : 0;
  const score = Math.round(onTimePct * 0.6 + avgProgress * 0.4);

  return { score, active: active.length, onTime: onTimeCount, avgProgress };
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
      <circle
        cx="28" cy="28" r={r}
        fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="900" fill={color}>{score}</text>
    </svg>
  );
}

export function DispatchPhase500StrategyPanel({ batches, initialStrategy = 'balance' }: Props) {
  const [strategy, setStrategy] = useState<DispatchStrategy>(initialStrategy);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [tourStats, setTourStats] = useState(() => calcTourScore(batches));

  useEffect(() => {
    setTourStats(calcTourScore(batches));
  }, [batches]);

  function choose(k: DispatchStrategy) {
    if (k === strategy || pending) return;
    const prev = strategy;
    setStrategy(k);
    setSaved(false);
    start(async () => {
      const res = await setDispatchStrategy(k);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setStrategy(prev);
      }
    });
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-stone-500" />
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">Phase 500 · Dispatch-Strategie</span>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-600">
              <CheckCircle2 className="w-3 h-3" /> Gespeichert
            </span>
          )}
          {pending && <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-400" />}
        </div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Tour score + stats */}
        {tourStats.active > 0 && (
          <div className="flex items-center gap-3 rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
            <ScoreRing score={tourStats.score} />
            <div className="flex-1 grid grid-cols-3 gap-2">
              <div>
                <div className="text-[9px] font-black uppercase text-stone-400">Aktive Touren</div>
                <div className="text-base font-black text-stone-700 tabular-nums">{tourStats.active}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase text-stone-400">Pünktlich</div>
                <div className="text-base font-black tabular-nums text-matcha-700">{tourStats.onTime}/{tourStats.active}</div>
              </div>
              <div>
                <div className="text-[9px] font-black uppercase text-stone-400">Ø Fortschritt</div>
                <div className="text-base font-black tabular-nums text-stone-700">{tourStats.avgProgress}%</div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy buttons */}
        <div className="grid grid-cols-3 gap-2">
          {OPTIONS.map(({ key, Icon, title, desc, activeBg, activeBorder, activeText, color }) => {
            const active = strategy === key;
            return (
              <button
                key={key}
                onClick={() => choose(key)}
                disabled={pending}
                className={cn(
                  'rounded-lg border-2 px-3 py-2.5 text-left transition-all hover:shadow-sm active:scale-95 disabled:opacity-60',
                  active ? cn(activeBg, activeBorder) : 'border-stone-200 bg-white hover:border-stone-300',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={cn('w-3.5 h-3.5', active ? activeText : color)} />
                  <span className={cn('text-xs font-black', active ? activeText : 'text-stone-700')}>{title}</span>
                  {active && <CheckCircle2 className={cn('w-3 h-3 ml-auto', activeText)} />}
                </div>
                <p className={cn('text-[10px] leading-tight', active ? activeText : 'text-stone-400')}>{desc}</p>
              </button>
            );
          })}
        </div>

        {/* Quick info about current strategy impact */}
        <div className="flex items-center gap-2 text-[10px] text-stone-400 border-t border-stone-100 pt-2">
          <Route className="w-3 h-3 shrink-0" />
          <span>
            {strategy === 'speed' && 'Speed: Jede Bestellung sofort zugewiesen — kein Warten auf Batches.'}
            {strategy === 'balance' && 'Balance: Bündelt nur wenn ETA-Verlust ≤ 8 Min und Fahrer < 20% Umweg.'}
            {strategy === 'spar' && 'Spar: Wartet bis zu 12 Min auf passende Batch-Partner für max. Effizienz.'}
          </span>
        </div>
      </div>
    </div>
  );
}
