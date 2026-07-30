'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Flame,
  TrendingUp, Zap,
} from 'lucide-react';

/**
 * Phase 1000 — Smart-Timing-Dashboard (Kitchen)
 *
 * Unified view: Echtzeit-Countdown pro Bestellung + Farbkodierung +
 * Schicht-Timing-Score. Sekunden-genauer Countdown; rot < 5 Min,
 * amber < 15 Min, grün ≥ 15 Min. Kompakt-Spalten-Layout für TV/Tablet.
 */

interface Order {
  id: string;
  status: string;
  bestellnummer?: string | null;
  created_at?: string | null;
  promised_at?: string | null;
  items?: Array<{ name?: string; title?: string }> | null;
  artikel?: Array<{ name?: string; title?: string }> | null;
  positionen?: Array<{ name?: string; title?: string }> | null;
}

interface Props {
  orders: Order[];
  timings?: unknown;
}

const ACTIVE_STATUSES = [
  'neu', 'bestätigt', 'eingegangen', 'accepted', 'confirmed',
  'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation',
];

function deadline(o: Order): number {
  if (o.promised_at) return new Date(o.promised_at).getTime();
  const base = o.created_at ? new Date(o.created_at).getTime() : Date.now();
  return base + 30 * 60_000;
}

function bnr(o: Order) {
  return o.bestellnummer ?? o.id.slice(-4).toUpperCase();
}

function itemLabel(o: Order) {
  const arr = o.items ?? o.artikel ?? o.positionen ?? [];
  return arr
    .slice(0, 2)
    .map((i: { name?: string; title?: string }) => i.name ?? i.title ?? '')
    .filter(Boolean)
    .join(' · ') || '—';
}

type Color = 'red' | 'amber' | 'green';

function calcColor(diffMs: number): Color {
  if (diffMs < 0 || diffMs < 5 * 60_000) return 'red';
  if (diffMs < 15 * 60_000) return 'amber';
  return 'green';
}

function fmt(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const m = Math.floor(abs / 60_000);
  const s = Math.floor((abs % 60_000) / 1_000);
  const base = `${m}:${String(s).padStart(2, '0')}`;
  return diffMs < 0 ? `+${base}` : base;
}

const COLORS: Record<Color, { dot: string; text: string; row: string; badge: string }> = {
  red:   { dot: 'bg-red-500 animate-pulse',   text: 'text-red-600 font-black',   row: 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',   badge: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' },
  amber: { dot: 'bg-amber-400',               text: 'text-amber-600 font-black', row: 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700' },
  green: { dot: 'bg-emerald-500',             text: 'text-emerald-700',          row: 'border-border bg-muted/10',                                           badge: 'bg-emerald-100 text-emerald-700' },
};

function shiftScore(orders: Order[], now: number): number {
  const active = orders.filter((o) => ACTIVE_STATUSES.includes(o.status));
  if (!active.length) return 100;
  const scores = active.map((o) => {
    const diff = deadline(o) - now;
    if (diff < 0) return 0;
    if (diff < 5 * 60_000) return 40;
    if (diff < 15 * 60_000) return 70;
    return 100;
  });
  return Math.round(scores.reduce((a: number, b) => a + b, 0 as number) / scores.length);
}

export function KitchenPhase1000SmartTimingDashboard({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    ivRef.current = setInterval(() => setNow(Date.now()), 1_000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  const rows = useMemo(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.includes(o.status))
      .map((o) => {
        const dl = deadline(o);
        const diff = dl - now;
        return { o, bnr: bnr(o), label: itemLabel(o), diff, color: calcColor(diff), fmt: fmt(diff) };
      })
      .sort((a, b) => a.diff - b.diff)
      .slice(0, 16);
  }, [orders, now]);

  const score = useMemo(() => shiftScore(orders, now), [orders, now]);
  const kritisch = rows.filter((r) => r.color === 'red').length;
  const dringend = rows.filter((r) => r.color === 'amber').length;
  const ok       = rows.filter((r) => r.color === 'green').length;

  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 55 ? 'text-amber-600' : 'text-red-600';
  const scoreBg    = score >= 80 ? 'bg-emerald-50 border-emerald-200' : score >= 55 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden" data-kitchen-phase="1000">
      {/* ── Header ── */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <Zap className="h-4 w-4 text-rose-600 shrink-0" />
        <span className="font-bold text-sm flex-1">Smart-Timing-Dashboard</span>

        {/* Score pill */}
        <span className={cn('text-xs font-black px-2 py-0.5 rounded-full border', scoreBg, scoreColor)}>
          Score {score}
        </span>

        {/* Status badges */}
        {kritisch > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 text-[10px] font-black animate-pulse">
            {kritisch} Kritisch
          </span>
        )}
        {dringend > 0 && (
          <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[10px] font-black">
            {dringend} Dringend
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t">
          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-4 divide-x text-center text-xs py-2 bg-muted/20">
            <div className="px-3 py-1">
              <div className={cn('text-xl font-black tabular-nums', scoreColor)}>{score}</div>
              <div className="text-muted-foreground leading-none mt-0.5">Timing-Score</div>
            </div>
            <div className="px-3 py-1">
              <div className="text-xl font-black tabular-nums text-red-600">{kritisch}</div>
              <div className="text-muted-foreground leading-none mt-0.5">Kritisch</div>
            </div>
            <div className="px-3 py-1">
              <div className="text-xl font-black tabular-nums text-amber-600">{dringend}</div>
              <div className="text-muted-foreground leading-none mt-0.5">Dringend</div>
            </div>
            <div className="px-3 py-1">
              <div className="text-xl font-black tabular-nums text-emerald-600">{ok}</div>
              <div className="text-muted-foreground leading-none mt-0.5">Im Plan</div>
            </div>
          </div>

          {/* ── Legend ── */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-4 py-2 border-t border-b bg-muted/10">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;5 Min / überfällig</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> &lt;15 Min</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥15 Min</span>
          </div>

          {/* ── Order Rows ── */}
          <div className="p-3 space-y-1.5">
            {rows.map(({ o, bnr: nr, label, diff, color, fmt: fmtStr }) => {
              const cm = COLORS[color];
              const overdue = diff < 0;
              return (
                <div
                  key={o.id}
                  className={cn('rounded-xl border px-3 py-2 flex items-center gap-3', cm.row)}
                >
                  <span className={cn('shrink-0 w-2.5 h-2.5 rounded-full', cm.dot)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black">#{nr}</span>
                      {overdue && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                      {!overdue && color === 'green' && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                      {!overdue && color === 'amber' && <Flame className="h-3 w-3 text-amber-500 shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{label}</div>
                  </div>
                  <div className={cn('text-base tabular-nums shrink-0', cm.text, overdue && 'animate-pulse')}>
                    {fmtStr}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-4 pb-3 text-[10px] text-muted-foreground border-t pt-2">
            <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Schicht-Timing-Score: <strong className={scoreColor}>{score}/100</strong></span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Live · 1-Sek-Update · {rows.length} aktiv</span>
          </div>
        </div>
      )}
    </div>
  );
}
