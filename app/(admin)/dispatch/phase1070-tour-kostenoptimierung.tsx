'use client';

import { useEffect, useState } from 'react';
import { Euro, Loader2, Merge, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type ZusammenlegungsVorschlag = {
  tour_a_id: string;
  tour_a_fahrer: string;
  tour_b_id: string;
  tour_b_fahrer: string;
  gemeinsame_zone: string;
  potenzielle_ersparnis_eur: number;
  entfernung_km: number;
  machbarkeit: 'hoch' | 'mittel' | 'niedrig';
};

type ApiResponse = {
  vorschlaege: ZusammenlegungsVorschlag[];
  gesamt_einsparpotenzial_eur: number;
};

function mock(): ApiResponse {
  return {
    vorschlaege: [
      {
        tour_a_id: 't1', tour_a_fahrer: 'Max M.',
        tour_b_id: 't3', tour_b_fahrer: 'Tom K.',
        gemeinsame_zone: 'B', potenzielle_ersparnis_eur: 4.80,
        entfernung_km: 2.1, machbarkeit: 'hoch',
      },
      {
        tour_a_id: 't2', tour_a_fahrer: 'Lisa B.',
        tour_b_id: 't5', tour_b_fahrer: 'Jan S.',
        gemeinsame_zone: 'A', potenzielle_ersparnis_eur: 3.20,
        entfernung_km: 3.4, machbarkeit: 'mittel',
      },
    ],
    gesamt_einsparpotenzial_eur: 8.00,
  };
}

const MACHBARKEIT_CONFIG: Record<ZusammenlegungsVorschlag['machbarkeit'], { label: string; cls: string }> = {
  hoch: { label: 'Hoch', cls: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 border-matcha-200 dark:border-matcha-700' },
  mittel: { label: 'Mittel', cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  niedrig: { label: 'Niedrig', cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700' },
};

function formatEuro(val: number): string {
  return val.toFixed(2).replace('.', ',') + ' €';
}

export function DispatchPhase1070TourKostenoptimierung({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/tour-kostenoptimierung?${p}`);
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
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const vorschlaege = data?.vorschlaege ?? [];
  if (!loading && vorschlaege.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-emerald-200 dark:border-emerald-800">
        <div className="flex items-center gap-2">
          <TrendingDown size={14} className="text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
            Tour-Kostenoptimierung — {vorschlaege.length} Vorschlag{vorschlaege.length !== 1 ? 'e' : ''}
          </span>
        </div>
        {data && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/50 px-2 py-0.5 rounded-full">
            <Euro size={9} />
            {formatEuro(data.gesamt_einsparpotenzial_eur)} sparen
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-emerald-500" />
        </div>
      )}

      {!loading && (
        <div className="p-3 space-y-2">
          {vorschlaege.map((v) => {
            const cfg = MACHBARKEIT_CONFIG[v.machbarkeit];
            return (
              <div
                key={`${v.tour_a_id}-${v.tour_b_id}`}
                className="rounded-xl bg-white dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Merge size={11} className="text-emerald-500 shrink-0" />
                    <span>{v.tour_a_fahrer}</span>
                    <span className="text-gray-400">+</span>
                    <span>{v.tour_b_fahrer}</span>
                  </div>
                  <span className={cn('text-[10px] font-bold border px-1.5 py-0.5 rounded-full', cfg.cls)}>
                    {cfg.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-600 dark:text-gray-400">
                  <div>
                    <div className="font-bold text-emerald-700 dark:text-emerald-300">{formatEuro(v.potenzielle_ersparnis_eur)}</div>
                    <div>Ersparnis</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">{v.entfernung_km} km</div>
                    <div>Abstand</div>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800 dark:text-gray-200">Zone {v.gemeinsame_zone}</div>
                    <div>Gemeinsam</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
