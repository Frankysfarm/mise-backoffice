'use client';

/**
 * Phase 582 — Storefront: Küchenstatus-Live-Badge
 *
 * Kleines Badge das den aktuellen Küchenstatus der Filiale signalisiert.
 * Errechnet den Status aus der Anzahl aktiver Bestellungen in Zubereitung.
 *
 * Status-Level:
 *   normal → < 5 Bestellungen in Zubereitung
 *   busy   → 5–9 Bestellungen
 *   peak   → ≥ 10 Bestellungen
 *
 * Holt Daten von /api/delivery/kitchen/queue?location_id=...
 * Fallback: zeigt nichts bei Fehler.
 * Ticker: 60s
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

type KitchenStatus = 'normal' | 'busy' | 'peak';

const STATUS_CFG: Record<KitchenStatus, { label: string; bg: string; border: string; textColor: string; dotColor: string }> = {
  normal: { label: 'Küche bereit',   bg: 'bg-emerald-50',  border: 'border-emerald-200', textColor: 'text-emerald-700', dotColor: 'bg-emerald-500' },
  busy:   { label: 'Küche beschäftigt', bg: 'bg-amber-50', border: 'border-amber-200',   textColor: 'text-amber-700',   dotColor: 'bg-amber-500'   },
  peak:   { label: 'Stoßzeit!',      bg: 'bg-red-50',      border: 'border-red-200',     textColor: 'text-red-700',     dotColor: 'bg-red-500'     },
};

function classifyStatus(activeCount: number): KitchenStatus {
  if (activeCount >= 10) return 'peak';
  if (activeCount >= 5)  return 'busy';
  return 'normal';
}

interface QueueItem {
  id: string;
  status: string;
}

export function Phase582KuechenstatusBadge({ locationId, className }: Props) {
  const [status, setStatus] = useState<KitchenStatus | null>(null);
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, {
          cache: 'no-store',
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();

        const items: QueueItem[] = Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data?.queue)
          ? data.queue
          : [];

        const inProgress = items.filter(o =>
          o.status === 'in_zubereitung' || o.status === 'in_preparation' || o.status === 'cooking',
        ).length;

        if (!cancelled) {
          setActiveCount(inProgress);
          setStatus(classifyStatus(inProgress));
        }
      } catch {
        // silent — badge is optional
      }
    }

    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (status === null) return null;

  const cfg = STATUS_CFG[status];

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
        cfg.bg,
        cfg.border,
        cfg.textColor,
        className,
      )}
    >
      {/* Animated dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {status !== 'normal' && (
          <span
            className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-75', cfg.dotColor)}
          />
        )}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', cfg.dotColor)} />
      </span>
      <ChefHat className="h-3 w-3 shrink-0" />
      <span>{cfg.label}</span>
      {status !== 'normal' && (
        <span className="tabular-nums opacity-80">({activeCount})</span>
      )}
    </div>
  );
}
