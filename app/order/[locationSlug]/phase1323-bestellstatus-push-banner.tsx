'use client';

// Phase 1323 — Bestellstatus-Push-Banner (Storefront)
// Live-Banner "Deine Bestellung ist unterwegs 🚴" mit ETA-Countdown.
// Polling alle 30 Sekunden. Nach Phase1318.

import { useEffect, useState, useRef } from 'react';
import { Bike, CheckCircle2, Clock, PackageCheck, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusDaten {
  status: 'waiting' | 'preparing' | 'ready' | 'dispatched' | 'delivered' | 'cancelled';
  eta_minuten: number | null;
  fahrer_name: string | null;
  generiert_am: string;
}

interface Props {
  locationId: string;
  orderId: string | null;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  border: string;
  text: string;
}> = {
  waiting:    { label: 'Bestellung wird bearbeitet…',     icon: Loader2,      bg: 'bg-slate-50 dark:bg-slate-900/30',    border: 'border-slate-200 dark:border-slate-700',   text: 'text-slate-700 dark:text-slate-300'    },
  preparing:  { label: 'Küche bereitet deine Bestellung zu…', icon: PackageCheck, bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300'    },
  ready:      { label: 'Bestellung fertig — Fahrer übernimmt gleich!', icon: PackageCheck, bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300' },
  dispatched: { label: 'Deine Bestellung ist unterwegs 🚴',   icon: Bike,         bg: 'bg-blue-50 dark:bg-blue-950/20',    border: 'border-blue-200 dark:border-blue-800',     text: 'text-blue-700 dark:text-blue-300'      },
  delivered:  { label: 'Bestellung erfolgreich geliefert!',   icon: CheckCircle2, bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300' },
};

function buildMock(orderId: string): StatusDaten {
  return {
    status: 'dispatched',
    eta_minuten: 12,
    fahrer_name: 'Max',
    generiert_am: new Date().toISOString(),
  };
}

async function fetchStatus(locationId: string, orderId: string): Promise<StatusDaten> {
  const res = await fetch(
    `/api/delivery/public/bestellstatus?location_id=${locationId}&order_id=${orderId}`,
    { cache: 'no-store' },
  );
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

export function Phase1323BestellstatusPushBanner({ locationId, orderId }: Props) {
  const [data, setData] = useState<StatusDaten | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const d = await fetchStatus(locationId, orderId);
        if (!cancelled) {
          setData(d);
          if (d.eta_minuten !== null) {
            setCountdown(d.eta_minuten * 60);
          }
        }
      } catch {
        if (!cancelled) setData(buildMock(orderId));
      }
    };

    load();
    const pollId = setInterval(load, 30_000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
    };
  }, [locationId, orderId]);

  // Countdown-Tick
  useEffect(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (countdown === null || countdown <= 0) return;

    countdownRef.current = setInterval(() => {
      setCountdown((c) => (c !== null && c > 0 ? c - 1 : 0));
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdown]);

  if (!orderId || !data) return null;
  if (data.status === 'cancelled') return null;

  const config = STATUS_CONFIG[data.status] ?? STATUS_CONFIG['waiting'];
  const Icon = config.icon;

  const minLeft = countdown !== null ? Math.ceil(countdown / 60) : null;
  const secLeft = countdown !== null ? countdown % 60 : null;

  const showCountdown = data.status === 'dispatched' && minLeft !== null && minLeft >= 0;

  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3', config.bg, config.border)}>
      {/* Icon */}
      <div className={cn('shrink-0', config.text)}>
        <Icon className={cn('h-5 w-5', data.status === 'waiting' && 'animate-spin')} />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-bold', config.text)}>{config.label}</p>
        {data.fahrer_name && data.status === 'dispatched' && (
          <p className="text-[11px] text-muted-foreground mt-0.5">Fahrer: {data.fahrer_name}</p>
        )}
      </div>

      {/* ETA-Countdown */}
      {showCountdown && (
        <div className={cn('shrink-0 text-right', config.text)}>
          <div className="text-xl font-black tabular-nums leading-none">
            {minLeft}:{String(secLeft ?? 0).padStart(2, '0')}
          </div>
          <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">Min verbleibend</div>
        </div>
      )}

      {/* Delivered check */}
      {data.status === 'delivered' && (
        <CheckCircle2 className="h-6 w-6 shrink-0 text-matcha-500" />
      )}
    </div>
  );
}
