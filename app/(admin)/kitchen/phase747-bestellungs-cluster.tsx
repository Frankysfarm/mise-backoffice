'use client';

import { useMemo } from 'react';
import { Layers } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  createdAt?: string;
  abholzeit?: string;
  items?: { menge: number }[];
}

interface Props {
  orders: Order[];
}

interface Cluster {
  slot: string;
  bestellungen: number;
  items: number;
  dringend: boolean;
}

function slotLabel(iso: string | undefined): string {
  if (!iso) return 'Sofort';
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const slot = m < 30 ? `${h}:00–${h}:30` : `${h}:30–${h + 1}:00`;
  return slot;
}

function minutenBis(iso: string | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 60_000));
}

export function KitchenPhase747BestellungsCluster({ orders }: Props) {
  const cluster = useMemo<Cluster[]>(() => {
    const aktiv = orders.filter((o) =>
      ['neu', 'new', 'pending', 'bestätigt', 'confirmed', 'in_zubereitung', 'cooking'].includes(o.status)
    );

    const map = new Map<string, { bestellungen: number; items: number; bis: number }>();
    for (const o of aktiv) {
      const slot = slotLabel(o.abholzeit ?? o.createdAt);
      const prev = map.get(slot) ?? { bestellungen: 0, items: 0, bis: minutenBis(o.abholzeit) };
      prev.bestellungen += 1;
      prev.items += Array.isArray(o.items) ? o.items.reduce((s, i) => s + (i.menge ?? 1), 0) : 1;
      map.set(slot, prev);
    }

    return Array.from(map.entries())
      .map(([slot, v]) => ({
        slot,
        bestellungen: v.bestellungen,
        items: v.items,
        dringend: v.bis < 15,
      }))
      .slice(0, 6);
  }, [orders]);

  if (cluster.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Layers className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="text-sm font-semibold">Bestellungs-Cluster</span>
        <span className="text-xs text-muted-foreground">{cluster.length} Zeitslots</span>
      </div>
      <div className="space-y-1.5">
        {cluster.map((c) => (
          <div key={c.slot} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${c.dringend ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/40'}`}>
            <span className={`text-[10px] font-bold w-20 shrink-0 ${c.dringend ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
              {c.slot}
            </span>
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${c.dringend ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, c.bestellungen * 12)}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums shrink-0 w-12 text-right">
              {c.bestellungen} Best.
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0 w-14 text-right">
              {c.items} Items
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
