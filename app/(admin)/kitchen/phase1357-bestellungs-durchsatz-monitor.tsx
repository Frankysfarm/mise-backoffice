'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Loader2, RefreshCw, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1357 — Bestellungs-Durchsatz-Monitor (Kitchen)
 *
 * Zeigt Phase1356-API: Stunden-Balken heute vs. gestern + Peak + Prognose nächste 2h.
 * 5-Min-Polling. Nach Phase1352 in kitchen/client.tsx.
 */

interface StundenEintrag {
  stunde: number;
  label: string;
  heute: number;
  gestern: number;
}

interface ApiData {
  stunden: StundenEintrag[];
  peak_stunde: number | null;
  peak_anzahl: number;
  gesamt_heute: number;
  gesamt_gestern: number;
  prognose_naechste_2h: number;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const POLL_MS = 5 * 60 * 1000;
const VISIBLE_HOURS = 12;

export function KitchenPhase1357BestellungsDurchsatzMonitor({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const laden = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/bestellungs-durchsatz?location_id=${locationId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ApiData = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, POLL_MS);
    return () => clearInterval(id);
  }, [laden]);

  const currentHour = new Date().getHours();

  const visibleStunden = data
    ? data.stunden
        .filter(s => s.stunde >= Math.max(0, currentHour - VISIBLE_HOURS + 1) && s.stunde <= currentHour)
    : [];

  const maxVal = Math.max(1, ...visibleStunden.flatMap(s => [s.heute, s.gestern]));

  const trend = data
    ? data.gesamt_heute > data.gesamt_gestern
      ? 'mehr'
      : data.gesamt_heute < data.gesamt_gestern
      ? 'weniger'
      : 'gleich'
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-bold">Bestellungs-Durchsatz</span>
        <button
          onClick={laden}
          disabled={loading}
          className="ml-auto rounded-md p-1 hover:bg-muted transition"
          title="Aktualisieren"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {!locationId && (
        <p className="text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
      )}

      {data && (
        <>
          {/* KPI-Zeile */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Heute</p>
              <p className="text-base font-bold tabular-nums text-foreground">{data.gesamt_heute}</p>
            </div>
            <div className="rounded-lg bg-muted/40 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">Gestern</p>
              <p className="text-base font-bold tabular-nums text-muted-foreground">{data.gesamt_gestern}</p>
            </div>
            <div className="rounded-lg bg-primary/10 px-2 py-1.5 text-center">
              <p className="text-[10px] text-muted-foreground">+2h Prognose</p>
              <p className="text-base font-bold tabular-nums text-primary">{data.prognose_naechste_2h}</p>
            </div>
          </div>

          {/* Trend */}
          {trend && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs rounded-md px-2 py-1',
              trend === 'mehr'   ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' :
              trend === 'weniger' ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400' :
                                   'bg-muted/40 text-muted-foreground'
            )}>
              <TrendingUp className="h-3 w-3 shrink-0" />
              <span>
                {trend === 'mehr'    ? `+${data.gesamt_heute - data.gesamt_gestern} Bestellungen mehr als gestern` :
                 trend === 'weniger' ? `${data.gesamt_gestern - data.gesamt_heute} Bestellungen weniger als gestern` :
                                      'Gleich wie gestern'}
              </span>
            </div>
          )}

          {/* Stunden-Balken */}
          {visibleStunden.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-muted-foreground font-medium">Letzte {visibleStunden.length}h</p>
              <div className="flex items-end gap-0.5 h-14">
                {visibleStunden.map(s => (
                  <div key={s.stunde} className="flex-1 flex flex-col items-center gap-0.5">
                    <div className="w-full flex flex-col justify-end h-11 gap-0.5">
                      <div
                        className={cn(
                          'w-full rounded-t-sm transition-all',
                          data.peak_stunde === s.stunde
                            ? 'bg-primary'
                            : s.stunde === currentHour
                            ? 'bg-primary/70'
                            : 'bg-primary/40'
                        )}
                        style={{ height: `${Math.round((s.heute / maxVal) * 44)}px` }}
                        title={`${s.label}: ${s.heute} heute / ${s.gestern} gestern`}
                      />
                    </div>
                    <span className={cn(
                      'text-[8px] tabular-nums',
                      s.stunde === currentHour ? 'font-bold text-primary' : 'text-muted-foreground'
                    )}>
                      {s.stunde}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-primary" /> Heute</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-muted-foreground/40" /> Gestern (Balken nicht sichtbar)</span>
              </div>
            </div>
          )}

          {/* Peak */}
          {data.peak_stunde !== null && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>
                Peak heute: <span className="font-bold text-foreground">{String(data.peak_stunde).padStart(2, '0')}:00 Uhr</span>
                {' '}mit <span className="font-bold text-foreground">{data.peak_anzahl}</span> Bestellungen
              </span>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground">
            Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · 5-Min-Polling
          </p>
        </>
      )}
    </div>
  );
}
