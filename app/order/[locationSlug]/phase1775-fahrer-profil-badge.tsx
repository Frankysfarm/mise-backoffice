'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, Bike } from 'lucide-react';

/**
 * Phase 1775 — Fahrer-Profil-Badge (Storefront)
 *
 * Name + Avatar-Initials + Bewertung des zugewiesenen Fahrers.
 * Hydration-safe; nur wenn Fahrer zugewiesen.
 * Props: locationId, orderId (optional).
 */

interface FahrerProfil {
  fahrer_id: string;
  vorname: string;
  nachname_initial: string;
  bewertung: number;
  touren_heute: number;
  zugewiesen: boolean;
}

interface Props {
  locationId: string;
  orderId?: string | null;
  className?: string;
}

function Initialen({ vorname, initial }: { vorname: string; initial: string }) {
  const text = `${vorname.charAt(0)}${initial}`.toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-saffron text-white text-sm font-black">
      {text}
    </div>
  );
}

export function StorefrontPhase1775FahrerProfilBadge({ locationId, orderId, className }: Props) {
  const [data, setData] = useState<FahrerProfil | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    async function load() {
      try {
        const params = new URLSearchParams({ location_id: locationId });
        if (orderId) params.set('order_id', orderId);
        const res = await fetch(`/api/delivery/public/fahrer-profil-badge?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.zugewiesen) setData(json);
        }
      } catch {
        // silent
      }
    }

    load();
  }, [mounted, locationId, orderId]);

  if (!mounted || !data || !data.zugewiesen) return null;

  const sterne = Math.round(data.bewertung * 2) / 2;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3',
      className,
    )}>
      <Initialen vorname={data.vorname} initial={data.nachname_initial} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Bike className="h-3.5 w-3.5 text-saffron" />
          <span className="text-xs font-bold text-foreground truncate">
            {data.vorname} {data.nachname_initial}.
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                'h-3 w-3',
                i < Math.floor(sterne)
                  ? 'text-amber-400 fill-amber-400'
                  : i < sterne
                    ? 'text-amber-400 fill-amber-200'
                    : 'text-muted-foreground',
              )}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1 tabular-nums">
            {data.bewertung.toFixed(1)} · {data.touren_heute} Tour{data.touren_heute !== 1 ? 'en' : ''} heute
          </span>
        </div>
      </div>

      <span className="shrink-0 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-[10px] font-bold text-green-700 dark:text-green-300">
        Zugewiesen
      </span>
    </div>
  );
}
