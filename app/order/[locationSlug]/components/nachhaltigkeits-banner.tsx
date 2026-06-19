'use client';

/**
 * NachhaltigkeitsBanner — Phase 249
 *
 * Zeigt nach erfolgreicher Bestellung die CO₂-Einsparung an,
 * wenn die Lieferung per Fahrrad oder E-Bike erfolgt.
 * Stärkt die grüne Markenidentität (Matcha-Theme).
 * Erscheint nur bei Lieferbestellungen mit bestätigtem Fahrzeugtyp.
 */

import { useEffect, useState } from 'react';
import { Leaf, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  orderStatus: string;
  distanceKm?: number | null;
}

export function NachhaltigkeitsBanner({ orderId, orderStatus, distanceKm }: Props) {
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!orderId || orderStatus === 'geliefert' || orderStatus === 'storniert') return;
    fetch(`/api/delivery/tracking/${orderId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.fahrer_fahrzeug) setVehicle(d.fahrer_fahrzeug);
      })
      .catch(() => null);
  }, [orderId, orderStatus]);

  const isGreen = vehicle === 'fahrrad' || vehicle === 'e-bike';
  if (!isGreen || dismissed) return null;

  const km = distanceKm ?? 3.5;
  // avg car: 0.21 kg CO₂/km, bike: ~0.02 kg CO₂/km
  const savedGrams = Math.round((0.21 - 0.02) * km * 1000);

  const emoji = vehicle === 'fahrrad' ? '🚲' : '⚡🚲';
  const vehicleLabel = vehicle === 'fahrrad' ? 'Fahrrad' : 'E-Bike';

  return (
    <div className={cn(
      'relative flex items-start gap-3 rounded-2xl border border-matcha-200 bg-gradient-to-r',
      'from-matcha-50 via-white to-matcha-50 p-4 shadow-sm',
    )}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-matcha-100 text-xl">
        {emoji}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-matcha-800">
          Grüne Lieferung per {vehicleLabel}!
        </p>
        <p className="text-xs text-matcha-600 mt-0.5">
          Deine Bestellung spart heute ca.{' '}
          <span className="font-bold">{savedGrams} g CO₂</span> im Vergleich zu einem Auto.
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <Leaf size={11} className="text-matcha-500" />
          <span className="text-[10px] text-matcha-500">
            Mise setzt auf emissionsarme Lieferung in deiner Stadt.
          </span>
        </div>
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1 text-matcha-400 hover:bg-matcha-100 transition"
        aria-label="Schließen"
      >
        <X size={14} />
      </button>
    </div>
  );
}
