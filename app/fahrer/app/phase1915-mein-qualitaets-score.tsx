'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';

/**
 * Phase 1915 — Mein-Qualitäts-Score (Fahrer-App)
 *
 * Eigener Gesamtscore + KPI-Aufschlüsselung (Pünktlichkeit/Bewertung/Stopps);
 * Rang im Team; Verbesserungstipp; isOnline-Guard; Collapsible; 30-Min-Polling.
 */

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface QualitaetsDaten {
  score: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
  ampel: Ampel;
  trend: Trend;
  rang: number;
  team_groesse: number;
  alert: boolean;
}

const MOCK: QualitaetsDaten = {
  score: 82, puenktlichkeit_pct: 85, bewertung_avg: 4.5, stopps_heute: 12,
  ampel: 'gruen', trend: 'steigend', rang: 2, team_groesse: 5, alert: false,
};

const AMPEL_CFG: Record<Ampel, { ring: string; score: string; label: string }> = {
  gruen: { ring: 'stroke-green-500', score: 'text-green-600 dark:text-green-400', label: 'Gut' },
  gelb: { ring: 'stroke-amber-500', score: 'text-amber-600 dark:text-amber-400', label: 'Ok' },
  rot: { ring: 'stroke-red-500', score: 'text-red-600 dark:text-red-400', label: 'Verbessern' },
};

const TIPP: Record<Ampel, string> = {
  gruen: 'Stark! Halte diese Leistung für Bonus-Qualifikation.',
  gelb: 'Noch 1–2 pünktliche Stopps mehr und dein Score steigt deutlich.',
  rot: 'Fokussiere dich auf Pünktlichkeit — das macht 40% deines Scores aus.',
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1915MeinQualitaetsScore({ driverId, locationId, isOnline, className }: Props) {
  const [daten, setDaten] = useState<QualitaetsDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId || !locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-qualitaet?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();

        type F = QualitaetsDaten & { fahrer_id: string; rang: number };
        const eintrag: F | undefined = json.fahrer?.find((f: F) => f.fahrer_id === driverId);
        if (!eintrag) throw new Error('Nicht gefunden');

        setDaten({
          score: eintrag.score,
          puenktlichkeit_pct: eintrag.puenktlichkeit_pct,
          bewertung_avg: eintrag.bewertung_avg,
          stopps_heute: eintrag.stopps_heute,
          ampel: eintrag.ampel,
          trend: eintrag.trend,
          rang: eintrag.rang,
          team_groesse: json.fahrer.length,
          alert: eintrag.alert,
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

  const cfg = AMPEL_CFG[daten.ampel];
  const TrendIcon = daten.trend === 'steigend' ? TrendingUp : daten.trend === 'fallend' ? TrendingDown : Minus;
  const trendFarbe = daten.trend === 'steigend' ? 'text-green-500' : daten.trend === 'fallend' ? 'text-red-500' : 'text-muted-foreground';

  const circumference = 2 * Math.PI * 30;
  const dashoffset = circumference * (1 - daten.score / 100);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Star className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Mein Qualitäts-Score</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted', cfg.score)}>
          {daten.score} / 100
        </span>
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {/* Score-Ring + KPIs */}
          <div className="flex items-center gap-4">
            {/* Score-Ring */}
            <div className="relative flex-shrink-0">
              <svg width="80" height="80" className="-rotate-90">
                <circle cx="40" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="40" cy="40" r="30" fill="none"
                  strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  className={cfg.ring}
                  style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={cn('text-xl font-black tabular-nums leading-none', cfg.score)}>
                  {daten.score}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5">{cfg.label}</span>
              </div>
            </div>

            {/* KPI-Grid */}
            <div className="grid grid-cols-1 gap-1.5 flex-1 min-w-0">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Pünktlichkeit</span>
                <span className={cn('text-xs font-black tabular-nums',
                  daten.puenktlichkeit_pct >= 85 ? 'text-green-600 dark:text-green-400'
                    : daten.puenktlichkeit_pct >= 70 ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400',
                )}>
                  {daten.puenktlichkeit_pct}%
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Bewertung</span>
                <span className="text-xs font-black tabular-nums">
                  {daten.bewertung_avg.toFixed(1)} ⭐
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Stopps heute</span>
                <span className="text-xs font-black tabular-nums">{daten.stopps_heute}</span>
              </div>
            </div>
          </div>

          {/* Rang + Trend */}
          <div className="flex items-center gap-3">
            <div className="flex-1 rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Rang im Team</div>
              <div className="text-lg font-black mt-0.5">
                {daten.rang} / {daten.team_groesse}
              </div>
            </div>
            <div className="flex-1 rounded-xl border bg-muted/30 px-3 py-2 text-center">
              <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Trend</div>
              <div className={cn('flex items-center justify-center gap-1 mt-0.5', trendFarbe)}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-bold">
                  {daten.trend === 'steigend' ? 'Aufwärts' : daten.trend === 'fallend' ? 'Abwärts' : 'Stabil'}
                </span>
              </div>
            </div>
          </div>

          {/* Tipp */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">{TIPP[daten.ampel]}</p>
          </div>

          <p className="text-[10px] text-muted-foreground text-right">Aktualisierung alle 30 Min</p>
        </div>
      )}
    </div>
  );
}
