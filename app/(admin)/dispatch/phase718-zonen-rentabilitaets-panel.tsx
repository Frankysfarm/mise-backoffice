'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, PieChart } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface ZoneRentabilitaet {
  zone: string;
  einnahmen_eur: number;
  db_eur: number;
  db_marge_pct: number;
  batches_count: number;
  bewertung: 'profitabel' | 'neutral' | 'verlust';
}

const MOCK: ZoneRentabilitaet[] = [
  { zone: 'Zone A', einnahmen_eur: 420, db_eur: 168, db_marge_pct: 40, batches_count: 52, bewertung: 'profitabel' },
  { zone: 'Zone B', einnahmen_eur: 280, db_eur: 56, db_marge_pct: 20, batches_count: 38, bewertung: 'neutral' },
  { zone: 'Zone C', einnahmen_eur: 95, db_eur: -12, db_marge_pct: -13, batches_count: 11, bewertung: 'verlust' },
];

function bewertungColor(b: ZoneRentabilitaet['bewertung']) {
  if (b === 'profitabel') return 'text-emerald-600 dark:text-emerald-400';
  if (b === 'neutral') return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function bewertungBadge(b: ZoneRentabilitaet['bewertung']) {
  if (b === 'profitabel') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  if (b === 'neutral') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300';
}

export function DispatchPhase718ZonenRentabilitaetsPanel({ locationId }: Props) {
  const [data, setData] = useState<ZoneRentabilitaet[]>([]);
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
        `/api/delivery/admin/zonen-rentabilitaet?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.zonen) && json.zonen.length > 0) {
          setData(json.zonen);
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

  const verlustZonen = data.filter((z) => z.bewertung === 'verlust').length;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <PieChart className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <span className="text-sm font-semibold">Zonen-Rentabilität</span>
          {!loading && verlustZonen > 0 && (
            <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
              {verlustZonen} Verlustzone{verlustZonen > 1 ? 'n' : ''}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="h-24 animate-pulse rounded bg-muted" />
          ) : data.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Keine Daten (30 Tage)</p>
          ) : (
            <>
              <div className="space-y-1.5">
                {data.map((z) => (
                  <div key={z.zone} className="flex items-center gap-2">
                    <div className="w-16 shrink-0">
                      <p className="text-xs font-semibold">{z.zone}</p>
                      <p className="text-[9px] text-muted-foreground">{z.batches_count} Touren</p>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${z.bewertung === 'profitabel' ? 'bg-emerald-500' : z.bewertung === 'neutral' ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.max(5, Math.min(100, Math.abs(z.db_marge_pct)))}%` }}
                          />
                        </div>
                        <span className={`text-xs font-bold tabular-nums w-10 text-right shrink-0 ${bewertungColor(z.bewertung)}`}>
                          {z.db_marge_pct}%
                        </span>
                      </div>
                    </div>
                    <span className={`text-[9px] font-semibold rounded-full px-2 py-0.5 shrink-0 ${bewertungBadge(z.bewertung)}`}>
                      {z.bewertung}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-right">10-Min Update · DB = Einnahmen − Kraftstoff − Zeit</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
