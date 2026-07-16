'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1827 — Live-Bestelleingang-Prognose (Kitchen)
 *
 * Balken: Bestelleingang je 30-Min-Slot der nächsten 4 Stunden,
 * basierend auf tatsächlichem Verlauf der heutigen Stunden.
 * Alert wenn Hochlast-Slot erwartet (>5 Bestellungen); useMemo; Collapsible.
 */

interface OrderItem {
  [key: string]: unknown;
}

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  accepted_at?: string;
  [key: string]: unknown;
}

interface Props {
  orders: Order[];
  hochlastSchwelle?: number;
  className?: string;
}

interface Slot {
  label: string;
  stunde: number;
  minute: 0 | 30;
  prognose: number;
  hochlast: boolean;
}

function slotKey(h: number, m: 0 | 30): string {
  return `${h.toString().padStart(2, '0')}:${m === 0 ? '00' : '30'}`;
}

export function KitchenPhase1827LiveBestelleingangPrognose({
  orders,
  hochlastSchwelle = 5,
  className,
}: Props) {
  const [offen, setOffen] = useState(true);

  const slots = useMemo<Slot[]>(() => {
    const jetzt = new Date();
    const jetztH = jetzt.getHours();
    const jetztM = jetzt.getMinutes();

    // Verlaufsdaten: Bestellungen aus der letzten Woche je Wochentag+Slot
    const schluessel = (o: Order): string | null => {
      const raw = o.created_at ?? o.createdAt ?? o.accepted_at;
      if (!raw || typeof raw !== 'string') return null;
      const d = new Date(raw);
      return slotKey(d.getHours(), (d.getMinutes() < 30 ? 0 : 30));
    };

    // Zähle heutige Bestellungen je Slot als Basis
    const heutigeSlots = new Map<string, number>();
    for (const o of orders) {
      const k = schluessel(o);
      if (k) heutigeSlots.set(k, (heutigeSlots.get(k) ?? 0) + 1);
    }

    // Berechne Durchschnitt der letzten 4 bekannten Stunden als Trend-Baseline
    const bisJetzt: number[] = [];
    for (let h = Math.max(0, jetztH - 3); h <= jetztH; h++) {
      for (const m of [0, 30] as const) {
        if (h === jetztH && m > jetztM) break;
        bisJetzt.push(heutigeSlots.get(slotKey(h, m)) ?? 0);
      }
    }
    const baseline = bisJetzt.length > 0
      ? bisJetzt.reduce((a, b) => a + b, 0) / bisJetzt.length
      : 2;

    // Generiere nächste 8 Slots (4 Stunden)
    const result: Slot[] = [];
    let h = jetztH;
    let m: 0 | 30 = jetztM < 30 ? 30 : 0;
    if (m === 0) h += 1;

    for (let i = 0; i < 8; i++) {
      if (h >= 24) break;
      // Typisches Tages-Profil: Mittagspeak ~12-13h, Abendpeak ~18-20h
      const stundenfaktor = (() => {
        if (h >= 11 && h <= 13) return 1.4;
        if (h >= 17 && h <= 20) return 1.6;
        if (h >= 21 && h <= 22) return 1.1;
        if (h >= 14 && h <= 16) return 0.8;
        return 0.7;
      })();
      const prognose = Math.round(baseline * stundenfaktor);
      result.push({
        label: slotKey(h, m),
        stunde: h,
        minute: m,
        prognose,
        hochlast: prognose >= hochlastSchwelle,
      });
      // nächster Slot
      if (m === 0) { m = 30; }
      else { m = 0; h += 1; }
    }
    return result;
  }, [orders, hochlastSchwelle]);

  const hatHochlast = slots.some((s) => s.hochlast);
  const maxPrognose = Math.max(1, ...slots.map((s) => s.prognose));

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Bestelleingang-Prognose
          </span>
          {hatHochlast && (
            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5">
              Hochlast erwartet
            </span>
          )}
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          {hatHochlast && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Hochlast-Slot erwartet — Küche vorbereiten!
              </p>
            </div>
          )}

          {!hatHochlast && (
            <div className="flex items-center gap-2 text-matcha-600 dark:text-matcha-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs">Keine Hochlast in den nächsten 4 Stunden erwartet.</span>
            </div>
          )}

          <div className="space-y-1.5">
            {slots.map((slot) => (
              <div key={slot.label} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
                  {slot.label}
                </span>
                <div className="flex-1 h-5 rounded bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded transition-all duration-500',
                      slot.hochlast
                        ? 'bg-amber-400 dark:bg-amber-500'
                        : 'bg-matcha-400 dark:bg-matcha-500',
                    )}
                    style={{ width: `${Math.round((slot.prognose / maxPrognose) * 100)}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'w-6 shrink-0 text-right text-[11px] font-bold tabular-nums',
                    slot.hochlast
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-zinc-600 dark:text-zinc-400',
                  )}
                >
                  {slot.prognose}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Prognose basiert auf heutigem Verlauf × Tages-Profil · Schwelle: {hochlastSchwelle} Bestellungen/Slot
          </p>
        </div>
      )}
    </div>
  );
}
