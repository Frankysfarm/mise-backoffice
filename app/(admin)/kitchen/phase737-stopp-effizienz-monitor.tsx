'use client';

import { useMemo } from 'react';
import { Gauge } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  items?: { menge: number }[];
  createdAt?: string;
  completedAt?: string;
  prep_time_min?: number;
}

interface Props {
  orders: Order[];
}

interface Metrik {
  label: string;
  wert: string;
  farbe: string;
}

export function KitchenPhase737StoppEffizienzMonitor({ orders }: Props) {
  const metriken = useMemo<Metrik[]>(() => {
    const fertig = orders.filter((o) => o.status === 'fertig' || o.status === 'ready' || o.status === 'completed');
    if (fertig.length === 0) return [];

    const gesamtItems = fertig.reduce((s, o) => {
      const n = Array.isArray(o.items) ? o.items.reduce((a, i) => a + (i.menge ?? 1), 0) : 1;
      return s + n;
    }, 0);

    const avgPrepMin = fertig.reduce((s, o) => s + (o.prep_time_min ?? 15), 0) / fertig.length;
    const itemsProMin = avgPrepMin > 0 ? gesamtItems / avgPrepMin : 0;

    const aktiv = orders.filter((o) => o.status === 'in_zubereitung' || o.status === 'cooking');
    const wartend = orders.filter((o) => o.status === 'neu' || o.status === 'new' || o.status === 'pending');

    const score = Math.min(100, Math.round(itemsProMin * 20));

    const farbe = score >= 70 ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 40 ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

    return [
      { label: 'Items/Min', wert: itemsProMin.toFixed(1), farbe },
      { label: 'Ø Prep-Zeit', wert: `${Math.round(avgPrepMin)} Min`, farbe: 'text-foreground' },
      { label: 'In Arbeit', wert: String(aktiv.length), farbe: 'text-blue-600 dark:text-blue-400' },
      { label: 'Wartend', wert: String(wartend.length), farbe: wartend.length > 5 ? 'text-red-600 dark:text-red-400' : 'text-foreground' },
    ];
  }, [orders]);

  if (metriken.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-slate-600 dark:text-slate-400" />
        <span className="text-sm font-semibold">Stopp-Effizienz</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {metriken.map((m) => (
          <div key={m.label} className="rounded-lg bg-muted/40 px-2 py-2 text-center">
            <p className={`text-lg font-black tabular-nums ${m.farbe}`}>{m.wert}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
