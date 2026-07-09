'use client';

/**
 * Phase 1016 — Tour-Stopp-Live-Cockpit (Dispatch)
 *
 * Echtzeit-Übersicht aller aktiven Tour-Stopps:
 * - Je Tour: Fahrer + Zone + Score-Balken + verbleibende Stopps
 * - Nächster Stopp prominent mit ETA-Ampel (grün/amber/rot)
 * - SLA-Status je Tour als Badge
 * - Stopp-Sequenz als Icon-Kette
 * - Polling: 45s. Fallback: Mock-Daten wenn keine API.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MapPin, Clock, ChevronDown, ChevronUp, Loader2,
  Navigation2, Star, AlertTriangle, CheckCircle2, Route,
} from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'offen' | 'unterwegs' | 'erledigt';
  eta_min: number | null;
  bestellnummer: string;
}

interface ActiveTour {
  fahrer_id: string;
  fahrer_name: string;
  tour_id: string;
  zone: string | null;
  score: number;
  sla: 'ok' | 'gefaehrdet' | 'verletzt';
  stopps: TourStop[];
  eta_gesamt_min: number | null;
}

interface ApiResp { touren: ActiveTour[]; generiert_am: string }

const MOCK: ApiResp = {
  generiert_am: new Date().toISOString(),
  touren: [
    {
      fahrer_id: 'f1', fahrer_name: 'M. Bauer', tour_id: 't1', zone: 'A',
      score: 87, sla: 'ok', eta_gesamt_min: 22,
      stopps: [
        { stopp_nr: 1, adresse: 'Musterstr. 12', status: 'erledigt', eta_min: null, bestellnummer: '1001' },
        { stopp_nr: 2, adresse: 'Hauptstr. 7',   status: 'unterwegs', eta_min: 8, bestellnummer: '1002' },
        { stopp_nr: 3, adresse: 'Gartenweg 3',   status: 'offen', eta_min: 16, bestellnummer: '1003' },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'L. Huber', tour_id: 't2', zone: 'B',
      score: 61, sla: 'gefaehrdet', eta_gesamt_min: 38,
      stopps: [
        { stopp_nr: 1, adresse: 'Ringstr. 45',   status: 'erledigt', eta_min: null, bestellnummer: '1004' },
        { stopp_nr: 2, adresse: 'Waldweg 9',     status: 'offen', eta_min: 14, bestellnummer: '1005' },
        { stopp_nr: 3, adresse: 'Bergstr. 22',   status: 'offen', eta_min: 28, bestellnummer: '1006' },
        { stopp_nr: 4, adresse: 'Seestr. 1',     status: 'offen', eta_min: 38, bestellnummer: '1007' },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'K. Stein', tour_id: 't3', zone: 'C',
      score: 38, sla: 'verletzt', eta_gesamt_min: 55,
      stopps: [
        { stopp_nr: 1, adresse: 'Dorfstr. 6',    status: 'offen', eta_min: 21, bestellnummer: '1008' },
        { stopp_nr: 2, adresse: 'Blumenstr. 14', status: 'offen', eta_min: 37, bestellnummer: '1009' },
        { stopp_nr: 3, adresse: 'Am Markt 2',    status: 'offen', eta_min: 55, bestellnummer: '1010' },
      ],
    },
  ],
};

interface Props { locationId: string | null }

function scoreBar(score: number) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function slaBadge(sla: string) {
  if (sla === 'ok')         return <span className="rounded-full bg-matcha-100 dark:bg-matcha-800 px-1.5 py-0.5 text-[9px] font-bold text-matcha-700 dark:text-matcha-200">SLA OK</span>;
  if (sla === 'gefaehrdet') return <span className="rounded-full bg-amber-100 dark:bg-amber-800 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-200 animate-pulse">Gefährdet</span>;
  return <span className="rounded-full bg-red-100 dark:bg-red-800 px-1.5 py-0.5 text-[9px] font-bold text-red-700 dark:text-red-200 animate-pulse">SLA Verletzt</span>;
}

function etaColor(min: number | null): string {
  if (min === null) return 'text-muted-foreground';
  if (min <= 10) return 'text-matcha-600 dark:text-matcha-400';
  if (min <= 25) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function DispatchPhase1016TourStoppLiveCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/dispatch/tour-stops-live?location_id=${locationId}`
        : `/api/delivery/dispatch/tour-stops-live`;
      const r = await fetch(url);
      if (r.ok) { setData(await r.json()); return; }
    } catch {}
    setData(MOCK);
  }, [locationId]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    const t = setInterval(load, 45_000);
    return () => clearInterval(t);
  }, [load]);

  const touren = data?.touren ?? [];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Stopp Live-Cockpit
          </span>
          {!loading && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-800 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-200">
              {touren.length} aktive Touren
            </span>
          )}
          {touren.some(t => t.sla === 'verletzt') && (
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
          )}
        </div>
        {loading
          ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          : open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />
        }
      </button>

      {open && (
        <div className="border-t divide-y">
          {touren.length === 0 && !loading && (
            <p className="px-5 py-4 text-sm text-muted-foreground text-center">Keine aktiven Touren</p>
          )}
          {touren.map(tour => {
            const nextStop = tour.stopps.find(s => s.status !== 'erledigt');
            const done = tour.stopps.filter(s => s.status === 'erledigt').length;
            const total = tour.stopps.length;
            return (
              <div key={tour.tour_id} className="px-4 py-3 space-y-2.5">
                {/* Fahrer header */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Navigation2 className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                  <span className="font-bold text-sm">{tour.fahrer_name}</span>
                  {tour.zone && (
                    <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                      Zone {tour.zone}
                    </span>
                  )}
                  {slaBadge(tour.sla)}
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono">
                    {done}/{total} Stopps
                  </span>
                </div>

                {/* Score bar */}
                {scoreBar(tour.score)}

                {/* Stopp-Sequenz */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  {tour.stopps.map((s, i) => (
                    <div key={s.stopp_nr} className="flex items-center gap-1 shrink-0">
                      <div className={cn(
                        'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2',
                        s.status === 'erledigt'  ? 'bg-matcha-100 dark:bg-matcha-900 border-matcha-400 text-matcha-700' :
                        s.status === 'unterwegs' ? 'bg-amber-100 dark:bg-amber-900 border-amber-400 text-amber-700 animate-pulse' :
                                                   'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 text-zinc-500',
                      )}>
                        {s.status === 'erledigt' ? <CheckCircle2 className="h-3 w-3" /> : s.stopp_nr}
                      </div>
                      {i < tour.stopps.length - 1 && (
                        <div className={cn('h-0.5 w-4 rounded', s.status === 'erledigt' ? 'bg-matcha-400' : 'bg-zinc-200 dark:bg-zinc-700')} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Nächster Stopp */}
                {nextStop && (
                  <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2">
                    <MapPin className="h-3.5 w-3.5 text-matcha-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{nextStop.adresse}</div>
                      <div className="text-[10px] text-muted-foreground">#{nextStop.bestellnummer}</div>
                    </div>
                    {nextStop.eta_min !== null && (
                      <div className={cn('flex items-center gap-1 text-xs font-bold tabular-nums', etaColor(nextStop.eta_min))}>
                        <Clock className="h-3 w-3" />
                        {nextStop.eta_min} Min
                      </div>
                    )}
                  </div>
                )}

                {/* Gesamt-ETA */}
                {tour.eta_gesamt_min !== null && (
                  <div className={cn('text-[10px] text-right font-mono', etaColor(tour.eta_gesamt_min))}>
                    Rückkehr in ~{tour.eta_gesamt_min} Min
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
