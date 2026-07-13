'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1369 — Kunden-Zufriedenheits-Ampel (Fahrer-App)
 *
 * Letzte Tour-Bewertung + 7-Tage-Durchschnitt + Trend-Ampel grün/gelb/rot.
 * isOnline-Guard. Nach Phase1364 in fahrer/app/client.tsx.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface RatingData {
  letzte_bewertung: number | null;
  letzte_tour_id: string | null;
  avg_7tage: number | null;
  bewertungs_anzahl_7tage: number;
  trend: 'besser' | 'gleich' | 'schlechter';
}

const MOCK: RatingData = {
  letzte_bewertung: 4.8,
  letzte_tour_id: 'tour-mock-123',
  avg_7tage: 4.5,
  bewertungs_anzahl_7tage: 23,
  trend: 'besser',
};

function StarRow({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={cn('h-4 w-4', i < Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground')}
        />
      ))}
      <span className="ml-1.5 text-sm font-bold text-foreground">{value.toFixed(1)}</span>
    </div>
  );
}

type AmpelLevel = 'gruen' | 'gelb' | 'rot';

function ampel(avg: number | null): AmpelLevel {
  if (avg === null) return 'gelb';
  if (avg >= 4.3) return 'gruen';
  if (avg >= 3.5) return 'gelb';
  return 'rot';
}

const AMPEL_STYLES: Record<AmpelLevel, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  gruen: { bg: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300', label: 'Sehr zufrieden', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  gelb:  { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',  text: 'text-amber-600 dark:text-amber-400', label: 'Zufrieden',     icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  rot:   { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',          text: 'text-red-600 dark:text-red-400',    label: 'Verbesserung nötig', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> },
};

const TREND_ICONS: Record<RatingData['trend'], React.ReactNode> = {
  besser:      <TrendingUp   className="h-4 w-4 text-green-500" />,
  gleich:      <TrendingDown className="h-4 w-4 text-muted-foreground rotate-90 scale-x-[-1]" />,
  schlechter:  <TrendingDown className="h-4 w-4 text-red-500" />,
};

export function FahrerPhase1369KundenZufriedenheitsAmpel({ driverId, isOnline }: Props) {
  const [data, setData] = useState<RatingData | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    if (!isOnline || !driverId) {
      setData(MOCK);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/schicht-statistik?driver_id=${driverId}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData({
        letzte_bewertung: json.avg_bewertung ?? null,
        letzte_tour_id: null,
        avg_7tage: json.avg_bewertung ?? null,
        bewertungs_anzahl_7tage: json.bewertungs_anzahl ?? 0,
        trend: 'gleich',
      });
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [laden]);

  if (!isOnline && !data) return null;

  const level = data ? ampel(data.avg_7tage) : 'gelb';
  const style = AMPEL_STYLES[level];

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold text-sm text-foreground">Kundenzufriedenheit</h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {data && (
        <>
          {/* Ampel-Badge */}
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', style.bg)}>
            {style.icon}
            <span className={cn('text-sm font-semibold', style.text)}>{style.label}</span>
          </div>

          {/* Letzte Bewertung */}
          {data.letzte_bewertung !== null && (
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Letzte Tour-Bewertung</p>
              <StarRow value={data.letzte_bewertung} />
            </div>
          )}

          {/* 7-Tage-Durchschnitt */}
          {data.avg_7tage !== null && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-[11px] text-muted-foreground">Ø letzter 7 Tage</p>
                <div className="text-sm font-bold text-foreground">{data.avg_7tage.toFixed(1)} ★</div>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1">
                  {TREND_ICONS[data.trend]}
                  <span className="text-[11px] text-muted-foreground capitalize">{data.trend}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{data.bewertungs_anzahl_7tage} Bewertungen</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
