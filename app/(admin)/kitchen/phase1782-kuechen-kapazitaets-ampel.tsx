'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

/**
 * Phase 1782 — Küchen-Kapazitäts-Ampel (Kitchen)
 *
 * Wie viele Bestellungen können gleichzeitig bearbeitet werden vs. aktuell aktiv?
 * Ampel grün/gelb/rot; Props-basiert; useMemo; Collapsible.
 */

interface Order {
  id?: string;
  status?: string;
  items?: unknown[];
  order_items?: unknown[];
}

interface Props {
  orders: Order[];
  maxKapazitaet?: number;
  className?: string;
}

type AmpelStatus = 'gruen' | 'gelb' | 'rot';

const AMPEL_STYLE: Record<AmpelStatus, { label: string; bg: string; bar: string; text: string; border: string }> = {
  gruen: {
    label: 'Kapazität frei',
    bg: 'bg-matcha-50 dark:bg-matcha-900/20',
    bar: 'bg-matcha-500',
    text: 'text-matcha-700 dark:text-matcha-300',
    border: 'border-matcha-200 dark:border-matcha-800',
  },
  gelb: {
    label: 'Hohe Auslastung',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    bar: 'bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  rot: {
    label: 'Kapazität überschritten',
    bg: 'bg-red-50 dark:bg-red-900/20',
    bar: 'bg-red-500',
    text: 'text-red-700 dark:text-red-300',
    border: 'border-red-200 dark:border-red-800',
  },
};

const DEFAULT_MAX = 10;

function calcAmpel(aktiv: number, max: number): AmpelStatus {
  const pct = aktiv / max;
  if (pct < 0.6) return 'gruen';
  if (pct < 0.9) return 'gelb';
  return 'rot';
}

export function KitchenPhase1782KuechenKapazitaetsAmpel({ orders, maxKapazitaet = DEFAULT_MAX, className }: Props) {
  const [open, setOpen] = useState(true);

  const { aktiveBestellungen, ampel, auslastungPct } = useMemo(() => {
    const aktiv = orders.filter(o =>
      ['accepted', 'preparing', 'in_progress', 'pending'].includes(o.status ?? ''),
    ).length;
    const pct = Math.min(100, Math.round((aktiv / maxKapazitaet) * 100));
    return {
      aktiveBestellungen: aktiv,
      ampel: calcAmpel(aktiv, maxKapazitaet),
      auslastungPct: pct,
    };
  }, [orders, maxKapazitaet]);

  const style = AMPEL_STYLE[ampel];
  const ueberlastet = ampel === 'rot';

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Küchen-Kapazität</span>
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
            ampel === 'gruen' ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300'
              : ampel === 'gelb' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
          )}>
            {ueberlastet && <AlertTriangle className="h-3 w-3" />}
            {style.label}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {ueberlastet && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              <p className="text-xs font-bold text-red-800 dark:text-red-200">
                Kapazitätsgrenze überschritten — neue Bestellungen könnten verzögert werden.
              </p>
            </div>
          )}

          {/* Kapazitäts-Anzeige */}
          <div className={cn('rounded-xl border p-4 space-y-3', style.bg, style.border)}>
            <div className="flex items-end justify-between">
              <div>
                <p className={cn('text-2xl font-black tabular-nums', style.text)}>
                  {aktiveBestellungen}
                  <span className="text-base font-bold text-muted-foreground ml-1">/ {maxKapazitaet}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">aktive Bestellungen / max. Kapazität</p>
              </div>
              <div className="text-right">
                <p className={cn('text-3xl font-black tabular-nums', style.text)}>{auslastungPct}%</p>
                <p className="text-[10px] text-muted-foreground">Auslastung</p>
              </div>
            </div>

            {/* Fortschrittsbalken */}
            <div className="h-3 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                style={{ width: `${auslastungPct}%` }}
              />
            </div>

            {/* Schwellen-Markierungen */}
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>0</span>
              <span className="text-amber-600">60%</span>
              <span className="text-red-600">90%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Frei-Kapazität */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
            <span className="text-xs text-muted-foreground">Noch verfügbar</span>
            <span className={cn('text-sm font-black tabular-nums', style.text)}>
              {Math.max(0, maxKapazitaet - aktiveBestellungen)} Plätze
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
