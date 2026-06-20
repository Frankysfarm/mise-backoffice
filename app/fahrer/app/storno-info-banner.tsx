'use client';

/**
 * FahrerStornoInfoBanner — Phase 345
 *
 * Zeigt dem Fahrer eine kurze Info-Meldung wenn eine Bestellung storniert wurde
 * während er unterwegs war. Verschwindet nach Dismiss.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface BatchStop {
  id: string;
  status: string;
  order_id?: string;
}

interface ActiveBatch {
  id: string;
  status: string;
  stops?: BatchStop[];
}

export function FahrerStornoInfoBanner({
  activeBatch,
}: {
  activeBatch: ActiveBatch | null;
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [cancelledOrders, setCancelledOrders] = useState<string[]>([]);

  useEffect(() => {
    if (!activeBatch?.stops) return;

    // Suche nach Stops die als fehlgeschlagen/storniert markiert sind
    const cancelled = activeBatch.stops
      .filter((s) => s.status === 'failed' || s.status === 'cancelled')
      .map((s) => s.id);

    setCancelledOrders(cancelled);
  }, [activeBatch]);

  const visibleCancelled = cancelledOrders.filter((id) => !dismissed.has(id));

  if (visibleCancelled.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleCancelled.map((stopId) => (
        <div
          key={stopId}
          className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex items-start gap-2.5"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-amber-800">Stop storniert</span>
            <span className="text-amber-700"> — dieser Lieferstopp wurde storniert. Bitte fahre zum nächsten Stop.</span>
          </div>
          <button
            onClick={() => setDismissed((prev) => new Set([...prev, stopId]))}
            className="text-amber-500 hover:text-amber-700 mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
