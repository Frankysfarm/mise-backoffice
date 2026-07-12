'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1124 — Bestellungs-Burst-Warnung (Kitchen)
// Alert wenn in den letzten 5 Min mehr als X Bestellungen eintreffen + empfohlene Vorabzubereitung

interface Item { name?: string; title?: string; quantity?: number }
interface Order {
  id: string;
  status: string;
  created_at?: string | null;
  items?: Item[] | null;
}
interface Props { orders: Order[] }

const BURST_THRESHOLD = 5;
const WINDOW_MS = 5 * 60 * 1000;

type BurstResult = {
  burst: boolean;
  count: number;
  threshold: number;
  topItems: { name: string; qty: number }[];
};

function analyzeBurst(orders: Order[]): BurstResult {
  const cutoff = Date.now() - WINDOW_MS;
  const recent = orders.filter(o => o.created_at && new Date(o.created_at).getTime() >= cutoff);
  const count = recent.length;
  const burst = count >= BURST_THRESHOLD;

  const itemMap = new Map<string, number>();
  for (const o of recent) {
    for (const it of o.items ?? []) {
      const name = it.name ?? it.title ?? 'Unbekannt';
      const qty = it.quantity ?? 1;
      itemMap.set(name, (itemMap.get(name) ?? 0) + qty);
    }
  }

  const topItems = Array.from(itemMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, qty]) => ({ name, qty }));

  return { burst, count, threshold: BURST_THRESHOLD, topItems };
}

export function KitchenPhase1124BestellungsBurstWarnung({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const result = useMemo(() => analyzeBurst(orders), [orders]);

  if (!result.burst) return null;

  return (
    <div className={cn(
      'rounded-xl border shadow-sm overflow-hidden',
      'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-950/40',
    )}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-orange-500 animate-pulse shrink-0" />
          <span className="font-bold text-sm text-orange-700 dark:text-orange-300">
            Bestellungs-Burst erkannt
          </span>
          <span className="rounded-full bg-orange-500 text-white text-[10px] font-black px-2 py-0.5">
            {result.count} in 5 Min
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-orange-500" /> : <ChevronDown className="h-4 w-4 text-orange-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-start gap-2 rounded-lg bg-orange-100 dark:bg-orange-900/40 p-3">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-700 dark:text-orange-300 font-medium">
              {result.count} Bestellungen in den letzten 5 Minuten — Burst-Schwelle ({result.threshold}) überschritten. Küche jetzt priorisieren!
            </p>
          </div>

          {result.topItems.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-orange-700 dark:text-orange-300 mb-2 uppercase tracking-wide">
                Empfohlene Vorabzubereitung
              </p>
              <div className="space-y-1.5">
                {result.topItems.map(it => (
                  <div key={it.name} className="flex items-center justify-between rounded-lg bg-white dark:bg-black/20 border border-orange-200 dark:border-orange-700 px-3 py-2">
                    <span className="text-sm font-medium text-foreground truncate max-w-[75%]">{it.name}</span>
                    <span className="text-xs font-black text-orange-600 dark:text-orange-400 shrink-0 ml-2">
                      ×{it.qty} vorbereiten
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
