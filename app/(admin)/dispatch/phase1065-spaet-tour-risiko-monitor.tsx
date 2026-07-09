'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type TourRisiko = {
  tour_id: string;
  fahrer_name: string;
  stopps_verbleibend: number;
  eta_minuten: number;
  schichtende_in_min: number;
  risiko: 'kritisch' | 'hoch' | 'mittel';
  verzoegerung_min: number;
  zone: string;
};

type ApiResponse = {
  touren: TourRisiko[];
  kritische_anzahl: number;
};

const RISIKO_CONFIG: Record<TourRisiko['risiko'], { label: string; farbe: string; badge: string }> = {
  kritisch: {
    label: 'Kritisch',
    farbe: 'text-red-700 dark:text-red-300',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700',
  },
  hoch: {
    label: 'Hoch',
    farbe: 'text-orange-700 dark:text-orange-300',
    badge: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700',
  },
  mittel: {
    label: 'Mittel',
    farbe: 'text-amber-700 dark:text-amber-300',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
  },
};

function mock(): ApiResponse {
  return {
    touren: [
      { tour_id: 't1', fahrer_name: 'Max M.', stopps_verbleibend: 4, eta_minuten: 72, schichtende_in_min: 35, risiko: 'kritisch', verzoegerung_min: 37, zone: 'B' },
      { tour_id: 't3', fahrer_name: 'Tom K.', stopps_verbleibend: 3, eta_minuten: 55, schichtende_in_min: 40, risiko: 'hoch', verzoegerung_min: 15, zone: 'C' },
    ],
    kritische_anzahl: 1,
  };
}

export function DispatchPhase1065SpaetTourRisikoMonitor({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/spaet-tour-risiko?${p}`);
      if (r.ok) setData(await r.json());
      else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const touren = data?.touren ?? [];
  if (!loading && touren.length === 0) return null;

  return (
    <div className="rounded-2xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-orange-600 dark:text-orange-400" />
          <span className="text-xs font-bold text-orange-800 dark:text-orange-200 uppercase tracking-wider">
            Spät-Tour-Risiko — {touren.length} Tour{touren.length !== 1 ? 'en' : ''}
          </span>
        </div>
        {(data?.kritische_anzahl ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 border border-red-200 dark:border-red-700 px-2 py-0.5 rounded-full animate-pulse">
            <AlertTriangle size={9} />
            {data?.kritische_anzahl} Kritisch
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-orange-500" />
        </div>
      )}

      {!loading && (
        <div className="p-3 space-y-2">
          {touren.map((tour) => {
            const cfg = RISIKO_CONFIG[tour.risiko];
            return (
              <div
                key={tour.tour_id}
                className="rounded-xl bg-white dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{tour.fahrer_name}</span>
                  <span className={cn('text-[10px] font-bold border px-1.5 py-0.5 rounded-full', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">{tour.stopps_verbleibend}</div>
                    <div>Stopps</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">{tour.eta_minuten} Min</div>
                    <div>ETA Tour-Ende</div>
                  </div>
                  <div>
                    <div className={cn('font-semibold', cfg.farbe)}>+{tour.verzoegerung_min} Min</div>
                    <div>nach Schichtende</div>
                  </div>
                </div>

                <div className="mt-2 text-[10px] text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 rounded-lg px-2 py-1">
                  Zone {tour.zone} · Schichtende in {tour.schichtende_in_min} Min
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
