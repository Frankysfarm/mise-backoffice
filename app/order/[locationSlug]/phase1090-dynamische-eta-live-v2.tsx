'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, Truck, Zap, CheckCircle2, ChevronRight } from 'lucide-react';

interface Props {
  locationId?: string;
  orderId?: string;
  className?: string;
}

interface EtaData {
  eta_min?: number;
  eta_min_low?: number;
  eta_min_high?: number;
  load?: 'quiet' | 'normal' | 'busy';
  queue_signal?: string;
  eta_extension_min?: number;
  confidence?: number;
  drivers_online?: number;
  active_orders?: number;
}

function ConfidenceRing({ confidence }: { confidence: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, confidence / 100));
  const color = confidence >= 80 ? '#4a7c59' : confidence >= 60 ? '#d97706' : '#dc2626';
  return (
    <div className="relative w-12 h-12 shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3.5" />
        <circle
          cx="22" cy="22" r={r} fill="none"
          stroke={color} strokeWidth="3.5"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[9px] font-black tabular-nums" style={{ color }}>{Math.round(confidence)}%</span>
      </div>
    </div>
  );
}

const LOAD_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  quiet: { label: 'Ruhig', color: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200' },
  normal: { label: 'Normal', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  busy:  { label: 'Ausgelastet', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const LOAD_STEPS: Record<string, string[]> = {
  quiet: ['Bestellung eingegangen', 'Wird zubereitet', 'Fahrer in der Nähe', 'Lieferung unterwegs', 'Bald da!'],
  normal: ['Bestellung eingegangen', 'Zubereitung läuft', 'Fahrer zugewiesen', 'Lieferung unterwegs', 'Bald da!'],
  busy: ['Bestellung eingegangen', 'Küche ausgelastet', 'Fahrer zugewiesen', 'Lieferung unterwegs', 'Bald da!'],
};

export function OrderPhase1090DynamischeEtaLiveV2({ locationId, orderId, className }: Props) {
  const [data, setData] = useState<EtaData | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      fetch(`/api/delivery/eta/live?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setData(d); })
        .catch(() => {});
    };
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Simulate step progression based on eta
  useEffect(() => {
    if (!data?.eta_min) return;
    const eta = data.eta_min;
    // Rough heuristic: advance step every eta/4 minutes
    const stepDuration = (eta * 60_000) / 4;
    let step = 1;
    const tick = () => {
      step = Math.min(4, step + 1);
      setActiveStep(step);
    };
    const timers = [
      setTimeout(tick, stepDuration),
      setTimeout(tick, stepDuration * 2),
      setTimeout(tick, stepDuration * 3),
    ];
    return () => timers.forEach(clearTimeout);
  }, [data?.eta_min]);

  const eta = data?.eta_min ?? 35;
  const etaLow = data?.eta_min_low ?? eta - 5;
  const etaHigh = data?.eta_min_high ?? eta + 5;
  const confidence = data?.confidence ?? 75;
  const load = (data?.load ?? 'normal') as keyof typeof LOAD_LABELS;
  const loadStyle = LOAD_LABELS[load] ?? LOAD_LABELS.normal;
  const queueSignal = data?.queue_signal;
  const etaExt = data?.eta_extension_min ?? 0;
  const steps = LOAD_STEPS[load] ?? LOAD_STEPS.normal;

  return (
    <div className={cn('rounded-2xl border bg-white overflow-hidden shadow-sm', className)}>
      {/* ETA Display */}
      <div className="flex items-center gap-4 px-5 py-4 bg-gradient-to-r from-stone-50 to-white">
        <ConfidenceRing confidence={confidence} />
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Geschätzte Lieferzeit</div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-stone-900 tabular-nums leading-none">{eta}</span>
            <span className="text-base text-stone-500 font-semibold">min</span>
            <span className="text-xs text-stone-400 font-medium">({etaLow}–{etaHigh} min)</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5 border', loadStyle.color, loadStyle.bg, loadStyle.border)}>
              {loadStyle.label}
            </span>
            {data?.drivers_online != null && (
              <span className="flex items-center gap-1 text-[10px] text-stone-400">
                <Truck className="w-2.5 h-2.5" /> {data.drivers_online} Fahrer
              </span>
            )}
          </div>
        </div>

        {/* Pulse indicator */}
        <div className="shrink-0 flex flex-col items-center gap-1">
          <div className="relative">
            <div className="w-4 h-4 rounded-full bg-matcha-500" />
            <div className="absolute inset-0 rounded-full bg-matcha-400 animate-ping opacity-60" />
          </div>
          <span className="text-[8px] text-matcha-600 font-bold">Live</span>
        </div>
      </div>

      {/* Surge Warning */}
      {queueSignal === 'surge' && etaExt > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-t border-amber-200">
          <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 font-semibold">
            Hohe Nachfrage — Lieferzeit um +{etaExt} Min verlängert
          </span>
        </div>
      )}

      {/* Progress Steps */}
      <div className="px-4 py-3 border-t border-stone-100">
        <div className="flex items-center gap-0">
          {steps.map((step, idx) => {
            const isComplete = idx < activeStep;
            const isCurrent = idx === activeStep;
            const isLast = idx === steps.length - 1;
            return (
              <React.Fragment key={step}>
                <div className="flex flex-col items-center gap-1 min-w-0 flex-1">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                    isComplete ? 'bg-matcha-500' :
                    isCurrent ? 'bg-blue-500 ring-2 ring-blue-200' :
                    'bg-stone-200'
                  )}>
                    {isComplete ? (
                      <CheckCircle2 className="w-3 h-3 text-white" />
                    ) : isCurrent ? (
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[8px] text-center leading-tight font-medium',
                    isComplete ? 'text-matcha-600' :
                    isCurrent ? 'text-blue-600 font-bold' :
                    'text-stone-400'
                  )}>
                    {step}
                  </span>
                </div>
                {!isLast && (
                  <div className={cn(
                    'h-px flex-1 mb-4 transition-colors',
                    isComplete ? 'bg-matcha-400' : 'bg-stone-200'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
