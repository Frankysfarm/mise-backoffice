'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, BarChart2, AlertTriangle } from 'lucide-react';

/**
 * Phase 1029 — Bestellungs-Komplexitäts-Heatmap (Kitchen)
 *
 * Zeigt welche Tagesstunden besonders komplexe Bestellungen produzieren.
 * Komplexität = Artikel-Anzahl × Komplexitäts-Score (Keyword-basiert).
 * Rein client-seitig, useMemo.
 */

interface Item {
  name?: string;
  title?: string;
  menge?: number;
}

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}

interface Props {
  orders: Order[];
}

const COMPLEX_KEYWORDS = ['auflauf', 'risotto', 'gericht', 'special', 'kombi', 'menü', 'premium', 'deluxe', 'teller', 'platte'];
const SIMPLE_KEYWORDS = ['getränk', 'drink', 'wasser', 'cola', 'saft', 'bier', 'wein'];

function itemKomplexitaet(name: string): number {
  const low = name.toLowerCase();
  if (COMPLEX_KEYWORDS.some(k => low.includes(k))) return 3;
  if (SIMPLE_KEYWORDS.some(k => low.includes(k))) return 0.5;
  return 1;
}

function orderKomplexitaet(items: Item[] | null | undefined): number {
  if (!items?.length) return 1;
  const score = items.reduce((sum, i) => {
    const k = itemKomplexitaet(i.name ?? i.title ?? '');
    return sum + k * (i.menge ?? 1);
  }, 0);
  return Math.round(score * 10) / 10;
}

interface StundenEintrag {
  stunde: number;
  label: string;
  komplexitaet: number;
  anzahl: number;
  avg_komplexitaet: number;
}

const STUNDEN = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

export function KitchenPhase1029BestellKomplexitaetsHeatmap({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const stunden = useMemo((): StundenEintrag[] => {
    const map = new Map<number, { summe: number; count: number }>();
    STUNDEN.forEach(h => map.set(h, { summe: 0, count: 0 }));

    for (const o of orders) {
      if (!o.created_at) continue;
      const h = new Date(o.created_at).getHours();
      if (!map.has(h)) continue;
      const k = orderKomplexitaet(o.items);
      const entry = map.get(h)!;
      entry.summe += k;
      entry.count++;
    }

    return STUNDEN.map(h => {
      const { summe, count } = map.get(h)!;
      const avg = count > 0 ? Math.round((summe / count) * 10) / 10 : 0;
      return {
        stunde: h,
        label: `${h}:00`,
        komplexitaet: Math.round(summe * 10) / 10,
        anzahl: count,
        avg_komplexitaet: avg,
      };
    });
  }, [orders]);

  const maxKomplexitaet = Math.max(...stunden.map(s => s.komplexitaet), 1);
  const peakStunde = stunden.reduce((a, b) => (a.komplexitaet > b.komplexitaet ? a : b), stunden[0]);
  const hoheKomplexitaet = stunden.filter(s => s.komplexitaet >= maxKomplexitaet * 0.75).length;

  if (orders.length === 0) return null;

  function heatColor(val: number, max: number): string {
    const pct = max > 0 ? val / max : 0;
    if (pct >= 0.75) return 'bg-red-500';
    if (pct >= 0.5) return 'bg-amber-400';
    if (pct >= 0.25) return 'bg-yellow-300';
    return 'bg-matcha-200 dark:bg-matcha-800';
  }

  function heatTextColor(val: number, max: number): string {
    const pct = max > 0 ? val / max : 0;
    if (pct >= 0.75) return 'text-red-700 dark:text-red-300';
    if (pct >= 0.5) return 'text-amber-700 dark:text-amber-300';
    if (pct >= 0.25) return 'text-yellow-700 dark:text-yellow-900';
    return 'text-matcha-700 dark:text-matcha-300';
  }

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Komplexitäts-Heatmap</span>
          {hoheKomplexitaet > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-red-300 bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              Peak: {peakStunde.label}
            </span>
          )}
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 px-2 py-0.5 text-xs font-semibold text-matcha-700 dark:text-matcha-300">
            Tagesstunden
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground mb-3">
            Bestellkomplexität (Artikel × Score) je Tagesstunde — rot = hoher Küchendruck
          </p>

          {/* Heatmap-Grid */}
          <div className="grid grid-cols-7 gap-1 sm:grid-cols-13">
            {stunden.map(s => (
              <div key={s.stunde} className="flex flex-col items-center gap-1">
                <div
                  title={`${s.label}: ${s.komplexitaet} Pkt, ${s.anzahl} Bestellungen`}
                  className={cn(
                    'w-full rounded-md h-10 flex items-center justify-center text-[10px] font-bold transition',
                    heatColor(s.komplexitaet, maxKomplexitaet),
                    heatTextColor(s.komplexitaet, maxKomplexitaet),
                  )}
                >
                  {s.komplexitaet > 0 ? s.komplexitaet : '—'}
                </div>
                <span className="text-[9px] text-muted-foreground">{s.label.replace(':00', '')}</span>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center gap-3 flex-wrap text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-matcha-200 dark:bg-matcha-800 inline-block" />Niedrig</div>
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-yellow-300 inline-block" />Mittel</div>
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-400 inline-block" />Hoch</div>
            <div className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-500 inline-block" />Peak</div>
            {peakStunde.anzahl > 0 && (
              <span className="ml-auto font-medium">
                Spitze: {peakStunde.label} ({peakStunde.anzahl} Bestellungen, Ø {peakStunde.avg_komplexitaet} Pkt)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
