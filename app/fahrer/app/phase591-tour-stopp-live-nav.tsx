'use client';

/**
 * Phase 591 — Fahrer-App: Tour-Stopp-Live-Navigation
 *
 * Zeigt den nächsten offenen Stopp prominent mit Navigations-Button.
 * Darunter kompakte Liste der verbleibenden Stopps.
 * Abgeschlossene Stopps erhalten ein Häkchen.
 *
 * Dark-Theme (bg-matcha-900) für mobile Nutzung.
 */

import { useState } from 'react';
import { CheckCircle2, MapPin, Navigation, Route } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  kunde_name: string | null;
  kunde_adresse: string | null;
  abgeschlossen_am: string | null;
  eta_earliest: string | null;
  eta_latest: string | null;
}

interface Props {
  stops: Stop[];
  batchStatus: string;
}

function mapsUrl(adresse: string | null): string {
  if (!adresse) return '#';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
}

function fmtEta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase591TourStoppLiveNav({ stops, batchStatus }: Props) {
  const [expanded, setExpanded] = useState(true);

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completed = sorted.filter(s => s.abgeschlossen_am !== null);
  const pending   = sorted.filter(s => s.abgeschlossen_am === null);
  const nextStop  = pending[0] ?? null;
  const remaining = pending.slice(1);

  const currentIndex = completed.length + 1;
  const total        = sorted.length;

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl bg-matcha-900 p-6 flex flex-col items-center gap-2 text-white">
        <Route className="h-8 w-8 text-matcha-400" />
        <p className="text-sm text-matcha-300">Keine aktiven Stopps</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-matcha-900 overflow-hidden">
      {/* Kopfzeile */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-matcha-700">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-400" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Tour-Navigation
          </span>
        </div>
        <span className="text-xs font-bold text-matcha-400 tabular-nums">
          Stopp {currentIndex} / {total}
        </span>
      </div>

      {/* Nächster Stopp – prominent */}
      {nextStop ? (
        <div className="px-4 py-4 space-y-3">
          <div className="flex items-start gap-3">
            {/* Nummer-Badge */}
            <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-matcha-500 text-white font-black text-sm">
              {nextStop.reihenfolge}
            </div>

            <div className="flex-1 min-w-0">
              {nextStop.kunde_name && (
                <div className="text-sm font-bold text-white leading-tight truncate">
                  {nextStop.kunde_name}
                </div>
              )}
              {nextStop.kunde_adresse && (
                <div className="text-xs text-matcha-300 mt-0.5 leading-snug line-clamp-2">
                  {nextStop.kunde_adresse}
                </div>
              )}
              {nextStop.eta_earliest && (
                <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-matcha-400">
                  <MapPin className="h-3 w-3" />
                  ETA {fmtEta(nextStop.eta_earliest)}
                  {nextStop.eta_latest && ` – ${fmtEta(nextStop.eta_latest)}`}
                </div>
              )}
            </div>
          </div>

          {/* Navigations-Button */}
          <a
            href={mapsUrl(nextStop.kunde_adresse)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl py-3 bg-matcha-500 hover:bg-matcha-400 active:bg-matcha-600 text-white text-sm font-bold transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Navigation starten
          </a>
        </div>
      ) : (
        <div className="px-4 py-5 flex items-center gap-2 text-matcha-300">
          <CheckCircle2 className="h-5 w-5 text-matcha-500" />
          <span className="text-sm font-bold">Alle Stopps abgeschlossen</span>
        </div>
      )}

      {/* Verbleibende Stopps */}
      {(remaining.length > 0 || completed.length > 0) && (
        <>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full flex items-center justify-between px-4 py-2 border-t border-matcha-700 text-matcha-400 hover:text-matcha-200 transition-colors"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider">
              {remaining.length} weitere Stopp{remaining.length !== 1 ? 's' : ''} · {completed.length} erledigt
            </span>
            <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
          </button>

          {expanded && (
            <div className="divide-y divide-matcha-800 border-t border-matcha-800">
              {/* Abgeschlossene */}
              {completed.map(stop => (
                <div
                  key={stop.id}
                  className="flex items-center gap-3 px-4 py-2.5 opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {stop.reihenfolge}. {stop.kunde_name ?? 'Unbekannt'}
                    </div>
                    {stop.kunde_adresse && (
                      <div className="text-[10px] text-matcha-400 truncate">{stop.kunde_adresse}</div>
                    )}
                  </div>
                </div>
              ))}

              {/* Verbleibende (nach dem nächsten) */}
              {remaining.map(stop => (
                <div
                  key={stop.id}
                  className="flex items-center gap-3 px-4 py-2.5 opacity-70"
                >
                  <div className="h-4 w-4 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-black text-matcha-400">
                      {stop.reihenfolge}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate">
                      {stop.kunde_name ?? 'Unbekannt'}
                    </div>
                    {stop.kunde_adresse && (
                      <div className="text-[10px] text-matcha-400 truncate">{stop.kunde_adresse}</div>
                    )}
                  </div>
                  {stop.eta_earliest && (
                    <span className="text-[10px] text-matcha-500 shrink-0 tabular-nums">
                      {fmtEta(stop.eta_earliest)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
