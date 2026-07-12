'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Clock, Flame, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1175 — Kochstart-Optimierungs-Matrix (Kitchen)
// Bestellungen die ihren optimalen Kochstart verpasst oder gerade erreicht haben — nach Dringlichkeit sortiert

interface Order {
  id: string;
  bestellnummer?: string;
  created_at?: string;
  geschaetzte_zubereitung_min?: number | null;
  status?: string;
}

interface Props {
  orders: Order[];
}

type Dringlichkeit = 'ueberfaellig' | 'jetzt' | 'bald' | 'ok';

interface MatrixEntry {
  id: string;
  nr: string;
  secsVerspaetung: number;
  prepMin: number;
  dringlichkeit: Dringlichkeit;
}

const DRING_CFG: Record<Dringlichkeit, { bg: string; text: string; dot: string; label: string; pulse?: boolean }> = {
  ueberfaellig: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: 'Überfällig', pulse: true },
  jetzt:        { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Jetzt starten' },
  bald:         { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400', label: 'Bald' },
  ok:           { bg: 'bg-matcha-50 border-matcha-200', text: 'text-matcha-700', dot: 'bg-matcha-500', label: 'Zeit vorhanden' },
};

function computeMatrix(orders: Order[]): MatrixEntry[] {
  const now = Date.now();
  const entries: MatrixEntry[] = [];
  for (const o of orders) {
    if (!o.created_at) continue;
    const active = ['accepted', 'preparing', 'ready'].includes(o.status ?? '');
    if (!active) continue;
    const createdMs = new Date(o.created_at).getTime();
    const prepMin = o.geschaetzte_zubereitung_min ?? 18;
    // ideal: Kochstart so dass Essen in 20 Min (Fahrer-ETA) fertig
    const idealCookStartMs = createdMs + (20 - prepMin) * 60_000;
    const secsVerspaetung = Math.round((now - idealCookStartMs) / 1000);
    let dringlichkeit: Dringlichkeit = 'ok';
    if (secsVerspaetung > 120) dringlichkeit = 'ueberfaellig';
    else if (secsVerspaetung > -30) dringlichkeit = 'jetzt';
    else if (secsVerspaetung > -300) dringlichkeit = 'bald';
    entries.push({ id: o.id, nr: o.bestellnummer ?? o.id.slice(-4), secsVerspaetung, prepMin, dringlichkeit });
  }
  const ORDER: Dringlichkeit[] = ['ueberfaellig', 'jetzt', 'bald', 'ok'];
  return entries.sort((a, b) => ORDER.indexOf(a.dringlichkeit) - ORDER.indexOf(b.dringlichkeit));
}

function fmtSecs(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  const sign = s >= 0 ? '+' : '-';
  return m > 0 ? `${sign}${m}m ${sec}s` : `${sign}${sec}s`;
}

export function KitchenPhase1180KochstartOptimierungsMatrix({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [matrix, setMatrix] = useState<MatrixEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setMatrix(computeMatrix(orders));
  }, [orders, tick]);

  const ueberfaelligCount = matrix.filter(e => e.dringlichkeit === 'ueberfaellig').length;
  const jetztCount = matrix.filter(e => e.dringlichkeit === 'jetzt').length;

  if (matrix.length === 0) return null;

  const headerColor = ueberfaelligCount > 0
    ? 'border-red-300 bg-red-50'
    : jetztCount > 0
    ? 'border-orange-300 bg-orange-50'
    : 'border-stone-200 bg-white';

  return (
    <div className={cn('rounded-2xl border', headerColor, 'overflow-hidden transition-colors')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Flame className={cn('h-4 w-4 shrink-0', ueberfaelligCount > 0 ? 'text-red-600 animate-pulse' : 'text-orange-500')} />
          <span className="text-sm font-bold text-stone-800">Kochstart-Matrix</span>
          <span className="text-xs text-stone-500">{matrix.length} Bestellungen</span>
          {ueberfaelligCount > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
              {ueberfaelligCount} überfällig
            </span>
          )}
          {jetztCount > 0 && ueberfaelligCount === 0 && (
            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-black text-white">
              {jetztCount} jetzt
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-stone-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {matrix.map(entry => {
            const cfg = DRING_CFG[entry.dringlichkeit];
            return (
              <div
                key={entry.id}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2',
                  cfg.bg,
                  entry.dringlichkeit === 'ueberfaellig' && 'animate-pulse',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                  <span className="text-sm font-bold text-stone-800 tabular-nums">#{entry.nr}</span>
                  <span className={cn('text-xs font-semibold', cfg.text)}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-500 tabular-nums">
                  <span className={cn('font-mono font-bold', cfg.text)}>
                    {fmtSecs(entry.secsVerspaetung)}
                  </span>
                  <span>{entry.prepMin}min Prep</span>
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-stone-400 pt-1">
            Kochstart-Ziel: Fertig wenn Fahrer eintrifft (Ø 20 Min ETA). Grün = genug Zeit. Rot = Kochstart überfällig.
          </p>
        </div>
      )}
    </div>
  );
}
