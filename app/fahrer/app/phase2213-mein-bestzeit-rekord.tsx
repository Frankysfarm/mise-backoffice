'use client';

import { useEffect, useState, useCallback } from 'react';

interface MeinBestzeitDaten {
  schnellste_lieferung_min: number | null;
  schnellste_lieferung_fahrer: string | null;
  allzeit_rekord_min: number | null;
  ist_neuer_rekord: boolean;
  top_fahrer: { fahrer_id: string; fahrer_name: string; stopps_pro_stunde: number; stopps_heute: number; schicht_stunden: number }[];
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2213MeinBestzeitRekord({ driverId, locationId, isOnline }: Props) {
  const [offen, setOffen] = useState(false);
  const [daten, setDaten] = useState<MeinBestzeitDaten | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/schicht-bestzeiten?location_id=${locationId}`);
      if (res.ok) setDaten(await res.json());
    } catch {
      // noop
    }
  }, [locationId]);

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, laden]);

  if (!isOnline || !locationId) return null;

  const meinRang = daten?.top_fahrer.findIndex((f) => f.fahrer_id === driverId) ?? -1;
  const meinEintrag = meinRang >= 0 ? daten!.top_fahrer[meinRang] : null;

  return (
    <div className="rounded-xl border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 p-4 mb-3">
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-yellow-900 dark:text-yellow-200">Mein Bestzeit-Rekord</span>
          {daten?.ist_neuer_rekord && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">REKORD!</span>
          )}
        </div>
        <span className="text-yellow-600 text-sm">{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div className="mt-3 space-y-3">
          {/* Schnellste heute */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-white dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 text-center">
              <div className="text-xl font-bold text-yellow-600 dark:text-yellow-300">
                {daten?.schnellste_lieferung_min != null ? `${daten.schnellste_lieferung_min} Min.` : '—'}
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-400">Schnellste heute</div>
              {daten?.schnellste_lieferung_fahrer && (
                <div className="text-xs text-gray-500 dark:text-gray-400">{daten.schnellste_lieferung_fahrer}</div>
              )}
            </div>
            <div className="flex-1 rounded-lg bg-white dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 text-center">
              <div className="text-xl font-bold text-gray-700 dark:text-gray-200">
                {daten?.allzeit_rekord_min != null ? `${daten.allzeit_rekord_min} Min.` : '—'}
              </div>
              <div className="text-xs text-yellow-700 dark:text-yellow-400">Allzeit-Rekord</div>
              {daten?.ist_neuer_rekord && (
                <div className="text-xs font-semibold text-green-500">Heute gebrochen! 🎉</div>
              )}
            </div>
          </div>

          {/* Mein Rang + Badge */}
          {meinEintrag && (
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">Meine Leistung heute</div>
                  <div className="text-base font-bold text-blue-800 dark:text-blue-200 mt-0.5">
                    {meinEintrag.stopps_pro_stunde.toFixed(1)} Stopps/h
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {meinEintrag.stopps_heute} Stopps · {meinEintrag.schicht_stunden}h
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl">{meinRang === 0 ? '🥇' : meinRang === 1 ? '🥈' : '🥉'}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Rang {meinRang + 1}</div>
                </div>
              </div>
            </div>
          )}

          {/* Motivation */}
          {meinEintrag == null && daten !== null && (
            <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Noch keine Lieferungen heute — los geht&apos;s! 🚀
            </div>
          )}
          {meinRang === 0 && (
            <div className="text-xs text-center text-green-600 dark:text-green-400 font-medium">
              Du führst das Team heute an! Weiter so! 💪
            </div>
          )}
          {meinRang === 1 && (
            <div className="text-xs text-center text-yellow-600 dark:text-yellow-400 font-medium">
              Platz 2 — nur noch ein kleiner Schritt zum Podiumsplatz!
            </div>
          )}
          {meinRang === 2 && (
            <div className="text-xs text-center text-orange-600 dark:text-orange-400 font-medium">
              Platz 3 — du bist dabei! Noch ein paar Stopps mehr.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
