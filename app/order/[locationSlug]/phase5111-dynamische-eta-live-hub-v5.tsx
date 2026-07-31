'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, CheckCircle2, ChefHat, Bike, Package, Zap, TrendingUp, Activity } from 'lucide-react';

interface TrackingData {
  status: 'bestellt' | 'bestaetigt' | 'in_zubereitung' | 'bereit' | 'abgeholt' | 'unterwegs' | 'geliefert';
  eta_min?: number | null;
  eta_confidence?: 'hoch' | 'mittel' | 'niedrig' | null;
  fahrer_name?: string | null;
  fahrer_eta_min?: number | null;
  prep_fortschritt_pct?: number | null;
  distanz_km?: number | null;
  bestellnummer?: string | null;
  fahrer_distanz_km?: number | null;
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
  hoch:    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Hohe Genauigkeit' },
  mittel:  { text: 'text-amber-400',   bg: 'bg-amber-500/10',   label: 'Mittlere Genauigkeit' },
  niedrig: { text: 'text-red-400',     bg: 'bg-red-500/10',     label: 'Niedrige Genauigkeit' },
};

const MOCK: TrackingData = {
  status: 'in_zubereitung',
  eta_min: 21,
  eta_confidence: 'hoch',
  fahrer_name: 'Max K.',
  fahrer_eta_min: 14,
  prep_fortschritt_pct: 65,
  distanz_km: 2.4,
  bestellnummer: '#4201',
  fahrer_distanz_km: 1.8,
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export function StorefrontPhase5111DynamischeEtaLiveHubV5({ orderId, locationId }: Props) {
  useNow();
  const [data, setData] = useState<TrackingData>(MOCK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}${locationId ? `&location_id=${locationId}` : ''}`);
        if (res.ok) {
          const json = await res.json();
          setData(json ?? MOCK);
        } else { setData(MOCK); }
      } catch { setData(MOCK); }
      finally { setLoading(false); }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [orderId, locationId]);

  const activeStepIdx = getStepIndex(data.status);
  const isDelivered = data.status === 'geliefert';
  const confidence = data.eta_confidence ? CONFIDENCE_COLOR[data.eta_confidence] : null;

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex items-center justify-center h-28">
        <span className="text-slate-400 text-sm animate-pulse">Lade Tracking-Daten…</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">
            {data.bestellnummer ? `Bestellung ${data.bestellnummer}` : 'Live-Tracking'}
          </span>
        </div>
        {!isDelivered && data.eta_min != null && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-lg font-bold text-white">{data.eta_min} Min</span>
          </div>
        )}
        {isDelivered && (
          <span className="flex items-center gap-1 text-emerald-400 text-sm font-semibold">
            <CheckCircle2 className="h-4 w-4" />Geliefert
          </span>
        )}
      </div>

      {/* ETA Confidence Banner */}
      {confidence && !isDelivered && (
        <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', confidence.bg, confidence.text)}>
          <TrendingUp className="h-3 w-3" />
          <span>{confidence.label}</span>
        </div>
      )}

      {/* 4-Step Phase Timeline */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const stepStatuses = STATUS_ORDER.filter((_, idx) => {
            const stepRanges = [[0, 1], [2, 3], [4, 5], [6, 6]];
            return idx >= (stepRanges[i]?.[0] ?? 0) && idx <= (stepRanges[i]?.[1] ?? 6);
          });
          const isDone = stepStatuses.some(s => getStepIndex(s) <= activeStepIdx && getStepIndex(s) >= 0);
          const isActive = stepStatuses.includes(data.status);

          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                  isActive  ? 'bg-indigo-500/30 border-2 border-indigo-400' :
                  isDone    ? 'bg-emerald-500/20 border border-emerald-500/40' :
                               'bg-white/5 border border-white/10'
                )}>
                  <StepIcon className={cn('h-3.5 w-3.5',
                    isActive ? 'text-indigo-400' : isDone ? 'text-emerald-400' : 'text-slate-500'
                  )} />
                </div>
                <span className={cn('text-[10px]', isActive ? 'text-indigo-400 font-semibold' : isDone ? 'text-emerald-400' : 'text-slate-500')}>
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 mb-4 mx-1', isDone && i < STEPS.length - 1 ? 'bg-emerald-400/40' : 'bg-white/10')} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Cook progress bar (only during preparation) */}
      {data.status === 'in_zubereitung' && data.prep_fortschritt_pct != null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-amber-400">
              <ChefHat className="h-3 w-3" />
              <span>Zubereitung</span>
            </div>
            <span className="text-amber-400 font-semibold">{data.prep_fortschritt_pct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${data.prep_fortschritt_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Driver proximity pulse (only when driver is on the way) */}
      {['abgeholt', 'unterwegs'].includes(data.status) && data.fahrer_name && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bike className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              <span className="text-xs font-semibold text-blue-300">{data.fahrer_name} ist unterwegs</span>
            </div>
            {data.fahrer_eta_min != null && (
              <span className="text-sm font-bold text-blue-400">{data.fahrer_eta_min} Min</span>
            )}
          </div>
          {data.fahrer_distanz_km != null && (
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <MapPin className="h-2.5 w-2.5" />
              <span>Noch {data.fahrer_distanz_km} km entfernt</span>
            </div>
          )}
          {/* Driver proximity progress */}
          {data.distanz_km != null && data.fahrer_distanz_km != null && (
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${Math.min(100, Math.round((1 - data.fahrer_distanz_km / data.distanz_km) * 100))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Delivered confirmation */}
      {isDelivered && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-300">Erfolgreich geliefert!</div>
            <div className="text-xs text-slate-400">Guten Appetit 🍽</div>
          </div>
        </div>
      )}

      <div className="text-[10px] text-slate-600 text-right">30-Sek-Polling · Mock-Fallback</div>
    </div>
  );
}
