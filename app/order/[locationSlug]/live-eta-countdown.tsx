'use client';

import { useEffect, useState } from 'react';
import { Clock, MapPin, CheckCircle2, Loader2, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  locationId?: string;
  initialStatus?: string | null;
  initialEtaMin?: number | null;
}

type TrackingStatus =
  | 'neu'
  | 'bestätigt'
  | 'in_zubereitung'
  | 'fertig'
  | 'unterwegs'
  | 'geliefert'
  | string;

const PHASE_CONFIG: Record<string, { label: string; emoji: string; pct: number; color: string }> = {
  neu:            { label: 'Bestellung eingegangen',    emoji: '📋', pct: 10,  color: 'bg-stone-400'  },
  bestätigt:      { label: 'Bestellung angenommen',    emoji: '✅', pct: 25,  color: 'bg-blue-400'   },
  in_zubereitung: { label: 'Wird zubereitet',          emoji: '👨‍🍳', pct: 55,  color: 'bg-amber-400'  },
  fertig:         { label: 'Bereit zur Abholung',      emoji: '📦', pct: 70,  color: 'bg-matcha-400' },
  unterwegs:      { label: 'Unterwegs zu dir!',        emoji: '🛵', pct: 88,  color: 'bg-matcha-500' },
  geliefert:      { label: 'Erfolgreich geliefert!',   emoji: '🎉', pct: 100, color: 'bg-matcha-600' },
};

function getPhase(status: string) {
  return PHASE_CONFIG[status] ?? PHASE_CONFIG.neu;
}

export function LiveEtaCountdown({ orderId, locationId, initialStatus, initialEtaMin }: Props) {
  const [status, setStatus] = useState<TrackingStatus>(initialStatus ?? 'neu');
  const [etaMin, setEtaMin] = useState<number | null>(initialEtaMin ?? null);
  const [remainSec, setRemainSec] = useState<number | null>(
    initialEtaMin != null ? initialEtaMin * 60 : null,
  );
  const [loading, setLoading] = useState(false);

  // Poll order status
  useEffect(() => {
    if (!orderId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/customer/tracking?order_id=${orderId}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.status) setStatus(data.status);
        if (typeof data.eta_min === 'number') {
          setEtaMin(data.eta_min);
          setRemainSec(data.eta_min * 60);
        }
      } catch {}
    };

    poll();
    const iv = setInterval(poll, 20_000);
    return () => clearInterval(iv);
  }, [orderId]);

  // Live countdown tick
  useEffect(() => {
    if (remainSec === null || status === 'geliefert') return;
    const iv = setInterval(() => {
      setRemainSec((s) => (s !== null && s > 0 ? s - 1 : s));
    }, 1_000);
    return () => clearInterval(iv);
  }, [remainSec, status]);

  const phase = getPhase(status);
  const isDelivered = status === 'geliefert';

  const fmtCountdown = (): string => {
    if (remainSec === null) return '';
    if (remainSec <= 0) return 'Jeden Moment…';
    const m = Math.floor(remainSec / 60);
    const s = remainSec % 60;
    if (m > 0) return `${m}:${String(s).padStart(2, '0')} Min`;
    return `${s} Sek`;
  };

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden transition-all',
        isDelivered
          ? 'border-matcha-300 bg-matcha-50'
          : 'border-stone-200 bg-white',
      )}
    >
      {/* Header */}
      <div className={cn('px-5 py-3 flex items-center gap-3', phase.color.replace('bg-', 'bg-') + '/10')}>
        <span className="text-2xl">{phase.emoji}</span>
        <div className="flex-1">
          <div className={cn('text-sm font-black', isDelivered ? 'text-matcha-800' : 'text-stone-800')}>
            {phase.label}
          </div>
          {!isDelivered && etaMin !== null && (
            <div className="text-[10px] text-stone-500">
              Geschätzte Lieferzeit: ~{etaMin} Min
            </div>
          )}
        </div>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-stone-400" />}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-stone-100">
        <div
          className={cn('h-full transition-all duration-1000', phase.color)}
          style={{ width: `${phase.pct}%` }}
        />
      </div>

      {/* Countdown */}
      {!isDelivered && remainSec !== null && remainSec > 0 && (
        <div className="flex items-center justify-center gap-3 px-5 py-4">
          <Clock className="h-5 w-5 text-matcha-600 shrink-0" />
          <div className="text-center">
            <div className="font-mono text-3xl font-black tabular-nums text-stone-800 leading-none">
              {fmtCountdown()}
            </div>
            <div className="text-[10px] text-stone-400 mt-1 uppercase tracking-wider font-semibold">
              {status === 'unterwegs' ? 'Fahrer unterwegs' : 'Verbleibende Zeit'}
            </div>
          </div>
        </div>
      )}

      {/* Delivered state */}
      {isDelivered && (
        <div className="flex items-center justify-center gap-2 px-5 py-4">
          <CheckCircle2 className="h-6 w-6 text-matcha-600" />
          <div>
            <div className="text-sm font-black text-matcha-800">Deine Bestellung ist angekommen!</div>
            <div className="text-[10px] text-matcha-600 mt-0.5">Guten Appetit 🍽️</div>
          </div>
        </div>
      )}

      {/* Phase steps */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between">
          {Object.entries(PHASE_CONFIG)
            .filter(([key]) => key !== 'neu')
            .map(([key, cfg], i, arr) => {
              const isCurrentOrPast = Object.keys(PHASE_CONFIG).indexOf(status) >=
                Object.keys(PHASE_CONFIG).indexOf(key);
              return (
                <div key={key} className="flex flex-col items-center gap-0.5 flex-1">
                  <div
                    className={cn(
                      'h-1.5 w-1.5 rounded-full transition-all',
                      isCurrentOrPast ? cfg.color : 'bg-stone-200',
                    )}
                  />
                  <span className={cn(
                    'text-[8px] font-semibold text-center leading-tight',
                    isCurrentOrPast ? 'text-stone-700' : 'text-stone-300',
                  )}>
                    {cfg.emoji}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
