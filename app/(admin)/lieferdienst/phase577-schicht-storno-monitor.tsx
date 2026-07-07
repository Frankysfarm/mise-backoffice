'use client';

/**
 * Phase 577 — Lieferdienst: Schicht-Storno-Monitor
 *
 * Live-Übersicht der Stornierungen in der aktuellen Schicht.
 * Alert wenn Storno-Rate >5%.
 *
 * Metriken:
 * - Stornierungen heute gesamt
 * - Storno-Rate % (vs. Gesamtbestellungen)
 * - Letzte 5 Stornierungen mit Bestellnummer + Zeit
 * - Trend: steigt/fällt vs. letzten 2h
 *
 * 60s Auto-Refresh via fetch
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, RefreshCw, TrendingDown, TrendingUp, XCircle } from 'lucide-react';

interface CancelledOrder {
  id: string;
  bestellnummer: string;
  storniert_am: string | null;
  created_at: string;
  storno_grund?: string | null;
  gesamtbetrag?: number;
}

interface ApiResponse {
  ok: boolean;
  storniert: CancelledOrder[];
  gesamtBestellungen: number;
  stornoRate: number;
  stornoRateVorherig: number;
}

interface Props {
  locationId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min`;
  return `vor ${Math.floor(min / 60)} h`;
}

export function LieferdienstPhase577SchichtStornoMonitor({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/storno-analyse?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData({
          ok: json.ok,
          storniert: json.cancelled ?? json.storniert ?? [],
          gesamtBestellungen: json.totalOrders ?? json.gesamtBestellungen ?? 0,
          stornoRate: json.cancellationRate ?? json.stornoRate ?? 0,
          stornoRateVorherig: json.prevCancellationRate ?? json.stornoRateVorherig ?? 0,
        });
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
      setLastUpdate(Date.now());
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  const ratePct = data?.stornoRate ?? 0;
  const prevRatePct = data?.stornoRateVorherig ?? 0;
  const stornoCount = data?.storniert?.length ?? 0;
  const isHigh = ratePct >= 5;
  const isRising = ratePct > prevRatePct + 0.5;
  const isFalling = ratePct < prevRatePct - 0.5;

  const recent = useMemo(() => {
    if (!data?.storniert) return [];
    return [...data.storniert]
      .sort((a, b) => new Date(b.storniert_am ?? b.created_at).getTime() - new Date(a.storniert_am ?? a.created_at).getTime())
      .slice(0, 5);
  }, [data]);

  return (
    <Card className={cn('overflow-hidden border', isHigh && 'border-red-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition', isHigh && 'bg-red-50')}
      >
        <div className="flex items-center gap-2">
          <XCircle className={cn('h-4 w-4', isHigh ? 'text-red-600' : 'text-slate-500')} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Storno-Monitor</span>
          <Badge className={cn('text-[10px] px-2 py-0.5', isHigh ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-700')}>
            {ratePct.toFixed(1)}%
          </Badge>
          {isHigh && (
            <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 animate-pulse">
              ⚠ Hoch
            </Badge>
          )}
          {isRising && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
          {isFalling && <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />}
        </div>
        <div className="flex items-center gap-2">
          {loading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Alert banner */}
          {isHigh && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 border border-red-300 px-3 py-2">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700">
                Storno-Rate über 5% — Ursache prüfen!
              </span>
            </div>
          )}

          {/* Summary tiles */}
          <div className="grid grid-cols-3 gap-2">
            <div className={cn('rounded-lg border p-2 text-center', isHigh ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
              <div className={cn('text-2xl font-black tabular-nums', isHigh ? 'text-red-700' : 'text-slate-700')}>
                {stornoCount}
              </div>
              <div className="text-[10px] text-muted-foreground">Stornos heute</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
              <div className="text-2xl font-black tabular-nums text-slate-700">{data?.gesamtBestellungen ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">Bestellungen</div>
            </div>
            <div className={cn('rounded-lg border p-2 text-center', isHigh ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200')}>
              <div className={cn('text-2xl font-black tabular-nums', isHigh ? 'text-red-700' : 'text-emerald-700')}>
                {ratePct.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">Storno-Rate</div>
            </div>
          </div>

          {/* Trend */}
          {prevRatePct > 0 && (
            <div className={cn('flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5',
              isRising ? 'bg-red-50 text-red-700' : isFalling ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'
            )}>
              {isRising ? <TrendingUp className="h-3.5 w-3.5" /> : isFalling ? <TrendingDown className="h-3.5 w-3.5" /> : null}
              <span className="font-medium">
                {isRising ? 'Steigende Tendenz' : isFalling ? 'Sinkende Tendenz' : 'Stabil'} — vorherig: {prevRatePct.toFixed(1)}%
              </span>
            </div>
          )}

          {/* Recent cancellations */}
          {recent.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Letzte Stornos</div>
              <div className="space-y-1">
                {recent.map(o => (
                  <div key={o.id} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-xs font-bold text-slate-700">#{o.bestellnummer}</span>
                      {o.storno_grund && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{o.storno_grund}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {o.gesamtbetrag != null && (
                        <span className="text-[10px] text-muted-foreground tabular-nums">{o.gesamtbetrag.toFixed(2)} €</span>
                      )}
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(o.storniert_am ?? o.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data && !loading && (
            <p className="text-sm text-muted-foreground text-center py-2">Keine Daten verfügbar</p>
          )}

          {lastUpdate && (
            <div className="text-[9px] text-muted-foreground text-right">
              Stand: {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
