'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Home, Clock, Bike, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Stop {
  id: string;
  geliefert_am: string | null;
}

interface Batch {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  fahrer_id: string | null;
  zone: string | null;
  fahrer?: { vorname: string; nachname: string } | null;
  stops: Stop[];
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  batches: Batch[];
  drivers?: any[];
}

type Urgency = 'arriving' | 'soon' | 'later';

interface Row {
  batchId: string;
  driverName: string;
  zone: string | null;
  stopsLeft: number;
  stopsTotal: number;
  returnInMin: number | null;
  estimatedReturnAt: Date | null;
  urgency: Urgency;
}

function useTickNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function formatUhrzeit(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchFahrerRueckkehrCountdown({ batches, drivers = [] }: Props) {
  const now = useTickNow();
  const [collapsed, setCollapsed] = useState(false);

  const active = batches.filter(
    (b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'assigned',
  );

  const rows: Row[] = active.map((b) => {
    // Support dispatch Driver shape (employee_id + employee) and simple shape (id + vorname/nachname)
    const driverRecord = drivers.find(
      (d) => d.employee_id === b.fahrer_id || d.id === b.fahrer_id,
    );
    const fahrerInfo = b.fahrer ?? driverRecord?.employee ?? driverRecord ?? null;
    const driverName = fahrerInfo
      ? `${fahrerInfo.vorname} ${fahrerInfo.nachname}`
      : 'Fahrer';

    const stopsLeft = b.stops.filter((s) => !s.geliefert_am).length;
    const stopsTotal = b.stops.length;

    let estimatedReturnAt: Date | null = null;
    let returnInMin: number | null = null;

    if (b.startzeit && b.total_eta_min != null) {
      estimatedReturnAt = new Date(new Date(b.startzeit).getTime() + b.total_eta_min * 60_000);
      returnInMin = Math.round((estimatedReturnAt.getTime() - now) / 60_000);
    }

    const urgency: Urgency =
      returnInMin !== null && returnInMin <= 5
        ? 'arriving'
        : returnInMin !== null && returnInMin <= 15
        ? 'soon'
        : 'later';

    return { batchId: b.id, driverName, zone: b.zone, stopsLeft, stopsTotal, returnInMin, estimatedReturnAt, urgency };
  }).sort((a, b) => {
    if (a.returnInMin === null && b.returnInMin === null) return 0;
    if (a.returnInMin === null) return 1;
    if (b.returnInMin === null) return -1;
    return a.returnInMin - b.returnInMin;
  });

  if (rows.length === 0) return null;

  const urgencyStyle: Record<Urgency, { bg: string; border: string; badge: string; dot: string; label: string }> = {
    arriving: {
      bg: 'bg-matcha-50',
      border: 'border-l-matcha-500',
      badge: 'bg-matcha-100 text-matcha-700',
      dot: 'bg-matcha-500',
      label: 'Kommt gleich',
    },
    soon: {
      bg: 'bg-amber-50',
      border: 'border-l-amber-400',
      badge: 'bg-amber-100 text-amber-700',
      dot: 'bg-amber-400',
      label: 'Bald zurück',
    },
    later: {
      bg: 'bg-stone-50',
      border: 'border-l-stone-300',
      badge: 'bg-stone-100 text-stone-600',
      dot: 'bg-stone-400',
      label: 'Unterwegs',
    },
  };

  const arrivingSoon = rows.filter((r) => r.urgency === 'arriving' || r.urgency === 'soon').length;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/20 transition-colors text-left"
      >
        <Home className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Fahrer-Rückkehr
        </span>
        {arrivingSoon > 0 && (
          <Badge className="bg-matcha-500 text-white text-[9px] font-black">
            {arrivingSoon} bald
          </Badge>
        )}
        <Badge variant="secondary" className="text-[9px]">
          {rows.length}
        </Badge>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="divide-y">
          {rows.map((row) => {
            const s = urgencyStyle[row.urgency];
            return (
              <div
                key={row.batchId}
                className={cn('flex items-center gap-3 px-4 py-3 border-l-2', s.bg, s.border)}
              >
                {/* Status dot */}
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  s.dot,
                  row.urgency === 'arriving' && 'animate-pulse',
                )} />

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.zone && (
                      <span className="text-[9px] bg-white/60 border rounded-full px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Bike className="w-3 h-3 text-stone-400 shrink-0" />
                    <span className="text-[10px] text-stone-500">
                      {row.stopsLeft > 0 ? `${row.stopsLeft}/${row.stopsTotal} Stopps offen` : 'Alle Stopps erledigt'}
                    </span>
                  </div>
                </div>

                {/* ETA */}
                <div className="shrink-0 text-right">
                  {row.returnInMin !== null ? (
                    <>
                      <div className={cn(
                        'font-mono text-sm font-black tabular-nums',
                        row.urgency === 'arriving' ? 'text-matcha-600' : row.urgency === 'soon' ? 'text-amber-600' : 'text-stone-600',
                      )}>
                        {row.returnInMin <= 0 ? 'Jetzt' : `${row.returnInMin} Min`}
                      </div>
                      {row.estimatedReturnAt && (
                        <div className="text-[9px] text-stone-400 flex items-center gap-0.5 justify-end">
                          <Clock className="w-2.5 h-2.5" />
                          {formatUhrzeit(row.estimatedReturnAt)}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-stone-400">–</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
