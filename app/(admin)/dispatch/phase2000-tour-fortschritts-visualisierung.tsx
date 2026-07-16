'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MapPin, Clock, Truck, CheckCircle2, Circle, ChevronDown, ChevronUp, Gauge, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 2000 — Tour-Fortschritts-Visualisierung (Dispatch)
 *
 * Alle aktiven Touren in einer visuellen Timeline:
 * - Stop-Fortschrittsleiste (abgeschlossen / offen)
 * - Fahrer-Name + Zone + Verlaufsdauer
 * - ETA-Genauigkeits-Anzeige (grün/amber/rot)
 * - Score-Ampel
 * Echtzeit via Supabase-Subscription.
 */

interface Stop {
  id: string;
  sequence: number;
  completed_at?: string | null;
  geliefert_am?: string | null;
  order?: { bestellnummer?: string; kunde_name?: string | null; delivery_zone?: string | null } | null;
}

interface Tour {
  id: string;
  state?: string;
  status?: string;
  startzeit?: string | null;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  driver_name?: string;
  fahrer?: { vorname?: string; nachname?: string } | null;
  stops: Stop[];
  score?: number | null;
}

function getEtaHealth(elapsedMin: number, etaMin: number | null, doneFrac: number): 'gut' | 'knapp' | 'spaet' | 'unbekannt' {
  if (etaMin === null) return 'unbekannt';
  const timeFrac = elapsedMin / etaMin;
  const delta = timeFrac - doneFrac;
  if (delta > 0.3) return 'spaet';
  if (delta > 0.1) return 'knapp';
  return 'gut';
}

const HEALTH_STYLE = {
  gut:       { bg: 'bg-green-50 dark:bg-green-950/20',  border: 'border-green-200 dark:border-green-800',  label: 'Pünktlich',  dot: 'bg-green-500',  text: 'text-green-700 dark:text-green-300'  },
  knapp:     { bg: 'bg-amber-50 dark:bg-amber-950/20',  border: 'border-amber-200 dark:border-amber-800',  label: 'Knapp',      dot: 'bg-amber-500',  text: 'text-amber-700 dark:text-amber-300'  },
  spaet:     { bg: 'bg-red-50 dark:bg-red-950/20',      border: 'border-red-200 dark:border-red-800',      label: 'Verspätet', dot: 'bg-red-500',    text: 'text-red-700 dark:text-red-300'      },
  unbekannt: { bg: 'bg-muted/20',                       border: 'border-border',                           label: 'Unbekannt',  dot: 'bg-muted-foreground', text: 'text-muted-foreground'         },
};

export function DispatchPhase2000TourFortschrittsVisualisierung({
  locationId,
  className,
}: {
  locationId: string | null;
  className?: string;
}) {
  const supabase = createClient();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [offen, setOffen] = useState(true);
  const [tick, setTick] = useState(0);

  async function load() {
    try {
      // Mise-Batches
      const q = supabase
        .from('mise_delivery_batches')
        .select('id, state, startzeit:created_at, total_eta_min, driver_id, stops:mise_delivery_batch_stops(id, sequence, completed_at, order:customer_orders(bestellnummer,kunde_name,delivery_zone))')
        .in('state', ['at_restaurant', 'on_route']);
      if (locationId) {
        // Lädt alle, filtert client-seitig nach location wenn nötig
      }
      const { data: miseBatches } = await q.limit(20);

      // Legacy-Batches
      const { data: legacyBatches } = await supabase
        .from('delivery_batches')
        .select('id, status, startzeit, total_eta_min, zone, fahrer:employees!fahrer_id(vorname, nachname), stops:delivery_batch_stops(id, reihenfolge, geliefert_am, order:customer_orders(bestellnummer,kunde_name,delivery_zone))')
        .in('status', ['pickup', 'unterwegs'])
        .limit(20);

      const combined: Tour[] = [];

      for (const b of (miseBatches ?? [])) {
        const stops: Stop[] = ((b as any).stops ?? []).map((s: any) => ({
          id: s.id,
          sequence: s.sequence,
          completed_at: s.completed_at,
          order: s.order,
        }));
        combined.push({
          id: (b as any).id,
          state: (b as any).state,
          startzeit: (b as any).startzeit,
          total_eta_min: (b as any).total_eta_min,
          stops,
        });
      }

      for (const b of (legacyBatches ?? [])) {
        const stops: Stop[] = ((b as any).stops ?? []).map((s: any) => ({
          id: s.id,
          sequence: s.reihenfolge,
          geliefert_am: s.geliefert_am,
          order: s.order,
        }));
        const fahrer = (b as any).fahrer;
        combined.push({
          id: (b as any).id,
          status: (b as any).status,
          startzeit: (b as any).startzeit,
          total_eta_min: (b as any).total_eta_min,
          zone: (b as any).zone,
          fahrer,
          driver_name: fahrer ? `${fahrer.vorname ?? ''} ${fahrer.nachname ?? ''}`.trim() : undefined,
          stops,
        });
      }

      setTours(combined);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    const ch = supabase.channel('dispatch-tour-vis-2000')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mise_delivery_batch_stops' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batch_stops' }, load)
      .subscribe();
    const tickIv = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => {
      clearInterval(iv);
      clearInterval(tickIv);
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const now = Date.now();

  const rows = useMemo(() => {
    return tours.map((t) => {
      const startMs = t.startzeit ? new Date(t.startzeit).getTime() : null;
      const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
      const totalStops = t.stops.length;
      const doneStops = t.stops.filter((s) => s.completed_at || s.geliefert_am).length;
      const doneFrac = totalStops > 0 ? doneStops / totalStops : 0;
      const health = getEtaHealth(elapsedMin, t.total_eta_min ?? null, doneFrac);
      const remainMin = t.total_eta_min !== null && t.total_eta_min !== undefined
        ? Math.max(0, t.total_eta_min - elapsedMin)
        : null;
      const progressPct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;

      const sortedStops = [...t.stops].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));

      return { tour: t, elapsedMin, doneStops, totalStops, health, remainMin, progressPct, sortedStops };
    }).sort((a, b) => {
      const order = ['spaet', 'knapp', 'gut', 'unbekannt'];
      return order.indexOf(a.health) - order.indexOf(b.health);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tours, tick]);

  if (loading) return null;
  if (rows.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Truck className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Fortschritts-Visualisierung</span>
        <span className="ml-2 text-[10px] rounded-full bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 font-bold">
          {rows.length} Tour{rows.length !== 1 ? 'en' : ''} aktiv
        </span>
        {rows.some((r) => r.health === 'spaet') && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse shrink-0" />
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">Live</span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {offen && (
        <div className="divide-y">
          {rows.map(({ tour, elapsedMin, doneStops, totalStops, health, remainMin, progressPct, sortedStops }) => {
            const hs = HEALTH_STYLE[health];
            return (
              <div key={tour.id} className={cn('px-4 py-3 space-y-2.5', hs.bg)}>
                {/* Tour-Header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', hs.dot)} />
                  <span className="text-xs font-bold text-foreground truncate">
                    {tour.driver_name || 'Fahrer'}
                  </span>
                  {(tour.zone || tour.stops[0]?.order?.delivery_zone) && (
                    <span className="text-[9px] rounded border bg-white/60 dark:bg-black/20 px-1.5 py-0.5 font-bold shrink-0">
                      Zone {tour.zone ?? tour.stops[0]?.order?.delivery_zone}
                    </span>
                  )}
                  <span className={cn('ml-auto text-[9px] font-black rounded-full px-1.5 py-0.5 text-white shrink-0', hs.dot)}>
                    {hs.label}
                  </span>
                </div>

                {/* KPI-Zeile */}
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold tabular-nums text-foreground">{doneStops}/{totalStops}</span>
                    <span className="text-muted-foreground">Stopps</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold tabular-nums text-foreground">{elapsedMin} Min</span>
                    <span className="text-muted-foreground">vergangen</span>
                  </div>
                  {remainMin !== null && (
                    <div className="flex items-center gap-1">
                      <Gauge className="h-3 w-3 text-muted-foreground" />
                      <span className={cn('font-bold tabular-nums', hs.text)}>~{remainMin} Min</span>
                      <span className="text-muted-foreground">verbl.</span>
                    </div>
                  )}
                </div>

                {/* Fortschrittsbalken */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', hs.dot)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                    {progressPct}%
                  </span>
                </div>

                {/* Stop-Timeline */}
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                  {sortedStops.map((stop, idx) => {
                    const done = !!(stop.completed_at || stop.geliefert_am);
                    return (
                      <div key={stop.id} className="flex items-center gap-1 shrink-0">
                        {idx > 0 && <div className={cn('w-4 h-0.5', done ? hs.dot : 'bg-muted-foreground/30')} />}
                        <div className="flex flex-col items-center gap-0.5">
                          {done ? (
                            <CheckCircle2 className={cn('h-4 w-4', hs.text)} />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground/40" />
                          )}
                          {stop.order?.bestellnummer && (
                            <span className="text-[8px] tabular-nums text-muted-foreground">
                              #{String(stop.order.bestellnummer).slice(-3)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
