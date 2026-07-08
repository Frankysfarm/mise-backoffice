'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneEta {
  zone: string;
  label: string;
  eta_base_min: number;
  color: string;
  surcharge_eur: number;
  free_delivery_above_eur: number | null;
}

interface ApiResponse {
  ok: boolean;
  signal: 'grün' | 'gelb' | 'rot';
  prognoseWarteMin: number | null;
}

interface Props {
  locationId: string;
}

const ZONE_DEFAULTS: ZoneEta[] = [
  { zone: 'A', label: 'Express',   eta_base_min: 20, color: '#22c55e', surcharge_eur: 0,   free_delivery_above_eur: 15 },
  { zone: 'B', label: 'Standard',  eta_base_min: 30, color: '#3b82f6', surcharge_eur: 1.5, free_delivery_above_eur: 25 },
  { zone: 'C', label: 'Weit',      eta_base_min: 45, color: '#f59e0b', surcharge_eur: 2.5, free_delivery_above_eur: 35 },
  { zone: 'D', label: 'Außerhalb', eta_base_min: 60, color: '#ef4444', surcharge_eur: 4.0, free_delivery_above_eur: null },
];

export function Phase673ZonenLieferzeit({ locationId }: Props) {
  const [extraMin, setExtraMin] = useState(0);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        const json: ApiResponse = await res.json();
        if (active && json.ok) {
          // Küchen-Zusatz-Wartezeit auf alle Zonen addieren
          const extra = json.signal === 'rot' ? (json.prognoseWarteMin ?? 10) :
                        json.signal === 'gelb' ? Math.round((json.prognoseWarteMin ?? 5) * 0.5) : 0;
          setExtraMin(extra);
        }
      } catch {
        // silent
      }
    }

    load();
    const id = setInterval(load, 90_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <MapPin className="w-4 h-4 text-slate-500" />
        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">
          Lieferzeiten nach Zone
        </span>
        {extraMin > 0 && (
          <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full">
            +{extraMin} Min Küchen-Verzögerung
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ZONE_DEFAULTS.map((z) => {
          const etaMin = z.eta_base_min + extraMin;
          return (
            <div
              key={z.zone}
              className="flex items-start gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"
            >
              <span
                className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: z.color }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Zone {z.zone}
                  </span>
                  <span className="text-xs text-slate-400">— {z.label}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className={cn('text-sm font-bold', extraMin > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200')}>
                    ~{etaMin} Min
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {z.surcharge_eur === 0
                    ? 'Kostenlos'
                    : `+${z.surcharge_eur.toFixed(2).replace('.', ',')} €`}
                  {z.free_delivery_above_eur !== null && (
                    <span> · ab {z.free_delivery_above_eur} € gratis</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
