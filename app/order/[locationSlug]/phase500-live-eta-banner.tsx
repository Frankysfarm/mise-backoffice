'use client';

/**
 * Phase 500 — Live ETA Banner (Storefront / Tracking)
 *
 * Dynamischer ETA-Banner für die Bestell-Bestätigung und das Tracking:
 * - Sekundengenauer Countdown bis zur Lieferung
 * - Ampel-Farbkodierung (grün=pünktlich, amber=leichte Verzögerung, rot=überfällig)
 * - Pulsierender Lieferwagen-Fortschrittsbalken
 * - Automatische Status-Updates via Supabase Realtime
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, MapPin, Package, Truck } from 'lucide-react';

type DeliveryStatus =
  | 'neu' | 'bestätigt' | 'in_zubereitung' | 'fertig' | 'unterwegs' | 'geliefert' | 'storniert';

interface Props {
  orderId: string;
  etaLatest: string | null;
  etaEarliest?: string | null;
  status: DeliveryStatus;
  driverName?: string | null;
}

const STATUS_LABELS: Record<DeliveryStatus, string> = {
  neu:            'Bestellung eingegangen',
  bestätigt:      'Bestellung bestätigt',
  in_zubereitung: 'Wird zubereitet',
  fertig:         'Bereit für Abholung',
  unterwegs:      'Fahrer ist unterwegs',
  geliefert:      'Geliefert — Guten Appetit!',
  storniert:      'Bestellung storniert',
};

const STATUS_STEP: Record<DeliveryStatus, number> = {
  neu: 0, bestätigt: 1, in_zubereitung: 2, fertig: 3, unterwegs: 4, geliefert: 5, storniert: -1,
};

const STEPS: { key: DeliveryStatus; label: string; icon: typeof Package }[] = [
  { key: 'bestätigt',      label: 'Bestätigt',   icon: Package },
  { key: 'in_zubereitung', label: 'In Arbeit',    icon: Package },
  { key: 'fertig',         label: 'Fertig',       icon: Package },
  { key: 'unterwegs',      label: 'Unterwegs',    icon: Truck },
  { key: 'geliefert',      label: 'Geliefert',    icon: MapPin },
];

function useCountdownSec(isoTarget: string | null): number | null {
  const [sec, setSec] = useState<number | null>(null);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isoTarget) { setSec(null); return; }
    const update = () => setSec(Math.floor((new Date(isoTarget).getTime() - Date.now()) / 1000));
    update();
    ivRef.current = setInterval(update, 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [isoTarget]);
  return sec;
}

function fmtDuration(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  if (m >= 1)  return `${m}:${String(s).padStart(2, '0')} Min`;
  return `${s} Sek`;
}

export function Phase500LiveEtaBanner({ orderId, etaLatest, etaEarliest, status, driverName }: Props) {
  const sec = useCountdownSec(etaLatest);
  const currentStep = STATUS_STEP[status] ?? 0;

  if (status === 'geliefert') {
    return (
      <div className="rounded-xl border-2 border-matcha-300 bg-matcha-50 px-4 py-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha-500 text-white shrink-0">
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <div className="font-black text-matcha-800 text-sm">Geliefert — Guten Appetit! 🎉</div>
          <div className="text-xs text-matcha-600">Deine Bestellung wurde übergeben.</div>
        </div>
      </div>
    );
  }

  if (status === 'storniert') {
    return (
      <div className="rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 flex items-center gap-3">
        <Clock className="w-5 h-5 text-red-500 shrink-0" />
        <div className="text-sm font-black text-red-700">Bestellung storniert</div>
      </div>
    );
  }

  const isLate  = sec !== null && sec < 0;
  const isClose = sec !== null && sec >= 0 && sec < 300; // < 5 min
  const isOk    = sec === null || (sec >= 300);

  const bannerColor = isLate
    ? 'border-red-300 bg-red-50'
    : isClose
      ? 'border-amber-300 bg-amber-50'
      : 'border-matcha-200 bg-matcha-50/60';

  const countdownColor = isLate ? 'text-red-700' : isClose ? 'text-amber-700' : 'text-matcha-700';

  return (
    <div className={cn('rounded-xl border-2 overflow-hidden', bannerColor)}>
      {/* ETA strip */}
      <div className="px-4 py-3 flex items-center gap-3">
        <div className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full shrink-0',
          isLate ? 'bg-red-100' : isClose ? 'bg-amber-100' : 'bg-matcha-100',
        )}>
          <Truck className={cn('w-5 h-5', countdownColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-0.5">
            {STATUS_LABELS[status]}
          </div>
          {sec !== null && (
            <div className={cn('text-xl font-black tabular-nums leading-none', countdownColor)}>
              {isLate ? 'Leicht verzögert' : fmtDuration(sec)}
              {!isLate && (
                <span className="text-xs font-semibold text-stone-400 ml-1.5">verbleibend</span>
              )}
            </div>
          )}
          {sec === null && etaLatest && (
            <div className="text-sm font-bold text-stone-600">
              ETA: {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
            </div>
          )}
          {driverName && status === 'unterwegs' && (
            <div className="text-xs text-stone-500 mt-0.5">Fahrer: {driverName}</div>
          )}
        </div>
        {etaLatest && (
          <div className="text-right shrink-0">
            <div className="text-[9px] font-black uppercase text-stone-400">Bis</div>
            <div className="text-sm font-black text-stone-700 tabular-nums">
              {new Date(etaLatest).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1.5">
          {STEPS.map((step, idx) => {
            const done = currentStep > idx + 1;
            const active = currentStep === idx + 1;
            const future = currentStep < idx + 1;
            return (
              <div key={step.key} className="flex flex-col items-center flex-1">
                <div className={cn(
                  'w-full h-1 rounded-full',
                  idx === 0 ? 'rounded-l-full' : '',
                  idx === STEPS.length - 1 ? 'rounded-r-full' : '',
                  done || active ? (isLate ? 'bg-red-400' : isClose ? 'bg-amber-400' : 'bg-matcha-400') : 'bg-stone-200',
                )} />
                <span className={cn(
                  'text-[8px] font-bold mt-0.5 text-center',
                  done || active ? (isLate ? 'text-red-600' : isClose ? 'text-amber-600' : 'text-matcha-600') : 'text-stone-300',
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
