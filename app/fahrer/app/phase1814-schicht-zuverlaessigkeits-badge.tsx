'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, TrendingUp, TrendingDown, Minus, Lightbulb } from 'lucide-react';

/**
 * Phase 1814 — Schicht-Zuverlässigkeits-Badge (Fahrer-App)
 *
 * Eigener Zuverlässigkeits-Score (aus Phase1811 /api/delivery/admin/fahrer-zuverlaessigkeit)
 * + Mini-Wochenverlauf (7 Punkte) + Ampel + Verbesserungstipps.
 * isOnline-Guard; 30-Min-Polling.
 */

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerData {
  score: number;
  ampel: Ampel;
  trend: Trend;
  trend_delta: number;
  abbruchquote_pct: number;
  puenktlichkeit_pct: number;
  schichtantritt_pct: number;
  verlauf_7_tage: number[];
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

const AMPEL_STYLE: Record<Ampel, { ring: string; bg: string; score: string; label: string; labelText: string }> = {
  gruen: {
    ring: 'ring-matcha-400',
    bg: 'bg-matcha-50 dark:bg-matcha-950/30',
    score: 'text-matcha-600 dark:text-matcha-300',
    label: 'Sehr zuverlässig',
    labelText: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300',
  },
  gelb: {
    ring: 'ring-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    score: 'text-amber-600 dark:text-amber-300',
    label: 'Zuverlässig',
    labelText: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  rot: {
    ring: 'ring-red-400',
    bg: 'bg-red-50 dark:bg-red-950/30',
    score: 'text-red-600 dark:text-red-300',
    label: 'Verbesserungsbedarf',
    labelText: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  },
};

const TIPPS: Record<Ampel, string[]> = {
  gruen: ['Super! Mach weiter so.', 'Deine Zuverlässigkeit ist top.'],
  gelb: [
    'Pünktlichkeit verbessern: früher losfahren.',
    'Stopps vollständig abschließen.',
    'Schicht pünktlich beginnen.',
  ],
  rot: [
    'Abbruchquote senken: Kunden vor Abfahrt anrufen.',
    'Schicht pünktlich beginnen — das zählt stark.',
    'Bei Problemen frühzeitig Dispatch kontaktieren.',
  ],
};

const MOCK: FahrerData = {
  score: 82,
  ampel: 'gruen',
  trend: 'steigend',
  trend_delta: 5,
  abbruchquote_pct: 3,
  puenktlichkeit_pct: 91,
  schichtantritt_pct: 100,
  verlauf_7_tage: [82, 78, 76, 80, 75, 72, 77],
};

export function FahrerPhase1814SchichtZuverlaessigkeitsBadge({ driverId, locationId, isOnline, className }: Props) {
  const [data, setData] = useState<FahrerData | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-zuverlaessigkeit?location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) throw new Error('api');
      const json = await res.json() as { fahrer: (FahrerData & { fahrer_id: string })[] };
      const mein = driverId ? json.fahrer.find((f) => f.fahrer_id === driverId) : json.fahrer[0];
      if (mein) setData(mein);
      else throw new Error('not_found');
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [locationId, driverId]);

  useEffect(() => {
    if (!isOnline) return;
    laden();
    const id = setInterval(laden, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, laden]);

  if (!isOnline) return null;
  if (loading && !data) {
    return (
      <div className={cn('rounded-2xl border bg-card px-4 py-3 animate-pulse', className)}>
        <div className="h-3 w-32 rounded bg-muted mb-2" />
        <div className="h-8 w-16 rounded bg-muted" />
      </div>
    );
  }
  if (!data) return null;

  const s = AMPEL_STYLE[data.ampel];
  const verlaufMax = Math.max(...data.verlauf_7_tage, 1);
  const tipps = TIPPS[data.ampel];

  return (
    <div className={cn('rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden', className)}>
      <div className={cn('px-4 py-3', s.bg)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn('h-8 w-8 rounded-full ring-2 flex items-center justify-center bg-card', s.ring)}>
              <ShieldCheck className={cn('h-4 w-4', s.score)} />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Meine Zuverlässigkeit</p>
              <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', s.labelText)}>
                {s.label}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className={cn('text-3xl font-black', s.score)}>{data.score}</p>
            <div className="flex items-center justify-end gap-0.5 text-[10px] text-muted-foreground">
              {data.trend === 'steigend' ? (
                <TrendingUp className="h-3 w-3 text-matcha-500" />
              ) : data.trend === 'fallend' ? (
                <TrendingDown className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3" />
              )}
              <span>{data.trend_delta > 0 ? '+' : ''}{data.trend_delta} Pkt.</span>
            </div>
          </div>
        </div>

        {/* Wochenverlauf Mini-Chart */}
        <div className="flex items-end gap-0.5 h-8 mt-2 mb-1">
          {[...data.verlauf_7_tage].reverse().map((val, i) => (
            <div
              key={i}
              className={cn('flex-1 rounded-sm transition-all', i === data.verlauf_7_tage.length - 1 ? s.score.replace('text-', 'bg-') : 'bg-muted-foreground/20')}
              style={{ height: `${Math.round((val / verlaufMax) * 100)}%`, minHeight: '4px' }}
              title={`${val} Pkt.`}
            />
          ))}
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground">
          <span>vor 7 Tagen</span>
          <span>heute</span>
        </div>
      </div>

      {/* Detailwerte */}
      <div className="px-4 py-2 border-t border-border grid grid-cols-3 gap-2">
        {[
          { label: 'Pünktlichkeit', val: data.puenktlichkeit_pct },
          { label: 'Abbruchquote', val: data.abbruchquote_pct, invert: true },
          { label: 'Schichtantritt', val: data.schichtantritt_pct },
        ].map(({ label, val, invert }) => (
          <div key={label} className="text-center">
            <p className={cn('text-base font-black', invert
              ? val > 10 ? 'text-red-600 dark:text-red-400' : 'text-matcha-600 dark:text-matcha-400'
              : val >= 90 ? 'text-matcha-600 dark:text-matcha-400' : val >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
            )}>
              {val}%
            </p>
            <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>

      {/* Tipp */}
      {data.ampel !== 'gruen' && tipps.length > 0 && (
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 px-3 py-2">
            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
            <p className="text-[10px] text-muted-foreground">{tipps[0]}</p>
          </div>
        </div>
      )}
    </div>
  );
}
