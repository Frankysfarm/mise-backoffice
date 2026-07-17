'use client';

import { useEffect, useState, useCallback } from 'react';

interface FahrerBestzeit {
  fahrer_id: string;
  fahrer_name: string;
  stopps_pro_stunde: number;
  stopps_heute: number;
  schicht_stunden: number;
}

interface BestzeitenDaten {
  schnellste_lieferung_min: number | null;
  schnellste_lieferung_fahrer: string | null;
  allzeit_rekord_min: number | null;
  ist_neuer_rekord: boolean;
  top_fahrer: FahrerBestzeit[];
  letzte_5_lieferungen: { fahrer_name: string; dauer_min: number; zeitpunkt: string }[];
  generiert_am: string;
}

const PODIUM_FARBEN = ['#FFD700', '#C0C0C0', '#CD7F32'];
const PODIUM_LABEL = ['🥇', '🥈', '🥉'];

export function DispatchPhase2212BestzeitenBoard({ locationId }: { locationId: string | null }) {
  const [offen, setOffen] = useState(true);
  const [daten, setDaten] = useState<BestzeitenDaten | null>(null);
  const [ladend, setLadend] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLadend(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-bestzeiten?location_id=${locationId}`);
      if (res.ok) setDaten(await res.json());
    } finally {
      setLadend(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden]);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-4 mb-3">
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <span className="font-semibold text-yellow-900 dark:text-yellow-200">Schicht-Bestzeiten</span>
          {daten?.ist_neuer_rekord && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">
              NEUER REKORD!
            </span>
          )}
        </div>
        <span className="text-yellow-600 dark:text-yellow-400 text-sm">{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div className="mt-3 space-y-4">
          {/* Rekord-Ticker */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[120px] rounded-lg bg-white dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">
                {daten?.schnellste_lieferung_min != null ? `${daten.schnellste_lieferung_min} Min.` : '—'}
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Schnellste heute</div>
              {daten?.schnellste_lieferung_fahrer && (
                <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-0.5">
                  {daten.schnellste_lieferung_fahrer}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-[120px] rounded-lg bg-white dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 p-3 text-center">
              <div className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                {daten?.allzeit_rekord_min != null ? `${daten.allzeit_rekord_min} Min.` : '—'}
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-400 mt-1">Allzeit-Rekord</div>
              {daten?.ist_neuer_rekord && (
                <div className="text-xs font-semibold text-red-500 mt-0.5">Heute gebrochen! 🎉</div>
              )}
            </div>
          </div>

          {/* Podium Top-3 Fahrer */}
          {daten?.top_fahrer && daten.top_fahrer.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2 uppercase tracking-wide">
                Top Fahrer nach Stopps/h
              </div>
              <div className="flex gap-2 items-end">
                {daten.top_fahrer.map((f, i) => (
                  <div
                    key={f.fahrer_id}
                    className="flex-1 rounded-lg p-2 text-center"
                    style={{ backgroundColor: `${PODIUM_FARBEN[i]}22`, borderColor: `${PODIUM_FARBEN[i]}66`, borderWidth: 1 }}
                  >
                    <div className="text-xl">{PODIUM_LABEL[i]}</div>
                    <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate mt-1">
                      {f.fahrer_name}
                    </div>
                    <div className="text-base font-bold mt-1" style={{ color: PODIUM_FARBEN[i] }}>
                      {f.stopps_pro_stunde.toFixed(1)}/h
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {f.stopps_heute} Stopps · {f.schicht_stunden}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Letzte 5 Lieferungen */}
          {daten?.letzte_5_lieferungen && daten.letzte_5_lieferungen.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 mb-2 uppercase tracking-wide">
                Letzte Lieferungen
              </div>
              <div className="space-y-1">
                {daten.letzte_5_lieferungen.map((l, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded px-3 py-1.5 text-sm ${
                      l.dauer_min <= 15
                        ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-gray-800/30 border border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <span className="text-gray-700 dark:text-gray-300">{l.fahrer_name}</span>
                    <span
                      className={`font-bold ${
                        l.dauer_min <= 15 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {l.dauer_min} Min. {l.dauer_min <= 15 ? '⚡' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ladend && <div className="text-xs text-yellow-500 text-right">Aktualisiere…</div>}
        </div>
      )}
    </div>
  );
}
