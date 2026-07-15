'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, X } from 'lucide-react';

/**
 * Phase 1741 — Live-Fahrer-Näherungs-Indikator (Storefront)
 *
 * Wenn Fahrer <500m entfernt: Näherungs-Banner mit Entfernungsanzeige;
 * 30s-Polling; Hydration-safe.
 */

interface FahrerNaeherungResponse {
  nahe: boolean;
  entfernung_m: number | null;
  fahrer_name: string | null;
  eta_sek: number | null;
}

interface Props {
  orderId: string | null;
  locationId: string;
  className?: string;
}

const POLL_MS = 30_000;
const NAEHERUNGS_GRENZE_M = 500;

function formatEntfernung(m: number): string {
  if (m < 100) return `${Math.round(m)} m`;
  return `${Math.round(m / 10) * 10} m`;
}

function formatEta(sek: number): string {
  if (sek < 60) return `< 1 Min`;
  return `${Math.round(sek / 60)} Min`;
}

export function StorefrontPhase1741LiveFahrerNaehHerungsIndikator({ orderId, locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<FahrerNaeherungResponse | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !orderId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/fahrer/naeherung?order_id=${orderId}&location_id=${locationId}`,
        );
        if (res.ok) {
          const d: FahrerNaeherungResponse = await res.json();
          setData(d);
          if (!d.nahe) setDismissed(false);
        }
      } catch {
        // silent: kein Mock, Banner bleibt weg
      }
    };

    laden();
    const id = setInterval(laden, POLL_MS);
    return () => clearInterval(id);
  }, [mounted, orderId, locationId]);

  if (!mounted) return null;
  if (!data?.nahe) return null;
  if (dismissed) return null;
  if ((data.entfernung_m ?? Infinity) > NAEHERUNGS_GRENZE_M) return null;

  const entfernungText = data.entfernung_m !== null ? formatEntfernung(data.entfernung_m) : null;
  const etaText = data.eta_sek !== null ? formatEta(data.eta_sek) : null;

  return (
    <div className={cn(
      'rounded-xl border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 p-3',
      className,
    )}>
      <div className="flex items-start gap-3">
        {/* Pulsierender Indikator */}
        <div className="relative mt-0.5 shrink-0">
          <span className="absolute inset-0 rounded-full bg-green-400 opacity-50 animate-ping" />
          <Navigation className="relative h-5 w-5 text-green-600 dark:text-green-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-green-800 dark:text-green-200">
            Dein Fahrer ist gleich da!
          </p>

          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {entfernungText && (
              <span className="rounded-full border border-green-200 dark:border-green-800 bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-[11px] font-bold text-green-700 dark:text-green-300 tabular-nums">
                📍 {entfernungText} entfernt
              </span>
            )}
            {etaText && (
              <span className="rounded-full border border-green-200 dark:border-green-800 bg-green-100 dark:bg-green-900/40 px-2.5 py-0.5 text-[11px] font-bold text-green-700 dark:text-green-300 tabular-nums">
                ⏱ in ca. {etaText}
              </span>
            )}
            {data.fahrer_name && (
              <span className="text-[11px] text-green-700 dark:text-green-300">
                Fahrer: {data.fahrer_name}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 hover:bg-green-100 dark:hover:bg-green-900/50 transition"
          aria-label="Banner schließen"
        >
          <X className="h-4 w-4 text-green-600 dark:text-green-400" />
        </button>
      </div>
    </div>
  );
}
