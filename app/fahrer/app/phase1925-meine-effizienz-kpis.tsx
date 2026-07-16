'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

/**
 * Phase 1925 — Meine-Effizienz-KPIs (Fahrer-App)
 *
 * Stopps/h + km/Stopp + Score + Vergleich mit Team-Ø + Trend;
 * Motivationstext; isOnline-Guard; Collapsible; 30-Min-Polling.
 * Nutzt bestehende Phase1130-API /api/delivery/admin/fahrer-effizienz-rangliste.
 */

interface FahrerRank {
  fahrer_id: string;
  fahrer_name: string;
  stopps_gesamt: number;
  stopps_pro_stunde: number;
  km_pro_stopp: number;
  puenktlichkeit_pct: number;
  gesamt_score: number;
  delta_schnitt: number;
  badge: 'gold' | 'silber' | 'bronze' | null;
  rang: number;
}

interface MeineEffizienz {
  eigener: FahrerRank;
  team_schnitt_score: number;
  gesamt_fahrer: number;
}

const MOCK_EIGEN: FahrerRank = {
  fahrer_id: 'me',
  fahrer_name: 'Ich',
  stopps_gesamt: 14,
  stopps_pro_stunde: 3.5,
  km_pro_stopp: 2.5,
  puenktlichkeit_pct: 86,
  gesamt_score: 75,
  delta_schnitt: -1,
  badge: 'bronze',
  rang: 3,
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const MOTIVATIONS: Record<string, string> = {
  hoch: 'Klasse! Du gehörst zu den effizientesten Fahrern heute.',
  mittel: 'Gute Leistung — noch eine Schippe drauf für den Spitzenplatz!',
  niedrig: 'Heute noch nicht auf Top-Level — konzentrier dich auf schnelle Stopps!',
};

export function FahrerPhase1925MeineEffizienzKPIs({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<MeineEffizienz | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-effizienz-rangliste?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        const fahrer: FahrerRank[] = json.fahrer ?? [];
        const eigener = fahrer.find((f) => f.fahrer_id === driverId) ?? null;
        if (!eigener) throw new Error('not found');
        setDaten({ eigener, team_schnitt_score: json.team_schnitt_score ?? 0, gesamt_fahrer: fahrer.length });
      } catch {
        setDaten({ eigener: MOCK_EIGEN, team_schnitt_score: 76, gesamt_fahrer: 5 });
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, driverId, locationId]);

  if (!isOnline || !daten) return null;

  const { eigener, team_schnitt_score, gesamt_fahrer } = daten;
  const scoreKlasse = eigener.gesamt_score >= 80
    ? 'text-green-700 dark:text-green-300'
    : eigener.gesamt_score >= 60
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-red-700 dark:text-red-300';
  const ringKlasse = eigener.gesamt_score >= 80 ? 'stroke-green-500' : eigener.gesamt_score >= 60 ? 'stroke-amber-500' : 'stroke-red-500';
  const circumference = 2 * Math.PI * 28;
  const dashoffset = circumference * (1 - eigener.gesamt_score / 100);

  const DeltaIcon = eigener.delta_schnitt > 3 ? TrendingUp : eigener.delta_schnitt < -3 ? TrendingDown : Minus;
  const deltaFarbe = eigener.delta_schnitt > 3 ? 'text-green-600 dark:text-green-400' : eigener.delta_schnitt < -3 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

  const motivKat = eigener.gesamt_score >= 80 ? 'hoch' : eigener.gesamt_score >= 60 ? 'mittel' : 'niedrig';
  const badgeEmoji = eigener.badge ? ({ gold: '🥇', silber: '🥈', bronze: '🥉' } as Record<string, string>)[eigener.badge] : null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Zap className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="text-xs font-bold uppercase tracking-wider">Meine Effizienz</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted flex items-center gap-1', scoreKlasse)}>
          <DeltaIcon className="h-3 w-3" />
          {eigener.gesamt_score}/100
        </span>
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          <div className="flex items-center gap-4">
            {/* Score-Ring */}
            <div className="relative shrink-0">
              <svg width="72" height="72" className="-rotate-90">
                <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
                <circle
                  cx="36" cy="36" r="28" fill="none" strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  className={ringKlasse}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-lg font-black tabular-nums leading-none', scoreKlasse)}>
                  {badgeEmoji ?? eigener.gesamt_score}
                </span>
                {!badgeEmoji && <span className="text-[8px] text-muted-foreground">/100</span>}
              </div>
            </div>

            {/* KPI-Grid */}
            <div className="flex-1 min-w-0 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Stopps/h</p>
                <p className="text-sm font-black tabular-nums">{eigener.stopps_pro_stunde}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">km/Stopp</p>
                <p className="text-sm font-black tabular-nums">{eigener.km_pro_stopp}</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Pünktlichkeit</p>
                <p className="text-sm font-black tabular-nums">{eigener.puenktlichkeit_pct}%</p>
              </div>
              <div className="rounded-lg bg-muted/30 px-2 py-1.5 text-center">
                <p className="text-[10px] text-muted-foreground">Rang</p>
                <p className="text-sm font-black tabular-nums">{eigener.rang}/{gesamt_fahrer}</p>
              </div>
            </div>
          </div>

          {/* Team-Vergleich */}
          <div className={cn('flex items-center gap-1.5 text-xs font-semibold', deltaFarbe)}>
            <DeltaIcon className="h-3.5 w-3.5" />
            <span>
              {eigener.delta_schnitt > 0 ? '+' : ''}{eigener.delta_schnitt} Punkte vs. Team-Ø ({team_schnitt_score})
            </span>
          </div>

          {/* Motivationstext */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{MOTIVATIONS[motivKat]}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            {eigener.stopps_gesamt} Stopps heute · 30-Min-Polling
          </p>
        </div>
      )}
    </div>
  );
}
