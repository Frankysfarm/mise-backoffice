'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, FlameKindling, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1817 — Gericht-Zubereitungs-Engpass-Alarm (Kitchen)
 *
 * Welche Gerichte häufen sich bei zu vielen gleichzeitigen Bestellungen?
 * Alert wenn >3 gleiche Gerichte gleichzeitig aktiv sind.
 * Props-basiert; useMemo; Collapsible.
 */

interface OrderItem {
  name?: string;
  title?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
  produkte?: OrderItem[];
}

interface Props {
  orders: Order[];
  engpassSchwelle?: number;
  warnSchwelle?: number;
  className?: string;
}

type Stufe = 'ok' | 'warn' | 'engpass';

interface GerichtEngpass {
  name: string;
  anzahl: number;
  stufe: Stufe;
}

const AKTIVE_STATUS = new Set(['new', 'confirmed', 'preparing', 'in_progress', 'in_zubereitung', 'accepted']);

const STUFE_STYLE: Record<Stufe, { bg: string; border: string; text: string; badge: string; dot: string }> = {
  ok: {
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    border: 'border-matcha-200 dark:border-matcha-800',
    text: 'text-matcha-700 dark:text-matcha-300',
    badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
    dot: 'bg-matcha-500',
  },
  warn: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-400',
  },
  engpass: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    dot: 'bg-red-500',
  },
};

function stufevon(anzahl: number, warn: number, engpass: number): Stufe {
  if (anzahl >= engpass) return 'engpass';
  if (anzahl >= warn) return 'warn';
  return 'ok';
}

export function KitchenPhase1817GerichtZubereitungsEngpassAlarm({
  orders,
  engpassSchwelle = 4,
  warnSchwelle = 3,
  className,
}: Props) {
  const [open, setOpen] = useState(true);

  const gerichte = useMemo((): GerichtEngpass[] => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.status || !AKTIVE_STATUS.has(o.status)) continue;
      const items = o.items ?? o.produkte ?? [];
      for (const item of items) {
        const name = item.name ?? item.title ?? 'Unbekannt';
        const menge = item.menge ?? item.quantity ?? 1;
        map.set(name, (map.get(name) ?? 0) + menge);
      }
    }
    return Array.from(map.entries())
      .filter(([, anzahl]) => anzahl >= warnSchwelle)
      .map(([name, anzahl]) => ({ name, anzahl, stufe: stufevon(anzahl, warnSchwelle, engpassSchwelle) }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [orders, warnSchwelle, engpassSchwelle]);

  const engpassCount = useMemo(() => gerichte.filter(g => g.stufe === 'engpass').length, [gerichte]);
  const warnCount = useMemo(() => gerichte.filter(g => g.stufe === 'warn').length, [gerichte]);

  const hatAlarm = engpassCount > 0 || warnCount > 0;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FlameKindling className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Gericht-Engpass-Alarm</span>
          {engpassCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {engpassCount} Engpass
            </span>
          )}
          {engpassCount === 0 && warnCount > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {warnCount} Warnung
            </span>
          )}
          {!hatAlarm && gerichte.length === 0 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-semibold text-matcha-700 dark:text-matcha-300">
              <CheckCircle2 className="h-3 w-3" />
              Kein Engpass
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {gerichte.length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 dark:bg-matcha-950/30 border border-matcha-200 dark:border-matcha-800 px-3 py-3">
              <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
              <span className="text-xs text-matcha-700 dark:text-matcha-300">
                Alle Gerichte unter Engpass-Schwelle ({warnSchwelle}×)
              </span>
            </div>
          ) : (
            <>
              {engpassCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                    {engpassCount} Gericht{engpassCount > 1 ? 'e' : ''} im Engpass — Kapazitätsgrenze {engpassSchwelle}× erreicht
                  </span>
                </div>
              )}
              <div className="grid gap-2">
                {gerichte.map(({ name, anzahl, stufe }) => {
                  const s = STUFE_STYLE[stufe];
                  const balken = Math.min(100, Math.round((anzahl / engpassSchwelle) * 100));
                  return (
                    <div key={name} className={cn('rounded-xl border px-3 py-2', s.bg, s.border)}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn('h-2 w-2 rounded-full shrink-0', s.dot)} />
                          <span className={cn('text-xs font-semibold truncate', s.text)}>{name}</span>
                        </div>
                        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ml-2', s.badge)}>
                          {anzahl}× aktiv
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-500', s.dot)}
                          style={{ width: `${balken}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-0.5">
                        <span className="text-[9px] text-muted-foreground">Warn ≥{warnSchwelle}</span>
                        <span className="text-[9px] text-muted-foreground">Engpass ≥{engpassSchwelle}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                  Warnung ({warnSchwelle}–{engpassSchwelle - 1}×)
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                  Engpass (≥{engpassSchwelle}×)
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
