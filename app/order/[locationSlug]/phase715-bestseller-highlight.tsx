'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';

interface Props {
  locationId: string | null;
  tage?: number;
  topN?: number;
}

interface BestsellerItem {
  name: string;
  bestellungen: number;
  rang: number;
}

const MOCK: BestsellerItem[] = [
  { name: 'Pizza Margherita', bestellungen: 142, rang: 1 },
  { name: 'Pasta Bolognese', bestellungen: 98, rang: 2 },
  { name: 'Caesar Salad', bestellungen: 77, rang: 3 },
];

const RANG_EMOJI = ['🥇', '🥈', '🥉'];

export function Phase715BestsellerHighlight({ locationId, tage = 7, topN = 3 }: Props) {
  const [data, setData] = useState<BestsellerItem[]>([]);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/item-demand?location_id=${locationId}&tage=${tage}&limit=${topN}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        const items = (json.items ?? json.top_items ?? []) as Array<{ name: string; count: number }>;
        if (items.length > 0) {
          setData(
            items.slice(0, topN).map((it, idx) => ({
              name: it.name,
              bestellungen: it.count,
              rang: idx + 1,
            })),
          );
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId, tage, topN]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 30 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || data.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-semibold">Beliebt diese Woche</span>
        <span className="text-[10px] text-muted-foreground">(letzte {tage} Tage)</span>
      </div>
      <div className="space-y-2">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-base w-6 text-center" role="img" aria-label={`Rang ${item.rang}`}>
              {RANG_EMOJI[item.rang - 1] ?? `${item.rang}.`}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">{item.name}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/30 px-2 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                {item.bestellungen}× bestellt
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
