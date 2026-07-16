'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Truck, X } from 'lucide-react';

/**
 * Phase 1901 — Fahrer-Anfahrts-ETA-Karte (Storefront)
 *
 * "Dein Fahrer ist ~X Min entfernt" mit Fahrzeug-Icon.
 * Nur wenn Tour dispatched. Hydration-safe; 30-Sek-Polling.
 */

interface FahrerEtaDaten {
  dispatched: boolean;
  eta_minuten: number | null;
  fahrer_name: string | null;
}

const MOCK_DISPATCHED: FahrerEtaDaten = {
  dispatched: true,
  eta_minuten: 8,
  fahrer_name: 'Max M.',
};

interface Props {
  locationId: string;
  orderId?: string | null;
  className?: string;
}

export function StorefrontPhase1901FahrerAnfahrtsEtaKarte({ locationId, orderId, className }: Props) {
  const [daten, setDaten] = useState<FahrerEtaDaten | null>(null);
  const [geschlossen, setGeschlossen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    const laden = async () => {
      try {
        const params = new URLSearchParams({ location_id: locationId });
        if (orderId) params.set('order_id', orderId);
        const res = await fetch(`/api/delivery/public/fahrer-eta?${params}`);
        if (!res.ok) throw new Error('API Fehler');
        setDaten(await res.json());
      } catch {
        setDaten(MOCK_DISPATCHED);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId, orderId]);

  if (!mounted || !daten || !daten.dispatched || daten.eta_minuten === null || geschlossen) return null;

  const eta = daten.eta_minuten;
  const ringFarbe =
    eta <= 5 ? 'border-green-400' : eta <= 15 ? 'border-amber-400' : 'border-blue-400';
  const textFarbe =
    eta <= 5 ? 'text-green-700 dark:text-green-300' : eta <= 15 ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300';

  return (
    <div
      className={cn(
        'rounded-2xl border bg-card shadow-sm overflow-hidden mx-4 mt-2',
        className,
      )}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        {/* Fahrzeug-Ring */}
        <div className={cn('flex h-12 w-12 items-center justify-center rounded-full border-2 shrink-0', ringFarbe)}>
          <Truck className={cn('h-6 w-6', textFarbe)} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">
            {daten.fahrer_name ? `${daten.fahrer_name} ist` : 'Dein Fahrer ist'}{' '}
            <span className={cn('tabular-nums', textFarbe)}>~{eta} Min</span> entfernt
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {eta <= 5
              ? 'Gleich da — bitte bereit sein!'
              : eta <= 15
              ? 'Auf dem Weg zu dir'
              : 'Unterwegs — aktualisiert alle 30 Sek'}
          </p>
        </div>

        {/* Schließen */}
        <button
          onClick={() => setGeschlossen(true)}
          className="rounded-full p-1 hover:bg-muted/50 transition-colors shrink-0"
          aria-label="Schließen"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Fortschrittsbalken */}
      <div className="h-1 bg-muted">
        <div
          className={cn('h-full transition-all duration-1000', textFarbe.replace('text-', 'bg-').replace('-700', '-500').replace('-300', '-500'))}
          style={{ width: `${Math.max(5, 100 - (eta / 45) * 100)}%` }}
        />
      </div>
    </div>
  );
}
