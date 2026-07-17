'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, Flame, Target, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 2086 — Smart-Timing-Live-Cockpit-Pro (Kitchen)
 *
 * Kombiniert Countdown-Kacheln + Farbkodierung + Timing-Score auf einer Fläche.
 * - Alle aktiven Bestellungen als Kacheln (1 Sek Refresh)
 * - Ampelfarben: grün >8 Min, gelb 4–8 Min, orange 1–4 Min, rot überfällig
 * - Timing-Score oben: % Bestellungen im grünen Bereich
 * - Sortierung: überfällig zuerst
 */

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  ready_target?: string | null;
}

type Level = 'ok' | 'warn' | 'urgent' | 'overdue';

function getRemainSec(order: Order): number | null {
  const target = order.ready_target
    ? new Date(order.ready_target).getTime()
    : order.bestellt_am && order.geschaetzte_zubereitung_min != null
    ? new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000
    : null;
  if (!target) return null;
  return Math.floor((target - Date.now()) / 1000);
}

function level(sec: number | null): Level {
  if (sec === null) return 'ok';
  if (sec <= 0) return 'overdue';
  if (sec <= 4 * 60) return 'urgent';
  if (sec <= 8 * 60) return 'warn';
  return 'ok';
}

function fmtCountdown(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const str = `${m}:${String(s).padStart(2, '0')}`;
  return sec < 0 ? `-${str}` : str;
}

const LEVEL_STYLE: Record<Level, { bg: string; border: string; text: string; dot: string; pulse: boolean }> = {
  ok:      { bg: 'bg-matcha-50',  border: 'border-matcha-200',  text: 'text-matcha-700',  dot: 'bg-matcha-500',  pulse: false },
  warn:    { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   dot: 'bg-amber-400',   pulse: false },
  urgent:  { bg: 'bg-orange-50',  border: 'border-orange-300',  text: 'text-orange-700',  dot: 'bg-orange-500',  pulse: false },
  overdue: { bg: 'bg-red-50',     border: 'border-red-400',     text: 'text-red-700',     dot: 'bg-red-600',     pulse: true  },
};

const STATUS_LABEL: Record<string, string> = {
  neu: 'Neu', in_zubereitung: 'Kocht', fertig: 'Fertig',
};

const ACTIVE_STATUS = new Set(['neu', 'in_zubereitung']);

interface Props {
  orders: Order[];
}

export function KitchenPhase2086SmartTimingLiveCockpitPro({ orders }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const cards = useMemo(() => {
    return orders
      .filter((o) => ACTIVE_STATUS.has(o.status))
      .map((o) => {
        const sec = getRemainSec(o);
        return { order: o, sec, lv: level(sec) };
      })
      .sort((a, b) => {
        const order: Level[] = ['overdue', 'urgent', 'warn', 'ok'];
        const ai = order.indexOf(a.lv);
        const bi = order.indexOf(b.lv);
        if (ai !== bi) return ai - bi;
        const as = a.sec ?? 9999;
        const bs = b.sec ?? 9999;
        return as - bs;
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const total = cards.length;
  const okCount = cards.filter((c) => c.lv === 'ok').length;
  const timingScore = total > 0 ? Math.round((okCount / total) * 100) : 100;
  const overdueCount = cards.filter((c) => c.lv === 'overdue').length;
  const urgentCount  = cards.filter((c) => c.lv === 'urgent').length;

  const scoreColor =
    timingScore >= 80 ? 'text-matcha-700' :
    timingScore >= 50 ? 'text-amber-600' :
    'text-red-600';

  if (total === 0) return null;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Target className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Smart-Timing-Cockpit Pro</span>

        {/* Badges */}
        {overdueCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
            {overdueCount}× überfällig
          </span>
        )}
        {urgentCount > 0 && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[9px] font-black">
            {urgentCount}× dringend
          </span>
        )}

        {/* Timing Score */}
        <span className={cn('ml-auto font-mono text-sm font-black tabular-nums', scoreColor)}>
          {timingScore}%
        </span>
        <span className="text-[10px] text-muted-foreground">Score</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Score Bar */}
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  timingScore >= 80 ? 'bg-matcha-500' : timingScore >= 50 ? 'bg-amber-400' : 'bg-red-500',
                )}
                style={{ width: `${timingScore}%` }}
              />
            </div>
            <span className={cn('font-mono text-xs font-bold tabular-nums', scoreColor)}>{timingScore}%</span>
          </div>

          {/* Kacheln */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {cards.map(({ order, sec, lv }) => {
              const s = LEVEL_STYLE[lv];
              return (
                <div
                  key={order.id}
                  className={cn(
                    'flex flex-col items-center rounded-xl border px-2 py-2.5 gap-1',
                    s.bg, s.border,
                    s.pulse && 'animate-pulse',
                  )}
                >
                  <div className={cn('h-2 w-2 rounded-full', s.dot)} />
                  <span className="font-mono text-[11px] font-black text-foreground">
                    #{order.bestellnummer.slice(-4)}
                  </span>
                  <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[8px] font-bold text-foreground/70">
                    {STATUS_LABEL[order.status] ?? order.status}
                  </span>
                  {sec !== null ? (
                    <span className={cn('font-mono text-sm font-black tabular-nums leading-none', s.text)}>
                      {fmtCountdown(sec)}
                    </span>
                  ) : (
                    <span className="text-[9px] text-muted-foreground">–:–</span>
                  )}
                  {lv === 'overdue' && <Flame className="h-3 w-3 text-red-500" />}
                  {lv === 'urgent' && <Zap className="h-3 w-3 text-orange-500" />}
                  {lv === 'ok' && <Clock className="h-3 w-3 text-matcha-500" />}
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 flex-wrap border-t pt-2">
            {[
              { dot: 'bg-matcha-500', label: '>8 Min — OK' },
              { dot: 'bg-amber-400',  label: '4–8 Min — Aufmerksam' },
              { dot: 'bg-orange-500', label: '1–4 Min — Dringend' },
              { dot: 'bg-red-600',    label: 'Überfällig' },
            ].map(({ dot, label }) => (
              <div key={label} className="flex items-center gap-1">
                <div className={cn('h-2 w-2 rounded-full', dot)} />
                <span className="text-[9px] text-muted-foreground">{label}</span>
              </div>
            ))}
            <span className="ml-auto text-[9px] text-muted-foreground">{total} aktiv · 1s-Refresh</span>
          </div>
        </div>
      )}
    </div>
  );
}
