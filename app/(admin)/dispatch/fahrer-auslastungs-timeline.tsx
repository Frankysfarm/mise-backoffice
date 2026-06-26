'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type SlotType = 'shift' | 'tour' | 'break' | 'free';

interface TimelineSlot {
  type: SlotType;
  startHour: number;
  endHour: number;
  label: string | null;
}

interface DriverTimeline {
  driverId: string;
  driverName: string;
  isOnline: boolean;
  slots: TimelineSlot[];
  totalShiftHours: number;
  totalTourHours: number;
  utilizationPct: number;
}

interface ApiResponse {
  ok: boolean;
  drivers: DriverTimeline[];
  hourLabels: string[];
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const VISIBLE_HOURS = [6, 8, 10, 12, 14, 16, 18, 20, 22];
const DAY_HOURS = 24;

const slotColor: Record<SlotType, string> = {
  shift: 'bg-stone-200',
  tour: 'bg-matcha-500',
  break: 'bg-amber-300',
  free: 'bg-transparent',
};

function slotStyle(slot: TimelineSlot): React.CSSProperties {
  return {
    left: `${(slot.startHour / DAY_HOURS) * 100}%`,
    width: `${((slot.endHour - slot.startHour) / DAY_HOURS) * 100}%`,
  };
}

function utilizationColor(pct: number): string {
  if (pct >= 80) return 'text-red-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-matcha-600';
}

export function DispatchFahrerAuslastungsTimeline({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/fahrer-auslastungs-timeline?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setDrivers(d.drivers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && drivers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-5 py-3 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">Fahrer-Auslastungs-Timeline</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        {!loading && (
          <span className="ml-auto rounded-full bg-stone-100 text-stone-600 px-2.5 py-0.5 text-[10px] font-bold">
            {drivers.length} Fahrer
          </span>
        )}
        <span className="text-muted-foreground text-xs ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 space-y-3">
          {loading && drivers.length === 0 ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-stone-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Hour axis */}
              <div className="relative h-4 ml-28">
                {VISIBLE_HOURS.map((h) => (
                  <span
                    key={h}
                    className="absolute text-[9px] text-stone-400 -translate-x-1/2"
                    style={{ left: `${(h / DAY_HOURS) * 100}%` }}
                  >
                    {String(h).padStart(2, '0')}
                  </span>
                ))}
              </div>

              {drivers.map((driver) => (
                <div key={driver.driverId} className="flex items-center gap-2">
                  {/* Driver label */}
                  <div className="w-28 shrink-0 text-right">
                    <span className="text-xs font-semibold truncate block">{driver.driverName}</span>
                    <span className={cn('text-[10px] font-bold', utilizationColor(driver.utilizationPct))}>
                      {driver.utilizationPct}%
                    </span>
                  </div>

                  {/* Timeline bar */}
                  <div className="flex-1 relative h-5 rounded-full bg-stone-100 overflow-hidden">
                    {/* Shift backgrounds */}
                    {driver.slots
                      .filter((s) => s.type === 'shift')
                      .map((slot, i) => (
                        <div
                          key={`shift-${i}`}
                          className={cn('absolute h-full', slotColor.shift)}
                          style={slotStyle(slot)}
                        />
                      ))}
                    {/* Tour overlays */}
                    {driver.slots
                      .filter((s) => s.type === 'tour')
                      .map((slot, i) => (
                        <div
                          key={`tour-${i}`}
                          className={cn('absolute h-full rounded-sm opacity-90', slotColor.tour)}
                          style={slotStyle(slot)}
                          title={slot.label ?? 'Tour'}
                        />
                      ))}
                    {/* Current time marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                      style={{ left: `${(new Date().getUTCHours() / DAY_HOURS) * 100}%` }}
                    />
                  </div>

                  {/* Hours summary */}
                  <div className="w-14 shrink-0 text-right">
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {driver.totalTourHours}h/{driver.totalShiftHours}h
                    </span>
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-4 pt-1 border-t border-stone-100">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-6 rounded-sm bg-stone-200" />
                  <span className="text-[10px] text-muted-foreground">Schicht</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-6 rounded-sm bg-matcha-500" />
                  <span className="text-[10px] text-muted-foreground">Tour</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-0.5 w-4 bg-red-500" />
                  <span className="text-[10px] text-muted-foreground">Jetzt</span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
