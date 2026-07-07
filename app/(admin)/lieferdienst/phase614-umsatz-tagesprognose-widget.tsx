'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Euro } from 'lucide-react';

interface StundenEntry {
  hour: number;
  umsatz: number;
  anzahl: number;
}

interface Props {
  locationId: string | null;
}

export function LieferdienstPhase614UmsatzTagesPrognoseWidget({ locationId }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [istUmsatz, setIstUmsatz] = useState<number | null>(null);
  const [prognose, setPrognose] = useState<number | null>(null);
  const [anzahlBestellungen, setAnzahlBestellungen] = useState(0);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/mehrstunden-umsatz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const json = await res.json();
      if (!json.ok || !Array.isArray(json.hours)) return;

      const hours: StundenEntry[] = json.hours;
      const gesamtBisher = json.summary?.totalUmsatz ?? 0;
      setIstUmsatz(Math.round(gesamtBisher * 100) / 100);
      setAnzahlBestellungen(json.summary?.totalAnzahl ?? 0);

      const now = new Date();
      const currentHour = now.getHours();
      const minSinceStart = now.getHours() * 60 + now.getMinutes();
      const businessStart = 10 * 60;
      const businessEnd = 22 * 60;
      const businessDuration = businessEnd - businessStart;
      const elapsed = Math.max(1, minSinceStart - businessStart);
      const remaining = Math.max(0, businessDuration - elapsed);

      if (elapsed > 0 && gesamtBisher > 0) {
        const rate = gesamtBisher / elapsed;
        const hochrechnung = gesamtBisher + rate * remaining;
        setPrognose(Math.round(hochrechnung * 100) / 100);
      } else if (json.summary?.gesamtPrognose) {
        setPrognose(Math.round(json.summary.gesamtPrognose));
      }

      void currentHour;
      void hours;
    } catch {
      // silent
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 120000);
    return () => clearInterval(id);
  }, [laden]);

  if (istUmsatz === null || !locationId) return null;

  const pct = prognose && prognose > 0 ? Math.min(100, Math.round((istUmsatz / prognose) * 100)) : 0;
  const abweichung = prognose !== null ? Math.round(((prognose - istUmsatz) / Math.max(1, prognose)) * 100) : 0;

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-matcha-950 shadow-sm mb-4">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-bold text-matcha-900 dark:text-matcha-100">
            Tages-Umsatzprognose
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-matcha-50 dark:bg-matcha-900/30 p-2.5 text-center">
              <div className="flex items-center justify-center gap-0.5 text-xl font-black text-matcha-800 dark:text-matcha-200 tabular-nums">
                <Euro className="w-4 h-4" />
                {istUmsatz.toFixed(0)}
              </div>
              <div className="text-[10px] text-matcha-600 dark:text-matcha-400 mt-0.5">Bisher heute</div>
            </div>
            <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 p-2.5 text-center">
              <div className="flex items-center justify-center gap-0.5 text-xl font-black text-violet-800 dark:text-violet-200 tabular-nums">
                <Euro className="w-4 h-4" />
                {prognose?.toFixed(0) ?? '–'}
              </div>
              <div className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">Tagesprognose</div>
            </div>
          </div>

          {prognose !== null && (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>{pct}% erreicht</span>
                  <span>{anzahlBestellungen} Bestellungen</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-matcha-400 to-matcha-600 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
              <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                {abweichung > 5
                  ? `Noch €${(prognose - istUmsatz).toFixed(0)} bis zur Prognose`
                  : abweichung < -5
                  ? `€${(istUmsatz - prognose).toFixed(0)} über der Prognose!'`
                  : 'Exakt im Plan'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
