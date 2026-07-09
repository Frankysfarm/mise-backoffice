'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, Clock, Flame } from 'lucide-react';

type KitchenOrder = {
  id: string;
  status: string;
  created_at?: string;
  estimated_delivery_time?: string;
  items?: { name: string; menge: number }[];
};

type Props = { orders: KitchenOrder[] };

type Slot = { label: string; load: number; count: number };

function buildSlots(orders: KitchenOrder[]): Slot[] {
  const now = Date.now();
  const slots: Slot[] = [
    { label: 'Jetzt', load: 0, count: 0 },
    { label: '+10m', load: 0, count: 0 },
    { label: '+20m', load: 0, count: 0 },
    { label: '+30m', load: 0, count: 0 },
  ];

  const active = orders.filter(o =>
    ['neu', 'bestaetigt', 'in_zubereitung', 'bereit'].includes(o.status),
  );

  for (const o of active) {
    const created = o.created_at ? new Date(o.created_at).getTime() : now;
    const ageMin = (now - created) / 60000;
    // assume 15 min prep, assign order to slot based on remaining prep time
    const remainMin = Math.max(0, 15 - ageMin);
    const itemCount = o.items?.reduce((s, i) => s + i.menge, 0) ?? 1;

    if (remainMin <= 2) {
      slots[0].count += itemCount;
    } else if (remainMin <= 12) {
      slots[1].count += itemCount;
    } else if (remainMin <= 22) {
      slots[2].count += itemCount;
    } else {
      slots[3].count += itemCount;
    }
  }

  const max = Math.max(...slots.map(s => s.count), 1);
  return slots.map(s => ({ ...s, load: Math.round((s.count / max) * 100) }));
}

function loadColor(load: number) {
  if (load >= 80) return { bar: 'bg-red-500', text: 'text-red-600', label: 'Hoch' };
  if (load >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600', label: 'Mittel' };
  return { bar: 'bg-matcha-500', text: 'text-matcha-600', label: 'Niedrig' };
}

export function KitchenPhase956AuslastungsPrognoseBoard({ orders }: Props) {
  const [slots, setSlots] = useState<Slot[]>(() => buildSlots(orders));

  useEffect(() => {
    setSlots(buildSlots(orders));
    const id = setInterval(() => setSlots(buildSlots(orders)), 30000);
    return () => clearInterval(id);
  }, [orders]);

  const maxLoad = Math.max(...slots.map(s => s.load));
  const peakSlot = slots.find(s => s.load === maxLoad);

  return (
    <Card className="p-4 border border-stone-200 bg-white">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-orange-600">
          <TrendingUp className="h-3.5 w-3.5" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">Küchen-Auslastungs-Prognose</div>
          <div className="text-[10px] text-muted-foreground">Geschätzter Küchendrucks — nächste 30 Min.</div>
        </div>
        {maxLoad >= 80 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
            <Flame className="h-3 w-3" /> Peak jetzt
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {slots.map((slot, i) => {
          const c = loadColor(slot.load);
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className="w-full h-16 bg-stone-100 rounded-lg overflow-hidden flex items-end">
                <div
                  className={cn('w-full rounded-t-lg transition-all duration-700', c.bar)}
                  style={{ height: `${Math.max(slot.load, 4)}%` }}
                />
              </div>
              <div className="text-[9px] font-bold text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-2.5 w-2.5" />
                {slot.label}
              </div>
              <div className={cn('text-[10px] font-black tabular-nums', c.text)}>
                {slot.count} Art.
              </div>
              <div className={cn('text-[9px] font-semibold', c.text)}>{c.label}</div>
            </div>
          );
        })}
      </div>

      {peakSlot && maxLoad >= 50 && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] text-amber-800 font-medium">
          Spitze erwartet bei <strong>{peakSlot.label}</strong> — {peakSlot.count} Artikel in Zubereitung.
          {maxLoad >= 80 && ' Alle Stationen aktivieren.'}
        </div>
      )}
    </Card>
  );
}
