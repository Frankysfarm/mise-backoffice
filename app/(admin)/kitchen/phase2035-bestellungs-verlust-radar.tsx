'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertOctagon, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  customer_name?: string | null;
  total_price?: number | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'gruen' | 'gelb' | 'rot';

function ampelOf(ratePct: number): Ampel {
  if (ratePct <= 5) return 'gruen';
  if (ratePct <= 10) return 'gelb';
  return 'rot';
}

const AMPEL_STYLE: Record<Ampel, { dot: string; bar: string; label: string; badge: string }> = {
  gruen: { dot: 'bg-matcha-500',  bar: 'bg-matcha-500',  label: 'Normal',   badge: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-800 dark:text-matcha-200' },
  gelb:  { dot: 'bg-amber-400',   bar: 'bg-amber-400',   label: 'Erhöht',   badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200' },
  rot:   { dot: 'bg-red-500 animate-pulse', bar: 'bg-red-500', label: 'Kritisch', badge: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300' },
};

export function KitchenPhase2035BestellungsVerlustRadar({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { verloren, gesamt2h, ratePct, ampel, totalWert } = useMemo(() => {
    const cutoff = Date.now() - 2 * 60 * 60 * 1000;
    const recent = orders.filter(o => {
      if (!o.created_at) return false;
      return new Date(o.created_at).getTime() >= cutoff;
    });
    const cancelled = recent.filter(o =>
      o.status === 'cancelled' || o.status === 'storniert' ||
      o.status === 'abgebrochen' || o.status === 'rejected',
    );
    const rate = recent.length > 0 ? (cancelled.length / recent.length) * 100 : 0;
    const wert = cancelled.reduce((s, o) => s + (o.total_price ?? 0), 0);
    return {
      verloren: cancelled,
      gesamt2h: recent.length,
      ratePct: rate,
      ampel: ampelOf(rate),
      totalWert: wert,
    };
  }, [orders]);

  const style = AMPEL_STYLE[ampel];

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        <AlertOctagon className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-semibold text-sm flex-1">Bestellungs-Verlust-Radar (2h)</span>
        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', style.badge)}>
          <span className={cn('inline-block w-2 h-2 rounded-full mr-1 align-middle', style.dot)} />
          {style.label}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {ampel === 'rot' && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-300 text-xs font-semibold">
              <AlertOctagon className="h-4 w-4 shrink-0" />
              Stornoquote &gt;10% — sofortiger Handlungsbedarf!
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-xl font-black tabular-nums text-foreground">{verloren.length}</div>
              <div className="text-[10px] text-muted-foreground">Verloren</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-2 text-center">
              <div className="text-xl font-black tabular-nums text-foreground">{gesamt2h}</div>
              <div className="text-[10px] text-muted-foreground">Gesamt (2h)</div>
            </div>
            <div className={cn('rounded-lg p-2 text-center', ampel === 'rot' ? 'bg-red-50 dark:bg-red-900/20' : ampel === 'gelb' ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-matcha-50 dark:bg-matcha-900/20')}>
              <div className={cn('text-xl font-black tabular-nums', ampel === 'rot' ? 'text-red-600' : ampel === 'gelb' ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-400')}>
                {ratePct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">Quote</div>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
              <span>Verlustquote</span>
              <span>{ratePct.toFixed(1)}% / 10%-Schwelle</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', style.bar)}
                style={{ width: `${Math.min(100, (ratePct / 10) * 100)}%` }}
              />
            </div>
          </div>

          {/* Wert */}
          {totalWert > 0 && (
            <div className="text-xs text-muted-foreground">
              Entgangener Umsatz: <span className="font-semibold text-foreground">{totalWert.toFixed(2)} €</span>
            </div>
          )}

          {/* Status if clean */}
          {verloren.length === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-matcha-700 dark:text-matcha-400 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Keine Stornierungen in den letzten 2 Stunden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
