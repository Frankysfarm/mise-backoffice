'use client';

/**
 * StornoMusterHeatmap — Phase 416
 *
 * 7×24-Heatmap der Stornierungsraten je Wochentag × Stunde.
 * Zeigt Hotspot-Zellen, Summary-KPIs und Empfehlungen.
 * Basiert auf lib/delivery/storno-muster-matrix.ts
 */

import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, ChevronDown, ChevronUp, RefreshCw, TrendingDown, TrendingUp, XCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type StornoQualityLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'keine_daten';
type StornoCause = 'kueche_verzoegerung' | 'kein_fahrer' | 'kunde_storniert' | 'zone_problem' | 'unbekannt';

interface StornoMusterZelle {
  dayOfWeek: number;
  hourOfDay: number;
  stornoRate: number | null;
  stornoCount: number;
  totalCount: number;
  weeksUsed: number;
  primaryCause: StornoCause | null;
  qualityLabel: StornoQualityLabel;
  isHotspot: boolean;
}

interface StornoMusterSummary {
  locationId: string;
  avgStornoRateTotal: number | null;
  maxStornoRate: number | null;
  minStornoRate: number | null;
  hotspotCount: number;
  totalCellsWithData: number;
  totalStornosInMatrix: number;
  totalOrdersInMatrix: number;
  worstDayOfWeek: number | null;
  worstHourOfDay: number | null;
  bestDayOfWeek: number | null;
  bestHourOfDay: number | null;
  overallQualityLabel: StornoQualityLabel;
  dominantCause: StornoCause | null;
  computedAt: string;
}

interface StornoHotspot {
  dayOfWeek: number;
  hourOfDay: number;
  stornoRate: number;
  stornoCount: number;
  totalCount: number;
  qualityLabel: StornoQualityLabel;
  primaryCause: StornoCause | null;
  recommendation: string;
}

interface StornoMusterDashboard {
  locationId: string;
  matrix: StornoMusterZelle[][];
  hotspots: StornoHotspot[];
  summary: StornoMusterSummary;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOW = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DOW_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const QUALITY_COLORS: Record<StornoQualityLabel, string> = {
  excellent:  'bg-emerald-500',
  good:       'bg-green-400',
  fair:       'bg-amber-400',
  poor:       'bg-orange-500',
  critical:   'bg-red-600',
  keine_daten:'bg-muted/40',
};

const CAUSE_LABELS: Record<StornoCause, string> = {
  kueche_verzoegerung: 'Küche',
  kein_fahrer:         'Kein Fahrer',
  kunde_storniert:     'Kunde',
  zone_problem:        'Zone',
  unbekannt:           'Unbekannt',
};

const CAUSE_COLORS: Record<StornoCause, string> = {
  kueche_verzoegerung: 'bg-orange-100 text-orange-800',
  kein_fahrer:         'bg-red-100 text-red-800',
  kunde_storniert:     'bg-amber-100 text-amber-800',
  zone_problem:        'bg-violet-100 text-violet-800',
  unbekannt:           'bg-gray-100 text-gray-700',
};

const QUALITY_LABELS: Record<StornoQualityLabel, string> = {
  excellent:  'Exzellent (<3%)',
  good:       'Gut (<6%)',
  fair:       'Mäßig (<10%)',
  poor:       'Schlecht (<15%)',
  critical:   'Kritisch (≥15%)',
  keine_daten:'Keine Daten',
};

// ── Helper ───────────────────────────────────────────────────────────────────

function pct(v: number | null) {
  if (v === null) return '–';
  return `${(v * 100).toFixed(1)}%`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function StornoMusterHeatmap({ locationId }: { locationId: string }) {
  const [data, setData] = useState<StornoMusterDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [computing, setComputing] = useState(false);
  const [tooltip, setTooltip] = useState<{ cell: StornoMusterZelle; x: number; y: number } | null>(null);
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

  const handleCompute = async () => {
    setComputing(true);
    try {
      const res = await fetch('/api/delivery/admin/storno-muster-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId }),
      });
      if (res.ok) await load();
    } finally {
      setComputing(false);
    }
  };

  const summary = data?.summary;
  const overallColor =
    summary?.overallQualityLabel === 'excellent' ? 'text-emerald-600' :
    summary?.overallQualityLabel === 'good'      ? 'text-green-600'   :
    summary?.overallQualityLabel === 'fair'      ? 'text-amber-600'   :
    summary?.overallQualityLabel === 'poor'      ? 'text-orange-600'  :
    summary?.overallQualityLabel === 'critical'  ? 'text-red-600'     :
    'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition"
      >
        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
        <span className="font-bold text-sm flex-1 text-left">Storno-Muster-Heatmap</span>
        <div className="flex items-center gap-2">
          {summary && (
            <span className={cn('text-sm font-black tabular-nums', overallColor)}>
              {pct(summary.avgStornoRateTotal)} Ø
            </span>
          )}
          {summary && summary.hotspotCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
              {summary.hotspotCount} Hotspot{summary.hotspotCount !== 1 ? 's' : ''}
            </span>
          )}
          {loading && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-5">
          {/* Summary KPIs */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: 'Ø Stornorate',
                  value: pct(summary.avgStornoRateTotal),
                  sub: QUALITY_LABELS[summary.overallQualityLabel],
                  color: overallColor,
                  border: `border-l-4 ${
                    summary.overallQualityLabel === 'excellent' ? 'border-l-emerald-400' :
                    summary.overallQualityLabel === 'good'      ? 'border-l-green-400'   :
                    summary.overallQualityLabel === 'fair'      ? 'border-l-amber-400'   :
                    summary.overallQualityLabel === 'poor'      ? 'border-l-orange-400'  :
                    'border-l-red-400'
                  }`,
                },
                {
                  label: 'Hotspots',
                  value: summary.hotspotCount.toString(),
                  sub: 'Problemzellen (≥15%)',
                  color: summary.hotspotCount > 0 ? 'text-red-600' : 'text-emerald-600',
                  border: summary.hotspotCount > 0 ? 'border-l-4 border-l-red-400' : 'border-l-4 border-l-emerald-400',
                },
                {
                  label: 'Schlechteste Zeit',
                  value: summary.worstDayOfWeek !== null && summary.worstHourOfDay !== null
                    ? `${DOW[summary.worstDayOfWeek]} ${summary.worstHourOfDay}:00`
                    : '–',
                  sub: `Max ${pct(summary.maxStornoRate)}`,
                  color: 'text-red-600',
                  border: 'border-l-4 border-l-red-200',
                },
                {
                  label: 'Stornos gesamt',
                  value: summary.totalStornosInMatrix.toLocaleString('de-DE'),
                  sub: `von ${summary.totalOrdersInMatrix.toLocaleString('de-DE')} Bestellungen`,
                  color: 'text-foreground',
                  border: 'border-l-4 border-l-muted',
                },
              ].map((kpi) => (
                <div key={kpi.label} className={cn('bg-muted/40 rounded-xl p-3', kpi.border)}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</div>
                  <div className={cn('text-xl font-black tabular-nums mt-0.5', kpi.color)}>{kpi.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* Dominant Cause */}
          {summary?.dominantCause && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Häufigste Ursache:</span>
              <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold', CAUSE_COLORS[summary.dominantCause])}>
                {CAUSE_LABELS[summary.dominantCause]}
              </span>
            </div>
          )}

          {/* 7×24 Heatmap */}
          {data?.matrix && data.matrix.length === 7 && (
            <div className="overflow-x-auto">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                7×24 Storno-Heatmap (Wochentag × Stunde)
              </div>
              <div className="relative" onMouseLeave={() => setTooltip(null)}>
                {/* Hour labels */}
                <div className="flex mb-1 ml-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="text-center text-[8px] text-muted-foreground"
                      style={{ width: 20, minWidth: 20 }}
                    >
                      {h % 4 === 0 ? `${h}` : ''}
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {data.matrix.map((row, dow) => (
                  <div key={dow} className="flex items-center mb-0.5">
                    <div className="text-[9px] font-bold text-muted-foreground mr-1 w-7 text-right shrink-0">
                      {DOW[dow]}
                    </div>
                    {row.map((cell) => (
                      <div
                        key={cell.hourOfDay}
                        className={cn(
                          'relative rounded-sm cursor-pointer transition-transform hover:scale-110',
                          QUALITY_COLORS[cell.qualityLabel],
                          cell.isHotspot && 'ring-1 ring-red-700 ring-offset-0',
                        )}
                        style={{ width: 20, height: 16, minWidth: 20 }}
                        onMouseEnter={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setTooltip({ cell, x: rect.left, y: rect.bottom });
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-3">
                {(Object.keys(QUALITY_COLORS) as StornoQualityLabel[])
                  .filter((k) => k !== 'keine_daten')
                  .map((label) => (
                    <div key={label} className="flex items-center gap-1">
                      <div className={cn('w-3 h-3 rounded-sm', QUALITY_COLORS[label])} />
                      <span className="text-[9px] text-muted-foreground">{QUALITY_LABELS[label]}</span>
                    </div>
                  ))}
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm bg-gray-200 ring-1 ring-red-700 ring-offset-0" />
                  <span className="text-[9px] text-muted-foreground">Hotspot</span>
                </div>
              </div>
            </div>
          )}

          {/* Tooltip */}
          {tooltip && (
            <div className="mt-2 p-3 rounded-xl bg-muted/60 border text-xs space-y-1 max-w-xs">
              <div className="font-bold">
                {DOW_FULL[tooltip.cell.dayOfWeek]}, {tooltip.cell.hourOfDay}:00–{tooltip.cell.hourOfDay + 1}:00
              </div>
              <div>Stornorate: <span className="font-bold">{pct(tooltip.cell.stornoRate)}</span></div>
              <div>Stornos: {tooltip.cell.stornoCount} / {tooltip.cell.totalCount} Bestellungen</div>
              {tooltip.cell.primaryCause && (
                <div>Ursache: <span className={cn('px-1 py-0.5 rounded text-[10px] font-bold', CAUSE_COLORS[tooltip.cell.primaryCause])}>
                  {CAUSE_LABELS[tooltip.cell.primaryCause]}
                </span></div>
              )}
              {tooltip.cell.isHotspot && (
                <div className="flex items-center gap-1 text-red-600 font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  Hotspot — chronisch hohe Stornorate
                </div>
              )}
              <div className="text-[10px] text-muted-foreground">Analysiert über {tooltip.cell.weeksUsed} Wochen</div>
            </div>
          )}

          {/* Hotspot List */}
          {data?.hotspots && data.hotspots.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3 w-3 text-red-500" />
                Hotspot-Analyse — Empfehlungen
              </div>
              <div className="space-y-2">
                {data.hotspots.slice(0, 5).map((h) => (
                  <div key={`${h.dayOfWeek}-${h.hourOfDay}`}
                    className="flex gap-3 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5"
                  >
                    <div className="shrink-0 text-center min-w-[3rem]">
                      <div className="text-xs font-black text-red-600">{pct(h.stornoRate)}</div>
                      <div className="text-[9px] text-muted-foreground">{DOW[h.dayOfWeek]} {h.hourOfDay}:00</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-foreground">{h.recommendation}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        {h.primaryCause && (
                          <span className={cn('px-1.5 py-0.5 rounded-full text-[9px] font-bold', CAUSE_COLORS[h.primaryCause])}>
                            {CAUSE_LABELS[h.primaryCause]}
                          </span>
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          {h.stornoCount} Stornos / {h.totalCount} Best.
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data && !loading && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <p className="mb-3">Noch keine Storno-Matrix berechnet.</p>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="px-4 py-2 rounded-lg bg-matcha-600 text-white text-xs font-bold hover:bg-matcha-700 disabled:opacity-50 transition flex items-center gap-2 mx-auto"
              >
                {computing && <RefreshCw className="h-3 w-3 animate-spin" />}
                Matrix berechnen (8 Wochen)
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-2">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                Aktualisieren
              </button>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition"
              >
                {computing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <TrendingUp className="h-3 w-3" />}
                Neu berechnen
              </button>
            </div>
            {lastFetch && (
              <div className="text-[10px] text-muted-foreground">
                Stand {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
