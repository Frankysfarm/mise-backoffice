'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, ShieldAlert } from 'lucide-react';

/**
 * Phase 1713 — Storno-Risiko-Ampel (Kitchen)
 *
 * Warnung wenn Bestellungen >15 Min in Zubereitung ohne Status-Update.
 * Eskalations-Banner bei ≥3 Bestellungen. Props-basiert, useMemo.
 */

interface Order {
  id: string;
  status: string;
  accepted_at?: string | null;
  created_at?: string | null;
  customer_name?: string | null;
  items?: Array<{ product_name?: string | null; name?: string | null }> | null;
}

interface Props {
  orders: Order[];
  warn_min?: number;
}

interface RisikoBestellung {
  id: string;
  name: string;
  warteMin: number;
  stufe: 'warn' | 'kritisch';
}

const ZUBEREITUNG_STATUS = new Set(['accepted', 'preparing', 'in_progress', 'in_zubereitung', 'confirmed']);

const STUFE_CFG = {
  warn:     { color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/20',   border: 'border-amber-200 dark:border-amber-700',   dot: 'bg-amber-400' },
  kritisch: { color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-50 dark:bg-red-900/20',        border: 'border-red-200 dark:border-red-700',        dot: 'bg-red-500' },
};

export function KitchenPhase1713StornoRisikoAmpel({ orders, warn_min = 15 }: Props) {
  const [open, setOpen] = useState(true);

  const { risikoListe, hatKritisch, anzahlKritisch } = useMemo(() => {
    const now = Date.now();
    const liste: RisikoBestellung[] = [];

    for (const o of orders) {
      if (!ZUBEREITUNG_STATUS.has(o.status)) continue;
      const startMs = o.accepted_at
        ? new Date(o.accepted_at).getTime()
        : o.created_at
        ? new Date(o.created_at).getTime()
        : null;
      if (!startMs) continue;

      const warteMin = Math.floor((now - startMs) / 60_000);
      if (warteMin < warn_min) continue;

      const firstItem = o.items?.[0];
      const itemName = firstItem?.product_name ?? firstItem?.name ?? 'Bestellung';
      const stufe: RisikoBestellung['stufe'] = warteMin >= warn_min * 2 ? 'kritisch' : 'warn';

      liste.push({
        id: o.id,
        name: o.customer_name ? `${o.customer_name} — ${itemName}` : itemName,
        warteMin,
        stufe,
      });
    }

    liste.sort((a, b) => b.warteMin - a.warteMin);
    const kritisch = liste.filter(r => r.stufe === 'kritisch');
    return { risikoListe: liste.slice(0, 8), hatKritisch: kritisch.length > 0, anzahlKritisch: kritisch.length };
  }, [orders, warn_min]);

  if (risikoListe.length === 0) return null;

  const eskalation = anzahlKritisch >= 3;
  const headerColor = hatKritisch ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300';

  return (
    <div className={cn(
      'rounded-xl border p-3 mb-3',
      hatKritisch ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10' : 'border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <span className={cn('flex items-center gap-2 text-sm font-bold', headerColor)}>
          <ShieldAlert className="h-4 w-4" />
          Storno-Risiko
          <span className={cn(
            'rounded-full px-2 py-0.5 text-xs font-black',
            hatKritisch ? 'bg-red-500 text-white' : 'bg-amber-400 text-amber-900',
          )}>
            {risikoListe.length}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-2 space-y-1.5">
          {eskalation && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-900/30 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                ESKALATION — {anzahlKritisch} Bestellungen kritisch überfällig!
              </span>
            </div>
          )}

          {risikoListe.map(r => {
            const cfg = STUFE_CFG[r.stufe];
            return (
              <div key={r.id} className={cn('flex items-center justify-between gap-2 rounded-lg border px-3 py-2', cfg.bg, cfg.border)}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', cfg.dot)} />
                  <span className={cn('text-xs font-medium truncate', cfg.color)}>{r.name}</span>
                </div>
                <span className={cn('flex items-center gap-1 text-xs font-black tabular-nums shrink-0', cfg.color)}>
                  <Clock className="h-3 w-3" />
                  {r.warteMin} Min
                </span>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground pt-1">
            Bestellungen in Zubereitung &gt;{warn_min} Min ohne Status-Update → Storno-Risiko
          </p>
        </div>
      )}
    </div>
  );
}
