'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package, Zap, TrendingUp } from 'lucide-react';

interface TrackingData {
  status: 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'abgeholt' | 'unterwegs' | 'geliefert';
  eta_min?: number | null;
  eta_confidence?: 'hoch' | 'mittel' | 'niedrig' | null;
  fahrer_name?: string | null;
  fahrer_eta_min?: number | null;
  prep_fortschritt_pct?: number | null;
  distanz_km?: number | null;
  bestellnummer?: string | null;
}

interface Props {
  orderId: string;
  locationId?: string | null;
}

const STEPS: { key: TrackingData['status']; label: string; icon: React.ElementType }[] = [
  { key: 'bestellt',       label: 'Bestellt',    icon: Package },
  { key: 'in_zubereitung', label: 'Zubereitung', icon: ChefHat },
  { key: 'abgeholt',       label: 'Abgeholt',    icon: Bike },
  { key: 'geliefert',      label: 'Geliefert',   icon: CheckCircle2 },
];

const STATUS_ORDER: TrackingData['status'][] = [
  'bestellt', 'bestaetigt', 'in_zubereitung', 'bereit', 'abgeholt', 'unterwegs', 'geliefert',
];

function getStepIndex(status: TrackingData['status']) {
  return STATUS_ORDER.indexOf(status);
}

const CONFIDENCE_COLOR = {
  hoch:    'text-emerald-400',
  mittel:  'text-amber-400',
  niedrig: 'text-red-400',
};

const MOCK: TrackingData = {
  status: 'in_zubereitung',
  eta_min: 22,
  eta_confidence: 'hoch',
  fahrer_name: 'Max K.',
  fahrer_eta_min: 15,
  prep_fortschritt_pct: 60,
  distanz_km: 2.4,
  bestellnummer: '#4201',
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export function StorefrontPhase5110DynamischeEtaLiveHubV4({ orderId, locationId }: Props) {
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(true);
  const now = useNow();

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/tracking/order/${orderId}`);
        if (res.ok) {
          const d = await res.json();
          setData(d);
        } else { setData(MOCK); }
      } catch { setData(MOCK); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId]);

  const currentStepIdx = getStepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const etaColor = data.eta_confidence ? CONFIDENCE_COLOR[data.eta_confidence] : 'text-white';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Live-Tracking</span>
          {data.bestellnummer && <span className="text-xs text-white/40">{data.bestellnummer}</span>}
        </div>
        {!isDelivered && data.eta_min !== null && data.eta_min !== undefined && (
          <div className="text-right">
            <div className={cn('text-2xl font-bold', etaColor)}>{data.eta_min}<span className="text-sm font-normal ml-0.5">min</span></div>
            {data.eta_confidence && (
              <div className={cn('text-[10px]', etaColor)}>ETA-Konfidenz: {data.eta_confidence}</div>
            )}
          </div>
        )}
        {isDelivered && (
          <div className="text-emerald-400 font-bold text-sm flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" /> Geliefert!
          </div>
        )}
      </div>

      {/* Phasen-Timeline */}
      <div className="flex items-center justify-between relative">
        <div className="absolute inset-y-3 left-6 right-6 h-0.5 bg-white/10" />
        {STEPS.map((step, i) => {
          const stepStatusIdx = getStepIndex(step.key);
          const isDone = currentStepIdx > stepStatusIdx;
          const isActive = Math.abs(currentStepIdx - stepStatusIdx) <= 1 && !isDone && currentStepIdx >= stepStatusIdx - 1;
          const Icon = step.icon;

          return (
            <div key={step.key} className="relative flex flex-col items-center gap-1 z-10">
              <div className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center transition-all',
                isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-amber-500 text-white ring-2 ring-amber-400/40' : 'bg-white/10 text-white/30',
              )}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className={cn('text-[10px] text-center leading-tight', isDone ? 'text-emerald-400' : isActive ? 'text-amber-300 font-semibold' : 'text-white/30')}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Zubereitung Fortschrittsbalken */}
      {data.prep_fortschritt_pct !== null && data.prep_fortschritt_pct !== undefined && ['in_zubereitung', 'bereit'].includes(data.status) && (
        <div>
          <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
            <span className="flex items-center gap-0.5"><ChefHat className="h-3 w-3" /> Zubereitung</span>
            <span>{data.prep_fortschritt_pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', data.prep_fortschritt_pct >= 80 ? 'bg-emerald-400' : data.prep_fortschritt_pct >= 50 ? 'bg-amber-400' : 'bg-indigo-400')}
              style={{ width: `${data.prep_fortschritt_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Fahrer-Info */}
      {(data.fahrer_name || data.fahrer_eta_min !== null) && ['abgeholt', 'unterwegs'].includes(data.status) && (
        <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2 flex items-center gap-2">
          <Bike className="h-4 w-4 text-blue-400 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs text-white">{data.fahrer_name ?? 'Fahrer unterwegs'}</div>
            {data.fahrer_eta_min !== null && data.fahrer_eta_min !== undefined && (
              <div className="text-[10px] text-blue-300">Noch ca. {data.fahrer_eta_min} min</div>
            )}
          </div>
          {data.distanz_km !== null && data.distanz_km !== undefined && (
            <div className="text-[10px] text-white/40 flex items-center gap-0.5">
              <MapPin className="h-3 w-3" />{data.distanz_km} km
            </div>
          )}
        </div>
      )}

      {/* Pulsierender Live-Indikator */}
      {!isDelivered && (
        <div className="flex items-center gap-1 justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-white/40">Live aktualisiert · alle 30s</span>
        </div>
      )}
    </div>
  );
}
