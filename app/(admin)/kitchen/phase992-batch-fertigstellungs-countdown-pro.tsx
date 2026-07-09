'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Package, Zap, ChevronDown, ChevronUp } from 'lucide-react';

/**
 * Phase 992 — Batch-Fertigstellungs-Countdown-Pro (Kitchen)
 *
 * Farbkodierter Batch-Countdown mit ETA-Ring je Bestellung
 * + Küchen-Kapazitäts-Ampel. Rein client-seitig.
 */

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  prep_time_minutes?: number | null;
  batch_id?: string | null;
}

interface Props {
  orders: Order[];
}

const AVG_PREP_MIN = 15;

function getSecondsLeft(order: Order, now: number): number {
  const created = order.created_at ? new Date(order.created_at).getTime() : now;
  const prepMs = (order.prep_time_minutes ?? AVG_PREP_MIN) * 60_000;
  const eta = created + prepMs;
  return Math.round((eta - now) / 1000);
}

function urgencyClass(sec: number): { ring: string; bg: string; text: string; label: string } {
  if (sec < 0) return { ring: 'stroke-red-500', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700', text: 'text-red-700 dark:text-red-300', label: 'Überfällig' };
  if (sec < 120) return { ring: 'stroke-red-500', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700', text: 'text-red-700 dark:text-red-300', label: 'Kritisch' };
  if (sec < 300) return { ring: 'stroke-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700', text: 'text-amber-700 dark:text-amber-300', label: 'Dringend' };
  return { ring: 'stroke-matcha-500', bg: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700', text: 'text-matcha-700 dark:text-matcha-300', label: 'Pünktlich' };
}

function formatSec(sec: number): string {
  if (sec < 0) return `-${Math.abs(Math.floor(sec / 60))}:${String(Math.abs(sec % 60)).padStart(2, '0')}`;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function EtaRing({ pct, urgency }: { pct: number; urgency: ReturnType<typeof urgencyClass> }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const dash = circ * Math.max(0, Math.min(1, pct));
  return (
    <svg width={40} height={40} viewBox="0 0 40 40" className="shrink-0">
      <circle cx={20} cy={20} r={r} fill="none" strokeWidth={3} className="stroke-muted" />
      <circle
        cx={20} cy={20} r={r} fill="none" strokeWidth={3}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 20 20)"
        className={urgency.ring}
      />
    </svg>
  );
}

export function KitchenPhase992BatchFertigstellungsCountdownPro({ orders }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = useMemo(() =>
    orders.filter(o => ['confirmed', 'preparing', 'ready'].includes(o.status)),
    [orders],
  );

  const withCountdown = useMemo(() =>
    active.map(o => {
      const sec = getSecondsLeft(o, now);
      const totalSec = (o.prep_time_minutes ?? AVG_PREP_MIN) * 60;
      const pct = Math.max(0, sec / totalSec);
      return { ...o, sec, pct, urgency: urgencyClass(sec) };
    }).sort((a, b) => a.sec - b.sec),
    [active, now],
  );

  const kritisch = withCountdown.filter(o => o.sec < 0 || o.sec < 120).length;
  const dringend = withCountdown.filter(o => o.sec >= 120 && o.sec < 300).length;

  const kapazitaet: { label: string; color: string; bg: string } =
    kritisch >= 3 ? { label: 'Überlastet', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-100 dark:bg-red-900/30' } :
    kritisch >= 1 || dringend >= 2 ? { label: 'Angespannt', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/30' } :
    { label: 'Entspannt', color: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-100 dark:bg-matcha-900/30' };

  if (withCountdown.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          <span className="font-bold text-sm">Batch-Countdown Pro</span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', kapazitaet.bg, kapazitaet.color)}>
            {kapazitaet.label}
          </span>
          {kritisch > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              {kritisch} kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{withCountdown.length} aktiv</span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {/* Kapazitäts-Ampel */}
          <div className="flex gap-2 flex-wrap text-[11px]">
            <div className="flex items-center gap-1 rounded-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              <span className="font-bold text-red-700 dark:text-red-300">{kritisch} kritisch</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
              <span className="font-bold text-amber-700 dark:text-amber-300">{dringend} dringend</span>
            </div>
            <div className="flex items-center gap-1 rounded-full bg-matcha-50 dark:bg-matcha-900/20 border border-matcha-200 dark:border-matcha-700 px-2 py-0.5">
              <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />
              <span className="font-bold text-matcha-700 dark:text-matcha-300">{withCountdown.length - kritisch - dringend} pünktlich</span>
            </div>
          </div>

          {/* Order cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
            {withCountdown.map(o => (
              <div
                key={o.id}
                className={cn('flex items-center gap-3 rounded-lg border p-2 transition', o.urgency.bg)}
              >
                <EtaRing pct={o.pct} urgency={o.urgency} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[10px] text-muted-foreground">#{o.id.slice(-4)}</span>
                    {o.sec < 0 && <Zap className="h-3 w-3 text-red-500 shrink-0" />}
                  </div>
                  <div className={cn('font-mono text-base font-black tabular-nums leading-none', o.urgency.text)}>
                    {formatSec(o.sec)}
                  </div>
                  <div className={cn('text-[10px] font-bold', o.urgency.text)}>
                    {o.urgency.label}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Clock className={cn('h-3.5 w-3.5', o.urgency.text)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
