'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Timer, ChevronDown, ChevronUp, AlertTriangle, Zap } from 'lucide-react';

/**
 * Phase 1001 — Smart-Timing-Farbkodierung Pro (Kitchen)
 *
 * Farbkodiertes Countdown-Grid für alle aktiven Bestellungen:
 * Grün (>10 Min) → Gelb (5–10 Min) → Rot (<5 Min) → Schwarz (überfällig).
 * Zeigt Bestellnummer, vergangene Zeit und Deadline-Status.
 * Rein client-seitig, kein API-Aufruf.
 */

interface Order {
  id: string;
  bestellnummer?: string | number;
  status: string;
  bestellt_am?: string | null;
  voraussichtliche_fertigstellung?: string | null;
  estimated_prep_minutes?: number | null;
}

interface Props {
  orders: Order[];
}

type UrgencyLevel = 'ok' | 'bald' | 'kritisch' | 'ueberfaellig';

interface PrepRow {
  id: string;
  nr: string;
  elapsedMin: number;
  remainMin: number | null;
  urgency: UrgencyLevel;
}

const URGENCY: Record<UrgencyLevel, { bg: string; border: string; text: string; ringColor: string; label: string; pulse: boolean }> = {
  ok:          { bg: 'bg-matcha-50 dark:bg-matcha-950/30',  border: 'border-matcha-200 dark:border-matcha-700', text: 'text-matcha-700 dark:text-matcha-300', ringColor: 'stroke-matcha-500', label: 'OK',         pulse: false },
  bald:        { bg: 'bg-amber-50 dark:bg-amber-950/30',    border: 'border-amber-200 dark:border-amber-700',   text: 'text-amber-700 dark:text-amber-300',   ringColor: 'stroke-amber-500',   label: 'Bald',       pulse: false },
  kritisch:    { bg: 'bg-red-50 dark:bg-red-950/30',        border: 'border-red-200 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',       ringColor: 'stroke-red-500',     label: 'Kritisch',   pulse: true  },
  ueberfaellig:{ bg: 'bg-zinc-900 dark:bg-zinc-950',        border: 'border-zinc-700',                          text: 'text-white',                            ringColor: 'stroke-zinc-400',    label: 'Überfällig', pulse: true  },
};

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'confirmed', 'in_preparation', 'preparing', 'angenommen']);
const DEFAULT_PREP_MIN = 18;
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function calcUrgency(remainMin: number | null): UrgencyLevel {
  if (remainMin === null) return 'ok';
  if (remainMin < 0) return 'ueberfaellig';
  if (remainMin < 5) return 'kritisch';
  if (remainMin < 10) return 'bald';
  return 'ok';
}

function CountdownRing({ remainMin, urgency }: { remainMin: number | null; urgency: UrgencyLevel }) {
  const u = URGENCY[urgency];
  const totalMin = DEFAULT_PREP_MIN;
  const progress = remainMin !== null
    ? Math.max(0, Math.min(1, remainMin / totalMin))
    : 0.5;
  const dash = CIRCUMFERENCE * (1 - progress);

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90">
      <circle cx="28" cy="28" r={RADIUS} strokeWidth="4" className="stroke-muted" fill="none" />
      <circle
        cx="28" cy="28" r={RADIUS}
        strokeWidth="4" fill="none"
        className={cn('transition-all duration-1000', u.ringColor)}
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dash}
        strokeLinecap="round"
      />
      <text
        x="28" y="28"
        textAnchor="middle"
        dominantBaseline="middle"
        className={cn('rotate-90', u.text)}
        style={{ fontSize: 11, fontWeight: 800, fill: 'currentColor', transform: 'rotate(90deg)', transformOrigin: '28px 28px' }}
      >
        {remainMin !== null
          ? (remainMin < 0 ? `+${Math.abs(Math.round(remainMin))}` : Math.round(remainMin))
          : '?'}
      </text>
    </svg>
  );
}

export function KitchenPhase1001SmartTimingFarbkodierungPro({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo<PrepRow[]>(() => {
    return orders
      .filter(o => ACTIVE_STATUSES.has(o.status))
      .map(o => {
        const startMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now - 600_000;
        const elapsedMin = Math.max(0, (now - startMs) / 60_000);
        const prepMin = o.estimated_prep_minutes ?? DEFAULT_PREP_MIN;

        let remainMin: number | null = null;
        if (o.voraussichtliche_fertigstellung) {
          remainMin = (new Date(o.voraussichtliche_fertigstellung).getTime() - now) / 60_000;
        } else {
          remainMin = prepMin - elapsedMin;
        }

        return {
          id: o.id,
          nr: String(o.bestellnummer ?? o.id.slice(-4)),
          elapsedMin,
          remainMin,
          urgency: calcUrgency(remainMin),
        };
      })
      .sort((a, b) => {
        const order: UrgencyLevel[] = ['ueberfaellig', 'kritisch', 'bald', 'ok'];
        return order.indexOf(a.urgency) - order.indexOf(b.urgency);
      });
  }, [orders, now]);

  const kritischCount = rows.filter(r => r.urgency === 'kritisch' || r.urgency === 'ueberfaellig').length;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-semibold">Smart-Timing Pro</span>
          {kritischCount > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {kritischCount}× Kritisch
            </span>
          )}
          <span className="ml-auto text-[9px] text-muted-foreground">{rows.length} aktiv</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(row => {
            const u = URGENCY[row.urgency];
            return (
              <div
                key={row.id}
                className={cn(
                  'rounded-xl border p-3 flex flex-col items-center gap-2',
                  u.bg, u.border,
                  u.pulse && 'animate-pulse',
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wider', u.text)}>
                    #{row.nr}
                  </span>
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold border',
                    u.bg, u.border, u.text,
                  )}>
                    {u.label}
                  </span>
                </div>
                <CountdownRing remainMin={row.remainMin} urgency={row.urgency} />
                <div className="text-[10px] text-muted-foreground">
                  {Math.round(row.elapsedMin)} Min vergangen
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
