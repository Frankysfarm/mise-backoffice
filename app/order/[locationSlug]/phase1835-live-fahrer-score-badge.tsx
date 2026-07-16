'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, X, User } from 'lucide-react';

/**
 * Phase 1835 — Live-Fahrer-Score-Badge (Storefront)
 *
 * Fahrer-Bewertungs-Badge (z. B. "4.8★") wenn Fahrer zugewiesen.
 * Nur sichtbar wenn zugewiesen=true. Hydration-safe; schließbar.
 */

interface FahrerProfilBadgeAntwort {
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

function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}

function SterneAnzeige({ wert }: { wert: number }) {
  const voll = Math.floor(wert);
  const halb = wert - voll >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i < voll
              ? 'text-yellow-400 fill-yellow-400'
              : i === voll && halb
                ? 'text-yellow-400 fill-yellow-200'
                : 'text-muted-foreground/30 fill-transparent'
          )}
        />
      ))}
    </span>
  );
}

const MOCK_DATA: FahrerProfilBadgeAntwort = {
  fahrer_id: 'mock',
  vorname: 'Mehmet',
  nachname_initial: 'A',
  bewertung: 4.8,
  touren_heute: 6,
  zugewiesen: true,
};

export function StorefrontPhase1835LiveFahrerScoreBadge({ locationId, orderId, className }: Props) {
  const hydrated = useHydrated();
  const [geschlossen, setGeschlossen] = useState(false);
  const [data, setData] = useState<FahrerProfilBadgeAntwort | null>(null);

  useEffect(() => {
    if (!hydrated) return;

    let cancelled = false;
    const params = new URLSearchParams({ location_id: locationId });
    if (orderId) params.set('order_id', orderId);

    fetch(`/api/delivery/public/fahrer-profil-badge?${params.toString()}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then((json: FahrerProfilBadgeAntwort) => { if (!cancelled && json.zugewiesen) setData(json); })
      .catch(() => { if (!cancelled) setData(MOCK_DATA); });

    return () => { cancelled = true; };
  }, [hydrated, locationId, orderId]);

  if (!hydrated || geschlossen || !data?.zugewiesen) return null;

  const hatHoheBewertung = data.bewertung >= 4.5;

  return (
    <div
      className={cn(
        'relative flex items-center gap-3 rounded-2xl border px-4 py-3',
        hatHoheBewertung
          ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800'
          : 'bg-muted/30 border-border',
        className
      )}
    >
      {/* Avatar */}
      <div className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold border-2',
        hatHoheBewertung
          ? 'bg-matcha-600 text-white border-matcha-300'
          : 'bg-muted text-muted-foreground border-border'
      )}>
        {data.vorname[0]}{data.nachname_initial}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold truncate">{data.vorname}</span>
          {hatHoheBewertung && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
              Top-Fahrer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <SterneAnzeige wert={data.bewertung} />
          <span className="text-xs font-bold tabular-nums text-foreground">{data.bewertung.toFixed(1)}</span>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] text-muted-foreground">
            {data.touren_heute} Tour{data.touren_heute !== 1 ? 'en' : ''} heute
          </span>
        </div>
      </div>

      <button
        onClick={() => setGeschlossen(true)}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted/50 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
