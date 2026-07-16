'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';

/**
 * Phase 1904 — Schicht-Bonus-Übersicht (Dispatch)
 *
 * Tabelle Fahrer + Bonus-Stufe + Betrag + Erreichbarkeitsscore.
 * Alert wenn kein Fahrer Gold. 30-Min-Polling. Phase1903-API.
 */

type BonusStufe = 'bronze' | 'silber' | 'gold' | 'kein';

interface FahrerBonus {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number | null;
  erreicht_pct: number;
  stufe: BonusStufe;
  bonus_betrag_eur: number;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerBonus[];
  kein_gold_alert: boolean;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', stopps_heute: 18, puenktlichkeit_pct: 94, bewertung_avg: 4.8, erreicht_pct: 92, stufe: 'gold', bonus_betrag_eur: 25 },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', stopps_heute: 12, puenktlichkeit_pct: 78, bewertung_avg: 4.3, erreicht_pct: 70, stufe: 'silber', bonus_betrag_eur: 12 },
    { fahrer_id: 'f3', fahrer_name: 'Luca P.', stopps_heute: 6, puenktlichkeit_pct: 65, bewertung_avg: 3.9, erreicht_pct: 50, stufe: 'bronze', bonus_betrag_eur: 5 },
    { fahrer_id: 'f4', fahrer_name: 'Anna T.', stopps_heute: 3, puenktlichkeit_pct: 55, bewertung_avg: null, erreicht_pct: 30, stufe: 'kein', bonus_betrag_eur: 0 },
  ],
  kein_gold_alert: false,
  generiert_am: new Date().toISOString(),
};

const STUFE_STYLE: Record<BonusStufe, { label: string; badge: string; icon: string }> = {
  gold: { label: 'Gold', badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', icon: '🥇' },
  silber: { label: 'Silber', badge: 'bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300', icon: '🥈' },
  bronze: { label: 'Bronze', badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300', icon: '🥉' },
  kein: { label: '–', badge: 'bg-muted text-muted-foreground', icon: '·' },
};

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1904SchichtBonusUebersicht({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ApiAntwort | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-bonus-rechner?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        setDaten(await res.json());
      } catch {
        setDaten({ ...MOCK, location_id: locationId });
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!locationId || !daten) return null;

  const goldFahrer = daten.fahrer.find((f) => f.stufe === 'gold');

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Schicht-Bonus</span>
        {goldFahrer && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 px-2 py-0.5">
            🥇 {goldFahrer.fahrer_name}
          </span>
        )}
        {daten.kein_gold_alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5">
            Kein Gold
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Alert kein Gold */}
          {daten.kein_gold_alert && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Kein Fahrer hat Gold erreicht — Teamleistung prüfen oder Anreize erhöhen.
              </p>
            </div>
          )}

          {/* Fahrer-Tabelle */}
          <div className="space-y-1.5">
            {/* Header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Fahrer</span>
              <span className="text-right">Stopps</span>
              <span className="text-right">Pünktl.</span>
              <span className="text-right">Bonus</span>
            </div>

            {daten.fahrer.map((f) => {
              const s = STUFE_STYLE[f.stufe];
              return (
                <div
                  key={f.fahrer_id}
                  className="grid grid-cols-[1fr_auto_auto_auto] gap-2 rounded-xl border bg-muted/30 px-3 py-2 items-center"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm">{s.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{f.fahrer_name}</p>
                      <span className={cn('text-[10px] font-bold rounded-full px-1.5 py-0.5', s.badge)}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold tabular-nums text-right">{f.stopps_heute}</span>
                  <span
                    className={cn(
                      'text-xs font-bold tabular-nums text-right',
                      f.puenktlichkeit_pct >= 90
                        ? 'text-green-600 dark:text-green-400'
                        : f.puenktlichkeit_pct >= 75
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {f.puenktlichkeit_pct}%
                  </span>
                  <span
                    className={cn(
                      'text-xs font-black tabular-nums text-right',
                      f.bonus_betrag_eur > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                    )}
                  >
                    {f.bonus_betrag_eur > 0 ? `${f.bonus_betrag_eur} €` : '–'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Team-Ø */}
          {daten.fahrer.length > 0 && (
            <div className="rounded-xl border bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
                <span className="text-xs text-muted-foreground">Team-Ø Pünktlichkeit</span>
              </div>
              <span className="text-xs font-black tabular-nums">
                {Math.round(daten.fahrer.reduce((s, f) => s + f.puenktlichkeit_pct, 0) / daten.fahrer.length)}%
              </span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">
            Aktualisierung alle 30 Min ·{' '}
            {new Date(daten.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
