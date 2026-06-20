'use client';

/* Phase 325: DispatchFahrerPausenAlert
   Erkennt Fahrer, die während einer aktiven Tour >5 Minuten stillstehen
   und zeigt einen priorisierten Alert mit Handlungsoptionen.
*/

import { useMemo } from 'react';
import { AlertTriangle, Phone, RefreshCw, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_update: string | null;
  employee: { vorname: string; nachname: string; telefon: string | null } | null;
};

type Batch = {
  id: string;
  fahrer_id?: string;
  driver_id?: string;
  status: string;
};

interface Props {
  drivers: Driver[];
  batches: Batch[];
  pauseSchwelle?: number;
}

export function DispatchFahrerPausenAlert({
  drivers,
  batches,
  pauseSchwelle = 5,
}: Props) {
  const now = Date.now();

  const stillstehenFahrer = useMemo(() => {
    const aktiveDriverIds = new Set(
      batches
        .filter((b) => b.status === 'in_delivery' || b.status === 'picking_up')
        .map((b) => b.fahrer_id ?? b.driver_id)
        .filter(Boolean) as string[],
    );

    return drivers
      .filter((d) => {
        if (!d.ist_online) return false;
        if (!d.aktueller_batch_id) return false;
        if (!aktiveDriverIds.has(d.employee_id)) return false;
        if (!d.last_update) return false;
        const minutenOhneBewegung = (now - new Date(d.last_update).getTime()) / 60_000;
        return minutenOhneBewegung >= pauseSchwelle;
      })
      .map((d) => {
        const minutenPause = Math.floor(
          (now - new Date(d.last_update!).getTime()) / 60_000,
        );
        return { driver: d, minutenPause };
      })
      .sort((a, b) => b.minutenPause - a.minutenPause);
  }, [drivers, batches, now, pauseSchwelle]);

  if (stillstehenFahrer.length === 0) return null;

  const urgency = (min: number) =>
    min >= 15 ? 'kritisch' : min >= 10 ? 'hoch' : 'mittel';

  const urgencyStyle = {
    kritisch: {
      bg: 'bg-red-50 border-red-300',
      badge: 'bg-red-500 text-white',
      text: 'text-red-700',
    },
    hoch: {
      bg: 'bg-amber-50 border-amber-300',
      badge: 'bg-amber-400 text-white',
      text: 'text-amber-700',
    },
    mittel: {
      bg: 'bg-orange-50 border-orange-200',
      badge: 'bg-orange-400 text-white',
      text: 'text-orange-700',
    },
  } as const;

  return (
    <Card className="overflow-hidden border-orange-200">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-200">
        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-orange-800">
          Fahrer-Pausen-Alert
        </span>
        <Badge className="ml-auto bg-orange-500 text-white text-[10px]">
          {stillstehenFahrer.length} Fahrer
        </Badge>
      </div>
      <div className="divide-y divide-stone-100">
        {stillstehenFahrer.map(({ driver, minutenPause }) => {
          const u = urgency(minutenPause);
          const s = urgencyStyle[u];
          const name = driver.employee
            ? `${driver.employee.vorname} ${driver.employee.nachname}`
            : driver.employee_id.slice(0, 8);
          return (
            <div key={driver.employee_id} className={cn('px-4 py-3 flex items-start gap-3', s.bg)}>
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <MapPin className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-stone-800">{name}</span>
                  <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', s.badge)}>
                    {minutenPause} Min. gestoppt
                  </span>
                </div>
                {driver.last_lat && driver.last_lng && (
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    {driver.last_lat.toFixed(4)}, {driver.last_lng.toFixed(4)}
                  </div>
                )}
                <div className={cn('text-[11px] font-medium mt-1', s.text)}>
                  {u === 'kritisch'
                    ? 'Dringend: Fahrer seit >15 Min. ohne GPS-Bewegung!'
                    : u === 'hoch'
                    ? 'Fahrer ist länger als 10 Min. nicht weitergefahren.'
                    : `Kein GPS-Update seit ${minutenPause} Min.`}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {driver.employee?.telefon && (
                  <a href={`tel:${driver.employee.telefon}`}>
                    <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]">
                      <Phone className="h-3 w-3 mr-1" />
                      Anrufen
                    </Button>
                  </a>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[11px] text-orange-700 border-orange-300"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Prüfen
                </Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2 bg-stone-50 border-t border-stone-100">
        <p className="text-[10px] text-stone-400">
          Alert ab {pauseSchwelle} Min. ohne GPS-Update bei aktiver Tour
        </p>
      </div>
    </Card>
  );
}
