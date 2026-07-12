'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingDown, Minus, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1189 — Schicht-Abschluss-Prognose (Kitchen)
// Basierend auf aktuellem Durchsatz: voraussichtliche Uhrzeit der letzten Bestellung + verbleibende Bestellungen

interface Order {
  id: string;
  status: string;
  created_at?: string | null;
}

interface Props { orders: Order[] }

type Prognose = {
  letzte_bestellung_uhrzeit: string | null;
  verbleibende_bestellungen: number;
  bestellungen_pro_stunde: number;
  schicht_endet_in_min: number | null;
  trend: 'steigend' | 'stabil' | 'fallend';
};

const SCHICHT_DAUER_STUNDEN = 8;

function computePrognose(orders: Order[]): Prognose {
  const now = Date.now();
  const h1Start = now - 60 * 60000;
  const h2Start = now - 120 * 60000;

  const letzteStunde = orders.filter(o => o.created_at && new Date(o.created_at).getTime() >= h1Start);
  const vorletzteStunde = orders.filter(
    o => o.created_at && new Date(o.created_at).getTime() >= h2Start && new Date(o.created_at).getTime() < h1Start,
  );

  const rate = letzteStunde.length;
  const rateVorher = vorletzteStunde.length;

  let trend: Prognose['trend'] = 'stabil';
  if (rate > rateVorher + 2) trend = 'steigend';
  else if (rateVorher > rate + 2) trend = 'fallend';

  const ersteBestellung = orders.reduce<Date | null>((earliest, o) => {
    if (!o.created_at) return earliest;
    const d = new Date(o.created_at);
    return !earliest || d < earliest ? d : earliest;
  }, null);

  let schichtEndetInMin: number | null = null;
  let letzte_bestellung_uhrzeit: string | null = null;

  if (ersteBestellung) {
    const schichtStartMs = ersteBestellung.getTime();
    const schichtEndeMs = schichtStartMs + SCHICHT_DAUER_STUNDEN * 3600000;
    schichtEndetInMin = Math.max(0, Math.round((schichtEndeMs - now) / 60000));

    if (rate > 0 && schichtEndetInMin > 0) {
      const verbleibendeMin = schichtEndetInMin;
      const letztesBestellZeitMs = now + verbleibendeMin * 60000 - (60000 / rate) * 2;
      const d = new Date(Math.min(letztesBestellZeitMs, schichtEndeMs));
      const h = String(d.getUTCHours()).padStart(2, '0');
      const m = String(d.getUTCMinutes()).padStart(2, '0');
      letzte_bestellung_uhrzeit = `${h}:${m} Uhr`;
    }
  }

  const verbleibende = rate > 0 && schichtEndetInMin
    ? Math.round((rate / 60) * schichtEndetInMin)
    : 0;

  return {
    letzte_bestellung_uhrzeit,
    verbleibende_bestellungen: verbleibende,
    bestellungen_pro_stunde: rate,
    schicht_endet_in_min: schichtEndetInMin,
    trend,
  };
}

const TREND_ICONS = {
  steigend: TrendingUp,
  stabil: Minus,
  fallend: TrendingDown,
};

const TREND_COLORS = {
  steigend: 'text-emerald-500',
  stabil: 'text-sky-500',
  fallend: 'text-amber-500',
};

export function KitchenPhase1189SchichtAbschlussPrognose({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const prognose = useMemo(() => computePrognose(orders), [orders]);
  const TrendIcon = TREND_ICONS[prognose.trend];

  const restLabel = prognose.schicht_endet_in_min !== null
    ? prognose.schicht_endet_in_min >= 60
      ? `${Math.floor(prognose.schicht_endet_in_min / 60)}h ${prognose.schicht_endet_in_min % 60}m`
      : `${prognose.schicht_endet_in_min} Min`
    : '—';

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden border-indigo-200 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="font-bold text-sm text-indigo-700 dark:text-indigo-300">
            Schicht-Abschluss-Prognose
          </span>
          <span className="rounded-full bg-indigo-500 text-white text-[10px] font-black px-2 py-0.5">
            {prognose.verbleibende_bestellungen} Bestell. erwartet
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-indigo-500" /> : <ChevronDown className="h-4 w-4 text-indigo-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-700 p-3 text-center">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">Letzte Bestellung ca.</p>
              <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">
                {prognose.letzte_bestellung_uhrzeit ?? '—'}
              </p>
            </div>
            <div className="rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-700 p-3 text-center">
              <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">Schicht endet in</p>
              <p className="text-lg font-black text-indigo-700 dark:text-indigo-300">{restLabel}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-700 px-3 py-2">
            <span className="text-sm text-muted-foreground">Ø Bestellungen/Stunde</span>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-indigo-700 dark:text-indigo-300">{prognose.bestellungen_pro_stunde}</span>
              <TrendIcon className={cn('h-4 w-4', TREND_COLORS[prognose.trend])} />
              <span className={cn('text-xs font-medium', TREND_COLORS[prognose.trend])}>
                {prognose.trend === 'steigend' ? '↑ steigend' : prognose.trend === 'fallend' ? '↓ fallend' : '→ stabil'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-black/20 border border-indigo-200 dark:border-indigo-700 px-3 py-2">
            <span className="text-sm text-muted-foreground">Verbleibende Bestellungen</span>
            <span className="font-black text-indigo-700 dark:text-indigo-300">
              ~{prognose.verbleibende_bestellungen}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
