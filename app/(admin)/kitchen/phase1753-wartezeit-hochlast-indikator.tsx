'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

/**
 * Phase 1753 — Wartezeit-Hochlast-Indikator (Kitchen)
 *
 * Ø Wartezeit bis Küchenannahme letzte 15/30 Min; Ampel rot/gelb/grün.
 * Alert wenn >5 Min. Props-basiert (orders), useMemo, Collapsible.
 */

interface Order {
  created_at?: string;
  accepted_at?: string;
  status?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

const ALERT_SCHWELLE = 5;
const GELB_SCHWELLE = 3;

function calcWartezeit(orders: Order[], fensterMin: number) {
  const cutoff = Date.now() - fensterMin * 60_000;
  const relevant = orders.filter(o => {
    if (!o.created_at || !o.accepted_at) return false;
    return new Date(o.created_at).getTime() >= cutoff;
  });
  if (relevant.length === 0) return null;
  const totalMs = relevant.reduce((s, o) => {
    return s + (new Date(o.accepted_at!).getTime() - new Date(o.created_at!).getTime());
  }, 0);
  return Math.round(totalMs / relevant.length / 60_000 * 10) / 10;
}

export function KitchenPhase1753WartezeitHochlastIndikator({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const avg15 = useMemo(() => calcWartezeit(orders, 15), [orders]);
  const avg30 = useMemo(() => calcWartezeit(orders, 30), [orders]);

  const hauptWert = avg15 ?? avg30 ?? 0;
  const ampel = hauptWert >= ALERT_SCHWELLE ? 'rot' : hauptWert >= GELB_SCHWELLE ? 'gelb' : 'gruen';
  const alert = ampel === 'rot';

  const ampelColors = {
    gruen: 'text-green-600 dark:text-green-400',
    gelb: 'text-amber-600 dark:text-amber-400',
    rot: 'text-red-600 dark:text-red-400',
  };
  const bgColors = {
    gruen: 'bg-green-50 dark:bg-green-950/20',
    gelb: 'bg-amber-50 dark:bg-amber-950/20',
    rot: 'bg-red-50 dark:bg-red-950/20',
  };

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Clock className={cn('h-4 w-4', ampelColors[ampel])} />
          <span className="text-sm font-bold">Wartezeit-Hochlast</span>
          {alert && (
            <span className="flex items-center gap-1 text-[10px] font-black bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 px-2 py-0.5 rounded-full">
              <AlertTriangle className="h-3 w-3" /> HOCHLAST
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-black', ampelColors[ampel])}>
            Ø {hauptWert > 0 ? `${hauptWert} Min` : '–'}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {alert && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300 font-medium">
              Achtung: Annahme-Wartezeit &gt;{ALERT_SCHWELLE} Min — Kapazität prüfen!
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className={cn('rounded-lg p-3 text-center', bgColors[ampel])}>
              <div className={cn('text-xl font-black', ampelColors[ampel])}>
                {avg15 != null ? `${avg15}m` : '–'}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Letzte 15 Min</div>
            </div>
            <div className="rounded-lg p-3 text-center bg-muted/50">
              <div className="text-xl font-black text-foreground">
                {avg30 != null ? `${avg30}m` : '–'}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase mt-0.5">Letzte 30 Min</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" /> &lt;{GELB_SCHWELLE}m normal</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {GELB_SCHWELLE}–{ALERT_SCHWELLE}m erhöht</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> &gt;{ALERT_SCHWELLE}m kritisch</span>
          </div>
        </div>
      )}
    </div>
  );
}
