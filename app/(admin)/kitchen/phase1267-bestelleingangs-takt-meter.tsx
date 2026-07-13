'use client';

// Phase 1267 — Bestelleingangs-Takt-Meter (Kitchen)
// Animierter Zähler Bestellungen/Min (gleitend 5 Min) + grün/amber/rot je Takt + Spitzenzeit-Indikator
// Props: orders · rein client-seitig via useMemo

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  schwelleHoch?: number;
  schwelleKritisch?: number;
}

type Level = 'ruhig' | 'normal' | 'hoch' | 'peak';

const LEVEL_STYLE: Record<Level, { header: string; bg: string; border: string; bar: string; text: string }> = {
  ruhig: {
    header: 'bg-gradient-to-r from-slate-400 to-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-200 dark:border-slate-700',
    bar: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
  },
  normal: {
    header: 'bg-gradient-to-r from-green-500 to-emerald-600',
    bg: 'bg-green-50 dark:bg-green-950/30',
    border: 'border-green-200 dark:border-green-700',
    bar: 'bg-green-500',
    text: 'text-green-700 dark:text-green-300',
  },
  hoch: {
    header: 'bg-gradient-to-r from-amber-400 to-orange-500',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-700',
    bar: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
  },
  peak: {
    header: 'bg-gradient-to-r from-red-500 to-rose-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
  },
};

const LEVEL_LABEL: Record<Level, string> = {
  ruhig: 'Ruhig',
  normal: 'Normal',
  hoch: 'Hoch',
  peak: 'Peak',
};

function levelFor(taktProMin: number, schwelleHoch: number, schwelleKritisch: number): Level {
  if (taktProMin >= schwelleKritisch) return 'peak';
  if (taktProMin >= schwelleHoch) return 'hoch';
  if (taktProMin >= 0.5) return 'normal';
  return 'ruhig';
}

export function KitchenPhase1267BestelleingangsTaktMeter({
  orders,
  schwelleHoch = 2,
  schwelleKritisch = 4,
}: Props) {
  const [open, setOpen] = useState(true);

  const { taktProMin, bestellungenIn5Min, level, spitzenzeit } = useMemo(() => {
    const now = Date.now();
    const fenster5Min = 5 * 60 * 1000;
    const fensterSpitze = 60 * 60 * 1000;

    const recent = orders.filter(o => {
      if (!o.created_at) return false;
      return now - new Date(o.created_at).getTime() <= fenster5Min;
    });
    const count5 = recent.length;
    const rate = count5 / 5;

    const lv = levelFor(rate, schwelleHoch, schwelleKritisch);

    // Spitzenzeit: Stunde in letzter 1h mit meisten Bestellungen
    const buckets: Record<number, number> = {};
    orders.forEach(o => {
      if (!o.created_at) return;
      const t = new Date(o.created_at).getTime();
      if (now - t > fensterSpitze) return;
      const min = Math.floor((now - t) / 60000);
      const bucket = Math.floor(min / 15) * 15;
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    });
    const maxBucket = Object.entries(buckets).sort((a, b) => b[1] - a[1])[0];
    const spitze = maxBucket ? `vor ${maxBucket[0]}–${Number(maxBucket[0]) + 15} Min` : null;

    return { taktProMin: rate, bestellungenIn5Min: count5, level: lv, spitzenzeit: spitze };
  }, [orders, schwelleHoch, schwelleKritisch]);

  const s = LEVEL_STYLE[level];
  const barWidth = Math.min(100, (taktProMin / schwelleKritisch) * 100);

  return (
    <div className={cn('rounded-xl border shadow-sm overflow-hidden mb-3', s.bg, s.border)}>
      <button
        className={cn('flex w-full items-center justify-between px-4 py-2.5 text-white', s.header)}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Zap className={cn('h-4 w-4', level === 'peak' && 'animate-pulse')} />
          <span className="font-semibold text-sm">Bestelleingangs-Takt</span>
          <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
            {LEVEL_LABEL[level]}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {/* Main counter */}
          <div className="flex items-end gap-3">
            <div className="flex flex-col items-center">
              <span className={cn('text-4xl font-black tabular-nums', s.text)}>
                {taktProMin.toFixed(1)}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Bestellungen/Min
              </span>
            </div>
            <div className="flex-1 pb-1">
              <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                <span>0</span>
                <span>{schwelleHoch} hoch</span>
                <span>{schwelleKritisch} peak</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Letzten 5 Min</p>
              <p className={cn('text-xl font-bold tabular-nums', s.text)}>{bestellungenIn5Min}</p>
              <p className="text-[10px] text-slate-400">Bestellungen</p>
            </div>
            <div className="rounded-lg bg-white/60 dark:bg-white/5 px-3 py-2 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">Intensität</p>
              <p className={cn('text-xl font-bold', s.text)}>{LEVEL_LABEL[level]}</p>
              {spitzenzeit && (
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400">
                  <TrendingUp className="h-2.5 w-2.5" />
                  <span>Spitze {spitzenzeit}</span>
                </div>
              )}
            </div>
          </div>

          {level === 'peak' && (
            <p className="text-xs text-red-600 dark:text-red-400 font-semibold animate-pulse text-center">
              Hochbetrieb! Alle Stationen voll einsetzen.
            </p>
          )}
          {level === 'hoch' && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
              Erhöhtes Aufkommen — Vorbereitung anpassen.
            </p>
          )}
          {level === 'ruhig' && (
            <p className="text-xs text-slate-400 text-center">Ruhige Phase — gute Zeit für Mise en Place.</p>
          )}

          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right tabular-nums">
            Gleitend 5 Min · {orders.length} Bestellungen gesamt
          </p>
        </div>
      )}
    </div>
  );
}
