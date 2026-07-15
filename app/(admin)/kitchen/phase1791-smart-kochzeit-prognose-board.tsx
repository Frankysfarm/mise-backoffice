'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ChefHat, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react';

/**
 * Phase 1791 — Smart-Kochzeit-Prognose-Board (Kitchen)
 *
 * Prognose der Zubereitungszeiten je Bestellung in der nächsten Stunde
 * basierend auf aktueller Warteschlangentiefe und Bestellkomplexität.
 * 5-Stufen-Ampel; useMemo; Collapsible; kein API-Call.
 */

interface Order {
  id?: string;
  status?: string;
  created_at?: string;
  bestellt_am?: string;
  order_number?: string | number;
  geschaetzte_zubereitung_min?: number | null;
  items?: unknown[];
  order_items?: unknown[];
}

interface Props {
  orders: Order[];
  className?: string;
}

const AKTIV = new Set(['pending', 'confirmed', 'in_preparation', 'ausstehend', 'bestaetigt', 'in_zubereitung', 'neu']);

type Stufe = 'optimal' | 'gut' | 'mittel' | 'eng' | 'kritisch';

const STUFE_CFG: Record<Stufe, { label: string; bg: string; border: string; dot: string; text: string; bar: string }> = {
  optimal:  { label: 'Optimal',  bg: 'bg-matcha-50 dark:bg-matcha-950/30',  border: 'border-matcha-200 dark:border-matcha-800',  dot: 'bg-matcha-500',  text: 'text-matcha-700 dark:text-matcha-300',  bar: 'bg-matcha-500'  },
  gut:      { label: 'Gut',      bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', dot: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-400' },
  mittel:   { label: 'Mittel',   bg: 'bg-amber-50 dark:bg-amber-950/30',    border: 'border-amber-200 dark:border-amber-800',    dot: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300',   bar: 'bg-amber-400'   },
  eng:      { label: 'Eng',      bg: 'bg-orange-50 dark:bg-orange-950/30',  border: 'border-orange-200 dark:border-orange-800',  dot: 'bg-orange-500',  text: 'text-orange-700 dark:text-orange-300',  bar: 'bg-orange-500'  },
  kritisch: { label: 'Kritisch', bg: 'bg-red-50 dark:bg-red-950/30',        border: 'border-red-200 dark:border-red-800',        dot: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',        bar: 'bg-red-500'     },
};

function berechneKomplexitaet(o: Order): number {
  const items = (o.items ?? o.order_items ?? []) as unknown[];
  return Math.min(1 + items.length * 0.15, 2.5);
}

function stufeVonMinuten(min: number): Stufe {
  if (min <= 15) return 'optimal';
  if (min <= 20) return 'gut';
  if (min <= 25) return 'mittel';
  if (min <= 35) return 'eng';
  return 'kritisch';
}

export function KitchenPhase1791SmartKochzeitPrognoseBoard({ orders, className }: Props) {
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const { rows, avgPrognose, trend, queueTiefe } = useMemo(() => {
    const aktiv = orders.filter(o => AKTIV.has(o.status ?? ''));
    const queueTiefe = aktiv.length;

    const BASE_MIN = 15;
    const QUEUE_FAKTOR = queueTiefe * 0.8;

    const rows = aktiv.map((o, idx) => {
      const komplex = berechneKomplexitaet(o);
      const prognose = Math.round((BASE_MIN + QUEUE_FAKTOR + idx * 1.2) * komplex);
      const gesetzt = o.geschaetzte_zubereitung_min ?? null;
      const abweichung = gesetzt ? prognose - gesetzt : null;
      const nr = o.order_number ? `#${o.order_number}` : `#${(o.id ?? '????').slice(0, 4)}`;
      const stufe = stufeVonMinuten(prognose);
      return { id: o.id ?? nr, nr, prognose, gesetzt, abweichung, stufe, komplex };
    }).sort((a, b) => b.prognose - a.prognose).slice(0, 8);

    const sumPrognose = rows.reduce((s, r) => s + r.prognose, 0);
    const avgPrognose = rows.length > 0 ? Math.round(sumPrognose / rows.length) : 0;

    const fruehereBestellungen = orders.filter(o => !AKTIV.has(o.status ?? ''));
    const trendVal = fruehereBestellungen.length > 0 && avgPrognose > 0
      ? avgPrognose > 22 ? 'steigend' : avgPrognose < 18 ? 'fallend' : 'stabil'
      : 'stabil';

    return { rows, avgPrognose, trend: trendVal as 'steigend' | 'fallend' | 'stabil', queueTiefe };
  }, [orders, now]);

  if (rows.length === 0) return null;

  const maxPrognose = Math.max(...rows.map(r => r.prognose), 1);

  const TrendIcon = trend === 'steigend' ? TrendingUp : trend === 'fallend' ? TrendingDown : Minus;
  const trendColor = trend === 'steigend' ? 'text-red-500' : trend === 'fallend' ? 'text-matcha-500' : 'text-muted-foreground';

  const dominantStufe = stufeVonMinuten(avgPrognose);
  const cfg = STUFE_CFG[dominantStufe];

  return (
    <div className={cn('rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChefHat className="h-4 w-4 shrink-0 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider truncate">
            Kochzeit-Prognose
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', cfg.bg, cfg.border, 'border', cfg.text)}>
            Ø {avgPrognose} Min · <TrendIcon className={cn('inline h-3 w-3', trendColor)} />
          </span>
          {queueTiefe >= 5 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 border border-red-200 dark:border-red-800 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 flex items-center gap-1">
              <Zap className="h-2.5 w-2.5" /> Hochlast
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-2">
          <div className="flex items-center gap-4 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            <span className="w-12">Bestell.</span>
            <span className="flex-1">Prognose (Min)</span>
            <span className="w-20 text-right">Abw. Soll</span>
            <span className="w-16 text-right">Status</span>
          </div>

          {rows.map((row) => {
            const pct = Math.min((row.prognose / maxPrognose) * 100, 100);
            const c = STUFE_CFG[row.stufe];
            return (
              <div key={row.id} className={cn('rounded-lg border p-2', c.bg, c.border)}>
                <div className="flex items-center gap-3">
                  <span className="w-12 shrink-0 font-mono text-[11px] font-bold text-foreground">{row.nr}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-2 rounded-full bg-muted/60 flex-1 overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', c.bar)} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={cn('shrink-0 font-mono text-[11px] font-black tabular-nums', c.text)}>
                        {row.prognose} Min
                      </span>
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      Komplexität ×{row.komplex.toFixed(1)}
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] tabular-nums font-semibold">
                    {row.abweichung !== null
                      ? <span className={row.abweichung > 3 ? 'text-red-600 dark:text-red-400' : row.abweichung < -3 ? 'text-matcha-600 dark:text-matcha-400' : 'text-muted-foreground'}>
                          {row.abweichung > 0 ? '+' : ''}{row.abweichung} Min
                        </span>
                      : <span className="text-muted-foreground">–</span>
                    }
                  </span>
                  <span className={cn('w-16 shrink-0 text-right text-[10px] font-bold', c.text)}>
                    <span className={cn('inline-flex items-center gap-1')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
                      {c.label}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}

          <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{queueTiefe} aktive Bestellung{queueTiefe !== 1 ? 'en' : ''} in der Warteschlange</span>
            <span>Prognose-Trend: <span className={trendColor}>{trend}</span></span>
          </div>
        </div>
      )}
    </div>
  );
}
