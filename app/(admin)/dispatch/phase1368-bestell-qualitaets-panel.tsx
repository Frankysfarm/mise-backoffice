'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Star, TrendingDown, TrendingUp, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1368 — Bestellqualitäts-Panel (Dispatch)
 *
 * Zeigt Phase1366-API: Storno-Rate + Ø-Bewertung + Fehlerquote + Top-Beschwerde.
 * Qualitäts-Ampel grün/gelb/rot. 15-Min-Polling.
 * Nach Phase1363 in dispatch/client.tsx.
 */

type QualitaetsLevel = 'sehr_gut' | 'gut' | 'ok' | 'schlecht';

interface ApiData {
  storno_rate_pct: number;
  storno_anzahl: number;
  gesamt_bestellungen: number;
  avg_bewertung: number | null;
  bewertungs_anzahl: number;
  fehler_rate_pct: number;
  top_beschwerde: string | null;
  qualitaets_level: QualitaetsLevel;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 15 * 60 * 1000;

const LEVEL_STYLES: Record<QualitaetsLevel, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  sehr_gut: { bg: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300', label: 'Sehr gut', icon: <CheckCircle2 className="h-4 w-4 text-green-500" /> },
  gut:      { bg: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',  text: 'text-green-600 dark:text-green-400', label: 'Gut',      icon: <CheckCircle2 className="h-4 w-4 text-green-400" /> },
  ok:       { bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',  text: 'text-amber-600 dark:text-amber-400', label: 'OK',       icon: <AlertTriangle className="h-4 w-4 text-amber-400" /> },
  schlecht: { bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',          text: 'text-red-600 dark:text-red-400',    label: 'Schlecht', icon: <XCircle className="h-4 w-4 text-red-500" /> },
};

export function DispatchPhase1368BestellQualitaetsPanel({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/bestell-qualitaets-monitor?location_id=${locationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json() as ApiData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const t = setInterval(laden, POLL_MS);
    return () => clearInterval(t);
  }, [laden]);

  if (!locationId) return null;

  const level = data ? LEVEL_STYLES[data.qualitaets_level] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-amber-400" />
        <h3 className="font-semibold text-sm text-foreground">Bestellqualität heute</h3>
        <button onClick={laden} className="ml-auto text-muted-foreground hover:text-foreground transition-colors" aria-label="Aktualisieren">
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {loading && !data && (
        <div className="flex justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && level && (
        <>
          {/* Qualitäts-Badge */}
          <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2', level.bg)}>
            {level.icon}
            <span className={cn('text-sm font-semibold', level.text)}>Qualität: {level.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{data.gesamt_bestellungen} Bestellungen</span>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: 'Storno-Rate',
                wert: `${data.storno_rate_pct}%`,
                sub: `${data.storno_anzahl} Stornos`,
                icon: data.storno_rate_pct <= 5
                  ? <TrendingDown className="h-4 w-4 text-green-500" />
                  : <TrendingUp className="h-4 w-4 text-red-500" />,
                warn: data.storno_rate_pct > 8,
              },
              {
                label: 'Ø Bewertung',
                wert: data.avg_bewertung !== null ? `${data.avg_bewertung.toFixed(1)} ★` : '—',
                sub: `${data.bewertungs_anzahl} Bewertungen`,
                icon: <Star className="h-4 w-4 text-amber-400" />,
                warn: data.avg_bewertung !== null && data.avg_bewertung < 3.5,
              },
              {
                label: 'Fehlerquote',
                wert: `${data.fehler_rate_pct}%`,
                sub: 'Reklamationen',
                icon: data.fehler_rate_pct <= 3
                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                  : <AlertTriangle className="h-4 w-4 text-amber-400" />,
                warn: data.fehler_rate_pct > 5,
              },
              {
                label: 'Top-Beschwerde',
                wert: data.top_beschwerde ? data.top_beschwerde.split(' ').slice(0, 2).join(' ') : 'Keine',
                sub: data.top_beschwerde ?? '',
                icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
                warn: false,
              },
            ].map(({ label, wert, sub, icon, warn }) => (
              <div key={label} className={cn('rounded-lg border p-2.5 space-y-0.5', warn ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-border bg-muted/30')}>
                <div className="flex items-center gap-1.5">
                  {icon}
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </div>
                <div className="text-sm font-bold text-foreground">{wert}</div>
                {sub && <div className="text-[10px] text-muted-foreground truncate">{sub}</div>}
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground text-right">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
          </p>
        </>
      )}
    </div>
  );
}
