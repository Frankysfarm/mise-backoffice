'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChefHat, Clock, MapPin, Package, Truck } from 'lucide-react';

/**
 * Phase 1851 — ETA Live-Tracking Hub (Biss-App Storefront)
 *
 * Dynamisches ETA-Tracking für Kunden nach Bestellabgabe:
 * - Live-Statusfortschritt mit animierten Phasen
 * - Echtzeit-Countdown bis Lieferung
 * - Fahrerdaten wenn verfügbar
 * - SSE/Polling für Live-Updates
 */

interface TrackingData {
  status: string;
  eta_earliest?: string | null;
  eta_latest?: string | null;
  driver_name?: string | null;
  stops_before?: number;
  driver_lat?: number | null;
  driver_lng?: number | null;
}

interface Props {
  orderId: string;
  bestellnummer: string;
  initialStatus?: string;
}

const PHASEN = [
  { key: 'neu',           icon: Package,   label: 'Eingegangen',    db: ['neu'] },
  { key: 'bestätigt',     icon: CheckCircle2, label: 'Bestätigt',   db: ['bestätigt'] },
  { key: 'in_zubereitung',icon: ChefHat,   label: 'In Zubereitung', db: ['in_zubereitung', 'fertig'] },
  { key: 'unterwegs',     icon: Bike,      label: 'Unterwegs',      db: ['unterwegs'] },
  { key: 'geliefert',     icon: CheckCircle2, label: 'Geliefert',   db: ['geliefert'] },
] as const;

function statusToPhase(status: string): number {
  for (let i = PHASEN.length - 1; i >= 0; i--) {
    if ((PHASEN[i].db as readonly string[]).includes(status)) return i;
  }
  return 0;
}

function EtaCountdownBadge({ eta_latest }: { eta_latest: string }) {
  const [sek, setSek] = useState(0);

  useEffect(() => {
    const update = () => {
      setSek(Math.max(0, Math.floor((new Date(eta_latest).getTime() - Date.now()) / 1000)));
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [eta_latest]);

  const m = Math.floor(sek / 60);
  const s = sek % 60;

  if (sek <= 0) return (
    <div className="flex flex-col items-center">
      <span className="font-black text-3xl text-matcha-700">Jeden Moment!</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center">
      <div className="font-mono font-black text-4xl text-matcha-800 tabular-nums leading-none">
        {m}:{String(s).padStart(2, '0')}
      </div>
      <div className="text-xs text-matcha-600 font-semibold mt-1">Minuten bis zur Lieferung</div>
    </div>
  );
}

export function BissPhase1851EtaLiveTrackingHub({ orderId, bestellnummer, initialStatus = 'neu' }: Props) {
  const [tracking, setTracking] = useState<TrackingData>({ status: initialStatus });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/orders/${orderId}`);
        if (!res.ok) return;
        const d = await res.json();
        setTracking({
          status: d.status ?? initialStatus,
          eta_earliest: d.eta_earliest ?? null,
          eta_latest: d.eta_latest ?? null,
          driver_name: d.driver_name ?? null,
          stops_before: d.stops_before ?? 0,
          driver_lat: d.driver_lat ?? null,
          driver_lng: d.driver_lng ?? null,
        });
      } catch {}
    };

    poll();
    timer = setInterval(poll, 15_000);
    return () => clearInterval(timer);
  }, [orderId, initialStatus]);

  const phaseIdx = statusToPhase(tracking.status);
  const aktuellePhase = PHASEN[phaseIdx];
  const geliefert = tracking.status === 'geliefert';

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* ETA-Countdown */}
      {!geliefert && tracking.eta_latest && (
        <div className="bg-matcha-50 border-b border-matcha-100 px-4 py-5 text-center">
          <EtaCountdownBadge eta_latest={tracking.eta_latest} />
          {tracking.stops_before !== undefined && tracking.stops_before > 0 && (
            <p className="text-[11px] text-matcha-600 mt-2">
              {tracking.stops_before} Lieferung{tracking.stops_before !== 1 ? 'en' : ''} vor dir
            </p>
          )}
        </div>
      )}

      {geliefert && (
        <div className="bg-matcha-50 border-b border-matcha-100 px-4 py-5 text-center">
          <CheckCircle2 className="h-10 w-10 text-matcha-600 mx-auto mb-2" />
          <p className="font-black text-xl text-matcha-700">Guten Appetit!</p>
          <p className="text-xs text-matcha-600 mt-1">Deine Bestellung wurde geliefert</p>
        </div>
      )}

      {/* Phasen-Timeline */}
      <div className="px-4 py-4">
        <div className="relative">
          {/* Verbindungslinie */}
          <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />

          <div className="space-y-4">
            {PHASEN.map((phase, i) => {
              const Icon = phase.icon;
              const erledigt = i < phaseIdx;
              const aktuell = i === phaseIdx;
              const ausstehend = i > phaseIdx;

              return (
                <div key={phase.key} className="flex items-center gap-3 relative">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all',
                    erledigt ? 'bg-matcha-500 text-white' :
                    aktuell ? 'bg-matcha-600 text-white ring-4 ring-matcha-100' :
                    'bg-gray-100 text-gray-400'
                  )}>
                    <Icon className={cn('h-4 w-4', aktuell && 'animate-pulse')} />
                  </div>
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm font-semibold',
                      erledigt ? 'text-gray-400' :
                      aktuell ? 'text-gray-900' :
                      'text-gray-400'
                    )}>
                      {phase.label}
                    </p>
                    {aktuell && phase.key === 'unterwegs' && tracking.driver_name && (
                      <p className="text-xs text-matcha-600 mt-0.5">
                        <Bike className="inline h-3 w-3 mr-1" />
                        Fahrer: {tracking.driver_name}
                      </p>
                    )}
                  </div>
                  {erledigt && (
                    <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
                  )}
                  {aktuell && (
                    <span className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
        <span className="font-mono">#{bestellnummer}</span>
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-matcha-500 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}
