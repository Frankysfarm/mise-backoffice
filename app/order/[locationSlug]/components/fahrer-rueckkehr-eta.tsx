'use client';

/**
 * FahrerRueckkehrEta — Phase 275
 *
 * Für Kunden auf der Storefront: zeigt eine dynamische ETA-Anzeige
 * mit Live-Puls sobald der Fahrer gestartet ist.
 *
 * Polling: alle 30s den Tracking-Endpoint, farbcodierte Ampel je nach Restzeit.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, MapPin } from 'lucide-react';

interface TrackingData {
  status:           string;
  eta_min?:         number | null;
  fahrer_name?:     string | null;
  last_updated?:    string | null;
}

function StatusPulse({ color }: { color: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', color)} />
      <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', color.replace('bg-', 'bg-'))} />
    </span>
  );
}

export function FahrerRueckkehrEta({
  bestellnummer,
}: {
  bestellnummer: string;
}) {
  const [data, setData] = useState<TrackingData | null>(null);

  useEffect(() => {
    if (!bestellnummer) return;
    const poll = () => {
      fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d as TrackingData); })
        .catch(() => {});
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [bestellnummer]);

  if (!data) return null;

  const eta   = data.eta_min;
  const isOnTheWay = ['unterwegs', 'delivering', 'on_the_way', 'out_for_delivery'].includes(data.status ?? '');

  if (!isOnTheWay && data.status !== 'nahe') return null;

  const color =
    eta == null ? 'bg-stone-400' :
    eta <= 5    ? 'bg-red-500' :
    eta <= 15   ? 'bg-amber-500' :
    'bg-emerald-500';

  const textColor =
    eta == null ? 'text-stone-600' :
    eta <= 5    ? 'text-red-700' :
    eta <= 15   ? 'text-amber-700' :
    'text-emerald-700';

  const bgColor =
    eta == null ? 'bg-stone-50 border-stone-200' :
    eta <= 5    ? 'bg-red-50 border-red-200' :
    eta <= 15   ? 'bg-amber-50 border-amber-200' :
    'bg-emerald-50 border-emerald-200';

  return (
    <div className={cn('rounded-xl border px-4 py-3 flex items-center gap-3', bgColor)}>
      <StatusPulse color={color} />

      <Bike className={cn('h-4 w-4 shrink-0', textColor)} />

      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-black', textColor)}>
          {data.fahrer_name ? `${data.fahrer_name} ist unterwegs` : 'Fahrer ist unterwegs'}
        </div>
        {eta != null ? (
          <div className="text-[11px] text-stone-500 mt-0.5">
            Lieferung in ca. <span className={cn('font-black', textColor)}>{eta} Minuten</span>
          </div>
        ) : (
          <div className="text-[11px] text-stone-500 mt-0.5">ETA wird berechnet…</div>
        )}
      </div>

      <MapPin className={cn('h-4 w-4 shrink-0', textColor)} />
    </div>
  );
}
