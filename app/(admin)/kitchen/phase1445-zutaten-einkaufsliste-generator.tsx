'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShoppingCart, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

// Phase 1445 — Zutaten-Einkaufsliste-Generator (Kitchen)
// Aggregierte Einkaufsliste aus aktiver Bestell-Queue für nächste 2h
// Ampel (ausreichend/bestellen/dringend); Props-basiert; nach Phase1440

interface OrderItem {
  name?: string | null;
  menge?: number | null;
  einheit?: string | null;
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

type AmpelStatus = 'ausreichend' | 'bestellen' | 'dringend';

interface EinkaufsEintrag {
  name: string;
  menge: number;
  einheit: string;
  ampel: AmpelStatus;
  anzahlBestellungen: number;
}

const DRINGEND_SCHWELLE = 5;
const BESTELLEN_SCHWELLE = 3;

const ZWEI_STUNDEN_MS = 2 * 60 * 60 * 1000;

const AKTIVE_STATUSES = new Set(['pending', 'preparing', 'in_zubereitung', 'fertig', 'confirmed', 'accepted']);

function ampelStatus(anzahl: number): AmpelStatus {
  if (anzahl >= DRINGEND_SCHWELLE) return 'dringend';
  if (anzahl >= BESTELLEN_SCHWELLE) return 'bestellen';
  return 'ausreichend';
}

const AMPEL_CONFIG: Record<AmpelStatus, { cls: string; badge: string; label: string; icon: React.ReactNode }> = {
  ausreichend: {
    cls: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    label: 'Ausreichend',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" />,
  },
  bestellen: {
    cls: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    label: 'Bestellen',
    icon: <AlertTriangle className="w-3 h-3 text-amber-500" />,
  },
  dringend: {
    cls: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    label: 'Dringend!',
    icon: <AlertTriangle className="w-3 h-3 text-red-500" />,
  },
};

export function KitchenPhase1445ZutatenEinkaufslisteGenerator({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const einkaufsliste = useMemo((): EinkaufsEintrag[] => {
    const jetzt = Date.now();
    const relevant = orders.filter(o => {
      if (!AKTIVE_STATUSES.has(o.status ?? '')) return false;
      if (o.bestellt_am) {
        const alter = jetzt - new Date(o.bestellt_am).getTime();
        return alter <= ZWEI_STUNDEN_MS;
      }
      return true;
    });

    const zutatenMap = new Map<string, { menge: number; einheit: string; anzahlBestellungen: number }>();

    for (const o of relevant) {
      for (const item of o.items ?? []) {
        const name = (item.name ?? '').trim();
        if (!name) continue;
        const einheit = item.einheit ?? 'Stk';
        const menge = item.menge ?? 1;
        const key = name.toLowerCase();
        const existing = zutatenMap.get(key);
        if (existing) {
          existing.menge += menge;
          existing.anzahlBestellungen += 1;
        } else {
          zutatenMap.set(key, { menge, einheit, anzahlBestellungen: 1 });
        }
      }
    }

    return Array.from(zutatenMap.entries())
      .map(([key, val]) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        menge: Math.round(val.menge * 10) / 10,
        einheit: val.einheit,
        ampel: ampelStatus(val.anzahlBestellungen),
        anzahlBestellungen: val.anzahlBestellungen,
      }))
      .sort((a, b) => {
        const order: Record<AmpelStatus, number> = { dringend: 0, bestellen: 1, ausreichend: 2 };
        return order[a.ampel] - order[b.ampel] || b.menge - a.menge;
      });
  }, [orders]);

  const dringendCount = einkaufsliste.filter(e => e.ampel === 'dringend').length;
  const bestellenCount = einkaufsliste.filter(e => e.ampel === 'bestellen').length;

  if (einkaufsliste.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <ShoppingCart className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Einkaufsliste (nächste 2h)
        </span>
        {dringendCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
            {dringendCount} dringend
          </span>
        )}
        {bestellenCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {bestellenCount} bestellen
          </span>
        )}
        <span className="text-[10px] text-slate-400 shrink-0">{einkaufsliste.length} Artikel</span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {einkaufsliste.map(eintrag => {
            const cfg = AMPEL_CONFIG[eintrag.ampel];
            return (
              <div
                key={eintrag.name}
                className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', cfg.cls)}
              >
                <div className="shrink-0">{cfg.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{eintrag.name}</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {eintrag.anzahlBestellungen}× in Queue
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-black tabular-nums text-slate-800 dark:text-slate-100">
                    {eintrag.menge} <span className="text-[10px] font-normal">{eintrag.einheit}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-slate-400 text-center pt-1">
            Schwellen: ≥{BESTELLEN_SCHWELLE}× → Bestellen · ≥{DRINGEND_SCHWELLE}× → Dringend
          </p>
        </div>
      )}
    </div>
  );
}
