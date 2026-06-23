'use client';

/**
 * BestellPhaseCountdown — Phase 440
 * Zeigt dem Kunden den genauen Countdown bis zur geschätzten Lieferung
 * mit animierter Phasendarstellung (Küche → Unterwegs → Ankunft).
 * Polling alle 30s gegen /api/delivery/tracking/[bestellnummer].
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, Home, Clock } from 'lucide-react';

type Phase = 'kueche' | 'unterwegs' | 'ankunft' | 'geliefert';

interface TrackingData {
  status: string;
  etaMin: number | null;
  fahrerName?: string | null;
  phase: Phase;
}

const PHASE_META: Record<Phase, {
  icon: React.ElementType;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  kueche:    { icon: ChefHat, label: 'Wird zubereitet',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  unterwegs: { icon: Bike,    label: 'Unterwegs zu dir',  color: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200' },
  ankunft:   { icon: Bike,    label: 'Fast da!',          color: 'text-matcha-700', bg: 'bg-matcha-50', border: 'border-matcha-200' },
  geliefert: { icon: Home,    label: 'Geliefert!',        color: 'text-stone-700',  bg: 'bg-stone-50',  border: 'border-stone-200' },
};

function statusToPhase(status: string, etaMin: number | null): Phase {
  if (['geliefert', 'abgeholt', 'abgeschlossen'].includes(status)) return 'geliefert';
  if (['unterwegs'].includes(status)) return etaMin != null && etaMin <= 5 ? 'ankunft' : 'unterwegs';
  return 'kueche';
}

function useCountdown(etaMin: number | null) {
  const [secsLeft, setSecsLeft] = useState(() => (etaMin ?? 0) * 60);

  useEffect(() => {
    setSecsLeft((etaMin ?? 0) * 60);
  }, [etaMin]);

  useEffect(() => {
    if (secsLeft <= 0) return;
    const iv = setInterval(() => setSecsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, [secsLeft > 0]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  return { mins, secs, secsLeft };
}

export function BestellPhaseCountdown({
  bestellnummer,
  initialEtaMin,
  initialStatus = 'in_zubereitung',
  className,
}: {
  bestellnummer: string;
  initialEtaMin?: number | null;
  initialStatus?: string;
  className?: string;
}) {
  const [tracking, setTracking] = useState<TrackingData>({
    status: initialStatus,
    etaMin: initialEtaMin ?? null,
    phase: statusToPhase(initialStatus, initialEtaMin ?? null),
  });

  useEffect(() => {
    if (!bestellnummer) return;
    const poll = async () => {
      try {
        const r = await fetch(`/api/delivery/tracking/${encodeURIComponent(bestellnummer)}`);
        if (!r.ok) return;
        const d = await r.json();
        const phase = statusToPhase(d.status ?? initialStatus, d.eta_min ?? null);
        setTracking({ status: d.status, etaMin: d.eta_min ?? null, fahrerName: d.fahrer_name ?? null, phase });
      } catch {}
    };
    poll();
    const iv = setInterval(poll, 30_000);
    return () => clearInterval(iv);
  }, [bestellnummer]);

  const { mins, secs, secsLeft } = useCountdown(tracking.etaMin);
  const meta = PHASE_META[tracking.phase];
  const Icon = meta.icon;

  const phases: Phase[] = ['kueche', 'unterwegs', 'geliefert'];
  const currentIdx = phases.indexOf(tracking.phase === 'ankunft' ? 'unterwegs' : tracking.phase);

  return (
    <div className={cn('rounded-2xl border overflow-hidden', meta.bg, meta.border, className)}>
      {/* Phase-Schrittleiste */}
      <div className="flex items-center px-4 pt-4 pb-2 gap-0">
        {phases.map((ph, i) => {
          const pm = PHASE_META[ph];
          const PhIcon = pm.icon;
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={ph} className="flex items-center flex-1 last:flex-none">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 transition-all',
                done ? 'bg-matcha-500 border-matcha-500 text-white' :
                active ? 'bg-white border-matcha-500 text-matcha-600' :
                'bg-white border-stone-200 text-stone-300'
              )}>
                <PhIcon className="h-3.5 w-3.5" />
              </div>
              {i < phases.length - 1 && (
                <div className={cn('flex-1 h-0.5 mx-1 rounded-full', done ? 'bg-matcha-400' : 'bg-stone-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Status-Label */}
      <div className="px-4 pb-2">
        <div className={cn('text-xs font-bold uppercase tracking-wide', meta.color)}>
          {meta.label}
          {tracking.fahrerName && tracking.phase !== 'kueche' && (
            <span className="ml-1 font-normal normal-case tracking-normal opacity-75">
              · {tracking.fahrerName}
            </span>
          )}
        </div>
      </div>

      {/* Countdown */}
      {tracking.phase !== 'geliefert' && secsLeft > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-baseline gap-1">
            <Clock className="h-4 w-4 text-muted-foreground mb-0.5" />
            <span className="font-mono text-4xl font-black tabular-nums text-foreground">
              {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Geschätzte Restzeit
          </div>
          {/* Countdown-Balken */}
          <div className="mt-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                tracking.phase === 'kueche' ? 'bg-amber-400' : 'bg-matcha-500'
              )}
              style={{
                width: `${Math.max(2, 100 - (secsLeft / ((tracking.etaMin ?? 30) * 60)) * 100)}%`
              }}
            />
          </div>
        </div>
      )}

      {tracking.phase === 'geliefert' && (
        <div className="px-4 pb-4">
          <div className="text-2xl font-black text-stone-700">Guten Appetit! 🎉</div>
          <div className="text-xs text-muted-foreground mt-0.5">Deine Bestellung ist angekommen.</div>
        </div>
      )}
    </div>
  );
}
