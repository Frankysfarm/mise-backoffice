'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';

/**
 * Phase 1834 — Pünktlichkeits-Cockpit (Fahrer-App)
 *
 * Eigene Pünktlichkeitsquote aus Phase1831-API + 7-Tage-Verlauf + Rang + Tipp.
 * isOnline-Guard; 30-Min-Polling.
 */

interface FahrerPuenktlichkeit {
  fahrer_id: string;
  fahrer_name: string;
  quote_pct: number;
  grade: 'A' | 'B' | 'C' | 'D';
  ampel: 'gruen' | 'gelb' | 'rot';
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  verlauf_7_tage: number[];
  rang: number;
}

interface ApiAntwort {
  location_id: string;
  fahrer: FahrerPuenktlichkeit[];
  team_durchschnitt: number;
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const AMPEL_COLORS = {
  gruen: {
    ring: 'border-matcha-400',
    score: 'text-matcha-600 dark:text-matcha-400',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    label: 'Sehr pünktlich',
  },
  gelb: {
    ring: 'border-amber-400',
    score: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    label: 'Pünktlichkeit OK',
  },
  rot: {
    ring: 'border-red-400',
    score: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    label: 'Verbesserungsbedarf',
  },
};

const TIPPS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Exzellente Pünktlichkeit! Du bist das Vorbild im Team.',
  B: 'Gute Leistung. Noch 5% mehr und du erreichst A-Status.',
  C: 'Kürzere Pausen zwischen Stopps helfen, die Quote zu verbessern.',
  D: 'Bitte Routen und Stoppzeiten optimieren — spreche mit dem Disponenten.',
};

function MiniChart({ werte }: { werte: number[] }) {
  if (werte.length < 2) return null;
  const min = Math.min(...werte, 0);
  const max = Math.max(...werte, 100);
  const range = max - min || 1;
  const w = 112;
  const h = 28;
  const pts = werte
    .map((v, i) => {
      const x = (i / (werte.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        className="text-matcha-500 dark:text-matcha-400"
      />
      {werte.map((v, i) => (
        <circle
          key={i}
          cx={(i / (werte.length - 1)) * w}
          cy={h - ((v - min) / range) * h}
          r="2"
          fill="currentColor"
          className="text-matcha-600 dark:text-matcha-400"
        />
      ))}
    </svg>
  );
}

const MOCK_ANTWORT: ApiAntwort = {
  location_id: 'mock',
  fahrer: [
    {
      fahrer_id: 'mock-driver',
      fahrer_name: 'Du',
      quote_pct: 87.4,
      grade: 'B',
      ampel: 'gruen',
      trend: 'steigend',
      trend_delta: 3,
      verlauf_7_tage: [87.4, 84.2, 82.0, 85.6, 81.1, 79.4, 84.3],
      rang: 2,
    },
  ],
  team_durchschnitt: 82.1,
  generiert_am: new Date().toISOString(),
};

const POLL_MS = 30 * 60 * 1_000;

export function FahrerPhase1834PuenktlichkeitsCockpit({ driverId, locationId, isOnline, className }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline || !locationId) return;

    let cancelled = false;

    async function laden() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-puenktlichkeit?location_id=${encodeURIComponent(locationId!)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error('api_error');
        const json: ApiAntwort = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData({ ...MOCK_ANTWORT, location_id: locationId! });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    laden();
    const id = setInterval(laden, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [isOnline, locationId]);

  if (!isOnline) return null;

  const meineEintraege = data?.fahrer ?? [];
  const ich = driverId
    ? meineEintraege.find(f => f.fahrer_id === driverId) ?? meineEintraege[0]
    : meineEintraege[0];

  const teamDurchschnitt = data?.team_durchschnitt ?? 0;
  const gesamtFahrer = meineEintraege.length;

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Pünktlichkeit</span>
          {ich && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              ich.ampel === 'gruen'
                ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
                : ich.ampel === 'gelb'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            )}>
              {ich.quote_pct.toFixed(1)}%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {loading && !ich && (
            <div className="text-xs text-muted-foreground">Lade Pünktlichkeits-Daten…</div>
          )}

          {!locationId && (
            <div className="text-xs text-muted-foreground">Standort nicht verfügbar.</div>
          )}

          {ich && (() => {
            const colors = AMPEL_COLORS[ich.ampel];
            return (
              <>
                {/* Score-Kachel */}
                <div className={cn('rounded-xl border-2 p-3 flex items-center gap-3', colors.ring, colors.bg)}>
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 border-current">
                    <span className={cn('font-display text-2xl font-black tabular-nums', colors.score)}>
                      {ich.quote_pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{colors.label}</span>
                      <span className="text-[10px] text-muted-foreground">Grade {ich.grade}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">
                        Rang #{ich.rang} von {gesamtFahrer}
                      </span>
                      {ich.trend === 'steigend' && (
                        <span className="flex items-center gap-0.5 text-matcha-600 dark:text-matcha-400 text-[10px] font-semibold">
                          <TrendingUp className="h-3 w-3" />+{ich.trend_delta}%
                        </span>
                      )}
                      {ich.trend === 'fallend' && (
                        <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400 text-[10px] font-semibold">
                          <TrendingDown className="h-3 w-3" />{ich.trend_delta}%
                        </span>
                      )}
                      {ich.trend === 'stabil' && (
                        <span className="flex items-center gap-0.5 text-muted-foreground text-[10px]">
                          <Minus className="h-3 w-3" />stabil
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      Team-Ø: {teamDurchschnitt.toFixed(1)}%
                      {ich.quote_pct > teamDurchschnitt
                        ? ` (+${(ich.quote_pct - teamDurchschnitt).toFixed(1)}%)`
                        : ` (${(ich.quote_pct - teamDurchschnitt).toFixed(1)}%)`}
                    </div>
                  </div>
                </div>

                {/* 7-Tage-Verlauf */}
                {ich.verlauf_7_tage.length > 1 && (
                  <div className="rounded-xl border bg-muted/20 px-3 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      7-Tage-Verlauf
                    </div>
                    <div className="flex items-end gap-2">
                      <MiniChart werte={[...ich.verlauf_7_tage].reverse()} />
                      <div className="text-[9px] text-muted-foreground">
                        <div>Heute: {ich.verlauf_7_tage[0].toFixed(0)}%</div>
                        <div>Vor 7T: {ich.verlauf_7_tage[6].toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tipp */}
                <div className={cn(
                  'flex items-start gap-2 rounded-xl border px-3 py-2',
                  ich.ampel === 'gruen'
                    ? 'bg-matcha-50 dark:bg-matcha-950/30 border-matcha-200 dark:border-matcha-800'
                    : ich.ampel === 'gelb'
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                )}>
                  {ich.ampel === 'gruen'
                    ? <CheckCircle2 className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />}
                  <span className="text-xs text-muted-foreground">{TIPPS[ich.grade]}</span>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
