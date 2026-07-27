'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, Clock, Bike, CheckCircle, Package, ChefHat, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

type Phase = 'eingang' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

interface EtaData {
  order_id: string | null;
  status: Phase;
  eta_min: number | null;
  eta_min_low: number | null;
  eta_min_high: number | null;
  fahrer_name: string | null;
  fahrer_distanz_km: number | null;
  letzte_aktualisierung: string | null;
  bestellnummer: string | null;
}

const PHASEN: { key: Phase; label: string; icon: React.ElementType }[] = [
  { key: 'eingang', label: 'Eingang', icon: Package },
  { key: 'zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'bereit', label: 'Bereit', icon: CheckCircle },
  { key: 'unterwegs', label: 'Unterwegs', icon: Bike },
  { key: 'geliefert', label: 'Geliefert', icon: MapPin },
];

const PHASE_ORDER: Phase[] = ['eingang', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function phaseIndex(p: Phase) { return PHASE_ORDER.indexOf(p); }

const MOCK: EtaData = {
  order_id: null,
  status: 'unterwegs',
  eta_min: 8,
  eta_min_low: 6,
  eta_min_high: 11,
  fahrer_name: 'Max M.',
  fahrer_distanz_km: 1.8,
  letzte_aktualisierung: new Date().toISOString(),
  bestellnummer: '#1042',
};

interface Props { orderId: string | null; }

export function Phase4150DynamischeEtaLiveTracking({ orderId }: Props) {
  const [data, setData] = useState<EtaData>({ ...MOCK, order_id: orderId });
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) { setData(j); setLastUpdate(Date.now()); } }
    } catch { /* Mock */ }
  }, [orderId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const currentIdx = phaseIndex(data.status);
  const isGeliefert = data.status === 'geliefert';

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-stone-900 px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-white font-black text-sm">Live-Tracking</div>
          {data.bestellnummer && <div className="text-stone-400 text-[10px]">Bestellung {data.bestellnummer}</div>}
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      </div>

      <div className="p-4 space-y-4">
        {/* ETA-Ring */}
        {!isGeliefert && data.eta_min !== null && (
          <div className="flex flex-col items-center py-2">
            <div className="relative w-28 h-28">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f5f4" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="#1c1917" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${264 * (1 - Math.min(1, data.eta_min / 60))} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-black text-stone-900">{data.eta_min}</div>
                <div className="text-[10px] text-stone-500 font-medium">min</div>
              </div>
            </div>
            {data.eta_min_low !== null && data.eta_min_high !== null && (
              <div className="text-[10px] text-stone-400 mt-1">
                Schätzung: {data.eta_min_low}–{data.eta_min_high} min
              </div>
            )}
          </div>
        )}

        {isGeliefert && (
          <div className="flex flex-col items-center py-4 space-y-2">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <div className="text-lg font-black text-stone-900">Geliefert!</div>
            <div className="text-sm text-stone-500">Guten Appetit 🍽️</div>
          </div>
        )}

        {/* Fahrer-Info */}
        {data.fahrer_name && !isGeliefert && (
          <div className="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
            <div className="w-9 h-9 rounded-full bg-stone-900 flex items-center justify-center flex-shrink-0">
              <Bike className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-stone-900">{data.fahrer_name}</div>
              {data.fahrer_distanz_km !== null && (
                <div className="text-[10px] text-stone-500">~{data.fahrer_distanz_km} km entfernt</div>
              )}
            </div>
          </div>
        )}

        {/* Phasen-Timeline */}
        <div className="space-y-0">
          {PHASEN.map((phase, idx) => {
            const done = idx < currentIdx;
            const active = idx === currentIdx;
            const Icon = phase.icon;
            const isLast = idx === PHASEN.length - 1;
            return (
              <div key={phase.key} className="flex gap-3">
                {/* Icon + Linie */}
                <div className="flex flex-col items-center">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                    done ? 'bg-stone-900' : active ? 'bg-stone-900 ring-2 ring-stone-300 ring-offset-2' : 'bg-stone-100',
                  )}>
                    <Icon className={cn('w-3.5 h-3.5', done || active ? 'text-white' : 'text-stone-400')} />
                  </div>
                  {!isLast && (
                    <div className={cn('w-0.5 h-5 my-0.5', done ? 'bg-stone-900' : 'bg-stone-100')} />
                  )}
                </div>
                {/* Label */}
                <div className={cn('flex items-start pt-1 pb-4', isLast && 'pb-0')}>
                  <span className={cn(
                    'text-xs',
                    done ? 'text-stone-400 line-through' :
                    active ? 'text-stone-900 font-bold' :
                    'text-stone-400',
                  )}>
                    {phase.label}
                    {active && data.status === 'unterwegs' && data.eta_min !== null && (
                      <span className="ml-1.5 text-[10px] text-stone-500 font-normal">~{data.eta_min} min</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Letzte Aktualisierung */}
        <div className="text-[9px] text-center text-stone-400">
          Zuletzt aktualisiert: {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
