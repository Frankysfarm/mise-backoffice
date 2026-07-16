'use client';

/**
 * Phase 1894 — Fahrer-Schicht-Benchmark-Widget (Dispatch)
 *
 * Tabelle aller Fahrer: Stopps + Verdienst + Pünktlichkeit heute vs. 7-Tage-Schnitt.
 * Spitzenreiter-Badge (Trophäe). Trend-Pfeil je Spalte. Alert-Banner wenn
 * Fahrer >30% unter Team-Schnitt. 30-Min-Polling. Collapsible (default offen).
 * GET /api/delivery/admin/fahrer-schicht-benchmark (Phase 1893)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Users,
  RefreshCw,
} from 'lucide-react';

interface FahrerBenchmark {
  fahrer_id: string;
  fahrer_name: string;
  stopps_heute: number;
  stopps_7d_schnitt: number;
  verdienst_eur_heute: number;
  verdienst_7d_schnitt: number;
  puenktlichkeit_pct: number;
  puenktlichkeit_7d_schnitt: number;
  trend_stopps: 'besser' | 'gleich' | 'schlechter';
  trend_verdienst: 'besser' | 'gleich' | 'schlechter';
  unter_schnitt_alert: boolean;
  spitzenreiter: boolean;
  ampel: 'gruen' | 'gelb' | 'rot';
  mock?: boolean;
}

interface TeamSchnitt {
  stopps: number;
  verdienst_eur: number;
  puenktlichkeit_pct: number;
}

interface Props {
  locationId: string | null;
  className?: string;
}

const TREND_ICON = {
  besser:      TrendingUp,
  gleich:      Minus,
  schlechter:  TrendingDown,
};
const TREND_COLOR = {
  besser:      'text-matcha-600 dark:text-matcha-400',
  gleich:      'text-amber-600 dark:text-amber-400',
  schlechter:  'text-red-600 dark:text-red-400',
};
const AMPEL_BADGE: Record<string, string> = {
  gruen: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300',
  gelb:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  rot:   'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};
const AMPEL_DOT: Record<string, string> = {
  gruen: 'bg-matcha-500', gelb: 'bg-amber-500', rot: 'bg-red-500',
};

export function DispatchPhase1894FahrerSchichtBenchmarkWidget({ locationId, className }: Props) {
  const [fahrer, setFahrer]       = useState<FahrerBenchmark[]>([]);
  const [schnitt, setSchnitt]     = useState<TeamSchnitt | null>(null);
  const [offen, setOffen]         = useState(true);
  const [laden, setLaden]         = useState(false);
  const [zuletzt, setZuletzt]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    if (!locationId) return;
    setLaden(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-benchmark?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        setFahrer(json.fahrer ?? []);
        setSchnitt(json.team_schnitt ?? null);
        setZuletzt(json.generiert_am ?? null);
      }
    } catch {
      /* Mock-Daten bleiben im Server */
    } finally {
      setLaden(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch_]);

  const alerts = fahrer.filter((f) => f.unter_schnitt_alert);
  if (!locationId) return null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Schicht-Benchmark</span>
        {laden && <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin ml-1" />}
        {alerts.length > 0 && (
          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            {alerts.length} unter Schnitt ⚠
          </span>
        )}
        {offen
          ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-3 space-y-3">
          {/* Alert Banner */}
          {alerts.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-300">Leistungswarnung</p>
                <p className="text-xs text-red-600 dark:text-red-400">
                  {alerts.map((f) => f.fahrer_name).join(', ')} — mehr als 30 % unter Team-Schnitt.
                </p>
              </div>
            </div>
          )}

          {/* Tabelle */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1 pr-2 font-semibold">Fahrer</th>
                  <th className="text-right py-1 px-2 font-semibold">Stopps heute</th>
                  <th className="text-right py-1 px-2 font-semibold">Ø 7d</th>
                  <th className="text-right py-1 px-2 font-semibold">Verdienst</th>
                  <th className="text-right py-1 px-2 font-semibold">Pünktl.</th>
                  <th className="text-center py-1 pl-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {fahrer.map((f) => {
                  const StoppIcon = TREND_ICON[f.trend_stopps];
                  const VerdIcon  = TREND_ICON[f.trend_verdienst];
                  return (
                    <tr key={f.fahrer_id} className={cn(
                      'border-b last:border-0 hover:bg-muted/20 transition-colors',
                      f.unter_schnitt_alert && 'bg-red-50/50 dark:bg-red-950/10',
                    )}>
                      <td className="py-2 pr-2">
                        <span className="flex items-center gap-1.5">
                          {f.spitzenreiter && (
                            <Trophy className="h-3 w-3 text-amber-500 shrink-0" />
                          )}
                          <div className={cn('h-2 w-2 rounded-full shrink-0', AMPEL_DOT[f.ampel])} />
                          <span className="font-semibold truncate max-w-[90px]">{f.fahrer_name}</span>
                        </span>
                      </td>
                      <td className="text-right py-2 px-2">
                        <span className={cn('flex items-center justify-end gap-0.5', TREND_COLOR[f.trend_stopps])}>
                          <StoppIcon className="h-3 w-3" />
                          <span className="font-bold tabular-nums">{f.stopps_heute}</span>
                        </span>
                      </td>
                      <td className="text-right py-2 px-2 tabular-nums text-muted-foreground">
                        {f.stopps_7d_schnitt.toFixed(1)}
                      </td>
                      <td className="text-right py-2 px-2">
                        <span className={cn('flex items-center justify-end gap-0.5', TREND_COLOR[f.trend_verdienst])}>
                          <VerdIcon className="h-3 w-3" />
                          <span className="tabular-nums font-semibold">
                            {f.verdienst_eur_heute.toFixed(0)} €
                          </span>
                        </span>
                      </td>
                      <td className="text-right py-2 px-2">
                        <span className={cn(
                          'font-bold tabular-nums',
                          f.puenktlichkeit_pct >= 85 ? 'text-matcha-700 dark:text-matcha-300'
                            : f.puenktlichkeit_pct >= 70 ? 'text-amber-700 dark:text-amber-300'
                            : 'text-red-700 dark:text-red-300',
                        )}>
                          {f.puenktlichkeit_pct} %
                        </span>
                      </td>
                      <td className="text-center py-2 pl-2">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', AMPEL_BADGE[f.ampel])}>
                          {f.ampel === 'gruen' ? 'gut' : f.ampel === 'gelb' ? 'ok' : 'schwach'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {schnitt && (
                <tfoot>
                  <tr className="border-t bg-muted/20 text-muted-foreground">
                    <td className="py-1.5 pr-2 text-[10px] font-semibold">Ø Team</td>
                    <td className="text-right py-1.5 px-2 text-[10px] tabular-nums font-semibold">
                      {schnitt.stopps.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-2" />
                    <td className="text-right py-1.5 px-2 text-[10px] tabular-nums font-semibold">
                      {schnitt.verdienst_eur.toFixed(0)} €
                    </td>
                    <td className="text-right py-1.5 px-2 text-[10px] tabular-nums font-semibold">
                      {schnitt.puenktlichkeit_pct} %
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {zuletzt && (
            <p className="text-[10px] text-muted-foreground text-right">
              Stand: {new Date(zuletzt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 30-Min-Polling
            </p>
          )}
        </div>
      )}
    </div>
  );
}
