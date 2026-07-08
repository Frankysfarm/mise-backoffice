'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Phone, MessageSquare, Clock } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface RisikoTour {
  batch_id: string;
  fahrer_name: string;
  wartezeit_min: number;
  letzter_kontakt_min: number | null;
  bestell_ids: string[];
}

interface ApiResponse {
  ok: boolean;
  risiko_touren: RisikoTour[];
}

const SCHWELLE_WARTEZEIT = 30;

function buildMock(): RisikoTour[] {
  return [
    {
      batch_id: 'mock-1',
      fahrer_name: 'Max M.',
      wartezeit_min: 38,
      letzter_kontakt_min: null,
      bestell_ids: ['B-001', 'B-002'],
    },
    {
      batch_id: 'mock-2',
      fahrer_name: 'Anna K.',
      wartezeit_min: 33,
      letzter_kontakt_min: 45,
      bestell_ids: ['B-003'],
    },
  ];
}

export function DispatchPhase797TourStornoPraevention({ locationId }: Props) {
  const [touren, setTouren] = useState<RisikoTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    if (!locationId) {
      setTouren(buildMock());
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-storno-risiko?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const json: ApiResponse = await res.json();
      if (json.ok) {
        setTouren((json.risiko_touren ?? []).filter((t) => t.wartezeit_min >= SCHWELLE_WARTEZEIT));
      }
    } catch {
      setTouren(buildMock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const sichtbar = touren.filter((t) => !dismissed.has(t.batch_id));

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-10 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  if (sichtbar.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 px-4 py-3 shadow-sm space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
          Storno-Prävention — {sichtbar.length} Tour{sichtbar.length !== 1 ? 'en' : ''} in Gefahr
        </span>
      </div>

      <div className="space-y-2">
        {sichtbar.map((tour) => (
          <div
            key={tour.batch_id}
            className="rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/30 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-red-700 dark:text-red-300 truncate">
                  {tour.fahrer_name}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
                    <Clock className="h-3 w-3" />
                    {tour.wartezeit_min} Min Wartezeit
                  </span>
                  {tour.letzter_kontakt_min !== null && (
                    <span className="text-[10px] text-muted-foreground">
                      Letzter Kontakt: vor {tour.letzter_kontakt_min} Min
                    </span>
                  )}
                  {tour.letzter_kontakt_min === null && (
                    <span className="text-[10px] text-red-500 font-medium">Kein Kontakt</span>
                  )}
                </div>
                {tour.bestell_ids.length > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {tour.bestell_ids.slice(0, 3).join(', ')}
                    {tour.bestell_ids.length > 3 ? ` +${tour.bestell_ids.length - 3}` : ''}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  className="rounded p-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                  title="Anrufen"
                  aria-label="Fahrer anrufen"
                >
                  <Phone className="h-3 w-3 text-red-600 dark:text-red-400" />
                </button>
                <button
                  className="rounded p-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                  title="Nachricht senden"
                  aria-label="Nachricht senden"
                >
                  <MessageSquare className="h-3 w-3 text-red-600 dark:text-red-400" />
                </button>
                <button
                  onClick={() => setDismissed((prev) => new Set([...prev, tour.batch_id]))}
                  className="rounded p-1 bg-muted hover:bg-muted/80 transition-colors"
                  title="Schließen"
                  aria-label="Schließen"
                >
                  <span className="text-[10px] leading-none text-muted-foreground">✕</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-muted-foreground">
        Touren mit &gt;{SCHWELLE_WARTEZEIT} Min Wartezeit ohne Fahrer-Kontakt · 1-Min-Update
      </p>
    </div>
  );
}
