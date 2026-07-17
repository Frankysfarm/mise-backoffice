'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb, Star } from 'lucide-react';
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
  ],
};

function tipp(status: DriverEff['status'], oph: number): string {
  if (status === 'hoch')   return `Starke Leistung! Mit ${oph.toFixed(1)} Aufträgen/h gehörst du zu den effizientesten Fahrern.`;
  if (status === 'normal') return 'Solide Effizienz. Reduziere Wartezeiten zwischen Touren um noch mehr zu schaffen.';
  return 'Dein Einsatz-Score ist gerade niedrig. Prüfe ob neue Aufträge bereit sind und starte zügig.';
}

function scoreColor(status: DriverEff['status']) {
  if (status === 'hoch')   return 'text-green-600';
  if (status === 'normal') return 'text-blue-600';
  return 'text-red-600';
}

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase2180MeinEinsatzScore({ driverId, locationId, isOnline }: Props) {
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
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const mein = data.drivers.find(d => d.id === driverId) ?? data.drivers[0];
  if (!mein) return null;

  const vsTeam = Math.round((mein.ordersPerHour - data.avgOrdersPerHour) * 10) / 10;
  const score  = Math.round(Math.min((mein.ordersPerHour / Math.max(data.avgOrdersPerHour * 1.5, 1)) * 100, 100));

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Star className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">Mein Einsatz-Score</span>
        <span className={cn('text-xs font-black tabular-nums', scoreColor(mein.status))}>
          {mein.ordersPerHour.toFixed(1)}/h
        </span>
        {loading && <span className="text-[9px] text-muted-foreground">…</span>}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          <div className="flex items-start gap-3">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Aufträge/Stunde heute</p>
              <p className={cn('text-3xl font-black tabular-nums', scoreColor(mein.status))}>
                {mein.ordersPerHour.toFixed(1)}
              </p>
              <p className="text-[10px] text-muted-foreground">Auftr./h</p>
            </div>
            <div className="ml-auto text-right space-y-0.5">
              <p className="text-[9px] text-muted-foreground">Aufträge heute: {mein.ordersToday}</p>
              <p className="text-[9px] text-muted-foreground">Aktive Std.: {mein.hoursActive.toFixed(1)}h</p>
              <p className="text-[9px] text-muted-foreground">Team-Ø: {data.avgOrdersPerHour.toFixed(1)}/h</p>
              <p className={cn('text-[10px] font-semibold', vsTeam >= 0 ? 'text-green-600' : 'text-red-600')}>
                {vsTeam >= 0 ? '+' : ''}{vsTeam} vs. Team
              </p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Score</span>
              <span>{score}%</span>
            </div>
            <div className="h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', mein.status === 'hoch' ? 'bg-green-500' : mein.status === 'normal' ? 'bg-blue-500' : 'bg-red-500')}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          <div className="rounded-lg bg-muted/30 border px-3 py-2 flex items-start gap-2">
            <Lightbulb className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-muted-foreground leading-snug">
              {tipp(mein.status, mein.ordersPerHour)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
