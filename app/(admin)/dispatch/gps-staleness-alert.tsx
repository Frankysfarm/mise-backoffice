'use client';

import { useMemo } from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Driver = {
  id: string;
  employee_id: string;
  aktueller_batch_id: string | null;
  last_update: string | null;
  online_seit: string | null;
  employee: { vorname: string; nachname: string; telefon: string | null } | null;
};

interface Props {
  drivers: Driver[];
}

function staleness(lastUpdate: string | null): { staleMin: number; level: 'ok' | 'warn' | 'critical' } {
  if (!lastUpdate) return { staleMin: 999, level: 'critical' };
  const diffMs = Date.now() - new Date(lastUpdate).getTime();
  const staleMin = Math.floor(diffMs / 60_000);
  const level = staleMin < 3 ? 'ok' : staleMin < 10 ? 'warn' : 'critical';
  return { staleMin, level };
}

export function DispatchGpsStalenessAlert({ drivers }: Props) {
  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.aktueller_batch_id !== null && d.online_seit !== null),
    [drivers],
  );

  const rows = useMemo(
    () =>
      activeDrivers
        .map((d) => ({ driver: d, ...staleness(d.last_update) }))
        .filter((r) => r.level !== 'ok')
        .sort((a, b) => b.staleMin - a.staleMin),
    [activeDrivers],
  );

  if (rows.length === 0) return null;

  const critical = rows.filter((r) => r.level === 'critical');
  const warn = rows.filter((r) => r.level === 'warn');

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      critical.length > 0 ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50',
    )}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-black/10">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', critical.length > 0 ? 'text-red-600' : 'text-amber-600')} />
        <span className={cn('text-xs font-bold uppercase tracking-wider', critical.length > 0 ? 'text-red-900' : 'text-amber-900')}>
          GPS-Signal veraltet
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {critical.length > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5">
              {critical.length} kritisch
            </span>
          )}
          {warn.length > 0 && (
            <span className="rounded-full bg-amber-400 text-white text-[9px] font-black px-2 py-0.5">
              {warn.length} Warnung
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-black/5">
        {rows.map(({ driver, staleMin, level }) => {
          const name = driver.employee
            ? `${driver.employee.vorname} ${driver.employee.nachname[0]}.`
            : 'Fahrer';
          return (
            <div key={driver.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                level === 'critical' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600',
              )}>
                {level === 'critical' ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{name}</div>
                <div className={cn('text-[10px]', level === 'critical' ? 'text-red-600' : 'text-amber-600')}>
                  Letztes GPS-Signal vor {staleMin} Min
                </div>
              </div>
              {driver.employee?.telefon && (
                <a
                  href={`tel:${driver.employee.telefon}`}
                  className="shrink-0 rounded-lg border border-current px-2 py-1 text-[10px] font-bold text-current hover:bg-white/30 transition"
                >
                  Anrufen
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
