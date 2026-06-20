'use client';

/**
 * ServiceStatusBanner — öffentliches Echtzeit-Servicequalitäts-Banner für die Storefront.
 *
 * Zeigt Kunden den aktuellen Lieferstatus basierend auf Auslastung + ETA:
 *   - Normal: "Lieferservice läuft rund · ~35 Min"
 *   - Erhöht:  "Starkes Bestellaufkommen · ~45 Min"
 *   - Hoch:    "Sehr hohe Nachfrage · ~55 Min"
 *
 * Öffentlich, keine Auth erforderlich.
 * Polling alle 90 Sekunden auf /api/delivery/eta/live?location_id=...
 */

import { useEffect, useRef, useState } from 'react';
import { Bike, Clock, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtaLiveData {
  eta_min: number;
  load: 'low' | 'normal' | 'elevated' | 'high' | string;
}

const LOAD_CONFIG = {
  low:      { label: 'Sehr schnelle Lieferung',         icon: Bike,         cls: 'bg-matcha-50 border-matcha-200 text-matcha-700' },
  normal:   { label: 'Lieferservice läuft rund',        icon: Bike,         cls: 'bg-stone-50 border-stone-200 text-stone-600' },
  elevated: { label: 'Erhöhtes Bestellaufkommen',       icon: Zap,          cls: 'bg-amber-50 border-amber-200 text-amber-700' },
  high:     { label: 'Sehr hohe Nachfrage gerade',      icon: AlertCircle,  cls: 'bg-red-50 border-red-200 text-red-700' },
} as const;

export function ServiceStatusBanner({ locationId }: { locationId: string }) {
  const [data, setData] = useState<EtaLiveData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = () => {
    fetch(`/api/delivery/eta/live?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => { if (json) setData(json as EtaLiveData); })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 90_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const key = (data.load in LOAD_CONFIG ? data.load : 'normal') as keyof typeof LOAD_CONFIG;
  const cfg = LOAD_CONFIG[key];
  const Icon = cfg.icon;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm',
      cfg.cls,
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="font-medium">{cfg.label}</span>
      <span className="ml-auto flex items-center gap-1 font-bold tabular-nums">
        <Clock className="h-3.5 w-3.5 shrink-0" />
        ~{data.eta_min} Min
      </span>
    </div>
  );
}
