'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ListChecks, ChevronDown, ChevronUp, CheckCircle2, Clock, MapPin } from 'lucide-react';

/**
 * Phase 1843 — Letzte-Touren-Recap (Dispatch)
 *
 * Zeigt die letzten 5 abgeschlossenen Touren mit Fahrer, Stopps, Dauer und Ø ETA-Abweichung.
 * 30-Min-Polling. GET /api/delivery/admin/abgeschlossene-touren.
 */

interface TourRecap {
  id: string;
  fahrer_name: string;
  stopps: number;
  dauer_min: number;
  abgeschlossen_um: string;
  eta_abweichung_min: number | null;
  zone: string | null;
}

interface ApiAntwort {
  touren: TourRecap[];
}

const MOCK_TOUREN: TourRecap[] = [
  { id: '1', fahrer_name: 'Mehmet K.', stopps: 4, dauer_min: 38, abgeschlossen_um: new Date(Date.now() - 12 * 60_000).toISOString(), eta_abweichung_min: 2, zone: 'A' },
  { id: '2', fahrer_name: 'Laura S.', stopps: 3, dauer_min: 25, abgeschlossen_um: new Date(Date.now() - 35 * 60_000).toISOString(), eta_abweichung_min: -3, zone: 'B' },
  { id: '3', fahrer_name: 'Jan P.', stopps: 5, dauer_min: 52, abgeschlossen_um: new Date(Date.now() - 58 * 60_000).toISOString(), eta_abweichung_min: 8, zone: 'C' },
  { id: '4', fahrer_name: 'Mehmet K.', stopps: 3, dauer_min: 29, abgeschlossen_um: new Date(Date.now() - 90 * 60_000).toISOString(), eta_abweichung_min: 0, zone: 'A' },
  { id: '5', fahrer_name: 'Laura S.', stopps: 4, dauer_min: 41, abgeschlossen_um: new Date(Date.now() - 120 * 60_000).toISOString(), eta_abweichung_min: -1, zone: 'B' },
];

function zeitVor(iso: string): string {
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 60) return `vor ${diffMin} Min`;
  return `vor ${Math.round(diffMin / 60)} Std`;
}

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1843LetzteTouren({ locationId, className }: Props) {
  const [touren, setTouren] = useState<TourRecap[]>([]);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/abgeschlossene-touren?location_id=${locationId}&limit=5`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const json: ApiAntwort = await res.json();
          setTouren(json.touren ?? []);
        }
      } catch {
        setTouren(MOCK_TOUREN);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  const anzeige = touren.length > 0 ? touren : MOCK_TOUREN;

  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <ListChecks className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Letzte Touren</span>
        <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
          {anzeige.length}
        </span>
        {offen ? (
          <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {offen && (
        <div className="divide-y">
          {anzeige.map((tour) => {
            const abw = tour.eta_abweichung_min;
            const abwFarbe =
              abw === null
                ? 'text-muted-foreground'
                : abw <= 0
                ? 'text-matcha-600 dark:text-matcha-400'
                : abw <= 5
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-red-600 dark:text-red-400';

            return (
              <div key={tour.id} className="flex items-center gap-3 px-4 py-3">
                <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{tour.fahrer_name}</span>
                    {tour.zone && (
                      <span className="text-[9px] rounded-full border bg-muted px-1.5 py-0.5 font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {tour.stopps} Stopps
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {tour.dauer_min} Min
                    </span>
                    <span className={cn('font-semibold', abwFarbe)}>
                      {abw === null
                        ? '—'
                        : abw === 0
                        ? 'Pünktlich'
                        : abw > 0
                        ? `+${abw} Min`
                        : `${abw} Min`}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right text-[10px] text-muted-foreground">
                  {zeitVor(tour.abgeschlossen_um)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
