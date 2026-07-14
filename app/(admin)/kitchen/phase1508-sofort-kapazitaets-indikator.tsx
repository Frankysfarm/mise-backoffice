'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Gauge, ChevronDown, ChevronUp, Settings } from 'lucide-react';

// Phase 1508 — Sofort-Kapazitaets-Indikator (Kitchen)
// SVG-Ring: Aktive Bestellungen vs. max. parallele Kapazitaet (einstellbar);
// Ampel gruen/gelb/rot; Props-basiert; nach Phase1503.

interface Order {
  id: string;
  status?: string | null;
}

interface Props {
  orders: Order[];
  maxKapazitaet?: number;
}

const AKTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'in_zubereitung', 'accepted']);

const RING_SIZE = 96;
const STROKE = 10;
const R = (RING_SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

type Ampel = 'gruen' | 'gelb' | 'rot';

function getAmpel(ratio: number): Ampel {
  if (ratio >= 0.9) return 'rot';
  if (ratio >= 0.65) return 'gelb';
  return 'gruen';
}

const AMPEL_CONFIG: Record<Ampel, { stroke: string; text: string; badge: string; ring: string; hint: string }> = {
  gruen: {
    stroke: '#10b981',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    ring: 'ring-emerald-200 dark:ring-emerald-800',
    hint: 'Kapazität ausreichend',
  },
  gelb: {
    stroke: '#f59e0b',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    ring: 'ring-amber-200 dark:ring-amber-800',
    hint: 'Kapazität erhöht — aufmerksam bleiben',
  },
  rot: {
    stroke: '#ef4444',
    text: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    ring: 'ring-rose-200 dark:ring-rose-800',
    hint: 'Überlast! — Neue Bestellungen ggf. verzögern',
  },
};

const PRESET_KAPAZITAETEN = [3, 5, 8, 10, 12];

export function KitchenPhase1508SofortKapazitaetsIndikator({ orders, maxKapazitaet: maxProp }: Props) {
  const [open, setOpen] = useState(true);
  const [max, setMax] = useState<number>(maxProp ?? 5);

  const aktiv = useMemo(
    () => orders.filter(o => AKTIVE_STATUSES.has(o.status ?? '')).length,
    [orders],
  );

  const ratio = Math.min(aktiv / max, 1);
  const ampel = getAmpel(ratio);
  const cfg = AMPEL_CONFIG[ampel];

  const dashOffset = CIRC * (1 - ratio);

  if (orders.length === 0) return null;

  return (
    <div className={cn('rounded-xl border overflow-hidden', {
      'border-emerald-200 dark:border-emerald-800': ampel === 'gruen',
      'border-amber-200 dark:border-amber-800': ampel === 'gelb',
      'border-rose-200 dark:border-rose-800': ampel === 'rot',
    })}>
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <Gauge className={cn('w-4 h-4 shrink-0', cfg.text)} />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Kapazitäts-Indikator
        </span>
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0', cfg.badge)}>
          {aktiv}/{max}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 bg-white dark:bg-slate-900 space-y-4">
          {/* SVG Ring */}
          <div className="flex items-center gap-5">
            <div className="shrink-0">
              <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={R}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={STROKE}
                  className="text-slate-100 dark:text-slate-800"
                />
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={R}
                  fill="none"
                  stroke={cfg.stroke}
                  strokeWidth={STROKE}
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <div
                className="relative"
                style={{ marginTop: `-${RING_SIZE / 2 + STROKE / 2}px`, height: `${RING_SIZE}px` }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={cn('text-xl font-bold', cfg.text)}>{aktiv}</span>
                  <span className="text-[9px] text-slate-400">von {max}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className={cn('text-sm font-semibold mb-1', cfg.text)}>
                {Math.round(ratio * 100)}% ausgelastet
              </div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                {cfg.hint}
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round(ratio * 100)}%`, backgroundColor: cfg.stroke }}
                />
              </div>
            </div>
          </div>

          {/* Kapazitäts-Einstellung */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
            <Settings className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="text-[10px] text-slate-400 shrink-0">Max. Kapazität:</span>
            {PRESET_KAPAZITAETEN.map(n => (
              <button
                key={n}
                onClick={() => setMax(n)}
                className={cn(
                  'text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors',
                  n === max
                    ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
