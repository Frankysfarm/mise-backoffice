'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderItem = { name: string };
type Order = {
  id: string;
  bestellnummer?: string;
  status?: string;
  items: OrderItem[] | string;
};

const STATION_KEYWORDS: Record<string, string> = {
  pizza: 'Ofen', flammkuchen: 'Ofen', auflauf: 'Ofen',
  burger: 'Grill', steak: 'Grill', schnitzel: 'Grill',
  pasta: 'Herd', suppe: 'Herd', curry: 'Herd',
  salat: 'Kalt', bowl: 'Kalt', wrap: 'Kalt',
  pommes: 'Friteuse', nuggets: 'Friteuse', chicken: 'Friteuse',
};

const STATION_KAPAZITAET: Record<string, number> = {
  Ofen: 3, Grill: 2, Herd: 4, Kalt: 5, Friteuse: 3, Küche: 3,
};

const STATION_FARBEN: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  Ofen:     { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-800 dark:text-orange-200', badge: 'bg-orange-500 text-white' },
  Grill:    { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-200', badge: 'bg-red-500 text-white' },
  Herd:     { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-200', badge: 'bg-blue-500 text-white' },
  Kalt:     { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', text: 'text-cyan-800 dark:text-cyan-200', badge: 'bg-cyan-500 text-white' },
  Friteuse: { bg: 'bg-yellow-50 dark:bg-yellow-950/30', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-800 dark:text-yellow-200', badge: 'bg-yellow-500 text-white' },
  Küche:    { bg: 'bg-muted/40', border: 'border-border', text: 'text-foreground', badge: 'bg-muted text-muted-foreground' },
};

function getStation(items: OrderItem[] | string): string {
  const text = Array.isArray(items)
    ? items.map((i) => i.name.toLowerCase()).join(' ')
    : String(items).toLowerCase();
  for (const [kw, station] of Object.entries(STATION_KEYWORDS)) {
    if (text.includes(kw)) return station;
  }
  return 'Küche';
}

export function KitchenPhase1059ParallelZubereitungsKarte({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);

  const stationMap = useMemo(() => {
    const map = new Map<string, { orders: Order[]; konflikt: boolean }>();
    const aktiv = orders.filter((o) =>
      ['neu', 'angenommen', 'wartend', 'in_zubereitung', 'pending'].includes(o.status ?? '')
    );
    for (const o of aktiv) {
      const s = getStation(o.items);
      const prev = map.get(s) ?? { orders: [], konflikt: false };
      const updated = [...prev.orders, o];
      map.set(s, {
        orders: updated,
        konflikt: updated.length > (STATION_KAPAZITAET[s] ?? 3),
      });
    }
    return map;
  }, [orders]);

  const stationen = [...stationMap.entries()].sort((a, b) => {
    if (a[1].konflikt && !b[1].konflikt) return -1;
    if (!a[1].konflikt && b[1].konflikt) return 1;
    return b[1].orders.length - a[1].orders.length;
  });

  if (stationen.length === 0) return null;
  const konflikte = stationen.filter(([, v]) => v.konflikt).length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b text-left"
      >
        <GitBranch size={15} className="text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Parallel-Zubereitung — Stationsauslastung</span>
        {konflikte > 0 && (
          <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
            {konflikte} Konflikt{konflikte > 1 ? 'e' : ''}
          </span>
        )}
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {stationen.map(([station, { orders: ords, konflikt }]) => {
            const f = STATION_FARBEN[station] ?? STATION_FARBEN['Küche'];
            const kap = STATION_KAPAZITAET[station] ?? 3;
            const pct = Math.min(100, Math.round((ords.length / kap) * 100));
            return (
              <div key={station} className={cn('rounded-xl border p-3', f.bg, f.border)}>
                <div className="flex items-center justify-between mb-2">
                  <span className={cn('text-sm font-bold', f.text)}>{station}</span>
                  <div className="flex items-center gap-1.5">
                    {konflikt && (
                      <span className="text-[9px] font-bold rounded-full bg-red-500 text-white px-1.5 py-0.5 animate-pulse">
                        Überlastet
                      </span>
                    )}
                    <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', f.badge)}>
                      {ords.length}/{kap}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden mb-2">
                  <div
                    className={cn('h-full rounded-full transition-all', konflikt ? 'bg-red-500 animate-pulse' : pct >= 70 ? 'bg-amber-500' : 'bg-matcha-500')}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex flex-wrap gap-1">
                  {ords.map((o) => (
                    <span key={o.id} className={cn('text-[9px] font-bold rounded px-1.5 py-0.5', f.badge)}>
                      #{o.bestellnummer ?? o.id.slice(-4)}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
