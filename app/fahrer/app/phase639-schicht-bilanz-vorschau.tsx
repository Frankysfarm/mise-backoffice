'use client';

import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, Euro, Clock, Target } from 'lucide-react';

interface Props {
  driverId: string;
  locationId: string | null;
}

interface SchichtDaten {
  schichtStartIso: string | null;
  schichtEndeIso: string | null;
  lieferungenBisher: number;
  verdienst_eur: number;
}

const MOCK: SchichtDaten = {
  schichtStartIso: null,
  schichtEndeIso: null,
  lieferungenBisher: 5,
  verdienst_eur: 14.50,
};

function euro(cent: number): string {
  return (cent / 100).toFixed(2).replace('.', ',') + ' €';
}

function eurofloat(v: number): string {
  return v.toFixed(2).replace('.', ',') + ' €';
}

function minutenBis(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 60_000));
}

function schichtDauerMinuten(startIso: string | null): number {
  if (!startIso) return 0;
  return Math.round((Date.now() - new Date(startIso).getTime()) / 60_000);
}

export function FahrerPhase639SchichtBilanzVorschau({ driverId, locationId }: Props) {
  const [daten, setDaten] = useState<SchichtDaten>(MOCK);
  const [loading, setLoading] = useState(true);

  const laden = useCallback(async () => {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/driver/schicht-status?${params}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        setDaten({
          schichtStartIso: json.started_at ?? null,
          schichtEndeIso: json.ends_at ?? null,
          lieferungenBisher: json.deliveries_count ?? 0,
          verdienst_eur: Number(json.earnings_eur ?? 0),
        });
      }
    } catch {
      // Fallback auf Mock
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60_000);
    return () => clearInterval(id);
  }, [laden]);

  const dauerMin = schichtDauerMinuten(daten.schichtStartIso);
  const restMin = minutenBis(daten.schichtEndeIso);

  // Hochrechnung: Wenn weniger als 5 Min gelaufen, keine Prognose
  const hochrechnung: number | null = (() => {
    if (dauerMin < 5 || daten.lieferungenBisher === 0) return null;
    if (restMin === null) return null;
    const gesamtMin = dauerMin + restMin;
    const rateProMin = daten.verdienst_eur / dauerMin;
    return +(rateProMin * gesamtMin).toFixed(2);
  })();

  const pct = hochrechnung != null && hochrechnung > 0
    ? Math.min(100, Math.round((daten.verdienst_eur / hochrechnung) * 100))
    : null;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        <span className="text-sm font-bold text-violet-800 dark:text-violet-200 uppercase tracking-wide flex-1">
          Schicht-Bilanz Vorschau
        </span>
        {restMin !== null && (
          <span className="flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
            <Clock className="h-3 w-3" />
            noch {restMin} Min.
          </span>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-violet-400 animate-pulse">Laden…</div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Aktueller Verdienst */}
          <div className="flex items-center gap-3">
            <Euro className="h-5 w-5 text-emerald-500 shrink-0" />
            <div className="flex-1">
              <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Bisher verdient
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {eurofloat(daten.verdienst_eur)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-500 dark:text-gray-400">Lieferungen</div>
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{daten.lieferungenBisher}</div>
            </div>
          </div>

          {/* Prognose */}
          {hochrechnung !== null && (
            <div className="rounded-lg bg-white dark:bg-gray-900 border border-violet-100 dark:border-violet-900/40 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-[10px] font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide">
                  Prognose Schichtende
                </span>
                <span className="ml-auto text-sm font-black text-violet-700 dark:text-violet-300 tabular-nums">
                  {eurofloat(hochrechnung)}
                </span>
              </div>
              {pct !== null && (
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-violet-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
              {pct !== null && (
                <div className="mt-1 text-[10px] text-gray-400 text-right">{pct}% erreicht</div>
              )}
            </div>
          )}

          {hochrechnung === null && dauerMin < 5 && (
            <div className="text-[10px] text-gray-400 italic">
              Prognose verfügbar nach 5 Min. Schichtdauer
            </div>
          )}
        </div>
      )}
    </div>
  );
}
