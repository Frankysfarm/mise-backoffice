'use client';

/**
 * Phase 1893 — Smart-Timing-Countdown-Farbkodierung-Ultra (Kitchen)
 *
 * Live-Countdown je aktiver Bestellung mit 4-stufiger Farbkodierung:
 *   grün  = >8 Min verbleibend   (ok)
 *   gelb  = 4–8 Min              (achtung)
 *   orange = 1–4 Min             (dringend)
 *   rot   = <1 Min / überfällig  (kritisch)
 *
 * Sortierung: Dringendste zuerst. Ticker: 5 Sek. Collapsible.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, ChevronDown, ChevronUp, Flame, Clock } from 'lucide-react';

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  prep_time_min?: number | null;
  kochstart_at?: string | null;
  estimated_pickup_at?: string | null;
}

interface Props {
  orders: Order[];
  className?: string;
}

type Stufe = 'ok' | 'achtung' | 'dringend' | 'kritisch';

const STUFE_META: Record<Stufe, { label: string; bg: string; border: string; text: string; badge: string; dot: string }> = {
  ok:       { label: 'OK',       bg: 'bg-matcha-50 dark:bg-matcha-950/30',   border: 'border-matcha-200 dark:border-matcha-800',   text: 'text-matcha-700 dark:text-matcha-300',   badge: 'bg-matcha-500 text-white',           dot: 'bg-matcha-500' },
  achtung:  { label: 'Achtung',  bg: 'bg-amber-50 dark:bg-amber-950/30',     border: 'border-amber-200 dark:border-amber-800',     text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-400 text-white',            dot: 'bg-amber-400' },
  dringend: { label: 'Dringend', bg: 'bg-orange-50 dark:bg-orange-950/30',   border: 'border-orange-200 dark:border-orange-800',   text: 'text-orange-700 dark:text-orange-300',   badge: 'bg-orange-500 text-white',           dot: 'bg-orange-500' },
  kritisch: { label: 'Kritisch', bg: 'bg-red-50 dark:bg-red-950/30',         border: 'border-red-200 dark:border-red-800',         text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-500 text-white animate-pulse', dot: 'bg-red-500' },
};

const ACTIVE_STATI = new Set(['neu', 'angenommen', 'in_zubereitung', 'bereit', 'confirmed', 'preparing', 'ready']);

function verbleibendeMinuten(order: Order, now: number): number {
  // Ziel: estimated_pickup_at oder kochstart_at + prep_time_min oder created_at + 25 Min fallback
  if (order.estimated_pickup_at) {
    return (new Date(order.estimated_pickup_at).getTime() - now) / 60_000;
  }
  if (order.kochstart_at && order.prep_time_min) {
    return (new Date(order.kochstart_at).getTime() + order.prep_time_min * 60_000 - now) / 60_000;
  }
  if (order.created_at) {
    return (new Date(order.created_at).getTime() + 25 * 60_000 - now) / 60_000;
  }
  return 10;
}

function toStufe(minLeft: number): Stufe {
  if (minLeft < 1)  return 'kritisch';
  if (minLeft < 4)  return 'dringend';
  if (minLeft < 8)  return 'achtung';
  return 'ok';
}

function fmtCountdown(min: number): string {
  if (min <= 0) return '00:00';
  const m = Math.floor(min);
  const s = Math.floor((min - m) * 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1893SmartTimingCountdownFarbkodierungUltra({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);
  const tickRef = useRef(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 5_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => ACTIVE_STATI.has(o.status ?? ''))
      .map((o) => {
        const minLeft = verbleibendeMinuten(o, now);
        return { id: o.id, minLeft, stufe: toStufe(minLeft) };
      })
      .sort((a, b) => a.minLeft - b.minLeft);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tickRef.current]);

  const counts: Record<Stufe, number> = { ok: 0, achtung: 0, dringend: 0, kritisch: 0 };
  rows.forEach((r) => counts[r.stufe]++);
  const kritischAnzahl = counts.kritisch + counts.dringend;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <AlarmClock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing · Countdown-Farbkodierung</span>
        {kritischAnzahl > 0 && (
          <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            {kritischAnzahl} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} aktiv</span>
        {offen
          ? <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Stufen-Übersicht */}
          <div className="grid grid-cols-4 gap-2">
            {(Object.entries(counts) as [Stufe, number][]).map(([stufe, n]) => {
              const m = STUFE_META[stufe];
              return (
                <div key={stufe} className={cn('rounded-xl border px-2 py-2 text-center', m.bg, m.border)}>
                  <div className={cn('text-lg font-black tabular-nums', m.text)}>{n}</div>
                  <div className="text-[9px] font-semibold text-muted-foreground uppercase">{m.label}</div>
                </div>
              );
            })}
          </div>

          {/* Bestellungs-Liste */}
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-3">Keine aktiven Bestellungen</div>
          ) : (
            <div className="space-y-2">
              {rows.map((row) => {
                const m = STUFE_META[row.stufe];
                return (
                  <div
                    key={row.id}
                    className={cn('flex items-center gap-3 rounded-xl border px-3 py-2.5', m.bg, m.border)}
                  >
                    <div className={cn('h-2 w-2 rounded-full shrink-0', m.dot)} />
                    <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
                      #{row.id.slice(-6).toUpperCase()}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black shrink-0', m.badge)}>
                      {m.label}
                    </span>
                    <div className={cn('flex items-center gap-1 tabular-nums font-black text-sm shrink-0', m.text)}>
                      {row.minLeft <= 0
                        ? <Flame className="h-3.5 w-3.5" />
                        : <Clock className="h-3.5 w-3.5 opacity-60" />}
                      {row.minLeft <= 0 ? 'Überfällig' : fmtCountdown(row.minLeft)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-right">Ticker: 5 Sek · Sortiert nach Dringlichkeit</p>
        </div>
      )}
    </div>
  );
}
