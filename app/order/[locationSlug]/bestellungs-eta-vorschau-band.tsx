'use client';

import { useState, useEffect } from 'react';
import { Clock, Zap, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type EtaData = {
  etaMin: number;
  confidence: 'high' | 'medium' | 'low';
  surgeActive: boolean;
  driversOnline: number;
  queueDepth: number;
};

function getConfidenceColor(c: EtaData['confidence']) {
  if (c === 'high') return 'text-matcha-600';
  if (c === 'medium') return 'text-amber-600';
  return 'text-red-600';
}

function getEtaLabel(eta: number) {
  if (eta <= 20) return 'Schnell';
  if (eta <= 35) return 'Normal';
  return 'Erhöht';
}

export function BestellungsEtaVorschauBand({
  locationId,
  deliveryTimeMin,
}: {
  locationId: string;
  deliveryTimeMin: number;
}) {
  const [data, setData] = useState<EtaData | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!locationId) return;

    const load = () => {
      fetch(`/api/delivery/eta?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.eta_min || d.etaMin) {
            setData({
              etaMin: d.eta_min ?? d.etaMin ?? deliveryTimeMin,
              confidence: d.confidence ?? 'medium',
              surgeActive: d.surge_active ?? d.surgeActive ?? false,
              driversOnline: d.drivers_online ?? d.driversOnline ?? 0,
              queueDepth: d.queue_depth ?? d.queueDepth ?? 0,
            });
            setPulse(true);
            setTimeout(() => setPulse(false), 800);
          }
        })
        .catch(() => {
          setData({
            etaMin: deliveryTimeMin,
            confidence: 'medium',
            surgeActive: false,
            driversOnline: 0,
            queueDepth: 0,
          });
        });
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId, deliveryTimeMin]);

  const eta = data?.etaMin ?? deliveryTimeMin;
  const surge = data?.surgeActive ?? false;
  const confidence = data?.confidence ?? 'medium';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all duration-500',
        surge
          ? 'bg-amber-50 border-amber-200'
          : 'bg-matcha-50 border-matcha-200',
        pulse && 'scale-[1.01]',
      )}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          surge ? 'bg-amber-100' : 'bg-matcha-100',
        )}
      >
        {surge ? (
          <TrendingUp className="h-4 w-4 text-amber-600" />
        ) : (
          <Zap className="h-4 w-4 text-matcha-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span
            className={cn(
              'text-lg font-black tabular-nums leading-none',
              surge ? 'text-amber-700' : 'text-matcha-700',
            )}
          >
            {eta}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">Min</span>
          <span
            className={cn(
              'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
              surge
                ? 'bg-amber-100 text-amber-700'
                : eta <= 20
                ? 'bg-matcha-100 text-matcha-700'
                : 'bg-stone-100 text-stone-600',
            )}
          >
            {getEtaLabel(eta)}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {surge ? 'Hohe Nachfrage — etwas längere Wartezeit' : 'Geschätzte Lieferzeit'}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Clock className={cn('h-3.5 w-3.5', getConfidenceColor(confidence))} />
        <span className={cn('text-[11px] font-semibold', getConfidenceColor(confidence))}>
          {confidence === 'high' ? 'Genau' : confidence === 'medium' ? 'Ca.' : '±'}
        </span>
      </div>
    </div>
  );
}
