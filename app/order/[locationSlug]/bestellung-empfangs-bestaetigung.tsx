'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  bestellnummer: string;
  name: string;
  etaMinutes: number;
  isDelivery: boolean;
}

export function BestellungEmpfangsBestaetigung({ bestellnummer, name, etaMinutes, isDelivery }: Props) {
  const [phase, setPhase] = useState<'entering' | 'visible' | 'details'>('entering');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('visible'), 50);
    const t2 = setTimeout(() => setPhase('details'), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className={cn(
      'text-center transition-all duration-500',
      phase === 'entering' ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
    )}>
      {/* Checkmark animation */}
      <div className="flex justify-center mb-4">
        <div className={cn(
          'relative flex h-20 w-20 items-center justify-center rounded-full transition-all duration-500',
          phase === 'entering' ? 'bg-muted' : 'bg-matcha-100',
        )}>
          {/* Pulse rings */}
          {phase !== 'entering' && (
            <>
              <span className="absolute inset-0 rounded-full bg-matcha-200 animate-ping opacity-30" />
              <span className="absolute inset-2 rounded-full bg-matcha-300 animate-ping opacity-20 animation-delay-150" />
            </>
          )}
          <CheckCircle2 className={cn(
            'h-10 w-10 transition-all duration-300',
            phase === 'entering' ? 'text-muted-foreground opacity-0' : 'text-matcha-600',
          )} />
        </div>
      </div>

      {/* Message */}
      <div className={cn(
        'transition-all duration-500 delay-200',
        phase === 'details' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      )}>
        <h2 className="font-display text-2xl font-black text-foreground mb-1">
          Danke, {name.split(' ')[0]}!
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Deine Bestellung <strong>#{bestellnummer}</strong> ist eingegangen.
        </p>

        {isDelivery && etaMinutes > 0 && (
          <div className="mx-auto max-w-[240px] rounded-2xl bg-matcha-50 border border-matcha-200 px-5 py-3 mb-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-600 mb-0.5">
              Geschätzte Lieferzeit
            </div>
            <div className="text-3xl font-black tabular-nums text-matcha-800">
              {etaMinutes} Min
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-1 text-amber-400">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={cn(
                'h-4 w-4 fill-current transition-all duration-300',
                `delay-[${200 + i * 80}ms]`,
                phase === 'details' ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
              )}
            />
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Wir werden dich nach der Lieferung um eine Bewertung bitten
        </p>
      </div>
    </div>
  );
}
