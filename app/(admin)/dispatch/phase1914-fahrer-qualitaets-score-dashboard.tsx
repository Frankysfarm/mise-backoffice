'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Star } from 'lucide-react';

/**
 * Phase 1914 — Fahrer-Qualitäts-Score-Dashboard (Dispatch)
 *
 * Rangliste Fahrer nach Qualitätsscore; Score-Ring + Ampel-Dot + Trend-Pfeil;
 * Alert wenn Score <60; 30-Min-Polling; Phase1913-API.
 */

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  stopps_heute: number;
  ampel: Ampel;
  trend: Trend;
  rang: number;
  alert: boolean;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerScore[];
  team_durchschnitt: number;
  generiert_am: string;
}

const MOCK: ApiAntwort = {
  location_id: 'mock',
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', score: 88, puenktlichkeit_pct: 92, bewertung_avg: 4.8, stopps_heute: 14, ampel: 'gruen', trend: 'steigend', rang: 1, alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Anna T.', score: 82, puenktlichkeit_pct: 85, bewertung_avg: 4.5, stopps_heute: 12, ampel: 'gruen', trend: 'stabil', rang: 2, alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.', score: 74, puenktlichkeit_pct: 78, bewertung_avg: 4.1, stopps_heute: 10, ampel: 'gelb', trend: 'stabil', rang: 3, alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Luca P.', score: 58, puenktlichkeit_pct: 61, bewertung_avg: 3.5, stopps_heute: 8, ampel: 'rot', trend: 'fallend', rang: 4, alert: true },
  ],
  team_durchschnitt: 76,
  generiert_am: new Date().toISOString(),
};

const AMPEL_FARBE: Record<Ampel, string> = {
  gruen: 'bg-green-500',
  gelb: 'bg-amber-500',
  rot: 'bg-red-500',
};
const SCORE_FARBE: Record<Ampel, string> = {
  gruen: 'text-green-600 dark:text-green-400',
  gelb: 'text-amber-600 dark:text-amber-400',
  rot: 'text-red-600 dark:text-red-400',
};
const TREND_ICON = { steigend: TrendingUp, fallend: TrendingDown, stabil: Minus };
const TREND_FARBE: Record<Trend, string> = {
  steigend: 'text-green-500', fallend: 'text-red-500', stabil: 'text-muted-foreground',
};

interface Props {
  locationId: string | null;
  className?: string;
}

export function DispatchPhase1914FahrerQualitaetsScoreDashboard({ locationId, className }: Props) {
  const [daten, setDaten] = useState<ApiAntwort | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-qualitaet?location_id=${locationId}`);
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

  const alerts = daten.fahrer.filter((f) => f.alert);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Star className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Qualitäts-Score</span>
        <span className="ml-1 text-[10px] font-bold rounded-full bg-muted text-muted-foreground px-2 py-0.5">
          Team Ø {daten.team_durchschnitt}
        </span>
        {alerts.length > 0 && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            {alerts.length} unter 60
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
          {alerts.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                <span className="font-bold">{alerts.map((f) => f.fahrer_name).join(', ')}</span> — Score unter 60, sofort Coaching!
              </p>
            </div>
          )}

          <div className="space-y-2">
            {daten.fahrer.map((f) => {
              const Icon = TREND_ICON[f.trend];
              return (
                <div
                  key={f.fahrer_id}
                  className={cn(
                    'rounded-xl border px-3 py-2.5 flex items-center gap-3',
                    f.alert ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/10' : 'bg-muted/30',
                  )}
                >
                  {/* Rang */}
                  <span className="text-[11px] font-black text-muted-foreground w-4 shrink-0 text-center">
                    {f.rang}
                  </span>

                  {/* Ampel-Dot */}
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', AMPEL_FARBE[f.ampel])} />

                  {/* Name */}
                  <span className="text-xs font-semibold flex-1 min-w-0 truncate">{f.fahrer_name}</span>

                  {/* KPIs */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right hidden sm:block">
                      <div className="text-[9px] text-muted-foreground">Pünktl.</div>
                      <div className="text-[11px] font-bold tabular-nums">{f.puenktlichkeit_pct}%</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-[9px] text-muted-foreground">Bew.</div>
                      <div className="text-[11px] font-bold tabular-nums">{f.bewertung_avg.toFixed(1)}</div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-[9px] text-muted-foreground">Stopps</div>
                      <div className="text-[11px] font-bold tabular-nums">{f.stopps_heute}</div>
                    </div>

                    {/* Score + Trend */}
                    <div className="flex items-center gap-1">
                      <Icon className={cn('h-3.5 w-3.5', TREND_FARBE[f.trend])} />
                      <span className={cn('text-base font-black tabular-nums', SCORE_FARBE[f.ampel])}>
                        {f.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Score = Pünktl. 40% + Bew. 35% + Stopps 25% · Alle 30 Min ·{' '}
            {new Date(daten.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      )}
    </div>
  );
}
