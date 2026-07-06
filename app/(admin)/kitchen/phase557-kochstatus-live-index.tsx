'use client';

/**
 * Phase 557 — Kochstatus-Live-Index
 *
 * Kompakter Live-Index aller aktiven Bestellungen mit Farbkodierung nach Dringlichkeit:
 * - Kachel-Raster: jede Bestellung = eine farbige Kachel (rot/amber/grün/grau)
 * - Legende: Überfällig / Kritisch (<3 Min) / Auf Zeit / Wartet
 * - Zusammenfassung: Ø verbleibende Zeit, Anzahl je Status
 * - Echtzeit-Update jede Sekunde
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Clock, Flame, Timer } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name?: string | null;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

type Band = 'overdue' | 'critical' | 'ok' | 'waiting' | 'done';

const BAND_META: Record<Band, { bg: string; border: string; dot: string; label: string; icon: React.ReactNode }> = {
  overdue:  { bg: 'bg-red-500',    border: 'border-red-600',    dot: 'bg-red-500',    label: 'Überfällig',  icon: <AlertCircle className="h-3 w-3" /> },
  critical: { bg: 'bg-amber-400',  border: 'border-amber-500',  dot: 'bg-amber-400',  label: 'Kritisch',    icon: <Flame className="h-3 w-3" />       },
  ok:       { bg: 'bg-matcha-400', border: 'border-matcha-500', dot: 'bg-matcha-400', label: 'Auf Zeit',    icon: <CheckCircle2 className="h-3 w-3" /> },
  waiting:  { bg: 'bg-blue-400',   border: 'border-blue-500',   dot: 'bg-blue-400',   label: 'Wartet',      icon: <Clock className="h-3 w-3" />        },
  done:     { bg: 'bg-muted',      border: 'border-border',     dot: 'bg-muted',      label: 'Fertig',      icon: <Timer className="h-3 w-3" />        },
};

function computeBand(order: Order, timing: Timing | undefined, nowMs: number): { band: Band; remainSec: number | null } {
  if (['fertig', 'abgeholt', 'geliefert', 'unterwegs'].includes(order.status)) {
    return { band: 'done', remainSec: null };
  }

  if (timing?.ready_target) {
    const remain = Math.floor((new Date(timing.ready_target).getTime() - nowMs) / 1000);
    if (remain < 0)   return { band: 'overdue',  remainSec: remain };
    if (remain < 180) return { band: 'critical', remainSec: remain };
    return { band: 'ok', remainSec: remain };
  }

  if (['neu', 'bestätigt'].includes(order.status)) {
    return { band: 'waiting', remainSec: null };
  }

  if (order.bestellt_am) {
    const elapsed = Math.floor((nowMs - new Date(order.bestellt_am).getTime()) / 1000);
    const target  = (order.geschaetzte_zubereitung_min ?? 20) * 60;
    const remain  = target - elapsed;
    if (remain < 0)   return { band: 'overdue',  remainSec: remain };
    if (remain < 180) return { band: 'critical', remainSec: remain };
    return { band: 'ok', remainSec: remain };
  }

  return { band: 'waiting', remainSec: null };
}

function fmtSec(s: number): string {
  const abs = Math.abs(s);
  const m = Math.floor(abs / 60);
  const sec = abs % 60;
  return `${s < 0 ? '-' : ''}${m}:${String(sec).padStart(2, '0')}`;
}

export function KitchenPhase557KochstatusLiveIndex({ orders, timings }: Props) {
  const [nowMs, setNowMs] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  const active = useMemo(
    () => orders.filter(o => !['geliefert', 'storniert', 'abgeholt'].includes(o.status)),
    [orders],
  );

  const cells = useMemo(() => active.map(o => ({
    order: o,
    ...computeBand(o, timings.find(t => t.order_id === o.id), nowMs),
  })), [active, timings, nowMs]);

  const counts: Record<Band, number> = { overdue: 0, critical: 0, ok: 0, waiting: 0, done: 0 };
  for (const c of cells) counts[c.band]++;

  const avgRemain = (() => {
    const vals = cells.filter(c => c.remainSec != null && c.remainSec > 0).map(c => c.remainSec as number);
    if (!vals.length) return null;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  })();

  if (!active.length) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full animate-pulse', counts.overdue > 0 ? 'bg-red-500' : counts.critical > 0 ? 'bg-amber-400' : 'bg-matcha-400')} />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Kochstatus-Live-Index
          </span>
        </div>
        <div className="flex items-center gap-3">
          {avgRemain != null && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Ø {fmtSec(avgRemain)} verbleibend
            </span>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {active.length} aktiv
          </span>
        </div>
      </div>

      {/* Kachel-Raster */}
      <div className="p-3">
        <div className="flex flex-wrap gap-1.5">
          {cells.map(c => {
            const meta = BAND_META[c.band];
            return (
              <div
                key={c.order.id}
                title={`${c.order.bestellnummer}${c.order.kunde_name ? ' · ' + c.order.kunde_name : ''}`}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border px-2 py-1.5 min-w-[52px] cursor-default transition-all',
                  c.band === 'overdue' ? 'animate-pulse' : '',
                  c.band === 'done' ? 'opacity-40' : '',
                  meta.bg === 'bg-red-500' ? 'bg-red-500 border-red-600 text-white' :
                  meta.bg === 'bg-amber-400' ? 'bg-amber-400 border-amber-500 text-amber-950' :
                  meta.bg === 'bg-matcha-400' ? 'bg-matcha-100 border-matcha-300 text-matcha-800' :
                  meta.bg === 'bg-blue-400' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                  'bg-muted border-border text-muted-foreground',
                )}
              >
                <span className="text-[10px] font-black tabular-nums leading-none">
                  {c.order.bestellnummer.slice(-3)}
                </span>
                {c.remainSec != null && (
                  <span className="text-[9px] font-bold tabular-nums leading-none mt-0.5">
                    {fmtSec(c.remainSec)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legende + Zähler */}
      <div className="border-t px-4 py-2 flex flex-wrap gap-3">
        {(Object.entries(counts) as [Band, number][]).filter(([, n]) => n > 0).map(([band, n]) => {
          const meta = BAND_META[band];
          return (
            <div key={band} className="flex items-center gap-1">
              <div className={cn('h-2 w-2 rounded-full', meta.dot)} />
              <span className="text-[10px] text-muted-foreground">{meta.label} <strong className="text-foreground">{n}</strong></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
