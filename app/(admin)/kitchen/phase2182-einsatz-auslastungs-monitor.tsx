'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Users } from 'lucide-react';
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

interface Props { locationId?: string | null }

export function KitchenPhase2182EinsatzAuslastungsMonitor({ locationId }: Props) {
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
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const { niedrig, hoch } = useMemo(() => ({
    niedrig: data.drivers.filter(d => d.status === 'niedrig'),
    hoch:    data.drivers.filter(d => d.status === 'hoch'),
  }), [data]);

  const hasAlert = niedrig.length > 0;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Users className={cn('h-4 w-4 shrink-0', hasAlert ? 'text-red-500' : 'text-blue-500')} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Einsatz-Auslastungs-Monitor</span>
        {hasAlert && (
          <span className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-100 border border-red-200 rounded-full px-2 py-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />{niedrig.length} LEERLAUF
          </span>
        )}
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/30 border px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Online</p>
              <p className="text-base font-black tabular-nums">{data.drivers.length}</p>
            </div>
            <div className="rounded-lg bg-green-50 border border-green-200 px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Hoch</p>
              <p className="text-base font-black tabular-nums text-green-600">{hoch.length}</p>
            </div>
            <div className={cn('rounded-lg border px-2 py-1.5', niedrig.length > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/30')}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Leerlauf</p>
              <p className={cn('text-base font-black tabular-nums', niedrig.length > 0 ? 'text-red-600' : 'text-green-600')}>
                {niedrig.length}
              </p>
            </div>
          </div>

          {hasAlert && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-[11px] text-red-700 font-medium leading-snug">
                {niedrig.map(d => d.name).join(', ')} — niedrige Einsatz-Effizienz. Dispatcher über Umverteilung informieren.
              </p>
            </div>
          )}

          {niedrig.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">Fahrer im Leerlauf</p>
              {niedrig.map(d => (
                <div key={d.id} className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 flex items-center gap-2">
                  <span className="text-[11px] font-medium flex-1 truncate">{d.name}</span>
                  <span className="text-[10px] font-bold text-red-700 tabular-nums">{d.ordersPerHour.toFixed(1)}/h</span>
                  <span className="text-[9px] text-muted-foreground">{d.ordersToday} Auftr.</span>
                </div>
              ))}
            </div>
          )}

          {!hasAlert && (
            <p className="text-[11px] text-muted-foreground text-center py-1">
              Alle Fahrer gut ausgelastet — kein Leerlauf
            </p>
          )}
        </div>
      )}
    </div>
  );
}
