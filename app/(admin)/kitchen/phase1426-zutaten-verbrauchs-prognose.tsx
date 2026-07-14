'use client';

import { useMemo } from 'react';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1426 — Zutaten-Verbrauchs-Prognose (Kitchen)
 *
 * Leitet aus der aktuellen Bestell-Queue ab, welche Hauptartikel in den
 * nächsten 2 Stunden besonders stark nachgefragt werden:
 *   • Grün: ausreichend Bestand erwartet
 *   • Gelb: erhöhter Bedarf — bitte prüfen
 *   • Rot: kritisch — Engpass wahrscheinlich
 * Props-basiert, keine eigene API. Nach Phase1421 in kitchen/client.tsx.
 */

interface OrderItem {
  name?: string | null;
  menge?: number;
}

interface Order {
  id: string;
  status?: string | null;
  bestellt_am?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type Ampel = 'ok' | 'warnung' | 'kritisch';

interface ArtikelBedarf {
  name: string;
  anzahl: number;
  prognose2h: number;
  ampel: Ampel;
}

const AMPEL_CFG: Record<Ampel, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> = {
  ok:       { label: 'OK',       icon: CheckCircle,   color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-200 dark:border-emerald-700' },
  warnung:  { label: 'Prüfen',   icon: TrendingUp,    color: 'text-amber-700 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700'     },
  kritisch: { label: 'Engpass',  icon: AlertTriangle, color: 'text-rose-700 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20',       border: 'border-rose-200 dark:border-rose-700'       },
};

export function KitchenPhase1426ZutatenVerbrauchsPrognose({ orders }: Props) {
  const bedarf = useMemo<ArtikelBedarf[]>(() => {
    const now  = Date.now();
    const win2h = 2 * 60 * 60 * 1000;

    const aktiv = orders.filter(
      (o) => o.status && !['geliefert', 'abgeholt', 'storniert'].includes(o.status),
    );

    const counter: Record<string, number> = {};
    for (const o of aktiv) {
      for (const item of o.items ?? []) {
        const key = (item.name ?? '').trim();
        if (!key) continue;
        counter[key] = (counter[key] ?? 0) + (item.menge ?? 1);
      }
    }

    const sinceMs = aktiv.reduce((min, o) => {
      const t = o.bestellt_am ? now - new Date(o.bestellt_am).getTime() : 0;
      return t > 0 && t < min ? t : min;
    }, win2h);
    const factor = sinceMs > 0 ? win2h / sinceMs : 1;

    return Object.entries(counter)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, anzahl]) => {
        const prognose2h = Math.round(anzahl * factor);
        const ampel: Ampel = prognose2h >= 20 ? 'kritisch' : prognose2h >= 10 ? 'warnung' : 'ok';
        return { name, anzahl, prognose2h, ampel };
      });
  }, [orders]);

  if (bedarf.length === 0) return null;

  const kritisch = bedarf.filter((b) => b.ampel === 'kritisch').length;
  const warnung  = bedarf.filter((b) => b.ampel === 'warnung').length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Verbrauchsprognose 2h</span>
        </div>
        <div className="flex items-center gap-1.5">
          {kritisch > 0 && (
            <span className="text-[10px] font-bold rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 px-2 py-0.5">
              {kritisch} Engpass
            </span>
          )}
          {warnung > 0 && (
            <span className="text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5">
              {warnung} Prüfen
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {bedarf.map((b) => {
          const cfg  = AMPEL_CFG[b.ampel];
          const Icon = cfg.icon;
          return (
            <div
              key={b.name}
              className={cn('flex items-center justify-between rounded-lg border px-3 py-2', cfg.bg, cfg.border)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.color)} />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{b.name}</span>
              </div>
              <div className="text-right ml-2 shrink-0">
                <span className={cn('text-xs font-bold tabular-nums', cfg.color)}>{b.prognose2h}×</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-0.5">2h</span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Hochrechnung aus {orders.length} aktiven Bestellungen
      </p>
    </div>
  );
}
