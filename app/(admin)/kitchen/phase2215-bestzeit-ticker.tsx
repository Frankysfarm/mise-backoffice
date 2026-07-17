'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';

interface LieferEintrag {
  fahrer_name: string;
  dauer_min: number;
  zeitpunkt: string;
}

interface BestzeitenDaten {
  schnellste_lieferung_min: number | null;
  letzte_5_lieferungen: LieferEintrag[];
  ist_neuer_rekord: boolean;
  generiert_am: string;
}

export function KitchenPhase2215BestzeitTicker({ locationId }: { locationId: string | null }) {
  const [offen, setOffen] = useState(true);
  const [daten, setDaten] = useState<BestzeitenDaten | null>(null);

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
    laden();
    const id = setInterval(laden, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [laden]);

  const lieferungen = useMemo(() => daten?.letzte_5_lieferungen ?? [], [daten]);

  const schnellste = useMemo(
    () => (lieferungen.length > 0 ? Math.min(...lieferungen.map((l) => l.dauer_min)) : null),
    [lieferungen],
  );

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4 mb-3">
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <span className="font-semibold text-green-900 dark:text-green-200">Bestzeit-Ticker</span>
          {daten?.ist_neuer_rekord && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">REKORD!</span>
          )}
          {schnellste != null && schnellste <= 15 && (
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded-full">
              {schnellste} Min. Bestzeit
            </span>
          )}
        </div>
        <span className="text-green-600 text-sm">{offen ? '▲' : '▼'}</span>
      </button>

      {offen && (
        <div className="mt-3">
          {lieferungen.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-3">
              Noch keine Lieferungen heute
            </div>
          ) : (
            <div className="space-y-1.5">
              {lieferungen.map((l, i) => {
                const istSchnell = l.dauer_min < 20;
                const zeit = new Date(l.zeitpunkt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      istSchnell
                        ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
                        : 'bg-white dark:bg-gray-800/20 border border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {istSchnell && <span className="text-green-500">⚡</span>}
                      <span className={`font-medium ${istSchnell ? 'text-green-800 dark:text-green-200' : 'text-gray-700 dark:text-gray-300'}`}>
                        {l.fahrer_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400 dark:text-gray-500">{zeit}</span>
                      <span
                        className={`font-bold text-base ${
                          istSchnell ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {l.dauer_min} Min.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
