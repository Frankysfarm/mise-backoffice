'use client';

import { useCallback, useEffect, useState } from 'react';
import { Users } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface WarteschlangenInfo {
  bestellungen_in_kueche: number;
  geschaetzte_wartezeit_min: number;
}

const MOCK: WarteschlangenInfo = {
  bestellungen_in_kueche: 7,
  geschaetzte_wartezeit_min: 12,
};

export function Phase720WarteschlangenAnzeige({ locationId }: Props) {
  const [data, setData] = useState<WarteschlangenInfo | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) {
      setData(MOCK);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/kunden-wartezeit-live?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        if (typeof json.bestellungen_in_kueche === 'number') {
          setData(json);
          return;
        }
        // Fallback: try to parse from kitchen backlog
        if (typeof json.aktive_bestellungen === 'number') {
          setData({
            bestellungen_in_kueche: json.aktive_bestellungen,
            geschaetzte_wartezeit_min: Math.max(5, json.aktive_bestellungen * 2),
          });
          return;
        }
      }
    } catch {
      // silent fallback
    }
    setData(null);
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 90_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data || data.bestellungen_in_kueche < 3) return null;

  const viel = data.bestellungen_in_kueche >= 8;

  return (
    <div className={`rounded-xl border p-3 ${viel
      ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20'
      : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20'
    }`}>
      <div className="flex items-center gap-2">
        <Users className={`h-4 w-4 shrink-0 ${viel ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${viel ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>
            {data.bestellungen_in_kueche} Bestellungen vor dir in der Küche
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Geschätzte Wartezeit: ca. {data.geschaetzte_wartezeit_min} Min zusätzlich
          </p>
        </div>
      </div>
    </div>
  );
}
