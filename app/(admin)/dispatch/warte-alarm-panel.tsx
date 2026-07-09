'use client';

import { AlertTriangle, Clock, Package, Truck, ChefHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  bestellnummer?: string;
  status: string;
  bestellt_am?: string | null;
  fertig_am?: string | null;
  kunde_name?: string;
  zone?: string | null;
  delivery_zone?: string | null;
}

interface Props {
  orders: Order[];
  /** Alert threshold in minutes per phase */
  schwellenwertMin?: { neu: number; zubereitung: number; fertig: number };
}

function minutenSeit(iso: string | null | undefined): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export function DispatchWarteAlarmPanel({
  orders,
  schwellenwertMin = { neu: 10, zubereitung: 30, fertig: 15 },
}: Props) {
  const alarme = orders
    .map((o) => {
      const minSeitBestellt = minutenSeit(o.bestellt_am);
      const minSeitFertig = minutenSeit(o.fertig_am);

      if (o.status === 'neu' && minSeitBestellt >= schwellenwertMin.neu) {
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? '?',
          kundeName: o.kunde_name ?? 'Kunde',
          zone: o.zone ?? o.delivery_zone ?? null,
          phase: 'NEU' as const,
          warteMin: minSeitBestellt,
          schwelle: schwellenwertMin.neu,
          icon: Package,
          color: 'red' as const,
        };
      }
      if (o.status === 'in_zubereitung' && minSeitBestellt >= schwellenwertMin.zubereitung) {
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? '?',
          kundeName: o.kunde_name ?? 'Kunde',
          zone: o.zone ?? o.delivery_zone ?? null,
          phase: 'ZUBEREITUNG' as const,
          warteMin: minSeitBestellt,
          schwelle: schwellenwertMin.zubereitung,
          icon: ChefHat,
          color: 'amber' as const,
        };
      }
      if (o.status === 'fertig' && minSeitFertig >= schwellenwertMin.fertig) {
        return {
          id: o.id,
          bestellnummer: o.bestellnummer ?? '?',
          kundeName: o.kunde_name ?? 'Kunde',
          zone: o.zone ?? o.delivery_zone ?? null,
          phase: 'FERTIG – KEIN FAHRER' as const,
          warteMin: minSeitFertig,
          schwelle: schwellenwertMin.fertig,
          icon: Truck,
          color: 'red' as const,
        };
      }
      return null;
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)
    .sort((a, b) => b.warteMin - a.warteMin);

  if (alarme.length === 0) return null;

  const criticalCount = alarme.filter((a) => a.color === 'red').length;

  return (
    <div
      className={cn(
        'rounded-2xl border-2 overflow-hidden',
        criticalCount > 0 ? 'border-red-300' : 'border-amber-200',
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between px-4 py-2.5',
          criticalCount > 0 ? 'bg-red-50' : 'bg-amber-50',
        )}
      >
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn('h-4 w-4', criticalCount > 0 ? 'text-red-500 animate-pulse' : 'text-amber-500')}
          />
          <span
            className={cn('text-xs font-black', criticalCount > 0 ? 'text-red-800' : 'text-amber-800')}
          >
            Warte-Alarm
          </span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
            )}
          >
            {alarme.length} Alarm{alarme.length !== 1 ? 'e' : ''}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-stone-400">
          <Clock className="h-3 w-3" />
          <span>Live</span>
        </div>
      </div>

      {/* Alarm list */}
      <div className="divide-y divide-stone-50 bg-white">
        {alarme.slice(0, 6).map((alarm) => {
          const Icon = alarm.icon;
          const overMin = alarm.warteMin - alarm.schwelle;
          const severity = overMin > alarm.schwelle ? 'critical' : 'warn';
          return (
            <div key={alarm.id} className="flex items-center gap-3 px-4 py-2.5">
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  alarm.color === 'red'
                    ? severity === 'critical'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-red-50 text-red-500'
                    : 'bg-amber-50 text-amber-500',
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-800">#{alarm.bestellnummer}</span>
                  {alarm.zone && (
                    <span className="rounded bg-stone-100 px-1 py-0.5 text-[9px] font-bold text-stone-500">
                      Zone {alarm.zone}
                    </span>
                  )}
                  <span
                    className={cn(
                      'rounded px-1 py-0.5 text-[9px] font-black',
                      alarm.color === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                    )}
                  >
                    {alarm.phase}
                  </span>
                </div>
                <div className="text-[10px] text-stone-500 truncate mt-0.5">{alarm.kundeName}</div>
              </div>
              <div className="text-right shrink-0">
                <div
                  className={cn(
                    'text-sm font-black tabular-nums',
                    alarm.color === 'red' ? 'text-red-600' : 'text-amber-600',
                  )}
                >
                  {alarm.warteMin} Min
                </div>
                <div className="text-[9px] text-stone-400">+{overMin} über Limit</div>
              </div>
            </div>
          );
        })}
      </div>

      {alarme.length > 6 && (
        <div className="px-4 py-2 bg-stone-50 text-center text-[10px] text-stone-400 border-t border-stone-100">
          +{alarme.length - 6} weitere Alarme
        </div>
      )}
    </div>
  );
}
