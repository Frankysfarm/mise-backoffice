'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, Clock, Flame, AlertTriangle, Zap } from 'lucide-react';

/**
 * Phase 1647 — Smart-Kochstart-Timing-Hub (Kitchen)
 *
 * Unified command center: 5-Stufen-Farbkodierung + Sekunden-Countdown +
 * optimaler Kochstart je aktiver Bestellung. Automatische Sortierung nach
 * Dringlichkeit. 1s-Ticker.
 */

interface Order {
  id: string;
  bestellnummer?: string;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  items?: Array<{ name?: string }> | null;
}

interface Props {
  orders: Order[];
}

type Stufe = 'pünktlich' | 'bald' | 'dringend' | 'kritisch' | 'überfällig';

function calcStufe(secs: number): Stufe {
  if (secs > 300) return 'pünktlich';
  if (secs > 120) return 'bald';
  if (secs > 0) return 'dringend';
  if (secs > -120) return 'kritisch';
  return 'überfällig';
}

const STUFE_STYLE: Record<Stufe, { bg: string; badge: string; bar: string; label: string }> = {
  pünktlich:  { bg: 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-200 dark:border-matcha-700', badge: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 border-matcha-300', bar: 'bg-matcha-500', label: 'Pünktlich' },
  bald:       { bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700', badge: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 border-yellow-300', bar: 'bg-yellow-400', label: 'Bald fällig' },
  dringend:   { bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-300', bar: 'bg-orange-500', label: 'Dringend' },
  kritisch:   { bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700', badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border-red-300', bar: 'bg-red-500', label: 'Kritisch' },
  überfällig: { bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700', badge: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border-purple-300', bar: 'bg-purple-600', label: 'Überfällig' },
};

function fmtCountdown(secs: number): string {
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const sign = secs < 0 ? '+' : '';
  return `${sign}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1647SmartKochstartTimingHub({ orders }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const rows = useMemo(() => {
    const active = orders.filter(o =>
      ['neu', 'bestätigt', 'confirmed', 'in_preparation', 'preparing'].includes(o.status)
    );
    const now = Date.now();
    return active.map(o => {
      const bestelltMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
      const prepMin = o.geschaetzte_zubereitung_min ?? 15;
      const targetMs = bestelltMs + prepMin * 60_000;
      const secs = Math.round((targetMs - now) / 1000);
      const pct = Math.min(100, Math.max(0, ((now - bestelltMs) / (prepMin * 60_000)) * 100));
      const stufe = calcStufe(secs);
      const kochstartEmpfehlung = secs > prepMin * 30 ? 'Noch Zeit' : secs > 0 ? 'Jetzt starten!' : 'Sofort!';
      return { o, secs, pct, stufe, kochstartEmpfehlung, prepMin };
    }).sort((a, b) => a.secs - b.secs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, tick]);

  const kritischCount = rows.filter(r => r.stufe === 'kritisch' || r.stufe === 'überfällig').length;
  const dringendCount = rows.filter(r => r.stufe === 'dringend').length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-semibold">Smart-Kochstart-Hub</span>
          {kritischCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {kritischCount}× Kritisch
            </span>
          )}
          {kritischCount === 0 && dringendCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 border border-orange-300 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:text-orange-300">
              <Flame className="h-3 w-3" />
              {dringendCount}× Dringend
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{rows.length} aktiv</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {rows.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">Keine aktiven Bestellungen.</p>
          )}
          {rows.map(({ o, secs, pct, stufe, kochstartEmpfehlung, prepMin }) => {
            const style = STUFE_STYLE[stufe];
            return (
              <div key={o.id} className={cn('rounded-lg border p-3 space-y-1.5', style.bg)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold truncate">#{o.bestellnummer ?? o.id.slice(0, 6)}</span>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[9px] font-bold shrink-0', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="font-mono text-sm font-black tabular-nums text-foreground">
                      {fmtCountdown(secs)}
                    </div>
                    {kochstartEmpfehlung !== 'Noch Zeit' && (
                      <span className="flex items-center gap-0.5 rounded bg-red-600 text-white px-1.5 py-0.5 text-[9px] font-bold animate-pulse">
                        <Zap className="h-2.5 w-2.5" />
                        {kochstartEmpfehlung}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-1000', style.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{prepMin} Min Ziel</span>
                  <span>{Math.round(pct)}% vergangen</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
