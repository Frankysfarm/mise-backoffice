'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, Flame, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1837 — Bestellrückstand-Eskalation (Kitchen)
 *
 * Alert wenn >3 Bestellungen >15 Min in Zubereitung.
 * Eskalations-Level Orange (>15 Min) oder Rot (>25 Min) je Wartezeit.
 * Collapsible; useMemo.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  order_number?: string | number;
  orderNumber?: string | number;
  items?: { name?: string; menge?: number; quantity?: number }[];
  produkte?: { name?: string; menge?: number; quantity?: number }[];
}

interface Props {
  orders: Order[];
  orangeSchwelleMin?: number;
  rotSchwelleMin?: number;
  eskalationsAnzahl?: number;
  className?: string;
}

type Stufe = 'orange' | 'rot';

interface RueckstandEintrag {
  id: string;
  bezeichnung: string;
  minutenAktiv: number;
  artikelAnzahl: number;
  stufe: Stufe;
}

const ZUBEREITUNGS_STATUS = new Set([
  'preparing', 'in_progress', 'in_zubereitung', 'confirmed', 'accepted',
]);

const STUFE_STYLE: Record<Stufe, {
  bg: string; border: string; text: string; badge: string; label: string; dot: string;
}> = {
  orange: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    label: 'Dringend',
    dot: 'bg-amber-400',
  },
  rot: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
    label: 'Kritisch',
    dot: 'bg-red-500',
  },
};

export function KitchenPhase1837BestellRueckstandEskalation({
  orders,
  orangeSchwelleMin = 15,
  rotSchwelleMin = 25,
  eskalationsAnzahl = 3,
  className,
}: Props) {
  const [open, setOpen] = useState(true);

  const rueckstand = useMemo((): RueckstandEintrag[] => {
    const jetzt = Date.now();
    return orders
      .filter(o => !o.status || ZUBEREITUNGS_STATUS.has(o.status))
      .map(o => {
        const erstelltAm = o.created_at ?? o.createdAt;
        const min = erstelltAm
          ? Math.floor((jetzt - new Date(erstelltAm).getTime()) / 60_000)
          : 0;
        const items = o.items ?? o.produkte ?? [];
        const nr = o.order_number ?? o.orderNumber ?? o.id.slice(-4);
        return {
          id: o.id,
          bezeichnung: `#${nr}`,
          minutenAktiv: min,
          artikelAnzahl: items.reduce((s, i) => s + (i.menge ?? i.quantity ?? 1), 0),
          stufe: min >= rotSchwelleMin ? 'rot' : 'orange',
        };
      })
      .filter(e => e.minutenAktiv >= orangeSchwelleMin)
      .sort((a, b) => b.minutenAktiv - a.minutenAktiv);
  }, [orders, orangeSchwelleMin, rotSchwelleMin]);

  const istEskalation = rueckstand.length >= eskalationsAnzahl;
  const rotAnzahl = rueckstand.filter(e => e.stufe === 'rot').length;
  const orangeAnzahl = rueckstand.filter(e => e.stufe === 'orange').length;

  if (!istEskalation && rueckstand.length === 0) {
    return (
      <div className={cn('rounded-2xl border bg-card px-4 py-3 flex items-center gap-2', className)}>
        <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs text-muted-foreground">Kein Bestellrückstand — alle Bestellungen im Zeitplan.</span>
      </div>
    );
  }

  return (
    <div className={cn(
      'rounded-2xl border shadow-sm overflow-hidden',
      rotAnzahl > 0 ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20' :
      'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20',
      className,
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          {rotAnzahl > 0
            ? <Flame className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />}
          <span className={cn('text-sm font-bold',
            rotAnzahl > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
          )}>
            Bestellrückstand
          </span>
          {rotAnzahl > 0 && (
            <span className="rounded-full bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-2 py-0.5 text-[10px] font-black">
              {rotAnzahl} Kritisch (&gt;{rotSchwelleMin} Min)
            </span>
          )}
          {orangeAnzahl > 0 && (
            <span className="rounded-full bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold">
              {orangeAnzahl} Dringend (&gt;{orangeSchwelleMin} Min)
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {istEskalation && (
            <div className={cn(
              'flex items-center gap-2 rounded-xl px-3 py-2 border',
              rotAnzahl > 0
                ? 'bg-red-100 dark:bg-red-950/40 border-red-200 dark:border-red-800'
                : 'bg-amber-100 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800',
            )}>
              <AlertTriangle className={cn('h-4 w-4 shrink-0',
                rotAnzahl > 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
              )} />
              <span className={cn('text-xs font-semibold',
                rotAnzahl > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300',
              )}>
                Eskalation: {rueckstand.length} Bestellungen im Rückstand — sofortige Maßnahmen erforderlich!
              </span>
            </div>
          )}

          {rueckstand.map(e => {
            const s = STUFE_STYLE[e.stufe];
            return (
              <div key={e.id} className={cn('rounded-xl border px-3 py-2.5', s.bg, s.border)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn('h-2 w-2 rounded-full shrink-0 animate-pulse', s.dot)} />
                    <span className={cn('text-xs font-bold', s.text)}>{e.bezeichnung}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {e.artikelAnzahl} Pos.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Clock className={cn('h-3 w-3', s.text)} />
                    <span className={cn('text-sm font-black tabular-nums', s.text)}>
                      {e.minutenAktiv} Min
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', s.dot)}
                    style={{ width: `${Math.min(100, (e.minutenAktiv / 30) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex gap-4 pt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />Dringend (&gt;{orangeSchwelleMin} Min)
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />Kritisch (&gt;{rotSchwelleMin} Min)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
