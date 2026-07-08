'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface MenuHighlight {
  id: string;
  name: string;
  beschreibung?: string;
  rang: number;
}

const MOCK: MenuHighlight[] = [
  { id: '1', name: 'Tagessuppe: Tomatencrème', beschreibung: 'Frisch aus der Küche', rang: 1 },
  { id: '2', name: 'Sonderangebot: Pizza Quattro', beschreibung: 'Heute -20%', rang: 2 },
  { id: '3', name: 'Dessert-Empfehlung: Tiramisu', rang: 3 },
];

export function KitchenPhase727TagesMenuHighlights({ locationId }: Props) {
  const [data, setData] = useState<MenuHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/scheduled?location_id=${locationId}&type=menu_highlight`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        const items = json.items ?? json.highlights ?? [];
        if (items.length > 0) {
          setData(items.map((it: MenuHighlight, idx: number) => ({ ...it, rang: idx + 1 })));
          return;
        }
      }
    } catch {
      // fallback
    }
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    laden().finally(() => setLoading(false));
    const id = setInterval(laden, 15 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold">Tages-Highlights</span>
          <span className="text-[10px] text-muted-foreground">{data.length} Empfehlung{data.length !== 1 ? 'en' : ''}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-16 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Highlights heute</p>
          ) : (
            data.map((item) => (
              <div key={item.id} className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/10 p-2">
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400 shrink-0">{item.rang}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">{item.name}</p>
                  {item.beschreibung && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">{item.beschreibung}</p>
                  )}
                </div>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">15-Min Update · Eingestellt im Admin-Bereich</p>
        </div>
      )}
    </div>
  );
}
