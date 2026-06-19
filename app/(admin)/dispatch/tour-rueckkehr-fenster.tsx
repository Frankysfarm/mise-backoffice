'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, TimerReset, CheckCircle2 } from 'lucide-react';

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer?: { vorname: string; nachname: string } | null;
  stops: { geliefert_am: string | null }[];
};

type Driver = {
  employee_id: string;
  employee: { vorname: string; nachname: string } | null;
};

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

type ReturnSlot = {
  driverId: string;
  name: string;
  returnAtMs: number;
  remainMin: number;
  status: 'imminent' | 'soon' | 'later';
  deliveredCount: number;
  totalStops: number;
};

function computeReturnSlots(batches: Batch[], drivers: Driver[], now: number): ReturnSlot[] {
  const driverMap = new Map(drivers.map(d => [d.employee_id, d]));
  const slots: ReturnSlot[] = [];

  for (const b of batches) {
    if (!b.fahrer_id) continue;
    if (b.status === 'abgeschlossen' || b.status === 'completed') continue;
    if (!b.startzeit || !b.total_eta_min) continue;

    const startMs = new Date(b.startzeit).getTime();
    const returnAtMs = startMs + b.total_eta_min * 60_000;
    const remainMin = Math.max(0, Math.round((returnAtMs - now) / 60_000));

    const driver = driverMap.get(b.fahrer_id);
    const driverName = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
      : driver?.employee
      ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
      : b.fahrer_id.slice(0, 6);

    const deliveredCount = b.stops.filter(s => s.geliefert_am != null).length;
    const totalStops = b.stops.length;

    slots.push({
      driverId: b.fahrer_id,
      name: driverName,
      returnAtMs,
      remainMin,
      status: remainMin <= 5 ? 'imminent' : remainMin <= 20 ? 'soon' : 'later',
      deliveredCount,
      totalStops,
    });
  }

  return slots.sort((a, b) => a.remainMin - b.remainMin);
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_STYLE = {
  imminent: { bar: 'bg-matcha-500', text: 'text-matcha-700', badge: 'bg-matcha-100 text-matcha-700', dot: 'bg-matcha-500 animate-pulse' },
  soon:     { bar: 'bg-amber-400',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400' },
  later:    { bar: 'bg-blue-400',   text: 'text-blue-700',   badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400' },
};

export function DispatchTourRückkehrFenster({ batches, drivers }: Props) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const slots = computeReturnSlots(batches, drivers, now);

  if (slots.length === 0) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
        <Bike size={13} className="shrink-0" />
        Keine aktiven Touren — alle Fahrer verfügbar.
      </div>
    );
  }

  const imminentCount = slots.filter(s => s.status === 'imminent').length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        imminentCount > 0 ? 'bg-matcha-50' : 'bg-muted/30',
      )}>
        <TimerReset size={14} className={imminentCount > 0 ? 'text-matcha-600' : 'text-muted-foreground'} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Rückkehr-Fenster
        </span>
        {imminentCount > 0 && (
          <span className="rounded-full bg-matcha-100 border border-matcha-200 text-matcha-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            {imminentCount} gleich zurück
          </span>
        )}
        <span className="text-[10px] text-muted-foreground">{slots.length} Touren</span>
      </div>

      <div className="p-3 space-y-2">
        {slots.map((slot) => {
          const s = STATUS_STYLE[slot.status];
          const progressPct = slot.totalStops > 0
            ? Math.round((slot.deliveredCount / slot.totalStops) * 100)
            : 0;

          return (
            <div key={slot.driverId} className="flex items-center gap-3">
              <div className="shrink-0 w-12 text-right">
                <div className={cn('text-[11px] font-black tabular-nums', s.text)}>
                  {slot.remainMin === 0 ? 'Jetzt' : `~${slot.remainMin}m`}
                </div>
                <div className="text-[9px] text-muted-foreground">{fmtTime(slot.returnAtMs)}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <Bike size={11} className={cn('shrink-0', s.text)} />
                    <span className="text-xs font-semibold truncate">{slot.name}</span>
                  </div>
                  <span className={cn('shrink-0 text-[9px] font-bold rounded-full px-1.5 py-0.5', s.badge)}>
                    {slot.deliveredCount}/{slot.totalStops}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>

              <div className={cn('shrink-0 h-2 w-2 rounded-full', s.dot)} />
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 border-t bg-muted/20 text-[9px] text-muted-foreground flex items-center gap-3">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-matcha-500 inline-block animate-pulse" /> &lt;5 Min</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" /> 5–20 Min</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400 inline-block" /> &gt;20 Min</span>
      </div>
    </div>
  );
}
