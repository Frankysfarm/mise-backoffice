'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type Confidence = 'hoch' | 'mittel' | 'niedrig' | null;

interface Props {
  etaMin: number | null;
  confidence: Confidence;
  phase: 'preparing' | 'dispatched' | 'delivering' | 'delivered';
  orderId?: string;
}

const STEPS: { key: Props['phase']; label: string }[] = [
  { key: 'preparing', label: 'In Zubereitung' },
  { key: 'dispatched', label: 'Angenommen' },
  { key: 'delivering', label: 'Unterwegs' },
  { key: 'delivered', label: 'Geliefert' },
];

const PHASE_ORDER: Props['phase'][] = ['preparing', 'dispatched', 'delivering', 'delivered'];

function getStepStatus(stepPhase: Props['phase'], currentPhase: Props['phase']): 'done' | 'active' | 'pending' {
  const stepIdx = PHASE_ORDER.indexOf(stepPhase);
  const currentIdx = PHASE_ORDER.indexOf(currentPhase);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'active';
  return 'pending';
}

function confidenceBadge(confidence: Props['confidence']) {
  if (!confidence) return null;
  switch (confidence) {
    case 'hoch':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
          Hohe ETA-Genauigkeit
        </span>
      );
    case 'mittel':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
          Mittlere ETA-Genauigkeit
        </span>
      );
    case 'niedrig':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-500 text-xs font-medium">
          Niedrige ETA-Genauigkeit
        </span>
      );
  }
}

function etaText(etaMin: number | null, phase: Props['phase']): string {
  if (phase === 'delivered') return 'Geliefert ✓';
  if (etaMin == null) return 'Wird berechnet…';
  if (etaMin <= 0) return 'Jeden Moment!';
  return `Noch ca. ${etaMin} Min`;
}

export function EtaVertrauenWidget({ etaMin, confidence: confidenceProp, phase, orderId }: Props) {
  const [liveConfidence, setLiveConfidence] = useState<Confidence>(confidenceProp);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setLiveConfidence(confidenceProp);
  }, [confidenceProp]);

  useEffect(() => {
    if (!orderId || phase === 'delivered') return;

    const poll = () => {
      fetch(`/api/delivery/orders/${orderId}/eta-confidence`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d && d.confidence !== undefined) {
            setLiveConfidence(d.confidence as Confidence);
          }
        })
        .catch(() => {});
    };

    poll();
    timerRef.current = setInterval(poll, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [orderId, phase]);

  const confidence = liveConfidence;

  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-semibold text-gray-800">{etaText(etaMin, phase)}</p>
        {confidenceBadge(confidence)}
      </div>

      <div className="relative flex items-center justify-between">
        {STEPS.map((step, idx) => {
          const status = getStepStatus(step.key, phase);
          const isLast = idx === STEPS.length - 1;
          return (
            <div key={step.key} className="flex-1 flex flex-col items-center relative">
              {!isLast && (
                <div
                  className={cn(
                    'absolute top-3 left-1/2 w-full h-0.5',
                    status === 'done' ? 'bg-emerald-400' : 'bg-gray-200',
                  )}
                />
              )}
              <div
                className={cn(
                  'relative z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                  status === 'done'
                    ? 'bg-emerald-500 border-emerald-500'
                    : status === 'active'
                    ? 'bg-white border-matcha-500 animate-pulse'
                    : 'bg-white border-gray-200',
                )}
              >
                {status === 'done' && (
                  <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                {status === 'active' && (
                  <div className="w-2 h-2 rounded-full bg-matcha-500" />
                )}
              </div>
              <span
                className={cn(
                  'mt-1.5 text-[10px] text-center leading-tight px-0.5',
                  status === 'done'
                    ? 'text-emerald-600 font-medium'
                    : status === 'active'
                    ? 'text-gray-800 font-semibold'
                    : 'text-gray-400',
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
