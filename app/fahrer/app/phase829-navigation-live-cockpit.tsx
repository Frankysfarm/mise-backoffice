'use client';

import { useEffect, useState } from 'react';
import { Navigation, MapPin, Clock, Gauge, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  reihenfolge: number;
  kunde_adresse?: string | null;
  eta_min?: number | null;
  geliefert_am?: string | null;
}

interface Props {
  currentStop: Stop | null;
  totalStops: number;
  completedStops: number;
  speedKmh?: number | null;
  distanceKm?: number | null;
}

export function FahrerPhase829NavigationLiveCockpit({
  currentStop,
  totalStops,
  completedStops,
  speedKmh,
  distanceKm,
}: Props) {
  const [tick, setTick] = useState(0);
  const [mockEta, setMockEta] = useState(7);

  useEffect(() => {
    const iv = setInterval(() => {
      setTick((n) => n + 1);
      setMockEta((prev) => Math.max(1, prev - Math.random() * 0.1));
    }, 5000);
    return () => clearInterval(iv);
  }, []);

  const etaMin = currentStop?.eta_min ?? Math.ceil(mockEta);
  const speed = speedKmh ?? Math.round(18 + Math.sin(tick) * 5);
  const dist = distanceKm ?? Number((1.2 - tick * 0.01).toFixed(1));
  const adresse = currentStop?.kunde_adresse ?? 'Bahnhofstr. 7, München';
  const remaining = totalStops - completedStops;

  const urgency = etaMin <= 2 ? 'kritisch' : etaMin <= 5 ? 'bald' : 'ok';

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      urgency === 'kritisch' ? 'border-red-300 animate-pulse' :
      urgency === 'bald' ? 'border-amber-300' : 'border-stone-200'
    )}>
      {/* Navigations-Header */}
      <div className={cn(
        'flex items-center gap-3 px-4 py-3',
        urgency === 'kritisch' ? 'bg-red-500 text-white' :
        urgency === 'bald' ? 'bg-amber-50 border-b border-amber-100' :
        'bg-blue-600 text-white'
      )}>
        <Navigation className={cn(
          'h-5 w-5 shrink-0',
          urgency !== 'ok' && urgency !== 'kritisch' ? 'text-amber-700' : ''
        )} />
        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-xs font-bold truncate',
            urgency === 'bald' ? 'text-amber-800' : ''
          )}>
            {adresse}
          </div>
          <div className={cn(
            'text-[10px]',
            urgency === 'bald' ? 'text-amber-600' : 'opacity-80'
          )}>
            Stopp {completedStops + 1} von {totalStops}
          </div>
        </div>
        <div className={cn(
          'shrink-0 text-right',
          urgency === 'bald' ? 'text-amber-800' : ''
        )}>
          <div className="text-2xl font-black tabular-nums leading-none">
            {etaMin}
          </div>
          <div className="text-[9px] font-medium opacity-80">Min ETA</div>
        </div>
      </div>

      {/* Live-Metriken */}
      <div className="grid grid-cols-3 divide-x divide-stone-100 bg-white border-b border-stone-100">
        <div className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Gauge className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400">Tempo</span>
          </div>
          <div className="text-lg font-black tabular-nums text-stone-700">{speed}</div>
          <div className="text-[9px] text-stone-400">km/h</div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <MapPin className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400">Entfernung</span>
          </div>
          <div className="text-lg font-black tabular-nums text-stone-700">
            {dist > 0 ? `${dist.toFixed(1)}` : '< 0.1'}
          </div>
          <div className="text-[9px] text-stone-400">km</div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="h-3 w-3 text-stone-400" />
            <span className="text-[9px] text-stone-400">Noch</span>
          </div>
          <div className="text-lg font-black tabular-nums text-stone-700">{remaining}</div>
          <div className="text-[9px] text-stone-400">Stopps</div>
        </div>
      </div>

      {/* Status-Hinweis */}
      <div className="px-4 py-2 bg-white">
        {urgency === 'kritisch' && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-bold">Fast da — bereit zur Übergabe!</span>
          </div>
        )}
        {urgency === 'bald' && (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">In ~{etaMin} Min ankommen</span>
          </div>
        )}
        {urgency === 'ok' && (
          <div className="flex items-center gap-2 text-matcha-600">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-xs font-medium">Navigation aktiv · auf Kurs</span>
          </div>
        )}
      </div>
    </div>
  );
}
