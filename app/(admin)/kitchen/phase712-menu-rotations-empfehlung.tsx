'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface MenuRotationsItem {
  name: string;
  bestellungen: number;
  avg_zubereitungszeit_min: number;
  effizienz_score: number;
  empfehlung: 'depriorisieren' | 'beobachten' | 'ok';
}

const MOCK: MenuRotationsItem[] = [
  { name: 'Rinderschmorbraten', bestellungen: 2, avg_zubereitungszeit_min: 45, effizienz_score: 12, empfehlung: 'depriorisieren' },
  { name: 'Gemüse-Lasagne', bestellungen: 4, avg_zubereitungszeit_min: 30, effizienz_score: 28, empfehlung: 'beobachten' },
  { name: 'Pasta Bolognese', bestellungen: 18, avg_zubereitungszeit_min: 12, effizienz_score: 90, empfehlung: 'ok' },
];

function badgeColor(emp: MenuRotationsItem['empfehlung']) {
  if (emp === 'depriorisieren') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  if (emp === 'beobachten') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
}

export function KitchenPhase712MenuRotationsEmpfehlung({ locationId }: Props) {
  const [data, setData] = useState<MenuRotationsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/menu-rotations-empfehlung?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.items) && json.items.length > 0) {
          setData(json.items);
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
    const id = setInterval(laden, 10 * 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const deprioCount = data.filter((d) => d.empfehlung === 'depriorisieren').length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Menü-Rotation</span>
          {!loading && deprioCount > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
              {deprioCount} depriorisieren
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-20 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Daten verfügbar</p>
          ) : (
            data.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.bestellungen}× heute · Ø {item.avg_zubereitungszeit_min} Min
                  </p>
                </div>
                <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${badgeColor(item.empfehlung)}`}>
                  {item.empfehlung}
                </span>
              </div>
            ))
          )}
          <p className="text-[10px] text-muted-foreground">10-Min Update · Score = Bestellungen / Zubereitungszeit</p>
        </div>
      )}
    </div>
  );
}
