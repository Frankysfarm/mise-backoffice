'use client';

// Phase 1223 — Fahrer-Einsatz-Planer (Dispatch)
// Drag-and-Drop-Zuweisung freier Fahrer zu offenen Touren (visuell, nur Vorschau — keine DB-Änderung)

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Bike, Package, AlertTriangle, CheckCircle2, RefreshCw, Users, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null;
}

interface FreierFahrer {
  id: string;
  name: string;
  zone: string | null;
  online_seit_min: number;
}

interface OffeneTour {
  id: string;
  stopps: number;
  zone: string | null;
  bestellwert_eur: number;
  warte_seit_min: number;
}

interface Zuweisung {
  tourId: string;
  fahrerId: string;
}

const MOCK_FAHRER: FreierFahrer[] = [
  { id: 'f1', name: 'Max Müller', zone: 'Mitte', online_seit_min: 12 },
  { id: 'f2', name: 'Jana Koch', zone: 'Nord', online_seit_min: 34 },
  { id: 'f3', name: 'Tom Bauer', zone: null, online_seit_min: 5 },
];

const MOCK_TOUREN: OffeneTour[] = [
  { id: 't1', stopps: 3, zone: 'Mitte', bestellwert_eur: 54.5, warte_seit_min: 8 },
  { id: 't2', stopps: 2, zone: 'Nord', bestellwert_eur: 31.0, warte_seit_min: 15 },
  { id: 't3', stopps: 4, zone: 'Süd', bestellwert_eur: 72.0, warte_seit_min: 3 },
];

export function DispatchPhase1223FahrerEinsatzPlaner({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [fahrer, setFahrer] = useState<FreierFahrer[]>(MOCK_FAHRER);
  const [touren, setTouren] = useState<OffeneTour[]>(MOCK_TOUREN);
  const [zuweisungen, setZuweisungen] = useState<Zuweisung[]>([]);
  const [dragFahrerId, setDragFahrerId] = useState<string | null>(null);
  const [hoveredTourId, setHoveredTourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/freie-fahrer?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.fahrer?.length) setFahrer(d.fahrer);
        if (d.touren?.length) setTouren(d.touren);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  const zugewieseneFahrerIds = new Set(zuweisungen.map((z) => z.fahrerId));
  const zugewieseneTourIds = new Set(zuweisungen.map((z) => z.tourId));

  function assignFahrer(tourId: string, fahrerId: string) {
    setZuweisungen((prev) => {
      const filtered = prev.filter((z) => z.tourId !== tourId && z.fahrerId !== fahrerId);
      return [...filtered, { tourId, fahrerId }];
    });
  }

  function removeZuweisung(tourId: string) {
    setZuweisungen((prev) => prev.filter((z) => z.tourId !== tourId));
  }

  function getFahrerForTour(tourId: string): FreierFahrer | undefined {
    const z = zuweisungen.find((zu) => zu.tourId === tourId);
    return z ? fahrer.find((f) => f.id === z.fahrerId) : undefined;
  }

  const freiFahrer = fahrer.filter((f) => !zugewieseneFahrerIds.has(f.id));
  const offeneCount = touren.filter((t) => !zugewieseneTourIds.has(t.id)).length;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
      >
        <Route className="h-4 w-4 text-violet-500 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">
          Fahrer-Einsatz-Planer
          <span className="ml-2 text-[10px] font-normal text-muted-foreground">(Vorschau)</span>
        </span>
        {offeneCount > 0 && (
          <span className="text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5">
            {offeneCount} offen
          </span>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
          {freiFahrer.length} frei · {zuweisungen.length} geplant
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <p className="text-[11px] text-muted-foreground">
            Fahrer auf Tour ziehen (drag) oder per Klick zuweisen — nur visuelle Vorschau, keine Datenbankänderung.
          </p>

          {/* Freie Fahrer */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Users className="h-3 w-3" /> Freie Fahrer ({freiFahrer.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {freiFahrer.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Alle Fahrer zugeteilt</span>
              )}
              {freiFahrer.map((f) => (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => setDragFahrerId(f.id)}
                  onDragEnd={() => setDragFahrerId(null)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border cursor-grab active:cursor-grabbing select-none transition',
                    'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700 text-violet-800 dark:text-violet-200',
                    dragFahrerId === f.id && 'opacity-50 scale-95',
                  )}
                >
                  <Bike className="h-3 w-3" />
                  {f.name}
                  {f.zone && <span className="text-[9px] font-normal opacity-70">· {f.zone}</span>}
                  <span className="text-[9px] text-muted-foreground tabular-nums">{f.online_seit_min}m</span>
                </div>
              ))}
            </div>
          </div>

          {/* Offene Touren */}
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
              <Package className="h-3 w-3" /> Offene Touren ({touren.length})
            </div>
            <div className="space-y-2">
              {touren.map((tour) => {
                const assignedFahrer = getFahrerForTour(tour.id);
                const isHovered = hoveredTourId === tour.id;
                const isUrgent = tour.warte_seit_min >= 10;

                return (
                  <div
                    key={tour.id}
                    onDragOver={(e) => { e.preventDefault(); setHoveredTourId(tour.id); }}
                    onDragLeave={() => setHoveredTourId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFahrerId) assignFahrer(tour.id, dragFahrerId);
                      setHoveredTourId(null);
                      setDragFahrerId(null);
                    }}
                    className={cn(
                      'rounded-lg border p-3 transition',
                      assignedFahrer
                        ? 'bg-matcha-50 dark:bg-matcha-900/20 border-matcha-300 dark:border-matcha-700'
                        : isHovered
                          ? 'bg-violet-50 dark:bg-violet-900/30 border-violet-400 dark:border-violet-600 border-dashed'
                          : isUrgent
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-muted/30 border-border',
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold">Tour #{tour.id.slice(-3)}</span>
                          {tour.zone && (
                            <span className="text-[9px] rounded-full bg-white/60 dark:bg-white/10 border px-1.5 py-0.5 font-bold">
                              Zone {tour.zone}
                            </span>
                          )}
                          <span className={cn(
                            'text-[9px] font-bold rounded-full px-1.5 py-0.5',
                            isUrgent
                              ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 animate-pulse'
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
                          )}>
                            {isUrgent && <AlertTriangle className="inline h-2.5 w-2.5 mr-0.5" />}
                            {tour.warte_seit_min}m wartend
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span>{tour.stopps} Stopps</span>
                          <span className="font-bold text-foreground">{tour.bestellwert_eur.toFixed(2)} €</span>
                        </div>
                      </div>

                      {assignedFahrer ? (
                        <div className="shrink-0 flex items-center gap-1.5">
                          <div className="flex items-center gap-1 rounded-lg bg-matcha-100 dark:bg-matcha-900/40 border border-matcha-300 dark:border-matcha-700 px-2 py-1 text-[11px] font-bold text-matcha-700 dark:text-matcha-300">
                            <CheckCircle2 className="h-3 w-3" />
                            {assignedFahrer.name}
                          </div>
                          <button
                            onClick={() => removeZuweisung(tour.id)}
                            className="text-[9px] text-muted-foreground hover:text-red-500 underline"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="shrink-0 flex flex-col gap-1">
                          {freiFahrer.slice(0, 2).map((f) => (
                            <button
                              key={f.id}
                              onClick={() => assignFahrer(tour.id, f.id)}
                              className="text-[10px] rounded px-2 py-1 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold hover:bg-violet-200 dark:hover:bg-violet-900/60 transition"
                            >
                              + {f.name.split(' ')[0]}
                            </button>
                          ))}
                          {freiFahrer.length === 0 && (
                            <span className="text-[10px] text-muted-foreground italic">Kein Fahrer frei</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {zuweisungen.length > 0 && (
            <button
              onClick={() => setZuweisungen([])}
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground underline"
            >
              <RefreshCw className="h-3 w-3" /> Alle Zuweisungen zurücksetzen
            </button>
          )}
        </div>
      )}
    </div>
  );
}
