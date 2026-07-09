'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Clock, ChevronDown, ChevronUp, CheckCircle2, Circle, AlertTriangle } from 'lucide-react';

/**
 * Phase 1002 — Tour-ETA-Sequenz-Board (Dispatch)
 *
 * Echtzeit-Stopp-Sequenz aller aktiven Touren:
 * Jede Tour zeigt ihre Stopps als visuelle Zeitachse (erledigt / aktiv / ausstehend)
 * mit ETA je Stopp und Verspätungs-Ampel.
 * Polling alle 30 Sekunden gegen /api/delivery/admin/tour-stops.
 * Fallback auf Mock-Daten.
 */

interface TourStop {
  id: string;
  nr: number;
  adresse: string;
  eta_min: number | null;
  geliefert_am: string | null;
  ist_aktuell: boolean;
}

interface Tour {
  id: string;
  fahrer: string;
  zone: string | null;
  stopps: TourStop[];
  verzoegert: boolean;
}

const MOCK: Tour[] = [
  {
    id: 't1', fahrer: 'Kemal A.', zone: 'A', verzoegert: false,
    stopps: [
      { id: 's1', nr: 1, adresse: 'Hauptstr. 5',    eta_min: null, geliefert_am: '2024-01-01T12:00:00Z', ist_aktuell: false },
      { id: 's2', nr: 2, adresse: 'Müllerweg 12',   eta_min: 4,    geliefert_am: null,                   ist_aktuell: true  },
      { id: 's3', nr: 3, adresse: 'Ringstr. 8',     eta_min: 12,   geliefert_am: null,                   ist_aktuell: false },
    ],
  },
  {
    id: 't2', fahrer: 'Sara M.', zone: 'B', verzoegert: true,
    stopps: [
      { id: 's4', nr: 1, adresse: 'Gartenallee 3',  eta_min: null, geliefert_am: '2024-01-01T12:10:00Z', ist_aktuell: false },
      { id: 's5', nr: 2, adresse: 'Schulplatz 1',   eta_min: 18,   geliefert_am: null,                   ist_aktuell: true  },
      { id: 's6', nr: 3, adresse: 'Parkweg 22',     eta_min: 28,   geliefert_am: null,                   ist_aktuell: false },
      { id: 's7', nr: 4, adresse: 'Bergstr. 4',     eta_min: 38,   geliefert_am: null,                   ist_aktuell: false },
    ],
  },
];

function StoppDot({ stop }: { stop: TourStop }) {
  if (stop.geliefert_am) {
    return <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />;
  }
  if (stop.ist_aktuell) {
    return <div className="h-4 w-4 rounded-full border-2 border-blue-500 bg-blue-100 dark:bg-blue-900/30 shrink-0 animate-pulse" />;
  }
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

export function DispatchPhase1002TourEtaSequenzBoard({ locationId }: { locationId: string | null }) {
  const [touren, setTouren] = useState<Tour[]>(MOCK);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const qs = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/tour-stop-timing${qs}`);
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const mapped: Tour[] = (raw.touren ?? raw.batches ?? []).map((t: {
          id?: string;
          fahrer_name?: string; fahrerName?: string; fahrer?: string;
          zone?: string | null;
          verzoegert?: boolean; is_delayed?: boolean;
          stopps?: Array<{
            id?: string; nr?: number; stop_nr?: number;
            adresse?: string; address?: string;
            eta_min?: number | null;
            geliefert_am?: string | null; delivered_at?: string | null;
            ist_aktuell?: boolean; is_current?: boolean;
          }>;
        }) => ({
          id: t.id ?? '',
          fahrer: t.fahrer_name ?? t.fahrerName ?? t.fahrer ?? 'Fahrer',
          zone: t.zone ?? null,
          verzoegert: t.verzoegert ?? t.is_delayed ?? false,
          stopps: (t.stopps ?? []).map((s, i) => ({
            id: s.id ?? String(i),
            nr: s.nr ?? s.stop_nr ?? i + 1,
            adresse: s.adresse ?? s.address ?? `Stopp ${i + 1}`,
            eta_min: s.eta_min ?? null,
            geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
            ist_aktuell: s.ist_aktuell ?? s.is_current ?? false,
          })),
        }));
        if (mapped.length > 0) setTouren(mapped);
      } catch {
        // keep mock
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const verzoegert = touren.filter(t => t.verzoegert).length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Tour-ETA-Sequenz-Board</span>
          {verzoegert > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {verzoegert}× Verspätet
            </span>
          )}
          <span className="ml-auto text-[9px] text-muted-foreground">{touren.length} Touren aktiv</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {touren.map(tour => {
            const done = tour.stopps.filter(s => s.geliefert_am).length;
            const total = tour.stopps.length;
            const aktuellerStopp = tour.stopps.find(s => s.ist_aktuell);

            return (
              <div
                key={tour.id}
                className={cn(
                  'px-4 py-3 space-y-2',
                  tour.verzoegert ? 'bg-red-50 dark:bg-red-950/10' : 'bg-transparent',
                )}
              >
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{tour.fahrer}</span>
                  {tour.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 dark:bg-zinc-800 border px-1.5 py-0.5 font-bold">
                      Zone {tour.zone}
                    </span>
                  )}
                  {tour.verzoegert && (
                    <span className="text-[9px] rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-1.5 py-0.5 font-bold text-red-700 dark:text-red-300">
                      Verspätet
                    </span>
                  )}
                  <span className="ml-auto text-[9px] text-muted-foreground tabular-nums">
                    {done}/{total} Stopps
                  </span>
                </div>

                {/* Stopp-Sequenz als Zeitachse */}
                <div className="flex items-center gap-0">
                  {tour.stopps.map((stopp, idx) => (
                    <div key={stopp.id} className="flex items-center">
                      <div className={cn(
                        'flex flex-col items-center gap-0.5',
                        stopp.ist_aktuell ? 'opacity-100' : stopp.geliefert_am ? 'opacity-70' : 'opacity-40',
                      )}>
                        <StoppDot stop={stopp} />
                        {stopp.eta_min !== null && !stopp.geliefert_am && (
                          <span className={cn(
                            'text-[8px] font-bold tabular-nums',
                            stopp.ist_aktuell ? 'text-blue-600 dark:text-blue-400' : 'text-muted-foreground',
                          )}>
                            {stopp.eta_min}m
                          </span>
                        )}
                      </div>
                      {idx < tour.stopps.length - 1 && (
                        <div className={cn(
                          'h-px w-6 sm:w-10 mx-0.5 transition-colors',
                          stopp.geliefert_am ? 'bg-matcha-400' : 'bg-border',
                        )} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Aktiver Stopp Info */}
                {aktuellerStopp && (
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">{aktuellerStopp.adresse}</span>
                    {aktuellerStopp.eta_min !== null && (
                      <span className="shrink-0 font-bold">~{aktuellerStopp.eta_min} Min</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {touren.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">Keine aktiven Touren.</div>
          )}
        </div>
      )}
    </div>
  );
}
