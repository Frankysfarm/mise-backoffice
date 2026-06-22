'use client';

/**
 * BestellungAktivitaetsTimeline — Phase 406
 *
 * Vertikale Timeline aller Bestellereignisse (neueste oben).
 * API: GET /api/delivery/orders/[orderId]/events
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  message: string;
  created_at: string;
}

interface EventsData {
  events: OrderEvent[];
}

function dotColor(eventType: string): string {
  const t = eventType.toLowerCase();
  if (t.includes('deliver') || t.includes('complet') || t.includes('success') || t.includes('fertig') || t.includes('abgeschloss')) {
    return 'bg-matcha-500';
  }
  if (t.includes('warn') || t.includes('delay') || t.includes('late') || t.includes('verspät')) {
    return 'bg-amber-500';
  }
  return 'bg-blue-400';
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function BestellungAktivitaetsTimeline({ orderId }: { orderId: string }) {
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/orders/${orderId}/events`, { cache: 'no-store' });
      if (!res.ok) return;
      const json: EventsData = await res.json();
      // newest first
      const sorted = [...(json.events ?? [])].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setEvents(sorted);
    } catch {
      // ignore
    }
  }, [orderId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  if (!orderId || events.length === 0) return null;

  return (
    <div className="py-2">
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-matcha-200" />

        <div className="space-y-3">
          {events.map((event, idx) => (
            <div key={event.id} className="flex items-start gap-3 relative">
              {/* Dot */}
              <div
                className={cn(
                  'shrink-0 mt-1 h-5 w-5 rounded-full border-2 border-white flex items-center justify-center z-10',
                  dotColor(event.event_type),
                )}
              />

              {/* Content */}
              <div className="flex-1 min-w-0 pb-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[11px] text-muted-foreground font-medium tabular-nums">
                    {formatTime(event.created_at)}
                  </span>
                  {idx === 0 && (
                    <span className="inline-block rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-semibold px-1.5 py-0.5 border border-matcha-200">
                      Aktuell
                    </span>
                  )}
                </div>
                <div className="text-sm text-foreground leading-snug mt-0.5">{event.message}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
