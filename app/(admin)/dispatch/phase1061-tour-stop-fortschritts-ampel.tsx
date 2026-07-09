'use client';

import { useMemo } from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = { geliefert_am?: string | null; arrived_at?: string | null; completed_at?: string | null };
type Batch = {
  id: string;
  startzeit?: string;
  total_eta_min?: number;
  zone?: string;
  stops?: Stop[];
  driver?: { employee?: { vorname: string; nachname: string } } | null;
};

function getStatus(batch: Batch, now: number): 'on-time' | 'tight' | 'late' | 'unknown' {
  const totalStops = batch.stops?.length ?? 0;
  const done = batch.stops?.filter((s) => s.geliefert_am ?? s.completed_at).length ?? 0;
  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : null;
  const etaMin = batch.total_eta_min ?? null;
  if (!startMs || etaMin === null) return 'unknown';
  const elapsed = (now - startMs) / 60000;
  const donePct = totalStops > 0 ? done / totalStops : 0;
  const timePct = elapsed / etaMin;
  const gap = timePct - donePct;
  if (gap > 0.3) return 'late';
  if (gap > 0.1) return 'tight';
  return 'on-time';
}

const STYLE = {
  'on-time': { icon: CheckCircle2, iconClass: 'text-matcha-600', bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-700', label: 'On-Track', barColor: 'bg-matcha-500' },
  'tight':   { icon: Clock,         iconClass: 'text-amber-600',   bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200 dark:border-amber-700',   label: 'Knapp',    barColor: 'bg-amber-400' },
  'late':    { icon: AlertTriangle, iconClass: 'text-red-600',     bg: 'bg-red-50 dark:bg-red-950/30',       border: 'border-red-200 dark:border-red-700',       label: 'Verspätet', barColor: 'bg-red-400' },
  'unknown': { icon: Clock,         iconClass: 'text-muted-foreground', bg: 'bg-muted/20', border: 'border-border', label: 'Unbekannt', barColor: 'bg-muted-foreground' },
};

export function DispatchPhase1061TourStopFortschrittsAmpel({
  batches,
  drivers,
}: {
  batches: Batch[];
  drivers: { id: string; employee?: { vorname: string; nachname: string } | null }[];
}) {
  const now = Date.now();

  const rows = useMemo(() => {
    return batches
      .filter((b) => b.startzeit && !(b.stops?.every((s) => s.geliefert_am ?? s.completed_at)))
      .map((b) => {
        const status = getStatus(b, now);
        const totalStops = b.stops?.length ?? 0;
        const done = b.stops?.filter((s) => s.geliefert_am ?? s.completed_at).length ?? 0;
        const progPct = totalStops > 0 ? Math.round((done / totalStops) * 100) : 0;
        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
        const elapsedMin = Math.round((now - startMs) / 60000);
        const driverName = b.driver?.employee
          ? `${b.driver.employee.vorname} ${b.driver.employee.nachname[0]}.`
          : '—';
        return { batch: b, status, totalStops, done, progPct, elapsedMin, driverName };
      })
      .sort((a, b) => {
        const order = ['late', 'tight', 'on-time', 'unknown'];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });
  }, [batches, now]);

  if (rows.length === 0) return null;

  const late = rows.filter((r) => r.status === 'late').length;
  const tight = rows.filter((r) => r.status === 'tight').length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <CheckCircle2 size={15} className="text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">Tour-Stop-Fortschritt — Ampel</span>
        <div className="flex items-center gap-1.5">
          {late > 0 && <span className="rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">{late} spät</span>}
          {tight > 0 && <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5">{tight} knapp</span>}
        </div>
      </div>

      <div className="p-3 space-y-2">
        {rows.map(({ batch, status, done, totalStops, progPct, elapsedMin, driverName }) => {
          const ss = STYLE[status];
          const Icon = ss.icon;
          return (
            <div key={batch.id} className={cn('rounded-xl border p-3', ss.bg, ss.border)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon size={13} className={ss.iconClass} />
                  <span className="text-xs font-bold">{driverName}</span>
                  {batch.zone && <span className="text-[9px] rounded bg-white/60 dark:bg-black/20 border px-1.5 font-bold">Zone {batch.zone}</span>}
                </div>
                <span className={cn('text-[9px] font-black rounded-full px-2 py-0.5 text-white', status === 'on-time' ? 'bg-matcha-500' : status === 'tight' ? 'bg-amber-500' : status === 'late' ? 'bg-red-500' : 'bg-muted')}>
                  {ss.label}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all', ss.barColor)} style={{ width: `${progPct}%` }} />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{done}/{totalStops} Stopps</span>
                <span className="text-[10px] text-muted-foreground">{elapsedMin} Min</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
