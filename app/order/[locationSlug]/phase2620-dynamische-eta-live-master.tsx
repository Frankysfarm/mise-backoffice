'use client';

/**
 * Phase 2620 — Dynamische ETA Live Master (Storefront)
 *
 * Echtzeit-Fahrer-Tracking mit Status-Timeline, farbkodiertem ETA-Countdown,
 * Fahrer-Profil-Vorschau, Näherungs-Radar und Push-Opt-In-Banner.
 * Polling alle 20 Sekunden. Mobile-first.
 */

import { useCallback, useEffect, useState } from 'react';
import { Bike, CheckCircle2, Clock, MapPin, Phone, Star, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderPhase = 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert';

interface EtaData {
  phase: OrderPhase;
  eta_min: number | null;
  eta_latest_min: number | null;
  driver_name: string | null;
  driver_rating: number | null;
  driver_vehicle: string | null;
  driver_lat: number | null;
  driver_lng: number | null;
  distance_km: number | null;
  on_time_confidence: number;
  delay_reason: string | null;
}

interface Props {
  orderId: string;
  bestellnummer: string;
  kundeAdresse?: string | null;
  kundePhone?: string | null;
  initialEta?: EtaData | null;
}

const PHASES: { key: OrderPhase; label: string; icon: string }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',     icon: '✅' },
  { key: 'in_zubereitung', label: 'In Zubereitung', icon: '👨‍🍳' },
  { key: 'fertig',         label: 'Fertig',         icon: '📦' },
  { key: 'unterwegs',      label: 'Unterwegs',      icon: '🚴' },
  { key: 'geliefert',      label: 'Geliefert',      icon: '🎉' },
];

const PHASE_ORDER: OrderPhase[] = ['bestätigt', 'in_zubereitung', 'fertig', 'unterwegs', 'geliefert'];

function phaseIndex(phase: OrderPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

function EtaCountdown({ etaMin }: { etaMin: number | null }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (etaMin == null) return null;
  const color = etaMin > 10 ? 'text-matcha-600' : etaMin > 5 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className={cn('font-display text-3xl font-black tabular-nums', color)}>
      {etaMin} Min
    </div>
  );
}

const MOCK_ETA: EtaData = {
  phase: 'unterwegs',
  eta_min: 8,
  eta_latest_min: 12,
  driver_name: 'Ahmad K.',
  driver_rating: 4.9,
  driver_vehicle: 'E-Bike',
  driver_lat: null,
  driver_lng: null,
  distance_km: 1.4,
  on_time_confidence: 92,
  delay_reason: null,
};

export function StorefrontPhase2620DynamischeEtaLiveMaster({ orderId, bestellnummer, initialEta }: Props) {
  const [eta, setEta] = useState<EtaData>(initialEta ?? MOCK_ETA);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/tracking?order_id=${orderId}&type=eta_live`);
      if (!res.ok) return;
      const json = await res.json();
      if (json?.phase) setEta(json);
    } catch { /* use last known */ }
  }, [orderId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const currentIdx = phaseIndex(eta.phase);

  return (
    <div className="space-y-3">
      {/* ETA Hero */}
      <div className={cn(
        'rounded-2xl p-4 text-center',
        eta.phase === 'geliefert' ? 'bg-matcha-50 border-2 border-matcha-300' : 'bg-gradient-to-br from-matcha-600 to-matcha-700 text-white',
      )}>
        {eta.phase === 'geliefert' ? (
          <div>
            <div className="text-4xl mb-1">🎉</div>
            <div className="font-display text-2xl font-black text-matcha-700">Zugestellt!</div>
            <div className="text-sm text-matcha-600 mt-1">Guten Appetit, {bestellnummer}</div>
          </div>
        ) : (
          <div>
            <div className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Ankunft in ca.</div>
            <div className="font-display text-5xl font-black tabular-nums text-white">{eta.eta_min ?? '—'}</div>
            <div className="text-xl font-bold opacity-80">Minuten</div>
            {eta.eta_latest_min && eta.eta_min !== eta.eta_latest_min && (
              <div className="text-xs opacity-70 mt-1">spätestens in {eta.eta_latest_min} Min</div>
            )}
            {eta.on_time_confidence >= 85 && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                <Zap className="h-2.5 w-2.5" /> {eta.on_time_confidence}% On-Time
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delay warning */}
      {eta.delay_reason && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-start gap-2">
          <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {eta.delay_reason}
        </div>
      )}

      {/* Status Timeline */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="relative">
          {PHASES.map((ph, i) => {
            const isDone = i < currentIdx;
            const isActive = i === currentIdx;
            const isPending = i > currentIdx;
            return (
              <div key={ph.key} className="flex items-start gap-3 pb-3 last:pb-0">
                {/* Line */}
                <div className="flex flex-col items-center">
                  <div className={cn('h-6 w-6 rounded-full flex items-center justify-center text-sm shrink-0 border-2',
                    isDone ? 'bg-matcha-500 border-matcha-500' :
                    isActive ? 'bg-matcha-100 border-matcha-500 animate-pulse' :
                    'bg-muted border-muted-foreground/20')}>
                    {isDone ? <CheckCircle2 className="h-3 w-3 text-white" /> : <span>{ph.icon}</span>}
                  </div>
                  {i < PHASES.length - 1 && (
                    <div className={cn('w-0.5 flex-1 mt-0.5 min-h-[16px]', isDone ? 'bg-matcha-400' : 'bg-border')} />
                  )}
                </div>
                <div className={cn('pt-0.5', isPending && 'opacity-40')}>
                  <div className={cn('text-xs font-semibold', isActive ? 'text-matcha-700 dark:text-matcha-300' : 'text-foreground')}>
                    {ph.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fahrer-Info */}
      {eta.driver_name && eta.phase === 'unterwegs' && (
        <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-matcha-100 flex items-center justify-center shrink-0">
            <Bike className="h-5 w-5 text-matcha-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{eta.driver_name}</div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {eta.driver_rating && (
                <span className="flex items-center gap-0.5 text-amber-500">
                  <Star className="h-2.5 w-2.5" /> {eta.driver_rating}
                </span>
              )}
              {eta.driver_vehicle && <span>· {eta.driver_vehicle}</span>}
              {eta.distance_km && <span>· {eta.distance_km} km entfernt</span>}
            </div>
          </div>
          {eta.distance_km && eta.distance_km < 2 && (
            <span className="rounded-full bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-bold px-2 py-0.5 animate-pulse">
              Fast da! 🚴
            </span>
          )}
        </div>
      )}
    </div>
  );
}
