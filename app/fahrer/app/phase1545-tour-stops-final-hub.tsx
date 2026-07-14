'use client';

import { useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  Navigation,
  CheckCircle2,
  Circle,
  MapPin,
  Package,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge?: number | null;
  sequence?: number | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  order?: {
    id?: string;
    bestellnummer?: string | null;
    kunde_name?: string | null;
    lieferadresse?: string | null;
    gesamtbetrag?: number | null;
    notiz?: string | null;
    items?: Array<{ name?: string; menge?: number }> | null;
  } | null;
}

interface Props {
  stops: Stop[];
  batchStatus?: string | null;
}

function getStopNumber(stop: Stop): number {
  return stop.reihenfolge ?? stop.sequence ?? 0;
}

function isCompleted(stop: Stop): boolean {
  return !!(stop.geliefert_am ?? stop.completed_at);
}

function isArrived(stop: Stop): boolean {
  return !!(stop.angekommen_am ?? stop.arrived_at);
}

export function FahrerPhase1545TourStopsFinalHub({ stops, batchStatus }: Props) {
  const [expandedStops, setExpandedStops] = useState<Set<string>>(new Set());

  const sorted = [...stops].sort((a, b) => getStopNumber(a) - getStopNumber(b));
  const completedCount = sorted.filter(isCompleted).length;
  const totalCount = sorted.length;

  // Determine the current stop: first non-completed stop
  const currentStop = sorted.find((s) => !isCompleted(s));

  function toggleExpand(id: string) {
    setExpandedStops((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function openMaps(address: string | null | undefined) {
    if (!address) return;
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-matcha-800 to-matcha-600 px-4 pb-6 pt-5 text-white shadow-lg">
        <h1 className="text-lg font-bold tracking-tight">Tour-Stops</h1>
        <p className="mt-1 text-sm text-matcha-100 opacity-90">
          {completedCount} von {totalCount} Stop{totalCount !== 1 ? 's' : ''} erledigt
        </p>
        {/* Progress bar */}
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-matcha-900/40">
          <div
            className="h-full rounded-full bg-white/80 transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
        {batchStatus && (
          <p className="mt-2 text-xs text-matcha-100 opacity-75">Status: {batchStatus}</p>
        )}
      </div>

      {/* Stop cards */}
      <div className="space-y-3 px-4 pt-4">
        {sorted.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-400 shadow-sm">
            Keine Stops vorhanden.
          </div>
        )}

        {sorted.map((stop) => {
          const num = getStopNumber(stop);
          const completed = isCompleted(stop);
          const arrived = isArrived(stop);
          const isCurrent = currentStop?.id === stop.id;
          const expanded = expandedStops.has(stop.id);
          const address = stop.order?.lieferadresse;
          const items = stop.order?.items ?? [];

          return (
            <div
              key={stop.id}
              className={cn(
                'overflow-hidden rounded-xl bg-white shadow-sm transition-all duration-200',
                isCurrent && 'border-2 border-amber-400 shadow-amber-100',
                completed && 'opacity-60',
              )}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Stop number indicator */}
                  <div className="mt-0.5 flex-shrink-0">
                    {completed ? (
                      <CheckCircle2 className="h-7 w-7 text-green-500" />
                    ) : isCurrent ? (
                      <div className="relative flex h-7 w-7 items-center justify-center">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                        <span className="relative flex h-6 w-6 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-white">
                          {num}
                        </span>
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-500">
                        {num}
                      </div>
                    )}
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">
                          {stop.order?.kunde_name ?? 'Unbekannte Kundin'}
                        </p>
                        {stop.order?.bestellnummer && (
                          <p className="text-xs text-gray-400">#{stop.order.bestellnummer}</p>
                        )}
                      </div>
                      {stop.order?.gesamtbetrag != null && (
                        <span className="flex-shrink-0 rounded-full bg-matcha-50 px-2 py-0.5 text-sm font-semibold text-matcha-700">
                          {euro(stop.order.gesamtbetrag)}
                        </span>
                      )}
                    </div>

                    {/* Address */}
                    {address && (
                      <div className="mt-1.5 flex items-start gap-1.5 text-gray-500">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                        <p className="text-sm leading-tight">{address}</p>
                      </div>
                    )}

                    {/* Note */}
                    {stop.order?.notiz && (
                      <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                        {stop.order.notiz}
                      </p>
                    )}

                    {/* Action row */}
                    <div className="mt-3 flex items-center gap-2">
                      {/* Maps button */}
                      {address && (
                        <button
                          onClick={() => openMaps(address)}
                          className="flex items-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-matcha-700 active:scale-95"
                        >
                          <Navigation className="h-3.5 w-3.5" />
                          Navigation
                          <ExternalLink className="h-3 w-3 opacity-70" />
                        </button>
                      )}

                      {/* Items toggle */}
                      {items.length > 0 && (
                        <button
                          onClick={() => toggleExpand(stop.id)}
                          className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50"
                        >
                          <Package className="h-3.5 w-3.5" />
                          {items.length} Artikel
                          {expanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Expandable items list */}
                    {expanded && items.length > 0 && (
                      <ul className="mt-3 space-y-1 rounded-lg bg-gray-50 p-3">
                        {items.map((item, idx) => (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{item.name ?? '–'}</span>
                            {item.menge != null && (
                              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                                ×{item.menge}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Completed banner */}
              {completed && (
                <div className="flex items-center gap-1.5 bg-green-50 px-4 py-1.5 text-xs font-medium text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Geliefert
                </div>
              )}
              {arrived && !completed && (
                <div className="flex items-center gap-1.5 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-700">
                  <Circle className="h-3.5 w-3.5" />
                  Angekommen – warte auf Übergabe
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
