'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface Item {
  name: string;
  menge?: number;
}

interface Order {
  status?: string | null;
  created_at?: string | null;
  items?: Item[] | null;
}

interface Props {
  orders: Order[];
  schwelleMinuten?: number;
}

interface StauItem {
  name: string;
  anzahl: number;
  aeltesteMinuten: number;
}

export function KitchenPhase707ZubereitungsStauMonitor({ orders, schwelleMinuten = 20 }: Props) {
  const [jetzt, setJetzt] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setJetzt(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const stauItems = useMemo<StauItem[]>(() => {
    const aktiv = orders.filter(
      (o) => o.status && ['confirmed', 'preparing'].includes(o.status) && o.created_at,
    );

    const itemMap: Record<string, { anzahl: number; aeltesteMinuten: number }> = {};

    for (const order of aktiv) {
      const ageMin = (jetzt - new Date(order.created_at!).getTime()) / 60_000;
      if (ageMin < schwelleMinuten) continue;

      for (const item of order.items ?? []) {
        const key = item.name;
        if (!itemMap[key]) itemMap[key] = { anzahl: 0, aeltesteMinuten: 0 };
        itemMap[key].anzahl += item.menge ?? 1;
        itemMap[key].aeltesteMinuten = Math.max(itemMap[key].aeltesteMinuten, ageMin);
      }
    }

    return Object.entries(itemMap)
      .map(([name, { anzahl, aeltesteMinuten }]) => ({
        name,
        anzahl,
        aeltesteMinuten: Math.round(aeltesteMinuten),
      }))
      .sort((a, b) => b.aeltesteMinuten - a.aeltesteMinuten);
  }, [orders, jetzt, schwelleMinuten]);

  if (stauItems.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
        <span className="text-xs font-bold text-red-700 dark:text-red-400">
          Zubereitungs-Stau ({stauItems.length} Gericht{stauItems.length !== 1 ? 'e' : ''})
        </span>
      </div>
      <div className="space-y-1">
        {stauItems.slice(0, 5).map((item) => (
          <div key={item.name} className="flex items-center justify-between text-[11px]">
            <span className="font-medium truncate max-w-[60%]">{item.name}</span>
            <div className="flex items-center gap-2 text-muted-foreground shrink-0">
              <span className="font-semibold text-red-600 dark:text-red-400">×{item.anzahl}</span>
              <span>{item.aeltesteMinuten} Min</span>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground">Gerichte in Bestellungen &gt;{schwelleMinuten} Min · 30s Aktualisierung</p>
    </div>
  );
}
