'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, Clock, Loader2, MapPin, TrendingDown, TrendingUp, Trophy } from 'lucide-react';

/**
 * Phase 925 — Tour-Effizienz-Live-Cockpit (Dispatch)
 *
 * Visualisiert Effizienz aller aktiven Touren als horizontale Score-Balken
 * mit Farbkodierung (Grün/Gelb/Rot) basierend auf:
 * - Stop-Pünktlichkeit
 * - km-Effizienz
 * - Fahrer-Score-Trend
 *
 * Polling alle 2 Min. Fallback auf Mock-Daten.
 */

interface TourRow {
  driver_id: string;
  fahrer_name: string;
  stops_gesamt: number;
  stops_erledigt: number;
  puenktlichkeit_pct: number;
  km_effizienz_score: number;
  gesamtscore: number;
  trend: 'up' | 'down' | 'stable';
  zone: string | null;
}

interface Props {
  locationId: string | null;
}

const MOCK: TourRow[] = [
  { driver_id: 'm1', fahrer_name: 'Tarkan A.', stops_gesamt: 4, stops_erledigt: 2, puenktlichkeit_pct: 94, km_effizienz_score: 88, gesamtscore: 91, trend: 'up', zone: 'A' },
  { driver_id: 'm2', fahrer_name: 'Lena M.', stops_gesamt: 3, stops_erledigt: 1, puenktlichkeit_pct: 78, km_effizienz_score: 82, gesamtscore: 80, trend: 'stable', zone: 'B' },
  { driver_id: 'm3', fahrer_name: 'Jörn K.', stops_gesamt: 5, stops_erledigt: 3, puenktlichkeit_pct: 61, km_effizienz_score: 70, gesamtscore: 65, trend: 'down', zone: 'C' },
];

function scoreColor(score: number): string {
  if (score >= 85) return 'bg-matcha-500';
  if (score >= 70) return 'bg-amber-400';
  return 'bg-red-400';
}

function scoreTextColor(score: number): string {
  if (score >= 85) return 'text-matcha-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-red-700';
}

function scoreBg(score: number): string {
  if (score >= 85) return 'bg-matcha-50 border-matcha-200';
  if (score >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

const POLL_MS = 2 * 60 * 1000;

export function DispatchPhase925TourEffizienzLiveCockpit({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TourRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-effizienz?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData((json.touren as TourRow[]) ?? MOCK);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const avgScore = data.length > 0
    ? Math.round(data.reduce((s, r) => s + r.gesamtscore, 0) / data.length)
    : 0;

  const topPerformer = data.length > 0
    ? data.reduce((best, r) => r.gesamtscore > best.gesamtscore ? r : best, data[0])
    : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Effizienz Live
          </span>
          {data.length > 0 && (
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              avgScore >= 85 ? 'bg-matcha-100 text-matcha-700'
              : avgScore >= 70 ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700',
            )}>
              Ø {avgScore} Punkte
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {/* Top-Performer Banner */}
          {topPerformer && topPerformer.gesamtscore >= 85 && (
            <div className="flex items-center gap-2 rounded-xl bg-matcha-50 border border-matcha-200 px-3 py-2">
              <Trophy className="h-4 w-4 text-matcha-600 shrink-0" />
              <span className="text-xs font-bold text-matcha-800">
                Bester Fahrer: {topPerformer.fahrer_name} · {topPerformer.gesamtscore} Punkte
              </span>
            </div>
          )}

          {/* Tour rows */}
          <div className="space-y-2">
            {data.map((row) => (
              <div
                key={row.driver_id}
                className={cn('rounded-xl border p-3 space-y-2', scoreBg(row.gesamtscore))}
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-stone-800">{row.fahrer_name}</span>
                    {row.zone && (
                      <span className="rounded-full bg-white border px-1.5 py-0.5 text-[9px] font-bold text-stone-600">
                        Zone {row.zone}
                      </span>
                    )}
                    {row.trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
                    {row.trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
                  </div>
                  <span className={cn('text-base font-black tabular-nums', scoreTextColor(row.gesamtscore))}>
                    {row.gesamtscore}
                  </span>
                </div>

                {/* Score bar */}
                <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', scoreColor(row.gesamtscore))}
                    style={{ width: `${row.gesamtscore}%` }}
                  />
                </div>

                {/* KPIs */}
                <div className="flex items-center gap-4 text-[10px] text-stone-500">
                  <span className="flex items-center gap-0.5">
                    <MapPin className="h-2.5 w-2.5" />
                    {row.stops_erledigt}/{row.stops_gesamt} Stopps
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {row.puenktlichkeit_pct}% pünktlich
                  </span>
                  <span className="flex items-center gap-0.5 text-matcha-600">
                    km {row.km_effizienz_score}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {data.length === 0 && !loading && locationId && (
            <p className="text-sm text-muted-foreground text-center py-3">
              Keine aktiven Touren.
            </p>
          )}

          {lastUpdate && (
            <p className="text-[9px] text-muted-foreground text-right">
              Stand: {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
