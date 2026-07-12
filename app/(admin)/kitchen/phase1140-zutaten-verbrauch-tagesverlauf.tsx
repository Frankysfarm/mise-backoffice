'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1140 — Zutaten-Verbrauch-Tagesverlauf (Kitchen)
// Stündlicher Verbrauch der Top-5-Zutaten als Liniendiagramm + Hochrechnung bis Schichtende

interface OrderItem {
  name?: string;
  title?: string;
  quantity?: number;
  qty?: number;
}

interface Order {
  id: string;
  created_at?: string;
  items?: OrderItem[] | string;
  status?: string;
}

interface Props {
  orders: Order[];
}

function parseItems(raw: OrderItem[] | string | undefined): OrderItem[] {
  if (!raw) return [];
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as OrderItem[]; } catch { return []; }
  }
  return raw;
}

function itemName(it: OrderItem): string {
  return it.name ?? it.title ?? 'Artikel';
}

function extractZutat(name: string): string {
  return name.split(' ')[0];
}

type StundeSlot = {
  stunde: number;
  label: string;
  counts: Record<string, number>;
};

export function KitchenPhase1140ZutatenVerbrauchTagesverlauf({ orders }: Props) {
  const [open, setOpen] = useState(false);

  const { top5, slots, hochrechnung } = useMemo(() => {
    const now = new Date();
    const nowHour = now.getUTCHours();

    // Count totals per zutat
    const total: Record<string, number> = {};
    for (const o of orders) {
      const items = parseItems(o.items);
      for (const it of items) {
        const z = extractZutat(itemName(it));
        total[z] = (total[z] ?? 0) + (it.quantity ?? it.qty ?? 1);
      }
    }

    const sorted = Object.entries(total).sort((a, b) => b[1] - a[1]);
    const top5Keys = sorted.slice(0, 5).map(([k]) => k);

    // Build hourly slots for the last 8h
    const startHour = Math.max(0, nowHour - 7);
    const hours = Array.from({ length: nowHour - startHour + 1 }, (_, i) => startHour + i);

    const slotMap: Record<number, Record<string, number>> = {};
    for (const h of hours) slotMap[h] = {};

    for (const o of orders) {
      if (!o.created_at) continue;
      const h = new Date(o.created_at).getUTCHours();
      if (!(h in slotMap)) continue;
      const items = parseItems(o.items);
      for (const it of items) {
        const z = extractZutat(itemName(it));
        if (!top5Keys.includes(z)) continue;
        slotMap[h][z] = (slotMap[h][z] ?? 0) + (it.quantity ?? it.qty ?? 1);
      }
    }

    const slots: StundeSlot[] = hours.map(h => ({
      stunde: h,
      label: `${String(h).padStart(2, '0')}:00`,
      counts: slotMap[h],
    }));

    // Hochrechnung: avg per completed hour * remaining hours
    const completedHours = slots.filter(s => s.stunde < nowHour);
    const schichtEnde = Math.min(23, nowHour + 4);
    const remainingHours = schichtEnde - nowHour;

    const hochrechnung: Record<string, number> = {};
    for (const z of top5Keys) {
      const avgPerH = completedHours.length
        ? completedHours.reduce((s, sl) => s + (sl.counts[z] ?? 0), 0) / completedHours.length
        : 0;
      hochrechnung[z] = Math.round(avgPerH * remainingHours);
    }

    return { top5: top5Keys, slots, hochrechnung };
  }, [orders]);

  const colors = [
    'bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500',
  ];
  const textColors = [
    'text-violet-600 dark:text-violet-400',
    'text-blue-600 dark:text-blue-400',
    'text-emerald-600 dark:text-emerald-400',
    'text-amber-600 dark:text-amber-400',
    'text-rose-600 dark:text-rose-400',
  ];

  // Max value per slot for bar scaling
  const maxVal = Math.max(
    1,
    ...slots.flatMap(s => top5.map(z => s.counts[z] ?? 0)),
  );

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="font-bold text-sm text-violet-700 dark:text-violet-300">Zutaten-Tagesverlauf</span>
          <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold">
            Top {top5.length} Artikel
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-violet-200 dark:border-violet-800 px-4 pb-4 pt-3 space-y-4">
          {top5.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Bestelldaten für heute.</p>
          )}

          {top5.length > 0 && (
            <>
              {/* Legende */}
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {top5.map((z, i) => (
                  <div key={z} className="flex items-center gap-1">
                    <span className={cn('inline-block h-2.5 w-2.5 rounded-full', colors[i])} />
                    <span className={cn('text-[11px] font-medium', textColors[i])}>{z}</span>
                  </div>
                ))}
              </div>

              {/* Stunden-Balken */}
              <div className="space-y-2">
                {slots.map(slot => {
                  const total = top5.reduce((s, z) => s + (slot.counts[z] ?? 0), 0);
                  return (
                    <div key={slot.stunde} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-[10px] font-mono text-muted-foreground">{slot.label}</span>
                      <div className="flex-1 h-5 rounded-full bg-muted/40 overflow-hidden flex">
                        {top5.map((z, i) => {
                          const w = ((slot.counts[z] ?? 0) / maxVal) * 100;
                          return w > 0 ? (
                            <div
                              key={z}
                              className={cn('h-full', colors[i])}
                              style={{ width: `${w}%` }}
                              title={`${z}: ${slot.counts[z] ?? 0}`}
                            />
                          ) : null;
                        })}
                      </div>
                      <span className="w-8 shrink-0 text-right text-[10px] font-bold tabular-nums text-muted-foreground">
                        {total}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Hochrechnung */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Hochrechnung bis Schichtende
                </p>
                <div className="flex flex-wrap gap-2">
                  {top5.map((z, i) => (
                    <div key={z} className={cn('rounded-lg border px-2.5 py-1.5 text-center',
                      'border-violet-200 dark:border-violet-700 bg-white dark:bg-violet-900/30')}>
                      <div className={cn('text-[10px] font-medium truncate max-w-[80px]', textColors[i])}>{z}</div>
                      <div className="text-sm font-black tabular-nums text-foreground">+{hochrechnung[z] ?? 0}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
