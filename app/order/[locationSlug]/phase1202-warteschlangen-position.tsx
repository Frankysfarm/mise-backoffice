'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock, Users, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1202 — Echtzeit-Warteschlangen-Position (Storefront)
// "Du bist Bestellung #3 in der Warteschlange" wenn Küche ausgelastet

interface Props {
  orderId: string;
  locationId: string;
}

type ApiData = {
  position: number;
  gesamt_wartend: number;
  order_id: string;
  status: string;
  kueche_ausgelastet: boolean;
  geschaetzte_wartezeit_min: number | null;
  message: string;
};

export function Phase1202WarteschlangenPosition({ orderId, locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/customer/warteschlangen-position?order_id=${encodeURIComponent(orderId)}&location_id=${encodeURIComponent(locationId)}`,
      );
      if (!res.ok) return;
      const json = await res.json() as ApiData;
      setData(json);
      // Auto-dismiss once no longer in queue
      if (!json.kueche_ausgelastet || json.position === 0) setDismissed(true);
    } catch {
      // silent
    }
  }, [orderId, locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (dismissed || !data) return null;
  if (!data.kueche_ausgelastet) return null;

  const position = data.position;
  const total = data.gesamt_wartend;

  return (
    <div
      className={cn(
        'rounded-xl border px-4 py-3 flex items-start gap-3 shadow-sm',
        position === 1
          ? 'border-matcha-300 bg-matcha-50 dark:border-matcha-700 dark:bg-matcha-950/30'
          : 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30',
      )}
    >
      {position === 1 ? (
        <CheckCircle className="h-5 w-5 text-matcha-500 shrink-0 mt-0.5" />
      ) : (
        <Clock className={cn('h-5 w-5 shrink-0 mt-0.5', 'text-amber-500')} />
      )}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-bold text-sm',
          position === 1 ? 'text-matcha-700 dark:text-matcha-300' : 'text-amber-700 dark:text-amber-300',
        )}>
          {position === 1 ? 'Du bist als Nächstes dran!' : `Du bist Bestellung #${position} in der Warteschlange`}
        </p>
        <div className="flex items-center gap-3 mt-1">
          {total > 1 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" />
              {total} Bestellungen aktiv
            </span>
          )}
          {data.geschaetzte_wartezeit_min && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              ~{data.geschaetzte_wartezeit_min} Min Wartezeit
            </span>
          )}
        </div>
        {/* Position progress dots */}
        {total > 1 && total <= 10 && (
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: Math.min(total, 8) }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-2 w-2 rounded-full',
                  i < position - 1
                    ? 'bg-muted-foreground/30'
                    : i === position - 1
                      ? (position === 1 ? 'bg-matcha-500 ring-2 ring-matcha-300' : 'bg-amber-500 ring-2 ring-amber-300')
                      : 'bg-muted',
                )}
              />
            ))}
            {total > 8 && <span className="text-[10px] text-muted-foreground">+{total - 8}</span>}
          </div>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-foreground hover:text-foreground text-lg leading-none shrink-0 -mt-0.5"
        aria-label="Schließen"
      >
        ×
      </button>
    </div>
  );
}
