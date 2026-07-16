'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, AlertTriangle, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown } from 'lucide-react';

/**
 * Phase 1934 — Kundenbewertungs-Dashboard (Dispatch)
 *
 * Ø-Stern-Ring + NPS-Gauge + Top-Kommentare; Trend-Pfeil; Alert <3.5; 1-Std-Polling.
 */

interface BewertungsDaten {
  avg_bewertung: number;
  bewertungs_count: number;
  nps_score: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  alert: boolean;
  top_positiv: string[];
  top_negativ: string[];
}

const MOCK: BewertungsDaten = {
  avg_bewertung: 4.3,
  bewertungs_count: 128,
  nps_score: 42,
  trend: 'steigend',
  alert: false,
  top_positiv: ['Sehr schnelle Lieferung!', 'Freundlicher Fahrer'],
  top_negativ: ['Etwas zu lange Wartezeit'],
};

export function DispatchPhase1934KundenbewertungsDashboard({ locationId, className }: { locationId: string | null; className?: string }) {
  const [daten, setDaten] = useState<BewertungsDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) { setDaten(MOCK); return; }

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/kundenbewertungen-aggregat?location_id=${locationId}`);
        if (!res.ok) throw new Error('API Fehler');
        const json = await res.json();
        setDaten(json);
      } catch {
        setDaten(MOCK);
      }
    };

    laden();
    const id = setInterval(laden, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!daten) return null;

  const circumference = 2 * Math.PI * 26;
  const dashoffset = circumference * (1 - daten.avg_bewertung / 5);
  const ringKlasse = daten.avg_bewertung >= 4 ? 'stroke-green-500' : daten.avg_bewertung >= 3 ? 'stroke-amber-500' : 'stroke-red-500';
  const textKlasse = daten.avg_bewertung >= 4 ? 'text-green-700 dark:text-green-300' : daten.avg_bewertung >= 3 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  const TrendIcon = daten.trend === 'steigend' ? TrendingUp : daten.trend === 'fallend' ? TrendingDown : Minus;
  const trendFarbe = daten.trend === 'steigend' ? 'text-green-600 dark:text-green-400' : daten.trend === 'fallend' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';

  const npsKlasse = daten.nps_score >= 50 ? 'text-green-700 dark:text-green-300' : daten.nps_score >= 0 ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300';

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Star className={cn('h-4 w-4 shrink-0', textKlasse)} />
        <span className="text-xs font-bold uppercase tracking-wider">Kundenbewertungen</span>
        <span className={cn('ml-1 text-[10px] font-bold rounded-full px-2 py-0.5 bg-muted flex items-center gap-1', textKlasse)}>
          <TrendIcon className="h-3 w-3" />
          {daten.avg_bewertung}/5 · {daten.bewertungs_count} Bew.
        </span>
        {daten.alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            Unter 3.5!
          </span>
        )}
        {offen ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {daten.alert && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs font-bold text-red-700 dark:text-red-300">Ø-Bewertung unter 3.5 — Qualität prüfen!</p>
            </div>
          )}

          <div className="flex items-center gap-4">
            {/* Stern-Ring */}
            <div className="relative shrink-0">
              <svg width="68" height="68" className="-rotate-90">
                <circle cx="34" cy="34" r="26" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
                <circle
                  cx="34" cy="34" r="26" fill="none" strokeWidth="5"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashoffset}
                  strokeLinecap="round"
                  className={ringKlasse}
                  style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Star className={cn('h-3 w-3 mb-0.5', textKlasse)} />
                <span className={cn('text-base font-black tabular-nums leading-none', textKlasse)}>{daten.avg_bewertung}</span>
              </div>
            </div>

            {/* KPIs */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">NPS-Score</span>
                <span className={cn('text-xs font-black tabular-nums', npsKlasse)}>{daten.nps_score > 0 ? '+' : ''}{daten.nps_score}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-2.5 py-1.5">
                <span className="text-[10px] text-muted-foreground">Bewertungen (7 Tage)</span>
                <span className="text-xs font-black tabular-nums">{daten.bewertungs_count}</span>
              </div>
              <div className={cn('flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 bg-muted/30', trendFarbe)}>
                <TrendIcon className="h-3 w-3" />
                <span className="text-[10px] font-semibold">
                  {daten.trend === 'steigend' ? 'Trend steigend' : daten.trend === 'fallend' ? 'Trend fallend' : 'Trend stabil'}
                </span>
              </div>
            </div>
          </div>

          {/* Kommentare */}
          {daten.top_positiv.length > 0 && (
            <div className="space-y-1">
              {daten.top_positiv.slice(0, 2).map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-green-50 dark:bg-green-950/20 px-2.5 py-1.5">
                  <ThumbsUp className="h-3 w-3 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-green-700 dark:text-green-300 italic">"{c}"</p>
                </div>
              ))}
            </div>
          )}
          {daten.top_negativ.length > 0 && (
            <div className="space-y-1">
              {daten.top_negativ.slice(0, 1).map((c, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/20 px-2.5 py-1.5">
                  <ThumbsDown className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 dark:text-red-300 italic">"{c}"</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-right">Letzte 7 Tage · 1-Std-Polling</p>
        </div>
      )}
    </div>
  );
}
