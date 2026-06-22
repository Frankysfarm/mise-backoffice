'use client';

/**
 * DispatchStornoMusterPanel — Phase 416
 *
 * Dispatch-Perspektive der Storno-Muster-Matrix:
 * Fokus auf kein_fahrer und zone_problem-Hotspots.
 * Zeigt, zu welchen Zeiten Stornos durch Fahrermangel/Zonenprobleme entstehen.
 */

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, ChevronDown, ChevronUp, MapPin, RefreshCw, XCircle } from 'lucide-react';

type StornoCause = 'kueche_verzoegerung' | 'kein_fahrer' | 'kunde_storniert' | 'zone_problem' | 'unbekannt';

interface StornoHotspot {
  dayOfWeek: number;
  hourOfDay: number;
  stornoRate: number;
  stornoCount: number;
  totalCount: number;
  qualityLabel: string;
  primaryCause: StornoCause | null;
  recommendation: string;
}

interface StornoMusterSummary {
  avgStornoRateTotal: number | null;
  maxStornoRate: number | null;
  hotspotCount: number;
  worstDayOfWeek: number | null;
  worstHourOfDay: number | null;
  dominantCause: StornoCause | null;
  totalStornosInMatrix: number;
  totalOrdersInMatrix: number;
}

interface StornoMusterDashboard {
  hotspots: StornoHotspot[];
  summary: StornoMusterSummary;
}

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DOW_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const CAUSE_COLORS: Record<StornoCause, { bg: string; text: string; icon: React.ReactNode }> = {
  kein_fahrer:         { bg: 'bg-red-50 border-red-200',    text: 'text-red-700',    icon: <Bike className="h-3 w-3" /> },
  zone_problem:        { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', icon: <MapPin className="h-3 w-3" /> },
  kueche_verzoegerung: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', icon: <AlertTriangle className="h-3 w-3" /> },
  kunde_storniert:     { bg: 'bg-amber-50 border-amber-200',  text: 'text-amber-700',  icon: <XCircle className="h-3 w-3" /> },
  unbekannt:           { bg: 'bg-gray-50 border-gray-200',   text: 'text-gray-600',   icon: <AlertTriangle className="h-3 w-3" /> },
};

const CAUSE_LABELS: Record<StornoCause, string> = {
  kein_fahrer:         'Kein Fahrer',
  zone_problem:        'Zonenprobleme',
  kueche_verzoegerung: 'Küche',
  kunde_storniert:     'Kunde',
  unbekannt:           'Unbekannt',
};

function pct(v: number | null) {
  if (v === null) return '–';
  return `${(v * 100).toFixed(1)}%`;
}

export function DispatchStornoMusterPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<StornoMusterDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/storno-muster-matrix?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        setData(await res.json() as StornoMusterDashboard);
        setLastFetch(new Date());
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  if (!locationId) return null;

  const dispatchHotspots = data?.hotspots.filter(
    (h) => h.primaryCause === 'kein_fahrer' || h.primaryCause === 'zone_problem',
  ) ?? [];

  const summary = data?.summary;

  // Current-hour awareness
  const now = new Date();
  const currentDow = now.getDay();
  const currentHour = now.getHours();
  const currentAlert = dispatchHotspots.find(
    (h) => h.dayOfWeek === currentDow && h.hourOfDay === currentHour,
  );

  const hasDispatchCritical = dispatchHotspots.length > 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition"
      >
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-bold text-sm flex-1 text-left">Storno-Muster (Dispatch)</span>
        <div className="flex items-center gap-2">
          {summary && (
            <span className="text-xs font-black tabular-nums text-muted-foreground">
              {pct(summary.avgStornoRateTotal)} Ø
            </span>
          )}
          {hasDispatchCritical && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              {dispatchHotspots.length} Dispatch-Hot.
            </span>
          )}
          {loading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-4">
          {/* Current-hour alert */}
          {currentAlert && (
            <div className={cn(
              'flex items-start gap-2 rounded-xl border px-3 py-2.5',
              currentAlert.primaryCause ? CAUSE_COLORS[currentAlert.primaryCause].bg : 'bg-muted/40 border',
            )}>
              <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', currentAlert.primaryCause ? CAUSE_COLORS[currentAlert.primaryCause].text : 'text-muted-foreground')} />
              <div>
                <div className={cn('text-xs font-bold', currentAlert.primaryCause ? CAUSE_COLORS[currentAlert.primaryCause].text : '')}>
                  Jetzt — {DOW_FULL[currentAlert.dayOfWeek]} {currentAlert.hourOfDay}:00 Uhr — historischer Hotspot
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{currentAlert.recommendation}</div>
              </div>
            </div>
          )}

          {/* Summary row */}
          {summary && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Dispatch-Hotspots', value: dispatchHotspots.length.toString(), color: dispatchHotspots.length > 0 ? 'text-red-600' : 'text-emerald-600' },
                { label: 'Max Stornorate', value: pct(summary.maxStornoRate), color: 'text-red-600' },
                { label: 'Ø Stornorate', value: pct(summary.avgStornoRateTotal), color: 'text-foreground' },
              ].map((k) => (
                <div key={k.label} className="bg-muted/40 rounded-lg p-2.5 text-center">
                  <div className={cn('text-base font-black tabular-nums', k.color)}>{k.value}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{k.label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dispatch-relevant hotspot list */}
          {dispatchHotspots.length > 0 ? (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Fahrer- & Zonen-Hotspots
              </div>
              <div className="space-y-1.5">
                {dispatchHotspots.slice(0, 6).map((h) => {
                  const cfg = h.primaryCause ? CAUSE_COLORS[h.primaryCause] : CAUSE_COLORS.unbekannt;
                  return (
                    <div
                      key={`${h.dayOfWeek}-${h.hourOfDay}`}
                      className={cn('flex items-center gap-3 rounded-lg border px-3 py-2', cfg.bg)}
                    >
                      <div className={cn('shrink-0', cfg.text)}>{cfg.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold">{DOW[h.dayOfWeek]} {h.hourOfDay}:00</span>
                          {h.primaryCause && (
                            <span className={cn('text-[9px] font-bold', cfg.text)}>
                              {CAUSE_LABELS[h.primaryCause]}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">{h.recommendation}</div>
                      </div>
                      <div className={cn('shrink-0 text-sm font-black tabular-nums', cfg.text)}>
                        {(h.stornoRate * 100).toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            !loading && (
              <div className="text-center py-4 text-[12px] text-emerald-600 font-medium">
                Keine Dispatch-Hotspots (Fahrer/Zone) gefunden.
              </div>
            )
          )}

          {/* Worst day/hour info */}
          {summary != null && summary.worstDayOfWeek !== null && summary.worstHourOfDay !== null && (
            <div className="border-t pt-3 text-xs text-muted-foreground">
              Schlechteste Zeit gesamt: <span className="font-bold text-foreground">
                {DOW_FULL[summary.worstDayOfWeek!]} {summary.worstHourOfDay}:00 Uhr
              </span>
              {summary.dominantCause && (
                <span> · Häufigste Ursache: <span className="font-bold">{CAUSE_LABELS[summary.dominantCause]}</span></span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
            >
              <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
              Aktualisieren
            </button>
            {lastFetch && (
              <span className="text-[10px] text-muted-foreground">
                Stand {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
