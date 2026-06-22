'use client';

/**
 * KitchenEchtzeitBatchKochstartKommando — Phase 406
 *
 * Zeigt alle Bestellungen, deren Kochstart in den nächsten 15 Minuten fällig ist
 * oder bereits überfällig ist.
 * API: GET /api/delivery/kitchen/queue?location_id=...
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QueueItem {
  id: string;
  order_id: string;
  batch_id: string;
  tour_pickup_at: string;
  cook_start_at: string;
  ready_target: string;
  prep_min: number;
  status: string;
  overdue: boolean;
}

function getMinutesUntil(isoString: string): number {
  return Math.round((new Date(isoString).getTime() - Date.now()) / 60_000);
}

function rowStyle(item: QueueItem): string {
  const minsUntil = getMinutesUntil(item.cook_start_at);
  if (item.overdue || minsUntil < 0) return 'bg-red-50 border-red-200';
  if (minsUntil <= 5) return 'bg-amber-50 border-amber-200';
  return 'bg-matcha-50 border-matcha-200';
}

function countdownLabel(item: QueueItem): string {
  const minsUntil = getMinutesUntil(item.cook_start_at);
  if (item.overdue || minsUntil < 0) return `seit ${Math.abs(minsUntil)} min fällig`;
  if (minsUntil === 0) return 'jetzt';
  return `in ${minsUntil} min`;
}

function countdownColor(item: QueueItem): string {
  const minsUntil = getMinutesUntil(item.cook_start_at);
  if (item.overdue || minsUntil < 0) return 'text-red-700 font-bold';
  if (minsUntil <= 5) return 'text-amber-700 font-semibold';
  return 'text-matcha-700';
}

export function KitchenEchtzeitBatchKochstartKommando({ locationId }: { locationId?: string | null }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [open, setOpen] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/kitchen/queue?${params}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json: QueueItem[] = await res.json();
      // Filter: overdue OR cook_start_at within next 15 min, not yet cooking/ready
      const now = Date.now();
      const filtered = json
        .filter((item) => {
          if (item.status === 'cooking' || item.status === 'ready') return false;
          const minsUntil = (new Date(item.cook_start_at).getTime() - now) / 60_000;
          return item.overdue || minsUntil <= 15;
        })
        .sort((a, b) => new Date(a.cook_start_at).getTime() - new Date(b.cook_start_at).getTime())
        .slice(0, 8);
      setItems(filtered);
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 20_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-matcha-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-sm text-foreground">Kochstart-Kommando</span>
          {items.length > 0 && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
              {items.length}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t border-matcha-200">
          {items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Keine Kochstarts fällig
            </div>
          ) : (
            <div className="divide-y divide-matcha-100">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2.5 border-l-4',
                    rowStyle(item),
                  )}
                >
                  {/* Batch ref */}
                  <div className="shrink-0">
                    <div className="text-[10px] text-muted-foreground font-mono">
                      #{item.batch_id.slice(0, 8)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {item.prep_min} min Prep
                    </div>
                  </div>

                  {/* Order */}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">Bestellung {item.order_id.slice(0, 8)}</div>
                    {(item.overdue || getMinutesUntil(item.cook_start_at) < 0) && (
                      <span className="inline-block rounded-full bg-red-500 text-white text-[10px] font-semibold px-2 py-0.5 mt-0.5">
                        Jetzt kochen!
                      </span>
                    )}
                  </div>

                  {/* Countdown */}
                  <div className={cn('shrink-0 text-xs text-right', countdownColor(item))}>
                    {countdownLabel(item)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
