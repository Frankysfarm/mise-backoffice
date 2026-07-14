'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlarmClock, ChefHat, CheckCircle2, Flame, Loader2, TrendingUp, Zap } from 'lucide-react';

// Phase 1505 — Smart-Timing-Cockpit-Ultra
// Kombiniert Countdown + dynamische Farbkodierung für alle aktiven Bestellungen:
// Grün (>8 Min) → Gelb (4-8 Min) → Orange (0-4 Min) → Rot (überfällig)
// Sortiert nach Dringlichkeit, zeigt Kochempfehlung + Schicht-Timing-Score.

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  bestellt_am?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  typ?: string | null;
  items?: { name: string; menge: number }[];
  kunde_name?: string | null;
}

interface Props {
  orders: Order[];
}

type Stufe = 'ok' | 'bald' | 'dringend' | 'kritisch';

const STUFE_CONFIG: Record<Stufe, {
  bg: string; border: string; badgeBg: string; badgeText: string;
  countdownColor: string; label: string; pulse: boolean;
}> = {
  ok:       { bg: 'bg-emerald-50',  border: 'border-emerald-200', badgeBg: 'bg-emerald-500',  badgeText: 'text-white', countdownColor: 'text-emerald-700', label: 'OK',         pulse: false },
  bald:     { bg: 'bg-yellow-50',   border: 'border-yellow-300',  badgeBg: 'bg-yellow-400',   badgeText: 'text-white', countdownColor: 'text-yellow-700',  label: 'Bald fällig', pulse: false },
  dringend: { bg: 'bg-orange-50',   border: 'border-orange-400',  badgeBg: 'bg-orange-500',   badgeText: 'text-white', countdownColor: 'text-orange-700',  label: 'Jetzt!',      pulse: true  },
  kritisch: { bg: 'bg-red-50',      border: 'border-red-500',     badgeBg: 'bg-red-600',      badgeText: 'text-white', countdownColor: 'text-red-700',     label: 'Überfällig',  pulse: true  },
};

function classifyStufe(restSek: number): Stufe {
  if (restSek > 8 * 60)  return 'ok';
  if (restSek > 4 * 60)  return 'bald';
  if (restSek >= 0)      return 'dringend';
  return 'kritisch';
}

function formatCd(sek: number): string {
  const neg = sek < 0;
  const abs = Math.abs(sek);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${neg ? '−' : ''}${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenPhase1505SmartTimingCockpitUltra({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const processed = useMemo(() => {
    const now = Date.now();
    return orders
      .filter((o) => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status))
      .map((o) => {
        const bestelltMs = o.bestellt_am ? new Date(o.bestellt_am).getTime() : now;
        const prepMin = o.geschaetzte_zubereitung_min ?? 15;
        const zielMs = bestelltMs + prepMin * 60_000;
        const restSek = Math.round((zielMs - now) / 1000);
        const stufe = classifyStufe(restSek);
        const prepPct = Math.min(100, Math.max(0, ((now - bestelltMs) / (prepMin * 60_000)) * 100));
        return { ...o, restSek, stufe, prepPct, prepMin };
      })
      .sort((a, b) => a.restSek - b.restSek);
  }, [orders]);

  const kritischCount   = processed.filter((o) => o.stufe === 'kritisch').length;
  const dringendCount   = processed.filter((o) => o.stufe === 'dringend').length;
  const timingScore = processed.length === 0 ? 100
    : Math.round(100 - (kritischCount * 25 + dringendCount * 10) / Math.max(1, processed.length) * 100);

  if (processed.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white">
        <AlarmClock className="w-4 h-4 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest">
          Smart-Timing Cockpit
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-stone-400">Score</span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
            timingScore >= 80 ? 'bg-emerald-500' : timingScore >= 60 ? 'bg-yellow-400 text-stone-900' : 'bg-red-500',
          )}>
            {timingScore}
          </span>
        </div>
      </div>

      {/* Summary strip */}
      {(kritischCount > 0 || dringendCount > 0) && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-2 text-[11px] font-bold',
          kritischCount > 0 ? 'bg-red-600 text-white' : 'bg-orange-500 text-white',
        )}>
          <Flame className="w-3.5 h-3.5 animate-pulse shrink-0" />
          {kritischCount > 0 && <span>{kritischCount} überfällig</span>}
          {dringendCount > 0 && <span>{dringendCount} dringend</span>}
        </div>
      )}

      {/* Order grid */}
      <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-4">
        {processed.map((o) => {
          const cfg = STUFE_CONFIG[o.stufe];
          return (
            <div
              key={o.id}
              className={cn(
                'rounded-xl border-2 p-3 flex flex-col gap-1.5 transition-all duration-300',
                cfg.bg, cfg.border,
                cfg.pulse && 'animate-pulse',
              )}
            >
              {/* Bestellnummer + Status badge */}
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-wider text-stone-500">
                  #{o.bestellnummer ?? o.id.slice(-4).toUpperCase()}
                </span>
                <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-black', cfg.badgeBg, cfg.badgeText)}>
                  {cfg.label}
                </span>
              </div>

              {/* Countdown */}
              <div className={cn('text-2xl font-black tabular-nums leading-none tracking-tight', cfg.countdownColor)}>
                {formatCd(o.restSek)}
              </div>

              {/* Prep progress bar */}
              <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000',
                    o.stufe === 'ok' ? 'bg-emerald-400' :
                    o.stufe === 'bald' ? 'bg-yellow-400' :
                    o.stufe === 'dringend' ? 'bg-orange-500' : 'bg-red-600',
                  )}
                  style={{ width: `${o.prepPct}%` }}
                />
              </div>

              {/* Customer / type */}
              <div className="text-[9px] text-stone-500 truncate">
                {o.kunde_name ?? (o.typ === 'abholung' ? 'Abholung' : 'Lieferung')}
                {' · '}{o.prepMin} Min Soll
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer score breakdown */}
      <div className="flex items-center gap-4 border-t px-4 py-2 bg-stone-50 text-[10px] text-stone-500">
        <TrendingUp className="w-3 h-3 shrink-0" />
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
          {processed.filter((o) => o.stufe === 'ok').length} OK
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
          {processed.filter((o) => o.stufe === 'bald').length} bald
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
          {dringendCount} jetzt
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
          {kritischCount} über
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Zap className="w-3 h-3 text-amber-500" />
          {processed.length} aktiv
        </span>
      </div>
    </div>
  );
}
