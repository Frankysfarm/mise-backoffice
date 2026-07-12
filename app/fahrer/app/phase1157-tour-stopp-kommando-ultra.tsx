'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Navigation, Package, Phone, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1157 — Tour-Stopp-Kommando-Ultra (Fahrer-App)
// Übersichtliche Tour-Stopp-Navigations-Zentrale: aktueller Stopp + nächste Stopps + Schnell-Aktionen

interface Stop {
  id: string;
  batch_id?: string;
  order_id?: string;
  reihenfolge?: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  order?: {
    id?: string;
    bestellnummer?: string;
    kunde_name?: string;
    kunde_adresse?: string | null;
    kunde_plz?: string | null;
    kunde_telefon?: string | null;
    gesamtbetrag?: number;
    bezahlt?: boolean;
    zahlungsart?: string;
    eta_earliest?: string | null;
    eta_latest?: string | null;
    kunde_notiz?: string | null;
  } | null;
}

interface ActiveBatch {
  id: string;
  status?: string;
  stops: Stop[];
}

interface Props {
  activeBatch: ActiveBatch | null;
  onMarkDelivered?: (stopId: string) => void;
}

function etaLabel(stop: Stop): string | null {
  const latest = stop.order?.eta_latest;
  if (!latest) return null;
  const d = new Date(latest);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function mapsUrl(stop: Stop): string {
  const adresse = stop.order?.kunde_adresse ?? '';
  const plz = stop.order?.kunde_plz ?? '';
  const q = encodeURIComponent(`${adresse} ${plz}`.trim());
  return `https://maps.google.com/?q=${q}`;
}

export function FahrerPhase1157TourStoppKommandoUltra({ activeBatch, onMarkDelivered }: Props) {
  const [open, setOpen] = useState(true);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  const stops = useMemo(() => {
    if (!activeBatch?.stops?.length) return [];
    return [...activeBatch.stops]
      .sort((a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0));
  }, [activeBatch]);

  const pendingStops = stops.filter(s => !s.geliefert_am);
  const completedStops = stops.filter(s => !!s.geliefert_am);
  const currentStop = pendingStops[0] ?? null;
  const nextStops = pendingStops.slice(1, 3);

  if (!activeBatch || stops.length === 0) return null;

  const totalStops = stops.length;
  const doneCount = completedStops.length;
  const progressPct = totalStops > 0 ? Math.round((doneCount / totalStops) * 100) : 0;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-100/60 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Navigation className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-sm font-bold text-blue-800 uppercase tracking-wider">
            Tour-Kommando
          </span>
          <span className="rounded-full bg-blue-600 text-white text-[10px] font-black px-2 py-0.5">
            {doneCount}/{totalStops} Stopps
          </span>
          {pendingStops.length === 0 && (
            <span className="rounded-full bg-matcha-600 text-white text-[10px] font-black px-2 py-0.5">
              Tour abgeschlossen!
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-blue-600" />
          : <ChevronDown className="h-4 w-4 text-blue-600" />}
      </button>

      {open && (
        <div className="border-t border-blue-200 space-y-0">
          {/* Fortschrittsbalken */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider">Fortschritt</span>
              <span className="text-[10px] font-black text-blue-800 ml-auto">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-blue-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Aktueller Stopp */}
          {currentStop && (
            <div className="mx-3 mb-3 rounded-lg border-2 border-blue-400 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-[11px] font-black uppercase tracking-wider">Jetzt liefern</span>
                <span className="ml-auto text-[10px] opacity-80">Stopp {(currentStop.reihenfolge ?? 0) + 1}</span>
              </div>
              <div className="p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-gray-900 truncate">
                      {currentStop.order?.kunde_name ?? 'Kunde'}
                    </div>
                    <div className="text-[11px] text-gray-600 truncate">
                      {currentStop.order?.kunde_adresse}
                      {currentStop.order?.kunde_plz ? `, ${currentStop.order.kunde_plz}` : ''}
                    </div>
                    {currentStop.order?.kunde_notiz && (
                      <div className="mt-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        {currentStop.order.kunde_notiz}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-black text-gray-900">
                      {currentStop.order?.gesamtbetrag != null
                        ? `${currentStop.order.gesamtbetrag.toFixed(2)} €`
                        : ''}
                    </div>
                    {currentStop.order?.bezahlt === false && (
                      <div className="text-[9px] font-bold text-red-600 uppercase">Bar</div>
                    )}
                    {currentStop.order?.bezahlt === true && (
                      <div className="text-[9px] font-bold text-matcha-600 uppercase">Bezahlt</div>
                    )}
                  </div>
                </div>

                {/* Aktionszeile */}
                <div className="flex items-center gap-2">
                  <a
                    href={mapsUrl(currentStop)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold py-2 hover:bg-blue-600 transition"
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Navigieren
                  </a>
                  {currentStop.order?.kunde_telefon && (
                    <a
                      href={`tel:${currentStop.order.kunde_telefon}`}
                      className="flex items-center justify-center gap-1 rounded-lg bg-white border border-blue-300 text-blue-600 text-xs font-bold py-2 px-3 hover:bg-blue-50 transition"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  {onMarkDelivered && (
                    confirmStop === currentStop.id ? (
                      <button
                        onClick={() => { onMarkDelivered(currentStop.id); setConfirmStop(null); }}
                        className="flex items-center justify-center gap-1 rounded-lg bg-matcha-500 text-white text-xs font-bold py-2 px-3 hover:bg-matcha-600 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Bestätigen
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmStop(currentStop.id)}
                        className="flex items-center justify-center gap-1 rounded-lg bg-white border border-matcha-300 text-matcha-700 text-xs font-bold py-2 px-3 hover:bg-matcha-50 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Geliefert
                      </button>
                    )
                  )}
                </div>

                {etaLabel(currentStop) && (
                  <div className="flex items-center gap-1 text-[10px] text-blue-600">
                    <Clock className="h-3 w-3" />
                    Geplante Ankunft: <strong>{etaLabel(currentStop)}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Nächste Stopps */}
          {nextStops.length > 0 && (
            <div className="px-3 pb-3 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 px-1">
                Nächste Stopps
              </div>
              {nextStops.map((stop, idx) => (
                <div
                  key={stop.id}
                  className="rounded-lg border border-blue-200 bg-white/70 px-3 py-2 flex items-center gap-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-[10px] font-black">
                    {(stop.reihenfolge ?? idx + 1) + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">
                      {stop.order?.kunde_name ?? 'Kunde'}
                    </div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {stop.order?.kunde_adresse}
                    </div>
                  </div>
                  <div className="shrink-0">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erledigte Stopps */}
          {completedStops.length > 0 && (
            <div className="px-3 pb-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 px-1 mb-1">
                Erledigt ({completedStops.length})
              </div>
              <div className="space-y-1">
                {completedStops.map(stop => (
                  <div
                    key={stop.id}
                    className="rounded-lg border border-matcha-200 bg-matcha-50/50 px-3 py-1.5 flex items-center gap-2 opacity-70"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                    <span className="text-[11px] text-matcha-700 truncate">
                      {stop.order?.kunde_name ?? 'Kunde'}
                    </span>
                    <span className="ml-auto text-[10px] text-matcha-500 shrink-0">
                      {stop.geliefert_am
                        ? new Date(stop.geliefert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
