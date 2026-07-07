'use client';

import { useEffect, useState, useCallback } from 'react';
import { Coffee, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

interface Props {
  driverId: string;
  locationId?: string | null;
}

interface PauseEmpfehlung {
  empfohlen: boolean;
  grund: string;
  optimalerZeitpunkt: string;
  aktuelleAuslastung: 'niedrig' | 'mittel' | 'hoch';
  naechsteSpitzeIn: number | null;
}

const MOCK_NIEDRIG: PauseEmpfehlung = {
  empfohlen: true,
  grund: 'Geringe Auftragslage — idealer Pausenzeitpunkt',
  optimalerZeitpunkt: 'Jetzt',
  aktuelleAuslastung: 'niedrig',
  naechsteSpitzeIn: 35,
};

const MOCK_HOCH: PauseEmpfehlung = {
  empfohlen: false,
  grund: 'Hohe Nachfrage — Pause in ca. 20 Min empfohlen',
  optimalerZeitpunkt: 'In ~20 Min',
  aktuelleAuslastung: 'hoch',
  naechsteSpitzeIn: null,
};

async function fetchEmpfehlung(driverId: string, locationId?: string | null): Promise<PauseEmpfehlung | null> {
  try {
    const url = locationId
      ? `/api/delivery/admin/sla-snapshot?location_id=${locationId}`
      : null;
    if (!url) return null;

    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();

    // Abschätzen ob hohe Auslastung basierend auf Pünktlichkeits-SLA
    const pct: number = json.aktuellerPct ?? 100;
    if (pct < 80) {
      return MOCK_HOCH;
    }
    return MOCK_NIEDRIG;
  } catch {
    return null;
  }
}

export function FahrerPhase623PauseEmpfehlung({ driverId, locationId }: Props) {
  const [data, setData] = useState<PauseEmpfehlung | null>(null);

  const laden = useCallback(async () => {
    const result = await fetchEmpfehlung(driverId, locationId);
    setData(result ?? MOCK_NIEDRIG);
  }, [driverId, locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 120_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!data) return null;

  const auslastungsFarbe =
    data.aktuelleAuslastung === 'niedrig'
      ? 'text-green-600 dark:text-green-400'
      : data.aktuelleAuslastung === 'mittel'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-red-600 dark:text-red-400';

  const auslastungsLabel =
    data.aktuelleAuslastung === 'niedrig'
      ? 'Niedrig'
      : data.aktuelleAuslastung === 'mittel'
      ? 'Mittel'
      : 'Hoch';

  return (
    <div
      className={`mb-3 rounded-xl border p-3 shadow-sm ${
        data.empfohlen
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
          : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 rounded-full p-2 ${
            data.empfohlen
              ? 'bg-green-100 dark:bg-green-900/40'
              : 'bg-amber-100 dark:bg-amber-900/40'
          }`}
        >
          <Coffee
            className={`h-4 w-4 ${
              data.empfohlen
                ? 'text-green-600 dark:text-green-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {data.empfohlen ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            )}
            <span
              className={`text-xs font-bold uppercase tracking-wide ${
                data.empfohlen
                  ? 'text-green-800 dark:text-green-200'
                  : 'text-amber-800 dark:text-amber-200'
              }`}
            >
              Pause-Empfehlung
            </span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200">{data.grund}</p>
          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {data.optimalerZeitpunkt}
            </span>
            <span>
              Auslastung:{' '}
              <span className={`font-semibold ${auslastungsFarbe}`}>{auslastungsLabel}</span>
            </span>
            {data.naechsteSpitzeIn !== null && (
              <span>Nächste Spitze in {data.naechsteSpitzeIn} Min</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
