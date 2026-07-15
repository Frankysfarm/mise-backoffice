'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, MapPin, Clock, CheckCircle2, Package, Navigation } from 'lucide-react';

type DeliveryPhase = 'confirmed' | 'preparing' | 'ready' | 'picked_up' | 'on_route' | 'delivered';

interface EtaTrackingData {
  orderNr: string;
  phase: DeliveryPhase;
  etaMin: number | null;
  prepStartedAt?: string | null;
  pickedUpAt?: string | null;
  driverName?: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  destinationAddress?: string;
  kitchenNote?: string | null;
  lastUpdated?: string;
}

interface Props {
  orderId?: string;
  data?: EtaTrackingData;
}

const PHASE_ORDER: DeliveryPhase[] = ['confirmed', 'preparing', 'ready', 'picked_up', 'on_route', 'delivered'];

const PHASE_CONFIG: Record<DeliveryPhase, { label: string; icon: React.ElementType; description: string }> = {
  confirmed:  { label: 'Bestätigt',      icon: CheckCircle2, description: 'Deine Bestellung wurde angenommen' },
  preparing:  { label: 'In Zubereitung', icon: ChefHat,       description: 'Die Küche bereitet dein Essen zu' },
  ready:      { label: 'Fertig',          icon: Package,       description: 'Essen fertig – wartet auf Abholung' },
  picked_up:  { label: 'Abgeholt',        icon: Bike,          description: 'Fahrer hat abgeholt' },
  on_route:   { label: 'Unterwegs',       icon: Navigation,    description: 'Fahrer ist auf dem Weg zu dir' },
  delivered:  { label: 'Zugestellt',      icon: MapPin,        description: 'Guten Appetit!' },
};

const MOCK_DATA: EtaTrackingData = {
  orderNr: '#1042',
  phase: 'on_route',
  etaMin: 8,
  driverName: 'Max',
  destinationAddress: 'Hauptstraße 12, Aachen',
  lastUpdated: new Date().toISOString(),
};

function useCountdown(etaMin: number | null): { mins: number; secs: number } {
  const [remaining, setRemaining] = useState(etaMin ? etaMin * 60 : 0);
  useEffect(() => {
    if (!etaMin) return;
    setRemaining(etaMin * 60);
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [etaMin]);
  return { mins: Math.floor(remaining / 60), secs: remaining % 60 };
}

export function Phase1736LiveEtaTrackingCockpit({ orderId, data = MOCK_DATA }: Props) {
  const [trackingData, setTrackingData] = useState<EtaTrackingData>(data);
  const { mins, secs } = useCountdown(trackingData.etaMin);

  useEffect(() => {
    if (!orderId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/order/${orderId}/tracking`);
        if (r.ok) {
          const d = await r.json();
          setTrackingData((prev) => ({ ...prev, ...d }));
        }
      } catch {/* use mock */}
    };
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  const currentPhaseIdx = PHASE_ORDER.indexOf(trackingData.phase);
  const isDelivered = trackingData.phase === 'delivered';

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm">
      {/* ETA Banner */}
      {!isDelivered && trackingData.etaMin !== null && (
        <div className="bg-gradient-to-r from-matcha-700 to-matcha-600 text-white px-5 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-bold opacity-80 uppercase tracking-wide">Geschätzte Lieferzeit</div>
            <div className="text-3xl font-black tabular-nums">
              {mins}<span className="text-xl font-bold opacity-70">:</span>
              <span className="text-xl">{String(secs).padStart(2, '0')}</span>
            </div>
            <div className="text-xs opacity-70">Min bis zur Lieferung</div>
          </div>
          {trackingData.driverName && (
            <div className="text-right">
              <div className="text-xs opacity-70">Dein Fahrer</div>
              <div className="text-base font-bold">{trackingData.driverName}</div>
              <div className="flex items-center gap-1 mt-1 text-[10px] opacity-70">
                <Bike className="h-3 w-3" />
                Unterwegs
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delivered banner */}
      {isDelivered && (
        <div className="bg-gradient-to-r from-matcha-700 to-matcha-600 text-white px-5 py-4 text-center">
          <CheckCircle2 className="h-8 w-8 mx-auto mb-1 opacity-90" />
          <div className="text-lg font-black">Zugestellt!</div>
          <div className="text-sm opacity-80">Guten Appetit 🍽️</div>
        </div>
      )}

      {/* Phase timeline */}
      <div className="px-5 py-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">
          Bestellung {trackingData.orderNr}
        </div>

        <div className="space-y-0">
          {PHASE_ORDER.map((phase, idx) => {
            const cfg = PHASE_CONFIG[phase];
            const Icon = cfg.icon;
            const isDone = idx < currentPhaseIdx;
            const isCurrent = idx === currentPhaseIdx;
            const isFuture = idx > currentPhaseIdx;
            const isLast = idx === PHASE_ORDER.length - 1;

            return (
              <div key={phase} className="flex items-start gap-3">
                {/* Icon + connector */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-500',
                    isDone ? 'bg-matcha-500 text-white' :
                    isCurrent ? 'bg-matcha-600 text-white ring-4 ring-matcha-200' :
                    'bg-stone-100 text-stone-400',
                  )}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {!isLast && (
                    <div className={cn(
                      'w-0.5 h-6 my-0.5 transition-all duration-700',
                      isDone ? 'bg-matcha-400' : 'bg-stone-200',
                    )} />
                  )}
                </div>

                {/* Text */}
                <div className={cn(
                  'flex-1 min-w-0 pt-1',
                  !isLast && 'pb-3',
                )}>
                  <div className={cn(
                    'text-sm font-bold',
                    isDone ? 'text-matcha-700' :
                    isCurrent ? 'text-foreground' :
                    'text-stone-400',
                  )}>
                    {cfg.label}
                    {isCurrent && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-matcha-500 animate-pulse align-middle" />}
                  </div>
                  {(isCurrent || isDone) && (
                    <div className={cn(
                      'text-xs mt-0.5',
                      isDone ? 'text-stone-400' : 'text-muted-foreground',
                    )}>
                      {cfg.description}
                    </div>
                  )}
                </div>

                {/* Timestamp placeholder */}
                {isDone && (
                  <div className="shrink-0 text-[9px] text-muted-foreground pt-2">✓</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kitchen note */}
      {trackingData.kitchenNote && (
        <div className="mx-5 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
          📝 {trackingData.kitchenNote}
        </div>
      )}

      {/* Destination */}
      {trackingData.destinationAddress && (
        <div className="mx-5 mb-4 flex items-start gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-matcha-500" />
          <span>{trackingData.destinationAddress}</span>
        </div>
      )}

      {/* Footer */}
      <div className="px-5 py-2.5 border-t border-stone-100 bg-stone-50">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" /> Echtzeit-Tracking
          </span>
          {trackingData.lastUpdated && (
            <span>
              Aktuell {new Date(trackingData.lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
