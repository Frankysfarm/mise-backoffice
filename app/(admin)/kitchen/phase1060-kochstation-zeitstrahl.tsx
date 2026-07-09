'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status?: string;
  items: { name: string }[] | string;
  created_at?: string;
  bestellt_am?: string;
  prep_time?: number;
};

const STATION_KEYWORDS: Record<string, string> = {
  pizza: 'Ofen', flammkuchen: 'Ofen',
  burger: 'Grill', steak: 'Grill', schnitzel: 'Grill',
  pasta: 'Herd', suppe: 'Herd',
  salat: 'Kalt', wrap: 'Kalt',
  pommes: 'Friteuse', nuggets: 'Friteuse',
};

function getStation(items: { name: string }[] | string): string {
  const text = Array.isArray(items) ? items.map((i) => i.name.toLowerCase()).join(' ') : String(items).toLowerCase();
  for (const [kw, s] of Object.entries(STATION_KEYWORDS)) if (text.includes(kw)) return s;
  return 'Küche';
}

const SLOTS = [0, 10, 20, 30] as const;

const SLOT_FARBEN = ['bg-matcha-500', 'bg-amber-400', 'bg-orange-500', 'bg-red-500'];

export function KitchenPhase1060KochstationZeitstrahl({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);

  const stationSlots = useMemo(() => {
    const now = Date.now();
    const aktiv = orders.filter((o) =>
      ['neu', 'angenommen', 'wartend', 'in_zubereitung', 'pending'].includes(o.status ?? '')
    );

    const map = new Map<string, number[]>();

    for (const o of aktiv) {
      const station = getStation(o.items);
      const prepMin = o.prep_time ?? 20;
      const ref = o.bestellt_am ?? o.created_at;
      const startMs = ref ? new Date(ref).getTime() : now;
      const readyMs = startMs + prepMin * 60 * 1000;
      const readyInMin = Math.max(0, Math.round((readyMs - now) / 60000));

      const slotIdx = SLOTS.findLastIndex((s) => readyInMin >= s);
      const idx = slotIdx >= 0 ? slotIdx : 0;

      const prev = map.get(station) ?? [0, 0, 0, 0];
      prev[idx] = (prev[idx] ?? 0) + 1;
      map.set(station, prev);
    }

    return [...map.entries()].sort((a, b) => {
      const totalA = a[1].reduce((s, v) => s + v, 0);
      const totalB = b[1].reduce((s, v) => s + v, 0);
      return totalB - totalA;
    });
  }, [orders]);

  if (stationSlots.length === 0) return null;

  const slotLabels = ['Jetzt', '+10 Min', '+20 Min', '+30 Min'];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
      >
        <BarChart2 size={15} className="text-orange-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Kochstation-Zeitstrahl — Nächste 30 Min</span>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {/* Header */}
          <div className="grid grid-cols-5 gap-1 text-[9px] font-bold uppercase tracking-wide text-muted-foreground px-1">
            <span>Station</span>
            {slotLabels.map((l) => (
              <span key={l} className="text-center">{l}</span>
            ))}
          </div>

          {stationSlots.map(([station, counts]) => {
            const max = Math.max(...counts, 1);
            return (
              <div key={station} className="grid grid-cols-5 gap-1 items-center">
                <span className="text-xs font-bold truncate">{station}</span>
                {counts.map((count, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <div className="w-full h-8 rounded flex items-end overflow-hidden bg-black/5">
                      <div
                        className={cn('w-full rounded transition-all', SLOT_FARBEN[i])}
                        style={{ height: `${count === 0 ? 0 : Math.max(15, (count / max) * 100)}%` }}
                      />
                    </div>
                    <span className={cn('text-[9px] font-bold', count === 0 ? 'text-muted-foreground' : 'text-foreground')}>
                      {count > 0 ? count : '—'}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}

          <p className="text-[9px] text-muted-foreground pt-1">
            Zeigt voraussichtliche Fertigstellungszeiten je Station auf Basis der aktuellen Prep-Zeit
          </p>
        </div>
      )}
    </div>
  );
}
