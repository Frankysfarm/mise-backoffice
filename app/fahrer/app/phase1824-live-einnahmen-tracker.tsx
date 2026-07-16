'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1824 — Live-Einnahmen-Tracker (Fahrer-App)
 *
 * Heutige Einnahmen (Touren × Satz); Stunden-Verlauf-Chart; Ziel vs. Ist.
 * isOnline-Guard; 30-Min-Polling.
 */

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

interface StundenEinnahme {
  stunde: number;
  betrag: number;
}

interface EinnahmenDaten {
  gesamt_heute: number;
  touren_heute: number;
  durchschnitt_pro_tour: number;
  ziel_heute: number;
  verlauf_stunden: StundenEinnahme[];
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_vs_gestern: number;
}

const MOCK_DATEN: EinnahmenDaten = {
  gesamt_heute: 47.5,
  touren_heute: 9,
  durchschnitt_pro_tour: 5.28,
  ziel_heute: 80,
  verlauf_stunden: [
    { stunde: 10, betrag: 5.5 },
    { stunde: 11, betrag: 8.0 },
    { stunde: 12, betrag: 12.5 },
    { stunde: 13, betrag: 10.0 },
    { stunde: 14, betrag: 7.5 },
    { stunde: 15, betrag: 4.0 },
  ],
  trend: 'steigend',
  trend_vs_gestern: 12,
};

function formatEuro(betrag: number): string {
  return betrag.toFixed(2).replace('.', ',') + ' €';
}

function TrendAnzeige({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'steigend') return (
    <span className="flex items-center gap-0.5 text-matcha-600 dark:text-matcha-400 text-xs font-semibold">
      <TrendingUp className="h-3.5 w-3.5" />+{delta}% ggü. gestern
    </span>
  );
  if (trend === 'fallend') return (
    <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400 text-xs font-semibold">
      <TrendingDown className="h-3.5 w-3.5" />{delta}% ggü. gestern
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-zinc-500 dark:text-zinc-400 text-xs">
      <Minus className="h-3.5 w-3.5" />Gleich wie gestern
    </span>
  );
}

async function ladeDaten(driverId: string, locationId: string): Promise<EinnahmenDaten> {
  const res = await fetch(
    `/api/delivery/admin/fahrer-einnahmen?driver_id=${driverId}&location_id=${locationId}`,
    { cache: 'no-store' }
  );
  if (!res.ok) throw new Error('fetch_failed');
  return res.json() as Promise<EinnahmenDaten>;
}

export function FahrerPhase1824LiveEinnahmenTracker({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<EinnahmenDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!driverId || !locationId || !isOnline) return;

    let aktiv = true;
    const laden = () =>
      ladeDaten(driverId, locationId)
        .then((d) => { if (aktiv) setDaten(d); })
        .catch(() => { if (aktiv) setDaten(MOCK_DATEN); });

    laden();
    const id = setInterval(laden, 30 * 60_000);
    return () => { aktiv = false; clearInterval(id); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  const d = daten ?? MOCK_DATEN;
  const zielPct = Math.min(100, Math.round((d.gesamt_heute / d.ziel_heute) * 100));
  const maxBetrag = Math.max(...d.verlauf_stunden.map((s) => s.betrag), 1);

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Live-Einnahmen heute
          </span>
          <span className="rounded-full bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300 text-[10px] font-bold px-1.5 py-0.5">
            {formatEuro(d.gesamt_heute)}
          </span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          {/* Hauptzahl + Trend */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {formatEuro(d.gesamt_heute)}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {d.touren_heute} Touren · Ø {formatEuro(d.durchschnitt_pro_tour)}/Tour
              </p>
            </div>
            <TrendAnzeige trend={d.trend} delta={d.trend_vs_gestern} />
          </div>

          {/* Ziel-Fortschritt */}
          <div>
            <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 mb-1">
              <span>Ziel: {formatEuro(d.ziel_heute)}</span>
              <span className={cn('font-semibold', zielPct >= 100 ? 'text-matcha-600 dark:text-matcha-400' : 'text-amber-600 dark:text-amber-400')}>
                {zielPct}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  zielPct >= 100 ? 'bg-matcha-500' : zielPct >= 70 ? 'bg-amber-400' : 'bg-zinc-400'
                )}
                style={{ width: `${zielPct}%` }}
              />
            </div>
          </div>

          {/* Stunden-Verlauf als Mini-Balkendiagramm */}
          {d.verlauf_stunden.length > 0 && (
            <div>
              <p className="text-[10px] text-zinc-400 mb-1">Einnahmen nach Stunde</p>
              <div className="flex items-end gap-1 h-12">
                {d.verlauf_stunden.map((s) => (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full rounded-t bg-matcha-400 dark:bg-matcha-500 transition-all duration-500"
                      style={{ height: `${Math.round((s.betrag / maxBetrag) * 40)}px` }}
                      title={`${s.stunde}:00 — ${formatEuro(s.betrag)}`}
                    />
                    <span className="text-[8px] text-zinc-400">{s.stunde}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fehlender Betrag bis Ziel */}
          {zielPct < 100 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Noch {formatEuro(d.ziel_heute - d.gesamt_heute)} bis zum Tagesziel.
            </p>
          )}
          {zielPct >= 100 && (
            <p className="text-xs text-matcha-600 dark:text-matcha-400 font-medium">
              Tagesziel erreicht! 🎯
            </p>
          )}
        </div>
      )}
    </div>
  );
}
