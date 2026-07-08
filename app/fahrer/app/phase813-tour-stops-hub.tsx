'use client';

import { ListOrdered, Navigation, Clock } from 'lucide-react';

interface StopOrder {
  bestellnummer: string;
  kunde_name: string;
  kunde_adresse: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
}

interface TourStop {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: StopOrder | null;
}

interface Props {
  stops: TourStop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

type StopStatus = 'geliefert' | 'angekommen' | 'ausstehend';

function getStatus(stop: TourStop): StopStatus {
  if (stop.geliefert_am) return 'geliefert';
  if (stop.angekommen_am) return 'angekommen';
  return 'ausstehend';
}

function formatEta(iso: string | null): string | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return null;
  }
}

function buildMapsUrl(adresse: string, driverLat?: number | null, driverLng?: number | null): string {
  const dest = encodeURIComponent(adresse);
  if (driverLat != null && driverLng != null) {
    return `https://maps.google.com/?saddr=${driverLat},${driverLng}&daddr=${dest}`;
  }
  return `https://maps.google.com/?q=${dest}`;
}

export function FahrerPhase813TourStopsHub({ stops, driverLat, driverLng }: Props) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);

  const geliefertCount = sorted.filter((s) => s.geliefert_am).length;
  const gesamt = sorted.length;
  const fortschritt = gesamt > 0 ? (geliefertCount / gesamt) * 100 : 0;

  // Current stop: first with angekommen but not geliefert, else first pending
  const currentStop =
    sorted.find((s) => s.angekommen_am && !s.geliefert_am) ??
    sorted.find((s) => !s.angekommen_am && !s.geliefert_am) ??
    null;

  const handleNavigieren = (stop: TourStop) => {
    const adresse = stop.order?.kunde_adresse ?? stop.order?.kunde_name ?? '';
    if (!adresse) return;
    window.open(buildMapsUrl(adresse, driverLat, driverLng), '_blank');
  };

  return (
    <div className="rounded-2xl bg-gray-900/80 border border-gray-700/60 px-4 py-4 shadow-xl text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-bold tracking-tight">Tour Stopps</span>
        </div>
        <span className="text-xs text-gray-400 tabular-nums">
          {geliefertCount}/{gesamt} abgeschlossen
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-1.5 w-full rounded-full bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${fortschritt}%` }}
          />
        </div>
      </div>

      {/* Stop List */}
      <div className="space-y-2">
        {sorted.map((stop) => {
          const status = getStatus(stop);
          const isCurrent = currentStop?.id === stop.id;
          const etaEarliest = formatEta(stop.order?.eta_earliest ?? null);
          const etaLatest = formatEta(stop.order?.eta_latest ?? null);
          const hasPendingNav =
            status === 'ausstehend' && stop.order?.kunde_adresse;

          let cardClasses =
            'flex items-start gap-3 rounded-xl px-3 py-2.5 border transition-all';
          if (isCurrent) {
            cardClasses +=
              status === 'angekommen'
                ? ' border-amber-400/70 bg-amber-950/30 ring-1 ring-amber-400/40'
                : ' border-blue-400/70 bg-blue-950/30 ring-1 ring-blue-400/40';
          } else if (status === 'geliefert') {
            cardClasses += ' border-gray-700/40 bg-gray-800/30 opacity-60';
          } else {
            cardClasses += ' border-gray-700/50 bg-gray-800/40';
          }

          return (
            <div key={stop.id} className={cardClasses}>
              {/* Status Indicator + Number Circle */}
              <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
                {status === 'geliefert' ? (
                  <span className="text-base leading-none text-emerald-400">✓</span>
                ) : status === 'angekommen' ? (
                  <span className="text-base leading-none">🚗</span>
                ) : (
                  <span className="h-4 w-4 rounded-full border-2 border-gray-500 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400">
                      {stop.reihenfolge}
                    </span>
                  </span>
                )}
                {status !== 'ausstehend' && (
                  <span
                    className={`text-[9px] font-semibold tabular-nums ${
                      status === 'geliefert' ? 'text-emerald-500' : 'text-amber-400'
                    }`}
                  >
                    #{stop.reihenfolge}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold truncate ${
                        status === 'geliefert' ? 'line-through text-gray-500' : 'text-white'
                      }`}
                    >
                      {stop.order?.kunde_name ?? '–'}
                    </p>
                    {stop.order?.kunde_adresse && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">
                        {stop.order.kunde_adresse}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  {status === 'geliefert' && (
                    <span className="shrink-0 rounded-full bg-emerald-900/50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-400">
                      Geliefert
                    </span>
                  )}
                  {status === 'angekommen' && !isCurrent && (
                    <span className="shrink-0 rounded-full bg-amber-900/50 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                      Vor Ort
                    </span>
                  )}
                  {isCurrent && status === 'angekommen' && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Vor Ort
                    </span>
                  )}
                  {isCurrent && status === 'ausstehend' && (
                    <span className="shrink-0 rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Nächster
                    </span>
                  )}
                </div>

                {/* ETA row */}
                {(etaEarliest || etaLatest) && status !== 'geliefert' && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock className="h-3 w-3 text-gray-500 shrink-0" />
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {etaEarliest && etaLatest
                        ? `ETA ${etaEarliest}–${etaLatest}`
                        : `ETA ${etaEarliest ?? etaLatest}`}
                    </span>
                  </div>
                )}

                {/* Navigieren button for pending stops */}
                {hasPendingNav && (
                  <button
                    onClick={() => handleNavigieren(stop)}
                    className="mt-2 flex items-center gap-1.5 rounded-lg bg-blue-600 active:bg-blue-700 px-3 py-1.5 text-[11px] font-bold text-white transition-opacity active:opacity-80"
                  >
                    <Navigation className="h-3 w-3 shrink-0" />
                    Navigieren
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">
            Keine Stopps vorhanden.
          </p>
        )}
      </div>
    </div>
  );
}
