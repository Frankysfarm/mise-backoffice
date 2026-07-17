'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  status: 'neu' | 'unterwegs' | 'geliefert';
  geliefert_am?: string | null;
}

interface Props {
  stops: Stop[];
  laufzeitMin?: number;
  geschaetzteTotalMin?: number;
  className?: string;
}

function Ring({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth={8} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={pct >= 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b'}
        strokeWidth={8}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function FahrerPhase1952TourFortschrittsRing({ stops, laufzeitMin, geschaetzteTotalMin, className }: Props) {
  const [open, setOpen] = useState(true);

  const { done, total, pct, restMin } = useMemo(() => {
    const total = stops.length;
    const done = stops.filter(s => s.status === 'geliefert').length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const restMin = geschaetzteTotalMin && laufzeitMin
      ? Math.max(0, geschaetzteTotalMin - laufzeitMin)
      : null;
    return { done, total, pct, restMin };
  }, [stops, laufzeitMin, geschaetzteTotalMin]);

  return (
    <div className={cn('rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Tour-Fortschritt</span>
          <span className={cn(
            'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
            pct >= 100 ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-300' :
            'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300',
          )}>
            {done}/{total} Stopps
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-indigo-100 dark:border-indigo-800 px-4 pb-4 pt-3">
          <div className="flex items-center gap-6">
            {/* Ring */}
            <div className="relative shrink-0">
              <Ring pct={pct} size={88} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn(
                  'text-xl font-black tabular-nums',
                  pct >= 100 ? 'text-green-500' : 'text-indigo-500',
                )}>
                  {pct}%
                </span>
              </div>
            </div>

            {/* KPI-Grid */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-center">
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{done}</p>
                <p className="text-[9px] text-slate-500">Geliefert</p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 px-3 py-2 text-center">
                <p className="text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">{total - done}</p>
                <p className="text-[9px] text-slate-500">Ausstehend</p>
              </div>
              {laufzeitMin !== undefined && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-center">
                  <p className="text-lg font-black text-blue-700 dark:text-blue-300 tabular-nums">{laufzeitMin}m</p>
                  <p className="text-[9px] text-slate-500">Laufzeit</p>
                </div>
              )}
              {restMin !== null && (
                <div className={cn(
                  'rounded-lg px-3 py-2 text-center',
                  restMin <= 5 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20',
                )}>
                  <p className={cn(
                    'text-lg font-black tabular-nums flex items-center justify-center gap-1',
                    restMin <= 5 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400',
                  )}>
                    <Clock className="w-3.5 h-3.5" />
                    {restMin}m
                  </p>
                  <p className="text-[9px] text-slate-500">Restzeit</p>
                </div>
              )}
            </div>
          </div>

          {pct >= 100 && (
            <div className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 px-3 py-2 text-center">
              <p className="text-sm font-bold text-green-700 dark:text-green-300">🎉 Tour abgeschlossen! Alle Stopps erledigt.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
