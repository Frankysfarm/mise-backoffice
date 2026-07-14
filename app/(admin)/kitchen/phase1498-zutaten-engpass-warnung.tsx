'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

// Phase 1498 — Zutaten-Engpass-Warnung (Kitchen)
// Aggregiert benötigte Zutaten aus offenen Bestellungen + Ampel-Warnung;
// Props-basiert; rein client-seitig; nach Phase1492.

interface OrderItem {
  name?: string | null;
  quantity?: number | null;
  zutaten?: string[] | null;
  ingredients?: string[] | null;
}

interface Order {
  id: string;
  status?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

type AmpelStatus = 'ausreichend' | 'bestellen' | 'dringend';

interface ZutatBedarf {
  zutat: string;
  bedarf: number;
  status: AmpelStatus;
}

const AKTIVE_STATUSES = new Set(['pending', 'confirmed', 'preparing', 'in_zubereitung', 'accepted', 'ready']);

const AMPEL_CONFIG: Record<AmpelStatus, { badge: string; dot: string; label: string }> = {
  dringend: {
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
    dot: 'bg-rose-500',
    label: 'Dringend',
  },
  bestellen: {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Bestellen',
  },
  ausreichend: {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    label: 'Ausreichend',
  },
};

function ampelFromBedarf(bedarf: number): AmpelStatus {
  if (bedarf >= 5) return 'dringend';
  if (bedarf >= 3) return 'bestellen';
  return 'ausreichend';
}

function extractZutaten(item: OrderItem): string[] {
  if (item.zutaten && item.zutaten.length > 0) return item.zutaten;
  if (item.ingredients && item.ingredients.length > 0) return item.ingredients;
  if (item.name) return [item.name];
  return [];
}

export function KitchenPhase1498ZutatenEngpassWarnung({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const bedarfListe = useMemo((): ZutatBedarf[] => {
    const aktiv = orders.filter((o) => o.status && AKTIVE_STATUSES.has(o.status));
    const map = new Map<string, number>();
    for (const order of aktiv) {
      for (const item of order.items ?? []) {
        const qty = item.quantity ?? 1;
        for (const zutat of extractZutaten(item)) {
          const key = zutat.toLowerCase().trim();
          if (key) map.set(key, (map.get(key) ?? 0) + qty);
        }
      }
    }
    return Array.from(map.entries())
      .map(([zutat, bedarf]) => ({
        zutat: zutat.charAt(0).toUpperCase() + zutat.slice(1),
        bedarf,
        status: ampelFromBedarf(bedarf),
      }))
      .sort((a, b) => {
        const order: Record<AmpelStatus, number> = { dringend: 0, bestellen: 1, ausreichend: 2 };
        return order[a.status] - order[b.status] || b.bedarf - a.bedarf;
      });
  }, [orders]);

  const warnCount = useMemo(
    () => bedarfListe.filter((z) => z.status !== 'ausreichend').length,
    [bedarfListe],
  );

  if (bedarfListe.length === 0) return null;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        warnCount > 0
          ? 'border-amber-200 dark:border-amber-800'
          : 'border-slate-200 dark:border-slate-700',
      )}
    >
      {/* Header */}
      <button
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 hover:opacity-90 transition-opacity',
          warnCount > 0
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : 'bg-slate-50 dark:bg-slate-800/40',
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <Package className="w-4 h-4 text-slate-600 dark:text-slate-300 shrink-0" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 text-left">
          Zutaten-Engpass
        </span>
        {warnCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            {warnCount} Warnung{warnCount !== 1 ? 'en' : ''}
          </span>
        )}
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-3 bg-white dark:bg-slate-900 space-y-2">
          {bedarfListe.slice(0, 12).map((z) => {
            const cfg = AMPEL_CONFIG[z.status];
            return (
              <div
                key={z.zutat}
                className="flex items-center gap-3 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
              >
                <span className={cn('w-2 h-2 rounded-full shrink-0', cfg.dot)} />
                <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">
                  {z.zutat}
                </span>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400 shrink-0">
                  ×{z.bedarf}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0',
                    cfg.badge,
                  )}
                >
                  {cfg.label}
                </span>
              </div>
            );
          })}
          {bedarfListe.length > 12 && (
            <p className="text-[11px] text-slate-400 text-center pt-1">
              +{bedarfListe.length - 12} weitere Zutaten
            </p>
          )}
          <p className="text-[10px] text-slate-400 pt-1">
            Basierend auf {orders.filter((o) => o.status && AKTIVE_STATUSES.has(o.status)).length} aktiven Bestellungen
          </p>
        </div>
      )}
    </div>
  );
}
