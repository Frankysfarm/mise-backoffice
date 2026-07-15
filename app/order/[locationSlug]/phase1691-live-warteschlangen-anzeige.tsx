'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertCircle } from 'lucide-react';

/**
 * Phase 1691 — Live-Warteschlangen-Anzeige (Storefront)
 *
 * Aktuelle Bestellanzahl in Warteschlange + geschätzte Verzögerung.
 * Gelber Banner wenn Queue >5; locationId; 5-Min-Polling; Hydration-safe.
 */

interface QueueData {
  bestellungen_in_queue: number;
  wartezeit_zusatz_min: number;
  stufe: 'niedrig' | 'mittel' | 'hoch';
  location_id: string;
}

interface Props {
  locationId: string;
}

const POLL_MS = 5 * 60 * 1000;
const QUEUE_WARN = 5;
const QUEUE_KRITISCH = 10;

async function fetchQueue(locationId: string): Promise<QueueData | null> {
  try {
    const res = await fetch(`/api/delivery/public/warteschlange?location_id=${encodeURIComponent(locationId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function StorefrontPhase1691LiveWarteschlangenAnzeige({ locationId }: Props) {
  const [data, setData] = useState<QueueData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchQueue(locationId).then(setData);
    const iv = setInterval(() => fetchQueue(locationId).then(setData), POLL_MS);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!mounted) return null;
  if (!data) return null;

  // Nur zeigen wenn Warteschlange erhöht
  if (data.bestellungen_in_queue <= QUEUE_WARN) return null;

  const isKritisch = data.bestellungen_in_queue >= QUEUE_KRITISCH || data.stufe === 'hoch';

  return (
    <div className={cn(
      'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm mb-3',
      isKritisch
        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
        : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    )}>
      {isKritisch
        ? <AlertCircle className="h-4 w-4 shrink-0" />
        : <Clock className="h-4 w-4 shrink-0" />}
      <div className="flex-1 min-w-0">
        <span className="font-semibold">
          {isKritisch ? 'Hohe Nachfrage' : 'Erhöhte Nachfrage'} —
        </span>
        {' '}
        <span>
          {data.bestellungen_in_queue} Bestellungen in der Warteschlange
          {data.wartezeit_zusatz_min > 0 && (
            <> · ca. <strong>+{data.wartezeit_zusatz_min} Min</strong> Verzögerung</>
          )}
        </span>
      </div>
    </div>
  );
}
