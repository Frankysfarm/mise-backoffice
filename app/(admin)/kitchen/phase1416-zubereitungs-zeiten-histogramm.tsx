'use client';

import { useMemo, useState } from 'react';
import { BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1416 — Zubereitungs-Zeiten-Histogramm (Kitchen)
 *
 * Verteilung der Zubereitungszeiten der letzten 50 Bestellungen in 5-Min-Buckets.
 * Props-basiert, rein client-seitig via useMemo.
 */

interface OrderItem {
  name?: string | null;
}

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  accepted_at?: string | null;
  ready_at?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
}

const BUCKETS_DEF: { label: string; min: number; max: number }[] = [
  { label: '0–5', min: 0, max: 5 },
  { label: '5–10', min: 5, max: 10 },
  { label: '10–15', min: 10, max: 15 },
  { label: '15–20', min: 15, max: 20 },
  { label: '20–25', min: 20, max: 25 },
  { label: '25–30', min: 25, max: 30 },
  { label: '30+', min: 30, max: Infinity },
];

function bucketColor(label: string): string {
  if (label === '0–5' || label === '5–10') return 'bg-emerald-500';
  if (label === '10–15' || label === '15–20') return 'bg-sky-500';
  if (label === '20–25' || label === '25–30') return 'bg-amber-500';
  return 'bg-rose-500';
}

export function KitchenPhase1416ZubereitungsZeitenHistogramm({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { buckets, schnitt, gesamt } = useMemo(() => {
    const now = Date.now();
    const zeiten: number[] = [];

    const pool = orders.slice(-50);
    for (const o of pool) {
      let startMs: number | null = null;
      let endMs: number | null = null;

      if (o.accepted_at) startMs = new Date(o.accepted_at).getTime();
      else if (o.created_at) startMs = new Date(o.created_at).getTime();

      if (o.ready_at) endMs = new Date(o.ready_at).getTime();
      else if (o.status === 'preparing' && startMs) endMs = now;

      if (startMs && endMs && endMs > startMs) {
        const mins = (endMs - startMs) / 60_000;
        if (mins < 120) zeiten.push(mins);
      }
    }

    const bkts: Bucket[] = BUCKETS_DEF.map((b) => ({
      ...b,
      count: zeiten.filter((z) => z >= b.min && z < b.max).length,
    }));

    const schnittVal = zeiten.length > 0 ? zeiten.reduce((a, b) => a + b, 0) / zeiten.length : 0;

    return { buckets: bkts, schnitt: schnittVal, gesamt: zeiten.length };
  }, [orders]);

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  if (gesamt === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Zubereitungs-Zeiten
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Ø {schnitt.toFixed(1)} Min · {gesamt} Bestellungen
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="flex items-end gap-2">
            {buckets.map((b) => {
              const pct = Math.round((b.count / maxCount) * 100);
              return (
                <div key={b.label} className="flex flex-col items-center flex-1 gap-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {b.count > 0 ? b.count : ''}
                  </span>
                  <div className="w-full flex items-end" style={{ height: '60px' }}>
                    <div
                      className={cn('w-full rounded-t transition-all', bucketColor(b.label))}
                      style={{ height: `${Math.max(pct, b.count > 0 ? 8 : 0)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center leading-tight">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center">
            Minuten · letzte {Math.min(orders.length, 50)} Bestellungen
          </p>
        </div>
      )}
    </div>
  );
}
