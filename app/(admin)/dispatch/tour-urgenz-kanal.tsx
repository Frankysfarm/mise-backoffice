'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, CheckCircle2, Gauge } from 'lucide-react';

type Stop = {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order?: {
    geschaetzte_lieferzeit_min?: number | null;
    bestellt_am?: string | null;
  } | null;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  stops: Stop[];
};

interface Props {
  batches: Batch[];
}

type Urgency = 'overdue' | 'tight' | 'on_track';

function stopUrgency(stop: Stop, now: number): Urgency | null {
  if (stop.geliefert_am) return null;
  const bestellt = stop.order?.bestellt_am;
  const etaMin = stop.order?.geschaetzte_lieferzeit_min ?? 45;
  if (!bestellt) return 'on_track';
  const deadline = new Date(bestellt).getTime() + etaMin * 60_000;
  const remainMs = deadline - now;
  if (remainMs < 0) return 'overdue';
  if (remainMs < 10 * 60_000) return 'tight';
  return 'on_track';
}

export function DispatchTourUrgenzKanal({ batches }: Props) {
  const now = Date.now();

  const { overdue, tight, on_track, total } = useMemo(() => {
    let overdue = 0;
    let tight = 0;
    let on_track = 0;
    for (const b of batches) {
      if (!['unterwegs', 'gestartet', 'aktiv'].includes(b.status)) continue;
      for (const s of b.stops) {
        const u = stopUrgency(s, now);
        if (!u) continue;
        if (u === 'overdue') overdue++;
        else if (u === 'tight') tight++;
        else on_track++;
      }
    }
    return { overdue, tight, on_track, total: overdue + tight + on_track };
  }, [batches, now]);

  if (total === 0) return null;

  const activeBatches = batches.filter((b) =>
    ['unterwegs', 'gestartet', 'aktiv'].includes(b.status),
  ).length;

  const kpis: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    bg: string;
    text: string;
  }> = [
    {
      label: 'Überfällig',
      value: overdue,
      icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
      bg: overdue > 0 ? 'bg-red-50' : 'bg-stone-50',
      text: overdue > 0 ? 'text-red-700' : 'text-stone-400',
    },
    {
      label: 'Kritisch',
      value: tight,
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      bg: tight > 0 ? 'bg-amber-50' : 'bg-stone-50',
      text: tight > 0 ? 'text-amber-700' : 'text-stone-400',
    },
    {
      label: 'Im Plan',
      value: on_track,
      icon: <CheckCircle2 className="h-4 w-4 text-matcha-600" />,
      bg: 'bg-matcha-50',
      text: 'text-matcha-700',
    },
  ];

  const headerBg =
    overdue > 0
      ? 'border-red-200 bg-red-50/40'
      : tight > 2
        ? 'border-amber-200 bg-amber-50/40'
        : 'border-stone-200 bg-white';

  return (
    <div className={cn('rounded-xl border p-3', headerBg)}>
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Tour-Urgenz
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {activeBatches} Touren aktiv · {total} Stopps
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {kpis.map((k) => (
          <div key={k.label} className={cn('rounded-lg p-2.5 text-center', k.bg)}>
            <div className="flex justify-center mb-1">{k.icon}</div>
            <div className={cn('text-xl font-black tabular-nums', k.text)}>{k.value}</div>
            <div className="text-[9px] font-semibold text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>
      {overdue > 0 && (
        <div className="mt-2 rounded-lg bg-red-100 px-3 py-1.5 text-[11px] font-bold text-red-700">
          ⚠ {overdue} Stop{overdue !== 1 ? 'ps' : ''} bereits überfällig — sofort dispatchen!
        </div>
      )}
    </div>
  );
}
