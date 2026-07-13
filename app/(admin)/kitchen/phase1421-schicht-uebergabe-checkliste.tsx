'use client';

import { useMemo, useState } from 'react';
import { CheckSquare, ChevronDown, ChevronUp, AlertTriangle, Clock, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1421 — Schicht-Übergabe-Checkliste (Kitchen)
 *
 * Zeigt offene Bestellungen mit Wartezeit-Farbkodierung:
 *   • Grün < 15 Min
 *   • Gelb 15–25 Min
 *   • Rot > 25 Min (kritisch)
 * Props-basiert, rein client-seitig. Nach Phase1416 in kitchen/client.tsx.
 */

interface OrderItem {
  name?: string | null;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  bestellt_am?: string | null;
  typ?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type UebergabeStatus = 'ok' | 'warnung' | 'kritisch';

interface UebergabeBestellung {
  id: string;
  nr: string;
  status: string;
  wartezeit: number;
  ampel: UebergabeStatus;
  items: string[];
}

const AMPEL_CONFIG: Record<UebergabeStatus, { label: string; color: string; bg: string; border: string; barColor: string }> = {
  ok:       { label: 'OK',       color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700', barColor: 'bg-emerald-500' },
  warnung:  { label: 'Warnung',  color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',     barColor: 'bg-amber-500'   },
  kritisch: { label: 'Kritisch', color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-200 dark:border-rose-700',       barColor: 'bg-rose-500'    },
};

export function KitchenPhase1421SchichtUebergabeCheckliste({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const liste = useMemo<UebergabeBestellung[]>(() => {
    const now = Date.now();
    return orders
      .filter((o) => o.status && !['geliefert', 'abgeholt', 'storniert'].includes(o.status))
      .map((o) => {
        const wartezeit = o.bestellt_am
          ? Math.round((now - new Date(o.bestellt_am).getTime()) / 60_000)
          : 0;
        const ampel: UebergabeStatus =
          wartezeit > 25 ? 'kritisch' : wartezeit > 15 ? 'warnung' : 'ok';
        return {
          id: o.id,
          nr: o.bestellnummer ?? o.id.slice(0, 6),
          status: o.status ?? 'unbekannt',
          wartezeit,
          ampel,
          items: (o.items ?? []).map((i) => i.name ?? '').filter(Boolean).slice(0, 3),
        };
      })
      .sort((a, b) => b.wartezeit - a.wartezeit);
  }, [orders]);

  const kritisch = liste.filter((l) => l.ampel === 'kritisch').length;
  const warnung  = liste.filter((l) => l.ampel === 'warnung').length;

  if (liste.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Schicht-Übergabe</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">{liste.length} offen</span>
          {kritisch > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-3 h-3" />{kritisch} kritisch
            </span>
          )}
          {warnung > 0 && kritisch === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
              <Clock className="w-3 h-3" />{warnung} Warnung
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {liste.map((b) => {
            const cfg = AMPEL_CONFIG[b.ampel];
            const pct = Math.min(100, Math.round((b.wartezeit / 30) * 100));
            return (
              <div
                key={b.id}
                className={cn('rounded-lg border p-3', cfg.bg, cfg.border)}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Package className={cn('w-3.5 h-3.5', cfg.color)} />
                    <span className={cn('text-sm font-bold', cfg.color)}>#{b.nr}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">{b.status}</span>
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums', cfg.color)}>
                    {b.wartezeit} Min
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden mb-1.5">
                  <div className={cn('h-full rounded-full transition-all', cfg.barColor)} style={{ width: `${pct}%` }} />
                </div>
                {b.items.length > 0 && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {b.items.join(' · ')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
