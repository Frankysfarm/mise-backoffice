'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HourBucket {
  hour: number;
  todayCount: number;
  avgCount: number;
  ratio: number;
}

interface ApiResponse {
  ok: boolean;
  hours: HourBucket[];
  peakHourToday: number | null;
  peakHourAvg: number | null;
  totalToday: number;
  totalAvg: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}`;
}

export function KitchenWellenVerlaufChart({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/order-wave-history?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d.ok ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const maxVal = data
    ? Math.max(...data.hours.map((h) => Math.max(h.todayCount, h.avgCount)), 1)
    : 1;

  // Show only hours 6–23 for readability
  const displayHours = data ? data.hours.filter((h) => h.hour >= 6) : [];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <BarChart3 className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Bestellungs-Wellenverlauf</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {data && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            Heute {data.totalToday} · Ø {data.totalAvg}
          </span>
        )}
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 space-y-3">
          {/* Legende */}
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" /> Heute
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-stone-300" /> Ø 7 Tage
            </span>
            {data?.peakHourToday !== null && (
              <span className="ml-auto">Peak heute: {fmtHour(data!.peakHourToday!)}:00 Uhr</span>
            )}
          </div>

          {/* Histogramm */}
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1" style={{ minWidth: '480px', height: '80px' }}>
              {displayHours.map((bucket) => {
                const todayH = Math.round((bucket.todayCount / maxVal) * 72);
                const avgH = Math.round((bucket.avgCount / maxVal) * 72);
                const isPeakToday = bucket.hour === data?.peakHourToday;

                return (
                  <div
                    key={bucket.hour}
                    className="flex-1 flex items-end gap-[1px] group relative"
                    title={`${fmtHour(bucket.hour)}:00 — Heute: ${bucket.todayCount}, Ø: ${bucket.avgCount}`}
                  >
                    {/* Ø-Balken (grau, hinten) */}
                    <div
                      className="flex-1 rounded-t-sm bg-stone-200"
                      style={{ height: `${avgH}px` }}
                    />
                    {/* Heute-Balken (blau, vorne) */}
                    <div
                      className={cn(
                        'flex-1 rounded-t-sm',
                        isPeakToday ? 'bg-blue-600' : 'bg-blue-400',
                        bucket.ratio > 1.4 ? 'bg-orange-400' : '',
                      )}
                      style={{ height: `${todayH}px` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Stunden-Achse */}
            <div className="flex gap-1 mt-1" style={{ minWidth: '480px' }}>
              {displayHours.map((bucket) => (
                <div
                  key={bucket.hour}
                  className={cn(
                    'flex-1 text-center text-[8px]',
                    bucket.hour === data?.peakHourToday ? 'text-blue-600 font-bold' : 'text-stone-400',
                  )}
                >
                  {bucket.hour % 2 === 0 ? fmtHour(bucket.hour) : ''}
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {data && (
            <div className="flex gap-3 text-xs text-stone-600">
              <span>
                Heute gesamt: <strong className="text-blue-600">{data.totalToday}</strong>
              </span>
              <span>
                Ø 7 Tage: <strong>{data.totalAvg}</strong>
              </span>
              {data.totalAvg > 0 && (
                <span>
                  Trend:{' '}
                  <strong
                    className={cn(
                      data.totalToday > data.totalAvg ? 'text-green-600' : 'text-red-500',
                    )}
                  >
                    {data.totalToday > data.totalAvg ? '+' : ''}
                    {Math.round(((data.totalToday - data.totalAvg) / data.totalAvg) * 100)}%
                  </strong>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
