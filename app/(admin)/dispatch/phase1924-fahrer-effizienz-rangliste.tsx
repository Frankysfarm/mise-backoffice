'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Medal } from 'lucide-react';

/**
 * Phase 1924 — Fahrer-Effizienz-Rangliste (Dispatch)
 *
 * Tabelle: Rang + Badge + Name + Stopps/h + Pünktlichkeit + Score + Delta;
 * Alert wenn Stopps/h < 2; Collapsible; 30-Min-Polling.
 * Nutzt bestehende Phase1130-API /api/delivery/admin/fahrer-effizienz-rangliste.
 */

interface FahrerRank {
  rang: number;
  fahrer_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_pro_stunde: number;
  puenktlichkeit_pct: number;
  gesamt_score: number;
  delta_schnitt: number;
  badge: 'gold' | 'silber' | 'bronze' | null;
}

interface RankingDaten {
  fahrer: FahrerRank[];
  team_schnitt_score: number;
  alert_count: number;
}

const MOCK: RankingDaten = {
  fahrer: [
    { rang: 1, fahrer_id: 'f1', fahrer_name: 'Ahmad K.', stopps_gesamt: 18, stopps_pro_stunde: 4.5, puenktlichkeit_pct: 94, gesamt_score: 88, delta_schnitt: 16, badge: 'gold' },
    { rang: 2, fahrer_id: 'f2', fahrer_name: 'Lukas M.', stopps_gesamt: 15, stopps_pro_stunde: 3.8, puenktlichkeit_pct: 89, gesamt_score: 79, delta_schnitt: 4, badge: 'silber' },
    { rang: 3, fahrer_id: 'f3', fahrer_name: 'Sara P.', stopps_gesamt: 14, stopps_pro_stunde: 3.5, puenktlichkeit_pct: 86, gesamt_score: 75, delta_schnitt: -1, badge: 'bronze' },
    { rang: 4, fahrer_id: 'f4', fahrer_name: 'Jonas H.', stopps_gesamt: 12, stopps_pro_stunde: 1.8, puenktlichkeit_pct: 80, gesamt_score: 58, delta_schnitt: -17, badge: null },
  ],
  team_schnitt_score: 75,
  alert_count: 1,
};

const BADGE_EMOJI: Record<string, string> = { gold: '🥇', silber: '🥈', bronze: '🥉' };

export function DispatchPhase1924FahrerEffizienzRangliste({ locationId, className }: { locationId: string | null; className?: string }) {
  const [daten, setDaten] = useState<RankingDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) { setDaten(MOCK); return; }

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-effizienz-rangliste?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const fahrer: FahrerRank[] = json.fahrer ?? [];
        const alertCount = fahrer.filter((f) => f.stopps_pro_stunde < 2 && f.stopps_pro_stunde > 0).length;
        setDaten({ fahrer, team_schnitt_score: json.team_schnitt_score ?? 0, alert_count: alertCount });
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  const scoreKlasse = (score: number) =>
    score >= 80 ? 'text-green-700 dark:text-green-300' : score >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';
  const dotKlasse = (score: number) =>
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Effizienz-Rangliste</span>
        <span className="ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted text-muted-foreground">
          Team-Ø {daten.team_schnitt_score}
        </span>
        {daten.alert_count > 0 && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {daten.alert_count} langsam!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {daten.alert_count > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">
                {daten.alert_count} Fahrer unter 2 Stopps/h — Effizienz kritisch!
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {daten.fahrer.map((f) => {
              const DeltaIcon = f.delta_schnitt > 3 ? TrendingUp : f.delta_schnitt < -3 ? TrendingDown : Minus;
              const deltaFarbe = f.delta_schnitt > 3 ? 'text-green-600 dark:text-green-400' : f.delta_schnitt < -3 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
              const isAlert = f.stopps_pro_stunde < 2 && f.stopps_pro_stunde > 0;
              return (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-3 py-2',
                    isAlert ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800' : 'bg-muted/20',
                  )}
                >
                  <span className="text-[10px] font-black text-muted-foreground w-4 text-center">{f.rang}</span>
                  <div className={cn('h-2 w-2 rounded-full shrink-0', dotKlasse(f.gesamt_score))} />
                  <span className="text-xs font-semibold flex-1 min-w-0 truncate">
                    {f.badge ? BADGE_EMOJI[f.badge] + ' ' : ''}{f.fahrer_name}
                  </span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline tabular-nums">{f.stopps_pro_stunde}/h</span>
                  <span className="text-[10px] text-muted-foreground hidden sm:inline tabular-nums">{f.puenktlichkeit_pct}%</span>
                  <span className={cn('text-xs font-black tabular-nums', scoreKlasse(f.gesamt_score))}>{f.gesamt_score}</span>
                  <DeltaIcon className={cn('h-3 w-3 shrink-0', deltaFarbe)} />
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Medal className="h-3 w-3" />
            <span>Score = Stopps/h(40%) + Pünktlichkeit(35%) + km-Eff.(25%) · 30-Min-Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
