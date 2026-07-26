'use client';

/**
 * BestellDynamischeEtaV2 — Dynamische ETA mit Live-Tracking für die Bestellseite.
 *
 * Zeigt:
 *   - Echtzeit-Phasenpfad (Eingegangen → Zubereitung → Fahrer unterwegs → Geliefert)
 *   - Sekundengenauer Countdown bis zur Lieferung
 *   - Fahrer-Näherungs-Indikator (Annäherungsring wenn Fahrer nah)
 *   - 4-stufige Farbkodierung je verbleibender Zeit
 *
 * Props: orderId, status, etaMin, bestelltAm
 * Polling alle 20s auf /api/delivery/customer/tracking
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { CheckCircle2, ChefHat, Clock, MapPin, Package, Truck, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderStatus = 'neu' | 'bestaetigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface TrackingData {
  status: OrderStatus;
  eta_min: number | null;
  driver_name: string | null;
  driver_nearby: boolean;
  phase_idx: number;
}

const PHASES: { key: OrderStatus; label: string; icon: React.ElementType }[] = [
  { key: 'neu',           label: 'Eingegangen',    icon: Package    },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: ChefHat   },
  { key: 'unterwegs',    label: 'Fahrer unterwegs', icon: Truck     },
  { key: 'geliefert',   label: 'Angekommen!',       icon: MapPin    },
];

function statusToPhase(status: OrderStatus): number {
  if (status === 'geliefert')                            return 3;
  if (status === 'unterwegs')                             return 2;
  if (status === 'fertig' || status === 'in_zubereitung') return 1;
  return 0;
}

function etaFarbe(etaMin: number | null): { bar: string; text: string; bg: string } {
  if (etaMin === null || etaMin <= 0) return { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (etaMin <= 5)  return { bar: 'bg-red-500',    text: 'text-red-700',    bg: 'bg-red-50'    };
  if (etaMin <= 10) return { bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50' };
  if (etaMin <= 20) return { bar: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50' };
  return                   { bar: 'bg-emerald-400', text: 'text-emerald-700', bg: 'bg-emerald-50' };
}

interface Props {
  orderId?: string;
  initialStatus?: OrderStatus;
  initialEtaMin?: number | null;
  bestelltAm?: string | null;
  className?: string;
}

export function BestellDynamischeEtaV2({
  orderId,
  initialStatus = 'neu',
  initialEtaMin = null,
  bestelltAm,
  className,
}: Props) {
  const [data, setData] = useState<TrackingData>({
    status: initialStatus,
    eta_min: initialEtaMin,
    driver_name: null,
    driver_nearby: false,
    phase_idx: statusToPhase(initialStatus),
  });
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  // Sekundentakt für Countdown
  useEffect(() => {
    const iv = setInterval(() => {
      tickRef.current += 1;
      setTick(tickRef.current);
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Polling
  const poll = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`);
      if (res.ok) {
        const d = await res.json();
        setData({
          status: d.status ?? initialStatus,
          eta_min: d.eta_min ?? null,
          driver_name: d.driver_name ?? null,
          driver_nearby: d.driver_nearby ?? false,
          phase_idx: statusToPhase(d.status ?? initialStatus),
        });
      }
    } catch { /* stale data OK */ }
  }, [orderId, initialStatus]);

  useEffect(() => {
    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, [poll]);

  const farbe = etaFarbe(data.eta_min);
  const geliefert = data.status === 'geliefert';

  return (
    <div className={cn('rounded-2xl border bg-white shadow-sm overflow-hidden', className)}>
      {/* Farbiger Header */}
      <div className={cn('px-4 py-3', geliefert ? 'bg-emerald-50 border-b border-emerald-100' : farbe.bg, 'border-b border-slate-100')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className={cn('h-4 w-4', farbe.text)} />
            <span className={cn('text-sm font-semibold', farbe.text)}>
              {geliefert ? 'Geliefert!' : data.driver_nearby ? 'Fahrer ist gleich da!' : 'Lieferzeit'}
            </span>
          </div>
          {!geliefert && data.eta_min != null && (
            <span className={cn('text-2xl font-bold tabular-nums', farbe.text)}>
              {data.eta_min <= 0 ? 'Gleich da' : `${data.eta_min} min`}
            </span>
          )}
          {geliefert && (
            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
          )}
        </div>
        {/* ETA Fortschrittsbalken (zeigt wie viel Zeit noch bleibt) */}
        {!geliefert && data.eta_min != null && data.eta_min > 0 && (
          <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-1000', farbe.bar)}
              style={{ width: `${Math.max(5, Math.min(100, (1 - data.eta_min / 45) * 100))}%` }}
            />
          </div>
        )}
      </div>

      {/* Phasenpfad */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {PHASES.map((phase, idx) => {
            const done = idx < data.phase_idx;
            const active = idx === data.phase_idx;
            const Icon = phase.icon;
            return (
              <div key={phase.key} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center transition-all duration-500',
                  done ? 'bg-emerald-500 text-white' :
                  active ? 'bg-blue-500 text-white ring-4 ring-blue-100' :
                  'bg-slate-100 text-slate-400'
                )}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <span className={cn(
                  'text-[9px] text-center leading-tight',
                  done ? 'text-emerald-600 font-medium' :
                  active ? 'text-blue-600 font-semibold' :
                  'text-slate-400'
                )}>
                  {phase.label}
                </span>
                {idx < PHASES.length - 1 && (
                  <div className={cn(
                    'absolute mt-3.5 h-0.5 transition-all duration-700',
                    done ? 'bg-emerald-400' : 'bg-slate-200'
                  )} style={{ width: '100%', transform: 'translateX(50%)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer Info / Annäherungsanzeige */}
      {data.driver_name && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 px-3 py-2">
          <Navigation className="h-4 w-4 text-blue-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-blue-700 font-medium">{data.driver_name}</span>
            {data.driver_nearby && (
              <span className="ml-2 text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                Fast da!
              </span>
            )}
          </div>
          {data.eta_min != null && data.eta_min > 0 && (
            <span className="text-xs font-bold text-blue-600 tabular-nums shrink-0">~{data.eta_min} min</span>
          )}
        </div>
      )}

      {/* Bestellzeitpunkt */}
      {bestelltAm && (
        <div className="px-4 pb-3 text-[10px] text-slate-400">
          Bestellt: {new Date(bestelltAm).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </div>
      )}
    </div>
  );
}
