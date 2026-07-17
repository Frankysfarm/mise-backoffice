'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverEff {
  id: string;
  name: string;
  ordersToday: number;
  hoursActive: number;
  ordersPerHour: number;
  status: 'hoch' | 'normal' | 'niedrig';
}

interface ApiData {
  ok: boolean;
  drivers: DriverEff[];
  avgOrdersPerHour: number;
}

const MOCK: ApiData = {
  ok: true,
  avgOrdersPerHour: 3.2,
  drivers: [
    { id: 'd1', name: 'Max M.',   ordersToday: 12, hoursActive: 3.5, ordersPerHour: 3.4, status: 'hoch'    },
    { id: 'd2', name: 'Sarah K.', ordersToday: 9,  hoursActive: 3.0, ordersPerHour: 3.0, status: 'normal'  },
    { id: 'd3', name: 'Tom B.',   ordersToday: 4,  hoursActive: 3.2, ordersPerHour: 1.3, status: 'niedrig' },
    { id: 'd4', name: 'Anna L.',  ordersToday: 11, hoursActive: 3.0, ordersPerHour: 3.7, status: 'hoch'    },
  ],
};

function statusColor(s: DriverEff['status']) {
  if (s === 'hoch')    return 'text-green-600';
  if (s === 'normal')  return 'text-blue-600';
  return 'text-red-600';
}

function barColor(s: DriverEff['status']) {
  if (s === 'hoch')   return 'bg-green-500';
  if (s === 'normal') return 'bg-blue-500';
  return 'bg-red-500';
}

interface Props { locationId: string | null }

export function DispatchPhase2179EinsatzEffizienzRanking({ locationId }: Props) {
  const [open, setOpen]       = useState(true);
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-einsatz-effizienz?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const lowPerformers = data.drivers.filter(d => d.status === 'niedrig');
  const hasAlert      = lowPerformers.length > 0;
  const sorted        = [...data.drivers].sort((a, b) => b.ordersPerHour - a.ordersPerHour);
  const maxOph        = sorted[0]?.ordersPerHour ?? 1;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Star className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Einsatz-Effizienz-Ranking</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{lowPerformers.length} NIEDRIG
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Team-Ø Aufträge/h</p>
              <p className="text-xl font-black tabular-nums">{data.avgOrdersPerHour.toFixed(1)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">{data.drivers.length} Fahrer online</p>
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {lowPerformers.map(d => d.name).join(', ')} — niedrige Einsatz-Effizienz. Coaching empfehlen.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {sorted.map((d, i) => (
              <div key={d.id} className={cn(
                'rounded-lg border p-2.5 space-y-1.5',
                d.status === 'niedrig' ? 'bg-red-50 border-red-200' : 'bg-muted/10',
              )}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-bold w-4 shrink-0">#{i + 1}</span>
                  {i === 0 && <Star className="h-3 w-3 text-yellow-500 shrink-0" />}
                  <span className="text-[11px] font-semibold flex-1 truncate">{d.name}</span>
                  <div className="flex items-center gap-1">
                    {d.ordersPerHour > data.avgOrdersPerHour && <TrendingUp   className="h-3 w-3 text-green-500" />}
                    {d.ordersPerHour < data.avgOrdersPerHour && <TrendingDown className="h-3 w-3 text-red-500" />}
                    <span className={cn('text-sm font-black tabular-nums', statusColor(d.status))}>
                      {d.ordersPerHour.toFixed(1)}/h
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', barColor(d.status))}
                      style={{ width: `${Math.min((d.ordersPerHour / maxOph) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground shrink-0">{d.ordersToday} Auftr.</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
