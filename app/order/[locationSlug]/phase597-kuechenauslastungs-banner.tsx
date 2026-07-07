'use client';

/**
 * Phase 597 — Storefront: Küchen-Auslastungs-Infobanner
 *
 * Zeigt Kunden wenn die Küche aktuell sehr ausgelastet ist (+5–10 Min Warnezeit).
 * Sichtbar nur bei Status "busy" oder "peak".
 * Holt Daten von /api/delivery/kitchen/queue?location_id=...
 * Ticker: 90s
 */

import { useEffect, useState } from 'react';
import { ChefHat, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  className?: string;
}

type Level = 'busy' | 'peak';

const CFG: Record<Level, { bg: string; border: string; text: string; icon: string; msg: string; extra: string }> = {
  busy: {
    bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800',
    icon: '🍳', msg: 'Küche stark ausgelastet', extra: '+5–10 Min Wartezeit möglich',
  },
  peak: {
    bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800',
    icon: '🔥', msg: 'Stoßzeit — Küche am Limit', extra: 'Bitte ca. +10 Min zusätzliche Wartezeit einplanen',
  },
};

export function Phase597KuechenauslastungsBanner({ locationId, className }: Props) {
  const [level, setLevel] = useState<Level | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/kitchen/queue?location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const items: Array<{ status: string }> = data.orders ?? data.queue ?? [];
        const active = items.filter((o) => ['bestätigt', 'in_zubereitung'].includes(o.status)).length;
        if (cancelled) return;
        if (active >= 10) setLevel('peak');
        else if (active >= 5) setLevel('busy');
        else setLevel(null);
      } catch {
        // silent
      }
    }

    load();
    const id = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!level) return null;

  const cfg = CFG[level];

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
        cfg.bg, cfg.border, cfg.text,
        className,
      )}
    >
      <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold">{cfg.msg}</div>
        <div className="mt-0.5 flex items-center gap-1.5 opacity-80 text-xs">
          <Clock className="h-3 w-3 shrink-0" />
          {cfg.extra}
        </div>
      </div>
      <ChefHat className="h-5 w-5 shrink-0 opacity-60 mt-0.5" />
    </div>
  );
}
