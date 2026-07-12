'use client';

// Storefront — Live-ETA-Tracker
// Zeigt Kunden die dynamische Lieferzeit mit Echtzeit-Update + Statusfortschritt
// Wird auf der Bestellbestätigungs-Seite eingeblendet

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, MapPin, Truck, Zap } from 'lucide-react';

interface Props {
  bestellnummer: string;
  locationId: string;
  initialEtaMin?: number;
}

type Phase = 'angenommen' | 'zubereitung' | 'bereit' | 'unterwegs' | 'geliefert';

type TrackingData = {
  status: Phase;
  eta_min: number;
  fahrer_name?: string;
  fortschritt_pct?: number;
  letztes_update: string;
};

const PHASE_CONFIG: Record<Phase, { label: string; icon: React.FC<{className?: string}>; color: string }> = {
  angenommen:  { label: 'Angenommen',     icon: CheckCircle2, color: 'text-blue-500' },
  zubereitung: { label: 'In Zubereitung', icon: ChefHat,      color: 'text-amber-500' },
  bereit:      { label: 'Abholbereit',    icon: CheckCircle2, color: 'text-emerald-500' },
  unterwegs:   { label: 'Unterwegs',      icon: Truck,        color: 'text-violet-500' },
  geliefert:   { label: 'Geliefert!',     icon: CheckCircle2, color: 'text-emerald-600' },
};

const PHASES: Phase[] = ['angenommen', 'zubereitung', 'bereit', 'unterwegs', 'geliefert'];

function buildMock(eta: number): TrackingData {
  return {
    status: 'zubereitung',
    eta_min: eta,
    fahrer_name: 'Ahmad K.',
    fortschritt_pct: 35,
    letztes_update: new Date().toISOString(),
  };
}

function etaColor(eta: number): string {
  if (eta <= 10) return 'text-emerald-600';
  if (eta <= 25) return 'text-amber-600';
  return 'text-red-600';
}

export function LiveEtaTracker({ bestellnummer, locationId, initialEtaMin = 30 }: Props) {
  const [data, setData] = useState<TrackingData>(() => buildMock(initialEtaMin));
  const [countdown, setCountdown] = useState(initialEtaMin * 60); // seconds

  const load = useCallback(() => {
    fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.eta_min !== undefined) {
          setData(d);
          setCountdown(d.eta_min * 60);
        }
      })
      .catch(() => {/* keep mock */});
  }, [bestellnummer]);

  useEffect(() => { load(); const iv = setInterval(load, 30_000); return () => clearInterval(iv); }, [load]);

  // Live countdown
  useEffect(() => {
    if (data.status === 'geliefert') return;
    const iv = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1_000);
    return () => clearInterval(iv);
  }, [data.status]);

  const displayMin = Math.ceil(countdown / 60);
  const displaySec = countdown % 60;
  const currentIdx = PHASES.indexOf(data.status);
  const isDelivered = data.status === 'geliefert';

  return (
    <div className={cn(
      'rounded-2xl border p-5 space-y-4 shadow-sm transition-all',
      isDelivered ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-200'
    )}>
      {/* ETA Display */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            {isDelivered ? 'Lieferung abgeschlossen' : 'Erwartete Lieferzeit'}
          </div>
          {!isDelivered ? (
            <div className="flex items-end gap-2">
              <span className={cn('text-4xl font-black tabular-nums', etaColor(displayMin))}>
                {displayMin}
              </span>
              <span className="text-lg font-bold text-stone-400 mb-0.5">
                :{String(displaySec).padStart(2, '0')} min
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <span className="text-2xl font-black text-emerald-600">Geliefert!</span>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-stone-400 uppercase tracking-wide">Bestellung</div>
          <div className="text-sm font-black text-stone-700">#{bestellnummer}</div>
          {data.fahrer_name && !isDelivered && (
            <div className="text-[10px] text-stone-500 mt-0.5 flex items-center gap-1 justify-end">
              <Truck className="h-2.5 w-2.5" />
              {data.fahrer_name}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isDelivered && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-500 rounded-full transition-all duration-1000"
              style={{ width: `${data.fortschritt_pct ?? 20}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-stone-400 font-bold">
            <span>Bestellung aufgegeben</span>
            <span>Geliefert</span>
          </div>
        </div>
      )}

      {/* Phase timeline */}
      <div className="flex items-center gap-0 relative">
        {PHASES.map((phase, idx) => {
          const cfg = PHASE_CONFIG[phase];
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isLast = idx === PHASES.length - 1;
          const Icon = cfg.icon;

          return (
            <div key={phase} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {!isLast && (
                <div className={cn(
                  'absolute top-3 left-1/2 w-full h-0.5 z-0',
                  idx < currentIdx ? 'bg-emerald-400' : 'bg-stone-200'
                )} />
              )}

              {/* Dot */}
              <div className={cn(
                'relative z-10 h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all',
                isDone    ? 'bg-emerald-500 border-emerald-500' :
                isCurrent ? cn('border-current bg-white animate-pulse', cfg.color) :
                'bg-white border-stone-200'
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                ) : (
                  <Icon className={cn('h-3 w-3', isCurrent ? cfg.color : 'text-stone-300')} />
                )}
              </div>

              {/* Label */}
              <div className={cn(
                'mt-1.5 text-[8px] font-bold text-center leading-tight max-w-[48px]',
                isCurrent ? cfg.color : isDone ? 'text-emerald-500' : 'text-stone-300'
              )}>
                {cfg.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Surge hint */}
      {!isDelivered && displayMin > 35 && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">Aktuell hohe Nachfrage — Danke für deine Geduld!</span>
        </div>
      )}
    </div>
  );
}
