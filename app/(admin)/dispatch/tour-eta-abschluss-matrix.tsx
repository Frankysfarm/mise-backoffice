'use client';

import { useMemo } from 'react';
import { RouteIcon, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = { geliefert_am: string | null; reihenfolge: number };

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  stops?: Stop[];
  fahrer: { vorname: string; nachname: string } | null;
};

interface Props {
  batches: Batch[];
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchTourEtaAbschlussMatrix({ batches }: Props) {
  const rows = useMemo(() => {
    const now = Date.now();
    return batches
      .filter((b) => ['unterwegs', 'on_route', 'gestartet'].includes(b.status))
      .map((b) => {
        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
        const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;
        const remainMin = b.total_eta_min !== null ? Math.max(0, b.total_eta_min - elapsedMin) : null;
        const etaArrivalMs = remainMin !== null ? now + remainMin * 60_000 : null;
        const totalStops = b.stops?.length ?? 0;
        const doneStops = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const progressPct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
        const isOnTime = remainMin !== null && remainMin > 5;
        const isLate = b.total_eta_min !== null && elapsedMin > b.total_eta_min;

        return {
          id: b.id,
          name: b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.` : 'Fahrer',
          remainMin,
          etaArrivalMs,
          totalStops,
          doneStops,
          progressPct,
          isOnTime,
          isLate,
          elapsedMin,
        };
      })
      .sort((a, b) => (a.remainMin ?? 999) - (b.remainMin ?? 999));
  }, [batches]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <RouteIcon className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">ETA-Abschluss-Matrix</span>
        <span className="ml-auto rounded-full bg-matcha-50 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Fahrer</th>
              <th className="px-3 py-2 text-center font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Stopps</th>
              <th className="px-3 py-2 text-center font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Verbleib</th>
              <th className="px-3 py-2 text-center font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Ankunft</th>
              <th className="px-3 py-2 text-left font-bold text-[10px] uppercase tracking-wide text-muted-foreground">Fortschritt</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id} className={cn(
                'transition-colors',
                r.isLate ? 'bg-red-50' : r.doneStops === r.totalStops ? 'bg-matcha-50' : 'hover:bg-muted/20',
              )}>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    {r.doneStops === r.totalStops && r.totalStops > 0
                      ? <CheckCircle2 className="h-3 w-3 text-matcha-600 shrink-0" />
                      : <Clock className={cn('h-3 w-3 shrink-0', r.isLate ? 'text-red-500' : 'text-muted-foreground')} />
                    }
                    <span className="font-bold truncate max-w-[80px]">{r.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span className="font-bold tabular-nums">{r.doneStops}</span>
                  <span className="text-muted-foreground">/{r.totalStops}</span>
                </td>
                <td className={cn(
                  'px-3 py-2.5 text-center font-black tabular-nums',
                  r.isLate ? 'text-red-600' : r.remainMin !== null && r.remainMin <= 10 ? 'text-amber-600' : 'text-matcha-700',
                )}>
                  {r.isLate ? `+${r.elapsedMin - (r.elapsedMin - (r.remainMin ?? 0))}m` :
                   r.remainMin !== null ? `${r.remainMin}m` : '–'}
                </td>
                <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted-foreground">
                  {r.etaArrivalMs ? fmtTime(r.etaArrivalMs) : '–'}
                </td>
                <td className="px-3 py-2.5 min-w-[80px]">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        r.isLate ? 'bg-red-400' : 'bg-matcha-500',
                      )}
                      style={{ width: `${r.progressPct}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
