'use client';

import { useEffect, useState } from 'react';
import { Activity, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourEtaConfidence {
  batchId: string;
  zone: string | null;
  driverName: string | null;
  confidence: number;
  confidenceLabel: 'sehr-hoch' | 'hoch' | 'mittel' | 'niedrig' | 'unbekannt';
  remainingStops: number;
  totalStops: number;
  gpsAgeMin: number | null;
  zonePunctualityPct: number | null;
  factors: {
    kuechenScore: number;
    gpsScore: number;
    zonenScore: number;
    stopsScore: number;
  };
}

interface Props {
  locationId: string | null;
}

const LABEL_CONFIG: Record<TourEtaConfidence['confidenceLabel'], { label: string; barColor: string; textColor: string; badgeBg: string }> = {
  'sehr-hoch': { label: 'Sehr hoch', barColor: 'bg-matcha-500', textColor: 'text-matcha-700', badgeBg: 'bg-matcha-100' },
  'hoch':      { label: 'Hoch',      barColor: 'bg-blue-500',   textColor: 'text-blue-700',   badgeBg: 'bg-blue-50'    },
  'mittel':    { label: 'Mittel',    barColor: 'bg-amber-400',  textColor: 'text-amber-700',  badgeBg: 'bg-amber-50'   },
  'niedrig':   { label: 'Niedrig',   barColor: 'bg-red-400',    textColor: 'text-red-700',    badgeBg: 'bg-red-50'     },
  'unbekannt': { label: '?',         barColor: 'bg-gray-300',   textColor: 'text-gray-500',   badgeBg: 'bg-gray-50'    },
};

export function DispatchEtaKonfidenzLeiste({ locationId }: Props) {
  const [tours, setTours] = useState<TourEtaConfidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/eta-confidence-score?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d) => setTours(d.tours ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 45_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!loading && tours.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        <Activity className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          ETA-Konfidenz je Tour
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {loading ? (
            <div className="p-4 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded bg-muted/40 animate-pulse" />
              ))}
            </div>
          ) : (
            tours.map((tour) => {
              const cfg = LABEL_CONFIG[tour.confidenceLabel];
              return (
                <div key={tour.batchId} className={cn('px-4 py-3', cfg.badgeBg)}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold truncate flex-1">
                      {tour.driverName ?? 'Fahrer'}
                    </span>
                    {tour.zone && (
                      <span className="text-[9px] rounded-full border bg-white/70 px-1.5 py-0.5 font-bold">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-black tabular-nums', cfg.textColor)}>
                      {tour.confidence}%
                    </span>
                    <span className={cn('text-[9px] font-bold rounded px-1.5 py-0.5 border', cfg.textColor)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Confidence bar */}
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
                      style={{ width: `${tour.confidence}%` }}
                    />
                  </div>

                  {/* Sub-factor pills */}
                  <div className="mt-1.5 flex gap-2 flex-wrap text-[9px] text-muted-foreground">
                    <span>Küche {tour.factors.kuechenScore}/20</span>
                    <span>GPS {tour.factors.gpsScore}/25{tour.gpsAgeMin !== null ? ` (${tour.gpsAgeMin}m)` : ''}</span>
                    <span>Zone {tour.factors.zonenScore}/25{tour.zonePunctualityPct !== null ? ` (${tour.zonePunctualityPct}%)` : ''}</span>
                    <span>Stopps {tour.factors.stopsScore}/30 ({tour.remainingStops}/{tour.totalStops})</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
