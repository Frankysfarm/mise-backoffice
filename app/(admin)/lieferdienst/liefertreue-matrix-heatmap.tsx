'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Clock } from 'lucide-react';

// ── Types (mirrored from lib/delivery/liefertreue-matrix.ts) ─────────────────

type QualityLabel = 'excellent' | 'good' | 'fair' | 'poor' | 'critical' | 'keine_daten';

interface LiefertreueZelle {
  dayOfWeek: number;
  hourOfDay: number;
  onTimeRate: number | null;
  avgDeliveryMin: number | null;
  orderCount: number;
  weeksUsed: number;
  qualityLabel: QualityLabel;
  isHotspot: boolean;
}

interface LiefertreueMatrixSummary {
  locationId: string;
  avgOnTimeRateTotal: number | null;
  minOnTimeRate: number | null;
  maxOnTimeRate: number | null;
  hotspotCount: number;
  worstDayOfWeek: number | null;
  worstHourOfDay: number | null;
  bestDayOfWeek: number | null;
  bestHourOfDay: number | null;
  overallQualityLabel: QualityLabel;
}

interface LiefertreueHotspot {
  dayOfWeek: number;
  hourOfDay: number;
  onTimeRate: number;
  avgDeliveryMin: number | null;
  orderCount: number;
  qualityLabel: QualityLabel;
  recommendation: string;
}

interface LiefertreueMatrixDashboard {
  locationId: string;
  matrix: LiefertreueZelle[][];
  hotspots: LiefertreueHotspot[];
  summary: LiefertreueMatrixSummary;
  computedAt: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DOW_LABELS_FULL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const QUALITY_COLORS: Record<QualityLabel, string> = {
  excellent:   'bg-emerald-500',
  good:        'bg-green-400',
  fair:        'bg-yellow-400',
  poor:        'bg-orange-500',
  critical:    'bg-red-600',
  keine_daten: 'bg-stone-200',
};

const QUALITY_TEXT: Record<QualityLabel, string> = {
  excellent:   'Exzellent ≥85%',
  good:        'Gut ≥70%',
  fair:        'Befriedigend ≥55%',
  poor:        'Schwach ≥40%',
  critical:    'Kritisch <40%',
  keine_daten: 'Keine Daten',
};

const QUALITY_BADGE_CLS: Record<QualityLabel, string> = {
  excellent:   'bg-emerald-100 text-emerald-800',
  good:        'bg-green-100 text-green-800',
  fair:        'bg-yellow-100 text-yellow-800',
  poor:        'bg-orange-100 text-orange-800',
  critical:    'bg-red-100 text-red-800',
  keine_daten: 'bg-stone-100 text-stone-500',
};

function pct(rate: number | null): string {
  if (rate === null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function hourLabel(h: number): string {
  return `${h.toString().padStart(2, '0')}`;
}

// ── Tooltip ──────────────────────────────────────────────────────────────────

interface TooltipInfo {
  zelle: LiefertreueZelle;
  x: number;
  y: number;
}

function HeatmapTooltip({ info, onClose }: { info: TooltipInfo; onClose: () => void }) {
  const { zelle } = info;
  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: info.x + 12, top: info.y - 8 }}
    >
      <div className="rounded-xl border border-stone-200 bg-white shadow-lg p-3 min-w-[160px]">
        <div className="font-bold text-xs text-stone-700 mb-1">
          {DOW_LABELS_FULL[zelle.dayOfWeek]} · {hourLabel(zelle.hourOfDay)}:00–{hourLabel(zelle.hourOfDay + 1)}:00
        </div>
        <div className="text-xs text-stone-500 space-y-0.5">
          <div>Pünktlichkeit: <span className="font-semibold text-stone-800">{pct(zelle.onTimeRate)}</span></div>
          {zelle.avgDeliveryMin !== null && (
            <div>Ø Lieferzeit: <span className="font-semibold text-stone-800">{Math.round(zelle.avgDeliveryMin)} min</span></div>
          )}
          <div>Bestellungen: <span className="font-semibold text-stone-800">{zelle.orderCount}</span></div>
          {zelle.isHotspot && (
            <div className="text-red-600 font-bold flex items-center gap-1 mt-1">
              <AlertTriangle className="h-3 w-3" /> Hotspot
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Heatmap Grid ─────────────────────────────────────────────────────────────

function HeatmapGrid({ matrix }: { matrix: LiefertreueZelle[][] }) {
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  if (!matrix || matrix.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Hour headers */}
        <div className="flex mb-0.5 pl-8">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className={cn(
                'flex-1 text-center text-[8px] font-mono text-stone-400 leading-none py-0.5',
                h % 4 === 0 ? 'text-stone-600 font-bold' : '',
              )}
            >
              {h % 4 === 0 ? hourLabel(h) : ''}
            </div>
          ))}
        </div>

        {/* Rows = days */}
        {Array.from({ length: 7 }, (_, dow) => {
          const row: LiefertreueZelle[] = matrix[dow] ?? [];
          return (
            <div key={dow} className="flex items-center mb-0.5 gap-0.5">
              <div className="w-7 text-right text-[9px] font-bold text-stone-500 pr-1 shrink-0">
                {DOW_LABELS[dow]}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const zelle = row[h];
                if (!zelle) return (
                  <div key={h} className="flex-1 h-5 rounded-sm bg-stone-100" />
                );
                return (
                  <div
                    key={h}
                    className={cn(
                      'flex-1 h-5 rounded-sm cursor-pointer transition-opacity hover:opacity-80 relative',
                      QUALITY_COLORS[zelle.qualityLabel],
                      zelle.isHotspot ? 'ring-1 ring-red-800 ring-inset' : '',
                    )}
                    onMouseEnter={(e) => setTooltip({ zelle, x: e.clientX, y: e.clientY })}
                    onMouseMove={(e) => setTooltip({ zelle, x: e.clientX, y: e.clientY })}
                    onMouseLeave={() => setTooltip(null)}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-stone-100">
          {(Object.entries(QUALITY_COLORS) as [QualityLabel, string][]).map(([label, cls]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={cn('w-3 h-3 rounded-sm', cls)} />
              <span className="text-[9px] text-stone-500">{QUALITY_TEXT[label]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm bg-stone-400 ring-1 ring-red-800 ring-inset" />
            <span className="text-[9px] text-stone-500">Hotspot</span>
          </div>
        </div>
      </div>

      {tooltip && <HeatmapTooltip info={tooltip} onClose={() => setTooltip(null)} />}
    </div>
  );
}

// ── Hotspot List ──────────────────────────────────────────────────────────────

function HotspotList({ hotspots }: { hotspots: LiefertreueHotspot[] }) {
  if (hotspots.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-stone-400">
        Keine Hotspots — alle Zeitfenster mit ausreichend Daten sind in Ordnung.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {hotspots.slice(0, 5).map((h, i) => (
        <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100">
          <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs text-red-800">
                {DOW_LABELS_FULL[h.dayOfWeek]} {hourLabel(h.hourOfDay)}:00–{hourLabel(h.hourOfDay + 1)}:00
              </span>
              <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', QUALITY_BADGE_CLS[h.qualityLabel])}>
                {pct(h.onTimeRate)} Pünktlichkeit
              </span>
              {h.avgDeliveryMin !== null && (
                <span className="text-[9px] text-stone-500">Ø {Math.round(h.avgDeliveryMin)} min</span>
              )}
              <span className="text-[9px] text-stone-400">{h.orderCount} Bestellungen</span>
            </div>
            <div className="text-[10px] text-stone-600 mt-0.5">{h.recommendation}</div>
          </div>
        </div>
      ))}
      {hotspots.length > 5 && (
        <div className="text-xs text-stone-400 text-center">+{hotspots.length - 5} weitere Hotspots</div>
      )}
    </div>
  );
}

// ── Summary Bar ───────────────────────────────────────────────────────────────

function SummaryBar({ summary }: { summary: LiefertreueMatrixSummary }) {
  const avgRate = summary.avgOnTimeRateTotal;
  const pctWidth = avgRate !== null ? Math.round(avgRate * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
      {/* Gesamt-Pünktlichkeit */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Gesamt-Pünktlichkeit</div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-black text-stone-800">{pct(avgRate)}</span>
          <span className={cn('mb-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold', QUALITY_BADGE_CLS[summary.overallQualityLabel])}>
            {summary.overallQualityLabel === 'keine_daten' ? 'Keine Daten' : summary.overallQualityLabel}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-stone-200 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', QUALITY_COLORS[summary.overallQualityLabel])}
            style={{ width: `${pctWidth}%` }}
          />
        </div>
      </div>

      {/* Hotspots */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Hotspots</div>
        <div className="flex items-center gap-2">
          <span className={cn('text-2xl font-black', summary.hotspotCount > 0 ? 'text-red-600' : 'text-emerald-600')}>
            {summary.hotspotCount}
          </span>
          {summary.hotspotCount > 0
            ? <AlertTriangle className="h-4 w-4 text-red-500" />
            : <TrendingUp className="h-4 w-4 text-emerald-500" />
          }
        </div>
        <div className="text-[10px] text-stone-400 mt-1">kritische Zeitfenster</div>
      </div>

      {/* Schlechtestes Fenster */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Schlechtestes Fenster</div>
        {summary.worstDayOfWeek !== null && summary.worstHourOfDay !== null ? (
          <>
            <div className="flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="font-bold text-xs text-stone-700">
                {DOW_LABELS_FULL[summary.worstDayOfWeek]} {hourLabel(summary.worstHourOfDay)}:00
              </span>
            </div>
            <div className="text-[10px] text-stone-400 mt-1">Min: {pct(summary.minOnTimeRate)}</div>
          </>
        ) : (
          <div className="text-xs text-stone-400">—</div>
        )}
      </div>

      {/* Bestes Fenster */}
      <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
        <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-1">Bestes Fenster</div>
        {summary.bestDayOfWeek !== null && summary.bestHourOfDay !== null ? (
          <>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="font-bold text-xs text-stone-700">
                {DOW_LABELS_FULL[summary.bestDayOfWeek]} {hourLabel(summary.bestHourOfDay)}:00
              </span>
            </div>
            <div className="text-[10px] text-stone-400 mt-1">Max: {pct(summary.maxOnTimeRate)}</div>
          </>
        ) : (
          <div className="text-xs text-stone-400">—</div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function LiefertreueMatrixHeatmap({ locationId }: { locationId: string }) {
  const [data, setData] = useState<LiefertreueMatrixDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [computing, setComputing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/liefertreue-matrix?location_id=${encodeURIComponent(locationId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d as LiefertreueMatrixDashboard);
      setLastFetch(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  async function handleCompute() {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/liefertreue-matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compute', location_id: locationId, weeks_back: 8 }),
      });
      await fetchData();
    } finally {
      setComputing(false);
    }
  }

  const hotspotCount = data?.summary?.hotspotCount ?? 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-stone-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Clock className="h-4 w-4 text-stone-400" />
          <span className="font-bold text-sm text-stone-800">Liefertreue-Matrix · 7×24-Heatmap</span>
          {hotspotCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-2.5 w-2.5" />
              {hotspotCount} Hotspot{hotspotCount !== 1 ? 's' : ''}
            </span>
          )}
          {data?.summary && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', QUALITY_BADGE_CLS[data.summary.overallQualityLabel])}>
              {pct(data.summary.avgOnTimeRateTotal)} Pünktlichkeit
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-4">
          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] text-stone-400">
              {lastFetch ? `Zuletzt: ${lastFetch.toLocaleTimeString('de-DE')}` : 'Wird geladen…'}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCompute}
                disabled={computing}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-[11px] font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-60 transition"
              >
                <RefreshCw className={cn('h-3 w-3', computing && 'animate-spin')} />
                {computing ? 'Berechne…' : 'Neu berechnen'}
              </button>
            </div>
          </div>

          {loading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-16 rounded bg-stone-100" />
              <div className="h-32 rounded bg-stone-100" />
            </div>
          )}

          {error && !loading && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
              Fehler: {error}
            </div>
          )}

          {!loading && !error && data && (
            <>
              <SummaryBar summary={data.summary} />

              <div className="mb-4">
                <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">
                  Pünktlichkeits-Heatmap (Zeilen = Wochentag, Spalten = Uhrzeit)
                </div>
                <HeatmapGrid matrix={data.matrix} />
              </div>

              {data.hotspots.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">
                    Hotspot-Analyse ({data.hotspots.length} kritische Zeitfenster)
                  </div>
                  <HotspotList hotspots={data.hotspots} />
                </div>
              )}

              {data.computedAt && (
                <div className="mt-3 text-[9px] text-stone-300 text-right">
                  Matrix berechnet: {new Date(data.computedAt).toLocaleString('de-DE')}
                </div>
              )}
            </>
          )}

          {!loading && !error && !data && (
            <div className="text-center py-6">
              <div className="text-sm text-stone-400 mb-3">Noch keine Matrix-Daten vorhanden.</div>
              <button
                onClick={handleCompute}
                disabled={computing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-4 py-2 text-xs font-bold text-white hover:bg-matcha-500 disabled:opacity-60 transition"
              >
                <RefreshCw className={cn('h-3 w-3', computing && 'animate-spin')} />
                Matrix jetzt berechnen
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
