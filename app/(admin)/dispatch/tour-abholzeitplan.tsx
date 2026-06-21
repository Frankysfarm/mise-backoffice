'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: { geliefert_am: string | null }[];
};

interface Props {
  batches: Batch[];
}

const ACTIVE = ['assigned', 'on_route', 'en_route', 'unterwegs', 'active'];

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchTourAbholZeitplan({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const active = batches.filter(b => ACTIVE.includes(b.status));
  if (active.length === 0) return null;

  const rows = active.map(b => {
    const name = b.fahrer
      ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
      : 'Fahrer';
    const total = b.stops.length;
    const done = b.stops.filter(s => s.geliefert_am).length;
    const remaining = total - done;

    let returnMs: number | null = null;
    if (b.startzeit && b.total_eta_min != null) {
      returnMs = new Date(b.startzeit).getTime() + b.total_eta_min * 60_000;
    }

    const diffMs = returnMs !== null ? returnMs - now : null;
    const diffMin = diffMs !== null ? Math.round(diffMs / 60_000) : null;

    const state =
      diffMin === null ? 'unknown' :
      diffMin < 0 ? 'overdue' :
      diffMin <= 5 ? 'soon' :
      'enroute';

    return { id: b.id, name, done, total, remaining, returnMs, diffMin, state };
  }).sort((a, b) => {
    if (a.returnMs === null) return 1;
    if (b.returnMs === null) return -1;
    return a.returnMs - b.returnMs;
  });

  const STATE_STYLE = {
    soon:    { badge: 'bg-matcha-100 text-matcha-700', dot: 'bg-matcha-500 animate-pulse' },
    enroute: { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
    overdue: { badge: 'bg-red-100 text-red-700',      dot: 'bg-red-500 animate-ping' },
    unknown: { badge: 'bg-stone-100 text-stone-500',  dot: 'bg-stone-400' },
  } as const;

  const soonCount = rows.filter(r => r.state === 'soon' || r.state === 'overdue').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100 bg-stone-50">
        <CalendarClock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Abholzeitplan</span>
        {soonCount > 0 && (
          <span className="ml-auto rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
            {soonCount} bald frei
          </span>
        )}
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map(row => {
          const st = STATE_STYLE[row.state];
          return (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className={cn('absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full', st.dot)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-foreground truncate">{row.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {row.done}/{row.total} Stopps · noch {row.remaining} offen
                </div>
              </div>
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', st.badge)}>
                {row.returnMs !== null
                  ? row.diffMin! < 0
                    ? `${Math.abs(row.diffMin!)} Min überfällig`
                    : row.diffMin! <= 1
                    ? 'Ankunft jetzt'
                    : `~${fmtTime(new Date(row.returnMs!))}`
                  : 'k.A.'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
