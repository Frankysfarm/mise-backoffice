'use client';

import { useEffect, useState } from 'react';
import { Grid3X3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatCell {
  dow: number;
  hour: number;
  total: number;
  onTime: number;
  pct: number | null;
}

interface DriverHeatmap {
  driverId: string;
  driverName: string;
  totalDeliveries: number;
  overallPct: number | null;
  cells: HeatCell[];
}

interface ApiResponse {
  ok: boolean;
  drivers: DriverHeatmap[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DISPLAY_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

function cellColor(pct: number | null, total: number): string {
  if (total === 0 || pct === null) return 'bg-stone-100';
  if (pct >= 90) return 'bg-green-500';
  if (pct >= 75) return 'bg-green-300';
  if (pct >= 60) return 'bg-amber-300';
  if (pct >= 40) return 'bg-orange-400';
  return 'bg-red-500';
}

function pctBadge(pct: number | null): string {
  if (pct === null) return 'bg-stone-100 text-stone-400';
  if (pct >= 85) return 'bg-green-100 text-green-700';
  if (pct >= 70) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

export function DispatchFahrerPuenktlichkeitsHeatmap({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverHeatmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/driver-punctuality-heatmap?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setDrivers(d.drivers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 300_000); // 5 Min - historische Daten ändern sich selten
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && drivers.length === 0) return null;

  const avgPct = drivers.length > 0
    ? Math.round(drivers.reduce((s, d) => s + (d.overallPct ?? 0), 0) / drivers.length)
    : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <Grid3X3 className="h-4 w-4 text-purple-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Pünktlichkeits-Heatmap</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {avgPct !== null && (
          <span className={cn('ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-bold', pctBadge(avgPct))}>
            Ø {avgPct}%
          </span>
        )}
        <span className="ml-1 text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {/* Legende */}
          <div className="px-5 py-2 flex items-center gap-3 flex-wrap bg-stone-50 text-[9px] text-stone-500">
            <span className="font-semibold text-stone-600">Pünktlichkeit:</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />≥90%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-300 inline-block" />≥75%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-300 inline-block" />≥60%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-orange-400 inline-block" />≥40%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />&lt;40%</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-stone-100 inline-block" />keine Daten</span>
            <span className="ml-auto text-[9px]">30-Tage-Historik</span>
          </div>

          {drivers.map((driver) => (
            <div key={driver.driverId} className="px-5 py-3">
              <button
                onClick={() => setExpandedDriver(expandedDriver === driver.driverId ? null : driver.driverId)}
                className="w-full flex items-center gap-2 text-left"
              >
                <span className="font-semibold text-sm">{driver.driverName}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', pctBadge(driver.overallPct))}>
                  {driver.overallPct !== null ? `${driver.overallPct}%` : '—'}
                </span>
                <span className="text-[10px] text-stone-400 ml-1">{driver.totalDeliveries} Lief.</span>
                <span className="ml-auto text-stone-400 text-xs">{expandedDriver === driver.driverId ? '▲' : '▼'}</span>
              </button>

              {expandedDriver === driver.driverId && (
                <div className="mt-3 overflow-x-auto">
                  <div className="min-w-[480px]">
                    {/* Stunden-Header */}
                    <div className="flex mb-1">
                      <div className="w-6 shrink-0" />
                      {DISPLAY_HOURS.map((h) => (
                        <div key={h} className="flex-1 text-center text-[8px] text-stone-400 font-mono">
                          {h}
                        </div>
                      ))}
                    </div>

                    {/* Zeilen: Wochentage */}
                    {DOW_LABELS.map((dayLabel, dow) => (
                      <div key={dow} className="flex items-center gap-0 mb-0.5">
                        <div className="w-6 shrink-0 text-[9px] text-stone-500 font-semibold">{dayLabel}</div>
                        {DISPLAY_HOURS.map((h) => {
                          const cell = driver.cells.find((c) => c.dow === dow && c.hour === h);
                          const pct = cell?.pct ?? null;
                          const total = cell?.total ?? 0;
                          return (
                            <div
                              key={h}
                              className={cn(
                                'flex-1 h-5 rounded-sm mx-px transition-all cursor-default',
                                cellColor(pct, total),
                              )}
                              title={total > 0 ? `${dayLabel} ${h}:00 — ${cell?.onTime}/${total} pünktlich (${pct}%)` : 'Keine Daten'}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Wird geladen…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
