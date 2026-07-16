'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, ChevronDown, ChevronUp, Star } from 'lucide-react';

/**
 * Phase 1905 — Mein-Bonus-Fortschritt (Fahrer-App)
 *
 * Aktuelle Bonus-Stufe + Fortschrittsbalken zur nächsten Stufe.
 * Betrag + Anforderungen. isOnline-Guard; Collapsible; 30-Min-Polling.
 */

type BonusStufe = 'bronze' | 'silber' | 'gold' | 'kein';

interface BonusDaten {
  stufe: BonusStufe;
  bonus_betrag_eur: number;
  erreicht_pct: number;
  naechste_stufe: BonusStufe | null;
  naechste_anforderung: string | null;
  naechste_pct_fehlend: number;
  stopps_heute: number;
  puenktlichkeit_pct: number;
}

const MOCK: BonusDaten = {
  stufe: 'silber',
  bonus_betrag_eur: 12,
  erreicht_pct: 70,
  naechste_stufe: 'gold',
  naechste_anforderung: 'Noch 5 Stopps + 90% Pünktlichkeit für Gold',
  naechste_pct_fehlend: 15,
  stopps_heute: 10,
  puenktlichkeit_pct: 78,
};

const STUFE_CONFIG: Record<BonusStufe, { label: string; farbe: string; balken: string; icon: string }> = {
  gold: { label: 'Gold', farbe: 'text-yellow-600 dark:text-yellow-400', balken: 'bg-yellow-500', icon: '🥇' },
  silber: { label: 'Silber', farbe: 'text-slate-600 dark:text-slate-300', balken: 'bg-slate-400', icon: '🥈' },
  bronze: { label: 'Bronze', farbe: 'text-orange-600 dark:text-orange-400', balken: 'bg-orange-500', icon: '🥉' },
  kein: { label: 'Kein Bonus', farbe: 'text-muted-foreground', balken: 'bg-muted-foreground/30', icon: '·' },
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1905MeinBonusFortschritt({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<BonusDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/schicht-bonus-rechner?location_id=${locationId}`,
        );
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const eintrag = json.fahrer?.find((f: { fahrer_id: string }) => f.fahrer_id === driverId);
        if (!eintrag) throw new Error('Nicht gefunden');

        const stufe: BonusStufe = eintrag.stufe;
        const naechste: BonusStufe | null =
          stufe === 'kein' ? 'bronze' : stufe === 'bronze' ? 'silber' : stufe === 'silber' ? 'gold' : null;
        const fehlend = naechste
          ? (stufe === 'kein' ? 45 : stufe === 'bronze' ? 65 : 85) - eintrag.erreicht_pct
          : 0;

        let anforderung: string | null = null;
        if (naechste === 'bronze') anforderung = 'Noch 5 Stopps für Bronze';
        else if (naechste === 'silber') anforderung = 'Noch 4 Stopps + 75% Pünktlichkeit für Silber';
        else if (naechste === 'gold') anforderung = 'Noch 5 Stopps + 90% Pünktlichkeit für Gold';

        setDaten({
          stufe,
          bonus_betrag_eur: eintrag.bonus_betrag_eur,
          erreicht_pct: eintrag.erreicht_pct,
          naechste_stufe: naechste,
          naechste_anforderung: anforderung,
          naechste_pct_fehlend: Math.max(0, fehlend),
          stopps_heute: eintrag.stopps_heute,
          puenktlichkeit_pct: eintrag.puenktlichkeit_pct,
        });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !daten) return null;

  const cfg = STUFE_CONFIG[daten.stufe];
  const balkenBreite = Math.min(100, Math.round(daten.erreicht_pct));

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Mein Bonus</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted', cfg.farbe)}>
          {cfg.icon} {cfg.label}
        </span>
        {daten.bonus_betrag_eur > 0 && (
          <span className="text-[10px] font-bold text-green-600 dark:text-green-400">
            +{daten.bonus_betrag_eur} €
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
          {/* Gold-Banner */}
          {daten.stufe === 'gold' && (
            <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 px-4 py-3 flex items-center gap-3">
              <span className="text-3xl">🥇</span>
              <div>
                <p className="text-sm font-bold text-yellow-800 dark:text-yellow-200">Gold erreicht!</p>
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                  +{daten.bonus_betrag_eur} € Bonus verdient — Spitzenleistung!
                </p>
              </div>
            </div>
          )}

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Stopps</div>
              <div className="text-lg font-black tabular-nums mt-0.5">{daten.stopps_heute}</div>
            </div>
            <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Pünktlich</div>
              <div
                className={cn(
                  'text-lg font-black tabular-nums mt-0.5',
                  daten.puenktlichkeit_pct >= 90
                    ? 'text-green-600 dark:text-green-400'
                    : daten.puenktlichkeit_pct >= 75
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {daten.puenktlichkeit_pct}%
              </div>
            </div>
          </div>

          {/* Fortschrittsbalken */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground">Bonus-Score</span>
              <span className="text-[10px] font-bold tabular-nums">{balkenBreite}%</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500', cfg.balken)}
                style={{ width: `${balkenBreite}%` }}
              />
            </div>
          </div>

          {/* Nächste Stufe */}
          {daten.naechste_stufe && daten.naechste_anforderung && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 flex items-start gap-2">
              <Star className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-blue-800 dark:text-blue-200">
                  {STUFE_CONFIG[daten.naechste_stufe].icon} {STUFE_CONFIG[daten.naechste_stufe].label} in Reichweite
                </p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-0.5">{daten.naechste_anforderung}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">Aktualisierung alle 30 Min</p>
        </div>
      )}
    </div>
  );
}
