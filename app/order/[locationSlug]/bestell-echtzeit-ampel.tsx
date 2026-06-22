'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  orderId?: string;
  status?: string;
  bestelltAm?: string;
  etaMin?: number;
  className?: string;
}

const STEPS = [
  { key: 'bestätigt', label: 'Bestätigt', color: 'bg-matcha-500' },
  { key: 'in_zubereitung', label: 'In Zubereitung', color: 'bg-amber-400' },
  { key: 'unterwegs', label: 'Unterwegs', color: 'bg-blue-500' },
] as const;

function getActiveStep(status?: string): number {
  if (!status) return 0;
  if (status === 'geliefert' || status === 'fertig' || status === 'unterwegs' || status === 'in_lieferung') return 2;
  if (status === 'in_zubereitung') return 1;
  return 0;
}

export function BestellEchtzeitAmpel({ status, bestelltAm, etaMin, className }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const { elapsed, remaining } = useMemo(() => {
    if (!bestelltAm) return { elapsed: null, remaining: null };
    const placed = new Date(bestelltAm).getTime();
    const elapsedMin = Math.floor((now - placed) / 60_000);
    const remaining = etaMin != null ? Math.max(0, etaMin - elapsedMin) : null;
    return { elapsed: elapsedMin, remaining };
  }, [bestelltAm, etaMin, now]);

  const activeStep = getActiveStep(status);

  return (
    <div className={cn('flex items-center gap-3 py-2', className)}>
      {STEPS.map((step, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                'h-4 w-4 rounded-full transition-all',
                isDone ? 'bg-matcha-400 opacity-60' : isActive ? `${step.color} ring-2 ring-offset-1 ring-current animate-pulse` : 'bg-gray-200'
              )} />
              <span className={cn('text-xs', isActive ? 'font-semibold text-matcha-900' : isDone ? 'text-matcha-500' : 'text-gray-400')}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('mb-4 flex-1 border-t-2 transition-colors', isDone ? 'border-matcha-400' : 'border-gray-200')} />
            )}
          </React.Fragment>
        );
      })}
      {(elapsed !== null || remaining !== null) && (
        <div className="ml-2 flex flex-col items-end text-right">
          {elapsed !== null && <span className="text-xs text-gray-500">{elapsed} Min. vergangen</span>}
          {remaining !== null && remaining > 0 && <span className="text-xs font-medium text-matcha-700">~{remaining} Min. noch</span>}
          {remaining === 0 && <span className="text-xs font-semibold text-matcha-600">Bald da!</span>}
        </div>
      )}
    </div>
  );
}
