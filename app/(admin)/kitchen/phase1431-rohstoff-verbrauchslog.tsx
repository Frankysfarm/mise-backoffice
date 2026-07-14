'use client';

import { useMemo } from 'react';
import { ClipboardList, Clock } from 'lucide-react';

/**
 * Phase 1431 — Rohstoff-Verbrauchslog (Kitchen)
 *
 * Protokoll der letzten 10 verbrauchten Artikel aus der Bestellhistorie:
 *   • Artikel-Name, Menge, Uhrzeit der Bestellung
 * Props-basiert, keine eigene API. Nach Phase1426 in kitchen/client.tsx.
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

interface LogEintrag {
  key: string;
  name: string;
  menge: number;
  uhrzeit: string;
}

export function KitchenPhase1431RohstoffVerbrauchslog({ orders }: Props) {
  const log = useMemo<LogEintrag[]>(() => {
    const abgeschlossen = orders.filter(
      (o) => o.status && ['geliefert', 'abgeholt'].includes(o.status) && o.bestellt_am,
    );

    const eintraege: (LogEintrag & { ts: number })[] = [];

    for (const o of abgeschlossen) {
      const ts = o.bestellt_am ? new Date(o.bestellt_am).getTime() : 0;
      const uhrzeit = o.bestellt_am
        ? new Date(o.bestellt_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '–';
      for (const item of o.items ?? []) {
        const name = (item.name ?? '').trim();
        if (!name) continue;
        eintraege.push({ key: `${o.id}-${name}`, name, menge: item.menge ?? 1, uhrzeit, ts });
      }
    }

    return eintraege
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10)
      .map(({ key, name, menge, uhrzeit }) => ({ key, name, menge, uhrzeit }));
  }, [orders]);

  if (log.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Verbrauchslog</span>
        <span className="text-xs text-slate-400 dark:text-slate-500">letzte 10 Artikel</span>
      </div>

      <div className="space-y-1">
        {log.map((e) => (
          <div
            key={e.key}
            className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{e.name}</span>
              <span className="shrink-0 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-1.5 py-0.5">
                ×{e.menge}
              </span>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-2 text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] tabular-nums">{e.uhrzeit}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500">
        Aus {orders.filter((o) => ['geliefert', 'abgeholt'].includes(o.status ?? '')).length} abgeschlossenen Bestellungen
      </p>
    </div>
  );
}
