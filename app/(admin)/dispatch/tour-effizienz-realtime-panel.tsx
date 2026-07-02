'use client';

/**
 * DispatchTourEffizienzRealtimePanel — Phase 518
 *
 * Für jede aktive Tour:
 *   - Ø km/Lieferung
 *   - Ø Min/Stop
 *   - Profitabilität (Liefergebühren – Fahrerkosten)
 * Pollt /api/delivery/admin/tour-effizienz-realtime alle 60s.
 */

import { useEffect, useRef, useState } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourEffizienzRow {
  batchId: string;
  driverName: string | null;
  stopsGesamt: number;
  stopsDone: number;
  avgMinProStop: number | null;
  estimatedKm: number | null;
  kmProLieferung: number | null;
  liefergebuehrenEur: number | null;
  fahrerKostenEur: number | null;
  profitEur: number | null;
  startedAt: string | null;
  elapsedMin: number;
}

interface ApiResponse {
  ok: boolean;
  touren: TourEffizienzRow[];
  generatedAt: string;
}

const POLL_MS = 60_000;

interface Props {
  locationId: string | null;
}

function ProfitBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground text-[10px]">—</span>;
  const pos = value >= 0;
  const Icon = value > 0.5 ? TrendingUp : value < -0.5 ? TrendingDown : Minus;
  return (
    <span className={cn('flex items-center gap-0.5 font-bold text-xs tabular-nums', pos ? 'text-matcha-400' : 'text-red-400')}>
      <Icon className="h-3 w-3" />
      {value >= 0 ? '+' : ''}{value.toFixed(2)} €
    </span>
  );
}

export function DispatchTourEffizienzRealtimePanel({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-effizienz-realtime?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const touren = data?.touren ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-bold text-foreground">Tour-Effizienz Echtzeit</span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? 'Einklappen' : 'Ausklappen'}
          className="text-muted-foreground hover:text-foreground"
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {open && (
        <>
          {!locationId && (
            <p className="text-xs text-muted-foreground text-center py-2">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && loading && (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />)}
            </div>
          )}

          {locationId && data && touren.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Touren.</p>
          )}

          {touren.length > 0 && (
            <div className="space-y-2">
              {/* Tabellen-Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 text-[9px] font-bold uppercase tracking-wide text-muted-foreground px-1">
                <span>Fahrer</span>
                <span className="text-right">Stops</span>
                <span className="text-right">km/Lief.</span>
                <span className="text-right">Min/Stop</span>
                <span className="text-right">Profit</span>
              </div>

              {touren.map((tour) => (
                <div
                  key={tour.batchId}
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 items-center rounded-lg bg-muted/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {tour.driverName ?? 'Unbekannt'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{tour.elapsedMin} Min vergangen</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs tabular-nums font-bold text-foreground">
                      {tour.stopsDone}/{tour.stopsGesamt}
                    </span>
                  </div>
                  <div className="text-right">
                    {tour.kmProLieferung !== null ? (
                      <span className="text-xs tabular-nums font-semibold text-blue-300">
                        {tour.kmProLieferung.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    {tour.avgMinProStop !== null ? (
                      <span className={cn('text-xs tabular-nums font-semibold', tour.avgMinProStop <= 5 ? 'text-matcha-400' : tour.avgMinProStop <= 10 ? 'text-amber-300' : 'text-red-400')}>
                        {tour.avgMinProStop.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="text-right">
                    <ProfitBadge value={tour.profitEur} />
                  </div>
                </div>
              ))}

              {data?.generatedAt && (
                <p className="text-[9px] text-muted-foreground text-right">
                  Stand: {new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
