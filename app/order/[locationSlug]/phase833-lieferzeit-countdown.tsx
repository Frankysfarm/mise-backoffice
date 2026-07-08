'use client';

import { useEffect, useState } from 'react';
import { Timer, Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string | null;
  etaEarliest: string | null;
  status: string | null;
  isDelivery: boolean;
}

function formatCountdown(secsLeft: number): { mins: number; secs: number; label: string } {
  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const label = secsLeft <= 0
    ? 'Jeden Moment!'
    : mins === 0
    ? `${secs} Sek.`
    : `${mins}:${secs.toString().padStart(2, '0')} Min`;
  return { mins, secs, label };
}

const ACTIVE_STATUSES = new Set([
  'bestätigt', 'confirmed', 'in_kitchen', 'ready', 'dispatched',
  'abgeholt', 'unterwegs', 'on_route', 'in_delivery', 'zubereitung',
]);

export function Phase833LieferzeitCountdown({ orderId, etaEarliest, status, isDelivery }: Props) {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);
  const [liveEtaIso, setLiveEtaIso] = useState<string | null>(etaEarliest);
  const [pollCount, setPollCount] = useState(0);

  // Poll for live ETA from API
  useEffect(() => {
    if (!orderId) return;
    const poll = async () => {
      try {
        const res = await fetch(`/api/delivery/tracking?order_id=${orderId}`);
        if (!res.ok) return;
        const d = await res.json();
        const eta =
          d.eta_earliest ??
          d.etaEarliest ??
          d.eta_iso ??
          null;
        if (eta) setLiveEtaIso(eta);
      } catch {}
      setPollCount(c => c + 1);
    };
    poll();
    const id = setInterval(poll, 30_000);
    return () => clearInterval(id);
  }, [orderId]);

  // Tick countdown every second
  useEffect(() => {
    const targetIso = liveEtaIso ?? etaEarliest;
    if (!targetIso) { setSecsLeft(null); return; }

    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setSecsLeft(diff);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [liveEtaIso, etaEarliest]);

  if (!isDelivery) return null;
  if (!status || !ACTIVE_STATUSES.has(status)) return null;
  if (status === 'delivered' || status === 'geliefert') return null;

  if (secsLeft === null) return null;

  const { label } = formatCountdown(secsLeft);
  const minsLeft = Math.floor(secsLeft / 60);
  const isUrgent = secsLeft < 5 * 60;
  const isArriving = secsLeft < 60;
  const isEnroute = ['abgeholt', 'unterwegs', 'on_route', 'in_delivery', 'dispatched'].includes(status ?? '');

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all',
      isArriving
        ? 'bg-matcha-100 border-matcha-400 dark:bg-matcha-950 dark:border-matcha-600'
        : isUrgent
        ? 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-600'
        : 'bg-card border-border'
    )}>
      <div className="flex items-center gap-2 mb-3">
        {isArriving
          ? <CheckCircle2 className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />
          : isEnroute
          ? <Bike className={cn('h-4 w-4', isUrgent ? 'text-amber-600' : 'text-matcha-600')} />
          : <Timer className="h-4 w-4 text-muted-foreground" />
        }
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          {isArriving ? 'Fahrer ist da!' : isEnroute ? 'Fahrer unterwegs' : 'Lieferung in'}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground opacity-60">
          Live {pollCount > 0 ? `· ${pollCount}×` : ''}
        </span>
      </div>

      {/* Großer Countdown */}
      <div className={cn(
        'text-center font-black tabular-nums leading-none',
        isArriving ? 'text-5xl text-matcha-600 dark:text-matcha-400' :
        isUrgent   ? 'text-5xl text-amber-600 dark:text-amber-400' :
                     'text-5xl text-foreground'
      )}>
        {isArriving ? '🎉' : label}
      </div>

      {isArriving && (
        <div className="text-center mt-1 text-sm font-semibold text-matcha-700 dark:text-matcha-300">
          Deine Bestellung kommt gleich an!
        </div>
      )}

      {/* Fortschrittsbalken */}
      {!isArriving && secsLeft > 0 && (() => {
        const totalSecs = minsLeft < 5 ? 5 * 60 : minsLeft < 15 ? 15 * 60 : 30 * 60;
        const pct = Math.max(2, Math.round((1 - secsLeft / totalSecs) * 100));
        return (
          <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                isUrgent ? 'bg-amber-500' : 'bg-matcha-500'
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
        );
      })()}

      <div className="mt-2 text-[10px] text-center text-muted-foreground">
        {liveEtaIso
          ? `ETA ${new Date(liveEtaIso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`
          : 'Geschätzte Ankunftszeit'}
      </div>
    </div>
  );
}
